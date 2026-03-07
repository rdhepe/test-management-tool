require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const crypto = require('crypto');
const { pool, organizationOperations, moduleOperations, testFileOperations, executionOperations, testSuiteOperations, suiteTestFileOperations, suiteExecutionOperations, suiteTestResultOperations, testFileDependencyOperations, featureOperations, requirementOperations, testCaseOperations, manualTestRunOperations, defectOperations, defectCommentOperations, defectHistoryOperations, sprintOperations, taskOperations, taskCommentOperations, taskHistoryOperations, featureCommentOperations, featureHistoryOperations, requirementCommentOperations, requirementHistoryOperations, testCaseCommentOperations, testCaseHistoryOperations, sessionOperations, userOperations, customRoleOperations, wikiOperations, settingsOperations, globalVariableOperations, objectRepositoryOperations, orFolderOperations, enquiryOperations, platformFeedbackOperations, platformBugReportOperations, performanceOperations, perfFolderOperations, perfSuiteOperations } = require('./db');

// On Linux containers (Railway/Docker) there is no X display — always run headless.
// On Windows/Mac with a real display, 'headed' mode works for local development.
const FORCE_HEADLESS = process.platform !== 'win32' && !process.env.DISPLAY;

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3001;

// Allow test specs to import any package installed in server/node_modules without
// requiring a separate npm install inside the temp directory.
const SERVER_NODE_MODULES = path.join(__dirname, 'node_modules');
const nodePathEnv = process.env.NODE_PATH
  ? `${process.env.NODE_PATH}${path.delimiter}${SERVER_NODE_MODULES}`
  : SERVER_NODE_MODULES;

// Track the currently active debug process so we can kill it before starting a new one
let activeDebugProcess = null;

// ── Real-time CI log streaming ────────────────────────────────────────────────
// runLogs: executionId → { lines: string[], clients: Set<SSEResponse>, done: boolean }
const runLogs = new Map();

function pushLog(executionId, line) {
  const entry = runLogs.get(executionId);
  if (!entry || entry.done) return;
  entry.lines.push(line);
  for (const client of entry.clients) {
    try { client.write(`data: ${JSON.stringify(line)}\n\n`); } catch {}
  }
}

function finishLog(executionId) {
  const entry = runLogs.get(executionId);
  if (!entry) return;
  entry.done = true;
  for (const client of entry.clients) {
    try { client.write(`event: done\ndata: {}\n\n`); client.end(); } catch {}
  }
  // Keep buffer for 60 s so late-connecting clients can still replay it
  setTimeout(() => runLogs.delete(executionId), 60_000);
}

// Kill the active debug session including its full child process tree (Windows-safe)
function killDebugSession() {
  if (!activeDebugProcess) return;
  const pid = activeDebugProcess.pid;
  if (process.platform === 'win32' && pid) {
    exec(`taskkill /F /T /PID ${pid}`, () => {});
  } else {
    try { activeDebugProcess.kill('SIGKILL'); } catch {}
  }
  activeDebugProcess = null;
}

// Create reports directory if it doesn't exist
// Use DATA_DIR env var if set (Railway Volume), otherwise co-locate with server
const dataDir = process.env.DATA_DIR || __dirname;
const reportsDir = path.join(dataDir, 'reports');
fs.mkdir(reportsDir, { recursive: true }).catch(console.error);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Resolve session from token for every request (non-enforcing)
// Falls back to DB lookup so sessions survive server restarts even if the
// in-memory Map wasn't pre-populated (e.g. auth_sessions table race on boot).
app.use(async (req, res, next) => {
  const token = req.headers['x-auth-token'];
  if (token) {
    if (sessions.has(token)) {
      req.session = sessions.get(token);
    } else {
      // Token not in memory — try the persistent DB store
      try {
        const rows = await pool.query('SELECT * FROM auth_sessions WHERE token = $1', [token]);
        if (rows.rows.length > 0) {
          const row = rows.rows[0];
          const sessionData = {
            userId: row.user_id,
            username: row.username,
            role: row.role,
            orgId: row.org_id,
            customRoleId: row.custom_role_id,
            permissions: row.permissions ? JSON.parse(row.permissions) : null,
            customRoleName: row.custom_role_name,
          };
          sessions.set(token, sessionData); // re-hydrate in-memory map
          req.session = sessionData;
        }
      } catch (_) { /* DB unavailable — degrade gracefully */ }
    }
  }
  next();
});

// Serve reports directory statically
app.use('/reports', express.static(reportsDir));

// Serve Vite build output (production)
const distPath = path.join(__dirname, '..', 'dist');
if (require('fs').existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    const p = req.path;
    if (
      p.startsWith('/auth') || p.startsWith('/orgs') || p.startsWith('/reports') ||
      p.startsWith('/health') || p.startsWith('/modules') || p.startsWith('/executions') ||
      p.startsWith('/suites') || p.startsWith('/requirements') || p.startsWith('/features') ||
      p.startsWith('/test-cases') || p.startsWith('/manual-test-runs') || p.startsWith('/defects') ||
      p.startsWith('/sprints') || p.startsWith('/tasks') || p.startsWith('/wiki') ||
      p.startsWith('/settings') || p.startsWith('/global-variables') || p.startsWith('/roles') ||
      p.startsWith('/run-test') || p.startsWith('/run-suite') || p.startsWith('/stop-debug') ||
      p.startsWith('/install-package') || p.startsWith('/execution') || p.startsWith('/suite-execution') ||
      p.startsWith('/analytics') || p.startsWith('/test-suites') || p.startsWith('/test-files') ||
      p.startsWith('/test-file-dependencies') || p.startsWith('/public') ||
      p.startsWith('/release-readiness') || p.startsWith('/enquiries') ||
      p.startsWith('/search') ||
      p.startsWith('/object-repository') ||
      p.startsWith('/or-folders') ||
      p.startsWith('/platform-feedback') || p.startsWith('/platform-bug-reports') ||
      p.startsWith('/debug-session') || p.startsWith('/debug-migrate-globalvars') ||
      p.startsWith('/performance-tests') || p.startsWith('/performance-executions') ||
      p.startsWith('/perf-folders') || p.startsWith('/perf-suites') || p.startsWith('/perf-suite-executions') || p.startsWith('/perf-ai')
    ) return next();
    // Only serve the SPA shell for GET requests (browser navigation)
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Helper function to copy directory recursively
async function copyDirectory(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

// ===== Module Endpoints =====

// GET /modules - Get all modules
app.get('/modules', async (req, res) => {
  try {
    const orgId = req.session?.orgId || 1;
    const modules = await moduleOperations.getAll(orgId);
    res.json(modules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /modules - Create a new module
app.post('/modules', async (req, res) => {
  try {
    const orgId = req.session?.orgId || 1;
    const module = await moduleOperations.create(req.body, orgId);
    res.json(module);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /modules/:id - Get a module by ID
app.get('/modules/:id', async (req, res) => {
  try {
    const module = await moduleOperations.getById(req.params.id);
    if (!module) return res.status(404).json({ error: 'Module not found' });
    res.json(module);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /modules/:id - Update a module (including imports)
app.put('/modules/:id', async (req, res) => {
  try {
    const module = await moduleOperations.update(req.params.id, req.body);
    if (!module) return res.status(404).json({ error: 'Module not found' });
    res.json(module);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /modules/:id/imports - Update only the imports block for a module
app.patch('/modules/:id/imports', async (req, res) => {
  try {
    const { imports } = req.body;
    if (imports === undefined) return res.status(400).json({ error: 'imports field is required' });
    const module = await moduleOperations.update(req.params.id, { imports });
    if (!module) return res.status(404).json({ error: 'Module not found' });
    res.json(module);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /install-package — stream npm install output to the client via SSE so the
// user sees live logs instead of waiting for the whole install to finish.
app.post('/install-package', async (req, res) => {
  const { packageName } = req.body;
  if (!packageName || !packageName.trim()) {
    return res.status(400).json({ error: 'packageName is required' });
  }
  // Basic safety: only allow valid npm package name chars (including @scope/name and @version)
  const safe = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(@[\w.^~>=<|-]+)?$/i;
  if (!safe.test(packageName.trim())) {
    return res.status(400).json({ error: 'Invalid package name' });
  }

  // Stream response using SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.flushHeaders();

  const send = (type, text) => {
    res.write(`data: ${JSON.stringify({ type, text })}\n\n`);
  };

  send('log', `$ npm install ${packageName.trim()} --save --ignore-scripts`);

  const proc = spawn('npm', ['install', packageName.trim(), '--save', '--ignore-scripts'], {
    cwd: __dirname,
    shell: true,
  });

  proc.stdout.on('data', chunk => {
    chunk.toString().split('\n').forEach(line => { if (line.trim()) send('log', line); });
  });
  proc.stderr.on('data', chunk => {
    chunk.toString().split('\n').forEach(line => { if (line.trim()) send('log', line); });
  });
  proc.on('close', code => {
    if (code === 0) {
      send('done', `✅ ${packageName.trim()} installed successfully.`);
    } else {
      send('error', `❌ npm exited with code ${code}`);
    }
    res.end();
  });
  proc.on('error', err => {
    send('error', `❌ Failed to run npm: ${err.message}`);
    res.end();
  });
});

// DELETE /modules/:id - Delete a module
app.delete('/modules/:id', async (req, res) => {
  try {
    await moduleOperations.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Test File Endpoints =====

// GET /test-files - Get all test files across all modules
app.get('/test-files', async (req, res) => {
  try {
    const orgId = req.session?.orgId || 1;
    const testFiles = await testFileOperations.getAll(orgId);
    res.json(testFiles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /modules/:id/test-files - Get all test files for a module
app.get('/modules/:id/test-files', async (req, res) => {
  try {
    const testFiles = await testFileOperations.getByModuleId(req.params.id);
    res.json(testFiles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /test-files/smart-generate — Live-crawl pages with Playwright then generate script using real element data
app.post('/test-files/smart-generate', async (req, res) => {
  try {
    const orgId = req.session?.orgId || 1;
    const org = await organizationOperations.getById(orgId);
    if (org?.ai_healing_enabled !== 1)
      return res.status(403).json({ error: 'AI script generation is only available for AI-enabled organizations.' });
    const apiKey = org?.openai_api_key || process.env.OPENAI_API_KEY || '';
    if (!apiKey) return res.status(400).json({ error: 'No OpenAI API key configured.' });

    const { instruction, testName = 'generated test', currentContent = '' } = req.body;
    if (!instruction?.trim()) return res.status(400).json({ error: 'instruction is required.' });

    // ── Phase 1: extract URLs from the instruction ──────────────────────
    const parseRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: `Extract every URL (with full scheme) from the test description below. Add https:// if missing. Return ONLY a JSON array of strings — no markdown. If none found return [].\n\n${instruction.trim()}` }],
        temperature: 0, max_tokens: 300,
      }),
    });
    const parseData = await parseRes.json();
    const parseRaw = (parseData.choices?.[0]?.message?.content || '[]').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    let urls = [];
    try { const parsed = JSON.parse(parseRaw); if (Array.isArray(parsed)) urls = parsed; } catch {}

    // ── Phase 2: crawl each URL with Playwright ──────────────────────────
    const { chromium } = require('@playwright/test');
    const pageSnapshots = {};

    if (urls.length > 0) {
      let browser;
      try {
        browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          viewport: { width: 1280, height: 900 },
        });
        for (const url of urls.slice(0, 4)) {
          const page = await context.newPage();
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(1500);
            const title = await page.title().catch(() => '');
            const elements = await page.evaluate(() => {
              const seen = new Set();
              return Array.from(document.querySelectorAll(
                'a,button,input,select,textarea,[role="button"],[role="link"],[role="textbox"],[role="searchbox"],[role="combobox"],[role="menuitem"],label'
              ))
                .filter(el => {
                  const r = el.getBoundingClientRect();
                  return r.width > 0 && r.height > 0;
                })
                .slice(0, 150)
                .map(el => {
                  const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
                  const key = el.tagName + '|' + (el.id || el.getAttribute('name') || el.getAttribute('placeholder') || text).slice(0, 40);
                  if (seen.has(key)) return null;
                  seen.add(key);
                  return {
                    tag:         el.tagName.toLowerCase(),
                    type:        el.getAttribute('type') || '',
                    id:          el.id || '',
                    name:        el.getAttribute('name') || '',
                    placeholder: el.getAttribute('placeholder') || '',
                    text,
                    ariaLabel:   el.getAttribute('aria-label') || '',
                    role:        el.getAttribute('role') || '',
                    href:        el.tagName === 'A' ? (el.getAttribute('href') || '') : '',
                    dataTestId:  el.getAttribute('data-testid') || el.getAttribute('data-test-id') || el.getAttribute('data-cy') || '',
                  };
                })
                .filter(Boolean);
            });
            pageSnapshots[url] = { url, title, elements };
          } catch (err) {
            console.warn(`smart-generate crawl failed for ${url}:`, err.message);
            pageSnapshots[url] = { url, title: '', elements: [], error: err.message };
          } finally {
            await page.close().catch(() => {});
          }
        }
        await context.close().catch(() => {});
      } catch (browserErr) {
        console.warn('smart-generate browser error:', browserErr.message);
      } finally {
        if (browser) await browser.close().catch(() => {});
      }
    }

    // ── Phase 3: build prompt with real element data → generate code ─────
    const elementContext = Object.values(pageSnapshots)
      .filter(p => p.elements?.length > 0)
      .map(p => {
        const rows = p.elements.map(e => {
          const parts = [
            e.tag,
            e.type        && `type="${e.type}"`,
            e.id          && `id="${e.id}"`,
            e.name        && `name="${e.name}"`,
            e.placeholder && `placeholder="${e.placeholder}"`,
            e.ariaLabel   && `aria-label="${e.ariaLabel}"`,
            e.role        && `role="${e.role}"`,
            e.dataTestId  && `data-testid="${e.dataTestId}"`,
            e.text        && `text="${e.text}"`,
          ].filter(Boolean).join(' ');
          return `  <${parts}>`;
        }).join('\n');
        return `PAGE: ${p.url} (title: "${p.title}")\nINTERACTIVE ELEMENTS (${p.elements.length} found):\n${rows}`;
      }).join('\n\n');

    const totalElements = Object.values(pageSnapshots).reduce((s, p) => s + (p.elements?.length || 0), 0);

    const prompt = `You are an expert Playwright automation engineer. Generate Playwright step code for the INSIDE of a test function body ONLY.

${elementContext ? `LIVE-CRAWLED PAGE DATA — Use these REAL element attributes for your locators. Do NOT invent selectors that are not present below.\n\n${elementContext}\n\n` : ''}\
CRITICAL RULES:
1. Do NOT include import statements. Do NOT include a test() wrapper.
2. Use the crawled element data above to build locators: prefer getByRole, getByLabel, getByPlaceholder, getByText, getByTestId — match aria-label, placeholder, text, id, name, or data-testid exactly as shown in the crawl data.
3. Always await every Playwright call.
4. Add clear inline comments for each logical block.
5. Include meaningful expect() assertions.
6. Use page.waitForLoadState('networkidle') after navigations.
${currentContent ? `EXISTING FILE CONTENT:\n\`\`\`\n${currentContent.slice(0, 2000)}\n\`\`\`` : ''}

USER INSTRUCTION: ${instruction.trim()}

Return ONLY valid JSON (no markdown):
{ "script": "<step code only>", "extraImports": "", "npmNote": "" }`;

    const genRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }], temperature: 0.1, max_tokens: 4000 }),
    });
    if (!genRes.ok) {
      const errText = await genRes.text();
      return res.status(502).json({ error: `OpenAI error ${genRes.status}: ${errText.slice(0, 200)}` });
    }
    const genData = await genRes.json();
    const raw = (genData.choices?.[0]?.message?.content || '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    let result;
    try { result = JSON.parse(raw); } catch {
      return res.status(502).json({ error: 'AI returned invalid JSON.', raw });
    }
    res.json({
      script:        result.script || '',
      npmNote:       result.npmNote || '',
      extraImports:  result.extraImports || '',
      crawledUrls:   Object.keys(pageSnapshots),
      elementsFound: totalElements,
    });
  } catch (error) {
    console.error('smart-generate error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /test-files/generate-ai-script — Generate a Playwright script from natural language (AI orgs only)
app.post('/test-files/generate-ai-script', async (req, res) => {
  try {
    const orgId = req.session?.orgId || 1;
    const org = await organizationOperations.getById(orgId);
    if (org?.ai_healing_enabled !== 1) {
      return res.status(403).json({ error: 'AI script generation is only available for AI-enabled organizations.' });
    }
    const apiKey = org?.openai_api_key || process.env.OPENAI_API_KEY || '';
    if (!apiKey) return res.status(400).json({ error: 'No OpenAI API key configured for this organization.' });

    const { instruction, testName = 'generated test', currentContent = '' } = req.body;
    if (!instruction?.trim()) return res.status(400).json({ error: 'instruction is required.' });

    const prompt = `You are an expert Playwright automation engineer. Generate Playwright step code for the INSIDE of a test function body ONLY.

CRITICAL RULES — READ CAREFULLY:
1. Do NOT include any import statements in "script". The runtime already provides: page, request, browser, context, browserName, test, expect.
2. Do NOT include the test() wrapper — no test('...', async ...) line and no closing });
3. Generate ONLY the step code that goes inside the test body: await statements, assertions, variables, comments.
4. The runtime wraps your output automatically: test(name, async ({ page, request, browser, context, browserName }) => { YOUR_SCRIPT });
5. Use modern Playwright locator APIs: getByRole, getByLabel, getByPlaceholder, getByText, getByTestId — prefer over raw CSS/XPath.
6. Always await every Playwright call.
7. Add clear inline comments explaining each logical block.
8. Include meaningful assertions using expect().
9. Handle navigation load states with await page.waitForLoadState() or appropriate timeouts.
10. If you need a third-party npm package (NOT from @playwright/test), list its import statements in "extraImports" and package name(s) in "npmNote". The user must add these to their module imports config.

${currentContent ? `EXISTING FILE CONTENT (for context/reference):\n\`\`\`\n${currentContent.slice(0, 2000)}\n\`\`\`` : ''}

USER INSTRUCTION: ${instruction.trim()}

Return ONLY valid JSON (no markdown code fences):
{
  "script": "<step code only — no imports, no test() wrapper>",
  "extraImports": "<import statement(s) for any third-party packages needed, or empty string>",
  "npmNote": "<space-separated npm package names to install, or empty string>"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }], temperature: 0.15, max_tokens: 3500 }),
    });
    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: `OpenAI error ${response.status}: ${errText.slice(0, 200)}` });
    }
    const aiData = await response.json();
    const raw = aiData.choices?.[0]?.message?.content || '';
    const jsonStr = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let result;
    try { result = JSON.parse(jsonStr); } catch {
      return res.status(502).json({ error: 'AI returned invalid JSON.', raw });
    }

    res.json({ script: result.script || '', npmNote: result.npmNote || '' });
  } catch (error) {
    console.error('generate-ai-script error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /modules/:id/test-files - Create a new test file
app.post('/modules/:id/test-files', async (req, res) => {
  try {
    const orgId = req.session?.orgId || 1;
    const testFile = await testFileOperations.create({
      module_id: req.params.id,
      name: req.body.name,
      content: req.body.content,
      requirement_id: req.body.requirementId || null
    }, orgId);
    res.json(testFile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /test-files/:id - Update test file content
app.put('/test-files/:id', async (req, res) => {
  try {
    const updates = {};
    if (req.body.name !== undefined) {
      updates.name = req.body.name;
    }
    if (req.body.content !== undefined) {
      updates.content = req.body.content;
    }
    if (req.body.requirementId !== undefined) {
      updates.requirement_id = req.body.requirementId;
    }
    
    // Support legacy API (just passing content string)
    const updateData = Object.keys(updates).length > 0 ? updates : req.body.content;
    const testFile = await testFileOperations.update(req.params.id, updateData);
    res.json(testFile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /test-files/:id - Delete a test file
app.delete('/test-files/:id', async (req, res) => {
  try {
    await testFileOperations.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Test File Dependency Endpoints =====

// GET /test-files/:id/dependencies - Get all dependencies for a test file
app.get('/test-files/:id/dependencies', async (req, res) => {
  try {
    const dependencies = await testFileDependencyOperations.getByTestFileId(parseInt(req.params.id));
    res.json(dependencies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /test-files/:id/execution-order - Get execution order for a test file
app.get('/test-files/:id/execution-order', async (req, res) => {
  try {
    const executionOrder = await testFileDependencyOperations.getExecutionOrder(parseInt(req.params.id));
    res.json(executionOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /test-files/:id/dependencies - Add a dependency to a test file
app.post('/test-files/:id/dependencies', async (req, res) => {
  try {
    const { dependencyFileId, dependencyType, executionOrder } = req.body;
    
    if (!dependencyFileId || !dependencyType) {
      return res.status(400).json({ error: 'dependencyFileId and dependencyType are required' });
    }
    
    if (!['before', 'after'].includes(dependencyType)) {
      return res.status(400).json({ error: 'dependencyType must be either "before" or "after"' });
    }
    
    const dependency = await testFileDependencyOperations.add({
      test_file_id: parseInt(req.params.id),
      dependency_file_id: dependencyFileId,
      dependency_type: dependencyType,
      execution_order: executionOrder || 0
    });
    
    res.json(dependency);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /test-files/:id/dependencies - Remove a specific dependency
app.delete('/test-files/:id/dependencies', async (req, res) => {
  try {
    const { dependencyFileId, dependencyType } = req.body;
    
    if (!dependencyFileId || !dependencyType) {
      return res.status(400).json({ error: 'dependencyFileId and dependencyType are required' });
    }
    
    await pool.query(
      'DELETE FROM test_file_dependencies WHERE test_file_id = $1 AND dependency_file_id = $2 AND dependency_type = $3',
      [parseInt(req.params.id), dependencyFileId, dependencyType]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Execution Endpoints =====

// GET /executions - Get all executions
app.get('/executions', async (req, res) => {
  try {
    const orgId = req.session?.orgId || 1;
    const executions = await executionOperations.getAll(orgId);
    res.json(executions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /executions/stats - Get execution statistics
app.get('/executions/stats', async (req, res) => {
  try {
    const orgId = req.session?.orgId || 1;
    const executions = await executionOperations.getAll(orgId);
    
    const total = executions.length;
    const passed = executions.filter(e => e.status === 'PASS').length;
    const failed = executions.filter(e => e.status === 'FAIL').length;
    const passPercentage = total > 0 ? Math.round((passed / total) * 100) : 0;
    
    res.json({
      total,
      passed,
      failed,
      passPercentage
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /release-readiness - Aggregate quality metrics and compute a release readiness score
app.get('/release-readiness', async (req, res) => {
  try {
    const orgId = req.session?.orgId || 1;
    const orgCheck = await organizationOperations.getById(orgId);
    if (orgCheck?.ai_healing_enabled !== 1) return res.status(403).json({ error: 'Release Readiness is only available for AI-enabled organizations.' });

    // Latest completed suite run only (status is stored as 'PASS' or 'FAIL' by the runner)
    const seRes = await pool.query(
      `SELECT total_tests, passed, failed FROM suite_executions
       WHERE org_id = $1 AND status IN ('PASS', 'FAIL', 'completed') ORDER BY created_at DESC LIMIT 1`,
      [orgId]
    );
    const recentRuns = seRes.rows;
    const latestRun  = recentRuns[0] || null;
    const totalTests  = latestRun ? (parseInt(latestRun.total_tests, 10) || 0) : 0;
    const totalPassed = latestRun ? (parseInt(latestRun.passed, 10) || 0) : 0;
    const suitePassRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : null;

    // Defects grouped by severity + status
    const defRes = await pool.query(
      `SELECT severity, status, COUNT(*) as cnt FROM defects WHERE org_id = $1 GROUP BY severity, status`,
      [orgId]
    );
    const defectGroups = defRes.rows;

    const defOpen = (sev) => defectGroups
      .filter(d => d.severity === sev && d.status === 'Open')
      .reduce((s, d) => s + parseInt(d.cnt, 10), 0);

    const criticalOpen = defOpen('Critical');
    const highOpen     = defOpen('High');
    const mediumOpen   = defOpen('Medium');
    const totalOpen    = defectGroups.filter(d => d.status === 'Open').reduce((s, d) => s + parseInt(d.cnt, 10), 0);
    const totalClosed  = defectGroups.filter(d => d.status !== 'Open').reduce((s, d) => s + parseInt(d.cnt, 10), 0);

    // Active sprint
    const sprintRes = await pool.query(
      `SELECT * FROM sprints WHERE org_id = $1 AND status = 'Active' ORDER BY created_at DESC LIMIT 1`,
      [orgId]
    );
    const activeSprint = sprintRes.rows[0] || null;

    let sprintCompletion = null;
    let sprintTotalReqs  = 0;
    let sprintPassedTCs  = 0;
    if (activeSprint) {
      const [totalReqsRes, passedReqsRes] = await Promise.all([
        pool.query(`SELECT COUNT(*) as c FROM requirements WHERE sprint_id = $1`, [activeSprint.id]),
        pool.query(
          `SELECT COUNT(DISTINCT r.id) as c FROM requirements r
           INNER JOIN test_cases tc ON tc.requirement_id = r.id
           INNER JOIN manual_test_runs mtr ON mtr.test_case_id = tc.id
           WHERE r.sprint_id = $1 AND mtr.status IN ('Passed')
             AND mtr.created_at = (
               SELECT MAX(m2.created_at) FROM manual_test_runs m2 WHERE m2.test_case_id = tc.id
             )`,
          [activeSprint.id]
        )
      ]);
      sprintTotalReqs  = parseInt(totalReqsRes.rows[0].c, 10);
      sprintPassedTCs  = parseInt(passedReqsRes.rows[0].c, 10);
      sprintCompletion = sprintTotalReqs > 0 ? Math.min(100, Math.round((sprintPassedTCs / sprintTotalReqs) * 100)) : 0;
    }

    // Test cases with at least one execution (org-scoped correctly)
    const tcCoverageRes = await pool.query(
      `SELECT
         COUNT(DISTINCT tc.id) as total,
         COUNT(DISTINCT mtr.test_case_id) as executed
       FROM test_cases tc
       LEFT JOIN manual_test_runs mtr ON mtr.test_case_id = tc.id
       WHERE tc.org_id = $1`,
      [orgId]
    );
    const tcTotal    = parseInt(tcCoverageRes.rows[0].total, 10) || 0;
    const tcExecuted = parseInt(tcCoverageRes.rows[0].executed, 10) || 0;
    const tcCoverage = tcTotal > 0 ? Math.round((tcExecuted / tcTotal) * 100) : null;

    // Manual test run pass rate — always latest run per test case
    let manualPassRate = null;
    const manualRunRes = await pool.query(
      `SELECT test_case_id, status, created_at FROM manual_test_runs WHERE org_id = $1`,
      [orgId]
    );
    if (manualRunRes.rows.length > 0) {
      const latestByTc = {};
      manualRunRes.rows.forEach(r => {
        const prev = latestByTc[r.test_case_id];
        if (!prev || new Date(r.created_at) > new Date(prev.created_at)) latestByTc[r.test_case_id] = r;
      });
      const latestManual = Object.values(latestByTc);
      const mPassed = latestManual.filter(r => r.status === 'Passed').length;
      manualPassRate = latestManual.length > 0 ? Math.round((mPassed / latestManual.length) * 100) : null;
    }

    // ── Score computation (0-100) ────────────────────────────────────────
    let score = 20; // base

    // Manual test pass rate → 30 pts (always based on manual runs, independent of suite)
    if (manualPassRate !== null) score += Math.round((manualPassRate / 100) * 30);

    // Critical/High open defect penalty  → -15 each critical, -8 each high (cap -40)
    const defectPenalty = Math.min(40, criticalOpen * 15 + highOpen * 8);
    score -= defectPenalty;

    // Sprint test completion → 20 pts
    if (sprintCompletion !== null) score += Math.round((sprintCompletion / 100) * 20);

    // TC coverage bonus → up to 10 pts
    if (tcCoverage !== null) score += Math.round((tcCoverage / 100) * 10);

    // Automated suite bonus → up to 20 pts (latest run pass rate only)
    const suiteBonus = suitePassRate !== null ? Math.round((suitePassRate / 100) * 20) : 0;
    score += suiteBonus;

    score = Math.max(0, Math.min(100, score));

    const metrics = { score, manualPassRate, suitePassRate,
      recentRunCount: recentRuns.length, totalTests, totalPassed,
      criticalOpen, highOpen, mediumOpen, totalOpen, totalClosed,
      activeSprint: activeSprint ? { id: activeSprint.id, name: activeSprint.name } : null,
      sprintCompletion, sprintTotalReqs, sprintPassedTCs,
      tcTotal, tcExecuted, tcCoverage, suiteBonus };

    res.json(metrics);
  } catch (error) {
    console.error('release-readiness error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /release-readiness/ai-summary - AI-powered release readiness analysis
app.post('/release-readiness/ai-summary', async (req, res) => {
  try {
    const orgId = req.session?.orgId || 1;
    const org   = await organizationOperations.getById(orgId);
    if (org?.ai_healing_enabled !== 1) return res.status(403).json({ error: 'Release Readiness is only available for AI-enabled organizations.' });
    const apiKey = org?.openai_api_key || process.env.OPENAI_API_KEY || '';
    if (!apiKey) return res.status(400).json({ error: 'No OpenAI API key configured for this organization.' });

    const m = req.body.metrics || {};
    const prompt = `You are a QA release readiness expert. Based on the following metrics, produce a concise JSON analysis.

METRICS:
- Release Readiness Score: ${m.score ?? '?'} / 100
- Automated Suite Pass Rate (latest run): ${m.suitePassRate !== null && m.suitePassRate !== undefined ? `${m.suitePassRate}% (${m.totalPassed ?? 0}/${m.totalTests ?? 0} tests passed)` : 'No automated suite runs recorded'}
- Manual Test Run Pass Rate: ${m.manualPassRate !== null && m.manualPassRate !== undefined ? `${m.manualPassRate}% (latest run per test case)` : 'No data'}
- Open Critical Defects: ${m.criticalOpen ?? 0}
- Open High Defects: ${m.highOpen ?? 0}
- Open Medium Defects: ${m.mediumOpen ?? 0}
- Total Open Defects: ${m.totalOpen ?? 0}
- Active Sprint: ${m.activeSprint ? m.activeSprint.name : 'None'}
- Sprint Test Completion: ${m.sprintCompletion !== null && m.sprintCompletion !== undefined ? m.sprintCompletion + '%' : 'N/A'} (${m.sprintPassedTCs ?? 0}/${m.sprintTotalReqs ?? 0} requirements covered)
- Test Case Coverage (manual): ${m.tcCoverage !== null && m.tcCoverage !== undefined ? m.tcCoverage + '%' : 'N/A'} (${m.tcExecuted ?? 0}/${m.tcTotal ?? 0} test cases executed)

Return ONLY valid JSON (no markdown) with this exact shape:
{
  "verdict": "Not Ready | Needs Work | Almost Ready | Ready",
  "summary": "2-3 sentence executive summary",
  "risks": ["risk 1", "risk 2", "risk 3"],
  "actions": ["action 1", "action 2", "action 3"],
  "confidence": "Low | Medium | High"
}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    let response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 800 }),
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: `OpenAI error ${response.status}: ${errText.slice(0, 200)}` });
    }
    const json = await response.json();
    const raw  = json.choices?.[0]?.message?.content?.trim() || '{}';
    // Strip possible markdown code fences
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    let aiResult;
    try { aiResult = JSON.parse(cleaned); } catch { aiResult = { verdict: 'Unknown', summary: raw, risks: [], actions: [], confidence: 'Low' }; }
    res.json(aiResult);
  } catch (error) {
    console.error('release-readiness/ai-summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /search - Global search across features, requirements, test cases, defects
app.get('/search', async (req, res) => {
  try {
    const orgId = req.session?.orgId || 1;
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ features: [], requirements: [], testCases: [], defects: [] });
    const term = `%${q}%`;
    const [feats, reqs, tcs, defs] = await Promise.all([
      pool.query(
        `SELECT id, uid, name AS title, 'feature' AS type FROM features WHERE org_id=$1 AND (name ILIKE $2 OR uid ILIKE $2) ORDER BY created_at DESC LIMIT 6`,
        [orgId, term]
      ),
      pool.query(
        `SELECT id, uid, title, 'requirement' AS type FROM requirements WHERE org_id=$1 AND (title ILIKE $2 OR uid ILIKE $2) ORDER BY created_at DESC LIMIT 6`,
        [orgId, term]
      ),
      pool.query(
        `SELECT id, uid, title, 'testcase' AS type FROM test_cases WHERE org_id=$1 AND (title ILIKE $2 OR uid ILIKE $2) ORDER BY created_at DESC LIMIT 6`,
        [orgId, term]
      ),
      pool.query(
        `SELECT id, uid, title, 'defect' AS type FROM defects WHERE org_id=$1 AND (title ILIKE $2 OR uid ILIKE $2) ORDER BY created_at DESC LIMIT 6`,
        [orgId, term]
      ),
    ]);
    res.json({
      features: feats.rows,
      requirements: reqs.rows,
      testCases: tcs.rows,
      defects: defs.rows,
    });
  } catch (error) {
    console.error('search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /executions/:id - Get execution by ID
app.get('/executions/:id', async (req, res) => {
  try {
    const execution = await executionOperations.getById(req.params.id);
    if (execution) {
      res.json(execution);
    } else {
      res.status(404).json({ error: 'Execution not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /modules/:id/executions - Get executions for a module
app.get('/modules/:id/executions', async (req, res) => {
  try {
    const executions = await executionOperations.getByModuleId(req.params.id);
    res.json(executions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Test Execution Endpoint =====

// ── AI Test Healer helpers ───────────────────────────────────────────────────
async function healTestWithAI(specContent, errorOutput, apiKey, depContext = '') {
  if (!apiKey) {
    throw new Error('No OpenAI API key configured for this organization.');
  }

  const prompt = `You are an expert Playwright test engineer. A test has failed. Analyze the failure and provide a fix.

${depContext ? `## Dependency Context (READ-ONLY — do NOT copy this code into fixedTestBody):
\`\`\`typescript${depContext}\`\`\`

` : ''}## Original Playwright Spec (the MAIN test — this is what you must fix):
\`\`\`typescript
${specContent.slice(0, 3500)}
\`\`\`

## Failure Output:
\`\`\`
${errorOutput.slice(0, 3000)}
\`\`\`

Respond with ONLY valid JSON — no markdown fences, no extra text:
{
  "analysis": "Concise explanation of what was failing and the root cause",
  "changes": [
    { "line": <1-based line number in spec>, "original": "<original line>", "fixed": "<fixed line>", "reason": "<why>" }
  ],
  "fixedTestBody": "<complete fixed code that goes INSIDE the test() callback, 2-space indented, valid TypeScript>"
}
Rules:
- fixedTestBody = ONLY the code INSIDE async ({ page, ... }) => { ... } for the MAIN test — not wrapper, not imports, NOT dep file code
- Do NOT copy or include any code from the dependency context into fixedTestBody
- Do not change test intent; only fix what is broken
- Use idiomatic Playwright: getByRole, getByLabel, getByText, getByPlaceholder, locator, etc.
- If element not found, use a more resilient selector or add explicit waits
- fixedTestBody must be syntactically valid TypeScript`;

  const healController = new AbortController();
  const healTimeoutId = setTimeout(() => healController.abort(), 30000);
  let response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 4000,
      }),
      signal: healController.signal,
    });
  } finally {
    clearTimeout(healTimeoutId);
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() || '';
  let parsed;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON object found in response');
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`Could not parse AI response as JSON: ${e.message}`);
  }

  return {
    analysis: String(parsed.analysis || 'No analysis provided'),
    changes: Array.isArray(parsed.changes) ? parsed.changes : [],
    fixedTestBody: String(parsed.fixedTestBody || ''),
  };
}

// ── AI Defect Description Generator ─────────────────────────────────────────
async function generateDefectWithAI({ testName, suiteName, errorMessage, specContent, logSnippet, aiHealNote }, apiKey) {
  if (!apiKey) throw new Error('No API key');

  const prompt = `You are a QA engineer writing a defect report for a failed automated Playwright test.
Use ONLY the information provided — do not invent steps or details.

## Context
Suite:        ${suiteName}
Test:         ${testName}
Error:
${(errorMessage || 'No error message captured').slice(0, 1500)}

## Test Source Code
\`\`\`typescript
${(specContent || '').slice(0, 2000)}
\`\`\`

Respond with ONLY valid JSON — no markdown fences, no extra text:
{
  "title": "Short, descriptive defect title (max 90 chars, no [Auto] prefix)",
  "summary": "One paragraph summarising the failure",
  "steps_to_reproduce": ["step 1", "step 2", "..."],
  "expected_behavior": "What should have happened",
  "actual_behavior": "What actually happened based on the error"
}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  let response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 1000 }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content?.trim() || '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in AI response');
  const parsed = JSON.parse(jsonMatch[0]);

  // Build structured markdown description
  const steps = Array.isArray(parsed.steps_to_reproduce) ? parsed.steps_to_reproduce : [];
  const description = [
    `## Summary`,
    parsed.summary || '',
    ``,
    `## Steps to Reproduce`,
    ...steps.map((s, i) => `${i + 1}. ${s}`),
    ``,
    `## Expected Behavior`,
    parsed.expected_behavior || '',
    ``,
    `## Actual Behavior`,
    parsed.actual_behavior || '',
    ``,
    `## Execution Details`,
    `- **Suite:** ${suiteName}`,
    `- **Test:** ${testName}`,
    `- **AI Heal:** ${aiHealNote}`,
    ``,
    logSnippet ? `## Execution Logs\n\`\`\`\n${logSnippet}\n\`\`\`` : ''
  ].filter(l => l !== undefined).join('\n').trim();

  return { title: String(parsed.title || testName).slice(0, 90), description };
}

function buildFixedSpec(originalSpec, fixedTestBody) {
  const testCallIdx = originalSpec.indexOf('\ntest(');
  const importSection = testCallIdx >= 0 ? originalSpec.slice(0, testCallIdx) : '';
  const nameMatch = originalSpec.match(/\ntest\(([^,\n]+),/);
  const nameToken = nameMatch ? nameMatch[1] : '"Test"';
  return `${importSection}\ntest(${nameToken}, async ({ page, request, browser, context, browserName }) => {\n${fixedTestBody}\n});\n`;
}

function formatHealLog(healResult, succeeded) {
  const bar = '\u2550'.repeat(58);
  const lines = ['', bar, '\uD83E\uDD16  AI TEST HEALER', bar, ''];
  lines.push(`\uD83D\uDCCB  Analysis: ${healResult.analysis}`);
  lines.push('');
  if (healResult.changes && healResult.changes.length > 0) {
    lines.push('\uD83D\uDCDD  Changes Made:');
    for (const c of healResult.changes) {
      lines.push(`  Line ${c.line}:`);
      lines.push(`    \u274C Before : ${String(c.original || '').trim()}`);
      lines.push(`    \u2705 After  : ${String(c.fixed || '').trim()}`);
      lines.push(`    \u2139\uFE0F  Reason : ${String(c.reason || '').trim()}`);
      lines.push('');
    }
  }
  if (succeeded === true)  lines.push('\u2705  Healed run PASSED!');
  if (succeeded === false) lines.push('\u274C  Test still failing after AI fix.');
  lines.push(bar);
  return lines.join('\n');
}

// POST /run-test endpoint
app.post('/run-test', async (req, res) => {
  const { code, moduleId, testFileId, browser = 'chromium', debug = false, workers = 1, fullyParallel = false, screenshotMode = 'only-on-failure', traceMode = 'off', videoMode = 'off' } = req.body;

  // Load global variables and make them available to tests via process.env
  const orgId = req.session?.orgId || 1;
  const orgForHeal = await organizationOperations.getById(orgId);
  const orgAiHealEnabled = orgForHeal?.ai_healing_enabled === 1;
  const orgApiKey = orgForHeal?.openai_api_key || process.env.OPENAI_API_KEY || '';
  const globalVarsEnv = await globalVariableOperations.getAllAsEnv(orgId);

  if (!code || typeof code !== 'string') {
    return res.status(400).json({
      success: false,
      logs: 'Error: Missing or invalid code parameter',
    });
  }

  const tempDir = path.join(dataDir, 'temp', `test-${Date.now()}`);
  const startTime = Date.now();
  let dependencyHeader = '';
  // Hoisted so the AI healer block in catch() can access them
  let specContent = '';
  let specPath = '';
  let combinedTestName = '';
  let filesToRun = []; // hoisted so AI healer can inspect which part is "main"

  try {
    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });

    // Write the Object Repository file so test code can: const OR = require('./_or')
    const orContent = await objectRepositoryOperations.generateORFileContent(orgId);
    await fs.writeFile(path.join(tempDir, '_or.js'), orContent, 'utf8');

    // Build the full ordered list of files to execute: before deps → main → after deps
    // (filesToRun is hoisted above so AI healer can access it)

    if (testFileId) {
      try {
        const execOrder = await testFileDependencyOperations.getExecutionOrder(parseInt(testFileId));

        // Before dependencies
        for (const dep of (execOrder.before || [])) {
          const depFile = await testFileOperations.getById(dep.dependency_file_id);
          if (depFile && depFile.content) {
            filesToRun.push({ label: 'before', name: dep.dependency_name || depFile.name, content: depFile.content });
          }
        }

        // Main test — use the live editor code (may have unsaved changes)
        const mainName = execOrder.self ? execOrder.self.name : 'Main Test';
        filesToRun.push({ label: 'main', name: mainName, content: code });

        // After dependencies
        for (const dep of (execOrder.after || [])) {
          const depFile = await testFileOperations.getById(dep.dependency_file_id);
          if (depFile && depFile.content) {
            filesToRun.push({ label: 'after', name: dep.dependency_name || depFile.name, content: depFile.content });
          }
        }

        // Build a summary header for the output logs
        if (filesToRun.length > 1) {
          dependencyHeader = '📋 Execution Order:\n';
          filesToRun.forEach((f, i) => {
            const tag = f.label === 'before' ? ' (before)' : f.label === 'after' ? ' (after)' : ' (main)';
            dependencyHeader += `  ${i + 1}. ${f.name}${tag}\n`;
          });
          dependencyHeader += '\n';
        }
      } catch (depErr) {
        console.warn('Could not resolve dependencies, running main test only:', depErr.message);
        filesToRun.push({ label: 'main', name: 'test', content: code });
      }
    } else {
      filesToRun.push({ label: 'main', name: 'test', content: code });
    }

    // Combine all files (before → main → after) into ONE test block so they all
    // share the same browser page. Separate spec files each open their own browser.
    const combinedSteps = filesToRun
      .map(f => {
        // Strip any user-written `const OR = require('./_or')` — OR is auto-imported at the top
        const cleaned = f.content.replace(/^[^\S\n]*const\s+OR\s*=\s*require\s*\(['"]\.\/(_or|_or\.js)['"]\)\s*;?\s*$/gm, '');
        const indented = cleaned.trim().split('\n').join('\n  ');
        return `  // ── ${f.name} (${f.label}) ──\n  ${indented}`;
      })
      .join('\n\n');

    combinedTestName = filesToRun.map(f => f.name).join(' → ');

    // Fetch module-level imports (extra libraries the user configured for this module)
    let moduleImportBlock = '';
    if (moduleId) {
      try {
        const mod = await moduleOperations.getById(moduleId);
        if (mod && mod.imports && mod.imports.trim()) {
          moduleImportBlock = '\n' + mod.imports.trim() + '\n';
        }
      } catch (_) {}
    }

    specContent = `import { test, expect } from '@playwright/test';
import OR from './_or.js';${moduleImportBlock}
test(${JSON.stringify(combinedTestName)}, async ({ page, request, browser, context, browserName }) => {
${combinedSteps}
});
`;
    specPath = path.join(tempDir, 'combined.spec.ts');
    await fs.writeFile(specPath, specContent, 'utf8');

    // Create package.json for the temp directory
    const packageJsonContent = JSON.stringify({
      "type": "module",
      "name": "temp-test",
      "version": "1.0.0"
    }, null, 2);
    const packageJsonPath = path.join(tempDir, 'package.json');
    await fs.writeFile(packageJsonPath, packageJsonContent, 'utf8');

    // Create playwright.config.ts for headed mode with HTML reporter
    const browserMap = { chromium: 'chromium', firefox: 'firefox', webkit: 'webkit' };
    const browserName = browserMap[browser] || 'chromium';

    // Per-browser launch args. viewport:null must also be in the project use block
    // because device presets would override the top-level viewport:null.
    const launchOptions = browser === 'chromium'
      ? `launchOptions: { args: ['--start-maximized'] }, viewport: null,`
      : browser === 'firefox'
      ? `launchOptions: { args: ['-foreground'] }, viewport: null,`
      : `viewport: null,`;

    const configContent = `import { defineConfig } from '@playwright/test';

export default defineConfig({
  fullyParallel: ${fullyParallel},
  workers: ${workers},
  use: {
    headless: ${FORCE_HEADLESS},
    slowMo: ${FORCE_HEADLESS ? 0 : 500},
    screenshot: '${screenshotMode}',
    trace: '${debug ? 'on' : traceMode}',
    video: '${videoMode}',
  },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }]
  ],
  projects: [
    {
      name: '${browserName}',
      use: {
        browserName: '${browserName}',
        ${launchOptions}
      },
    },
  ],
});
`;

    const configFilePath = path.join(tempDir, 'playwright.config.ts');
    await fs.writeFile(configFilePath, configContent, 'utf8');

    // Trace mode: run headless with full Playwright trace recording
    if (debug) {
      let traceStdout = '', traceStderr = '';
      try {
        const traceResult = await execAsync('npx playwright test', {
          cwd: tempDir,
          timeout: 120000,
          env: { ...process.env, ...globalVarsEnv, NODE_PATH: nodePathEnv },
        });
        traceStdout = traceResult.stdout || '';
        traceStderr = traceResult.stderr || '';
      } catch (traceErr) {
        // Test may fail — still capture output and collect trace
        traceStdout = traceErr.stdout || '';
        traceStderr = traceErr.stderr || '';
      }

      const traceLogs = [traceStdout, traceStderr].filter(s => s && s.trim()).join('\n').trim()
        || 'Trace run completed.';

      // Find trace.zip produced by Playwright — search recursively under test-results
      let tracePath = null;
      try {
        const testResultsDir = path.join(tempDir, 'test-results');
        console.log('[trace] searching for trace.zip in:', testResultsDir);

        // Recursive helper: returns first trace.zip path found anywhere under dir
        async function findTraceZip(dir) {
          let entries;
          try { entries = await fs.readdir(dir); } catch { return null; }
          // Check for trace.zip directly in this dir
          if (entries.includes('trace.zip')) return path.join(dir, 'trace.zip');
          // Recurse into subdirectories
          for (const entry of entries) {
            const full = path.join(dir, entry);
            try {
              const st = await fs.stat(full);
              if (st.isDirectory()) {
                const found = await findTraceZip(full);
                if (found) return found;
              }
            } catch {}
          }
          return null;
        }

        console.log('[trace] tempDir contents:', JSON.stringify(await fs.readdir(tempDir).catch(() => [])));
        try {
          const trDirs = await fs.readdir(testResultsDir);
          console.log('[trace] test-results entries:', JSON.stringify(trDirs));
        } catch (e) { console.log('[trace] test-results not found:', e.message); }

        const foundZip = await findTraceZip(testResultsDir);
        console.log('[trace] found zip:', foundZip);

        if (foundZip) {
          const traceFolderName = `trace-${Date.now()}`;
          const traceDestDir = path.join(reportsDir, traceFolderName);
          await fs.mkdir(traceDestDir, { recursive: true });
          await fs.copyFile(foundZip, path.join(traceDestDir, 'trace.zip'));
          tracePath = `${traceFolderName}/trace.zip`;
          console.log('[trace] saved to:', tracePath);
        }
      } catch (e) { console.log('[trace] outer error:', e.message); }

      return res.json({
        success: true,
        trace: true,
        logs: traceLogs,
        trace_path: tracePath,
      });
    }

    // Run Playwright test (config will handle headed mode)
    const { stdout, stderr } = await execAsync('npx playwright test', {
      cwd: tempDir,
      timeout: 60000, // 60 second timeout for headed mode
      env: { ...process.env, ...globalVarsEnv, NODE_PATH: nodePathEnv },
    });

    // Success - exit code 0
    const durationMs = Date.now() - startTime;
    const combinedOutput = [stdout, stderr].filter(s => s && s.trim()).join('\n').trim();
    const logs = dependencyHeader + (combinedOutput || 'Test completed successfully');

    // Try to find and read screenshot
    let screenshotBase64 = null;
    try {
      const testResultsDir = path.join(tempDir, 'test-results');
      
      try {
        await fs.access(testResultsDir);
        const testDirs = await fs.readdir(testResultsDir);
        
        for (const dir of testDirs) {
          const dirPath = path.join(testResultsDir, dir);
          const stat = await fs.stat(dirPath);
          
          if (stat.isDirectory()) {
            const files = await fs.readdir(dirPath);
            const screenshotFile = files.find(file => file.endsWith('.png'));
            
            if (screenshotFile) {
              const screenshotPath = path.join(dirPath, screenshotFile);
              const screenshotBuffer = await fs.readFile(screenshotPath);
              screenshotBase64 = screenshotBuffer.toString('base64');
              break;
            }
          }
        }
      } catch (err) {
        // No screenshot directory or error reading
      }
    } catch (screenshotError) {
      // Screenshot reading failed, continue without it
    }

    // Copy HTML report to persistent location
    let reportPath = null;
    try {
      const htmlReportDir = path.join(tempDir, 'playwright-report');
      await fs.access(htmlReportDir);
      
      const reportFolderName = `report-${Date.now()}`;
      const reportDestPath = path.join(reportsDir, reportFolderName);
      
      await copyDirectory(htmlReportDir, reportDestPath);
      reportPath = reportFolderName; // Store just the folder name
      console.log('HTML report saved:', reportDestPath);
    } catch (reportError) {
      console.error('Failed to save HTML report:', reportError.message);
    }

    // Collect trace artifact if tracing was enabled
    let tracePath = null;
    if (traceMode !== 'off') {
      try {
        const traceResultsDir = path.join(tempDir, 'test-results');
        const findTraceZipSuccess = async (dir) => {
          let entries; try { entries = await fs.readdir(dir); } catch { return null; }
          if (entries.includes('trace.zip')) return path.join(dir, 'trace.zip');
          for (const e of entries) {
            const full = path.join(dir, e);
            try { const st = await fs.stat(full); if (st.isDirectory()) { const found = await findTraceZipSuccess(full); if (found) return found; } } catch {}
          }
          return null;
        };
        const foundZip = await findTraceZipSuccess(traceResultsDir);
        if (foundZip) {
          const traceFolderName = `trace-${Date.now()}`;
          const traceDestDir = path.join(reportsDir, traceFolderName);
          await fs.mkdir(traceDestDir, { recursive: true });
          await fs.copyFile(foundZip, path.join(traceDestDir, 'trace.zip'));
          tracePath = `${traceFolderName}/trace.zip`;
          console.log('✓ Trace saved:', tracePath);
        }
      } catch (traceErr) { console.error('Trace collection error:', traceErr.message); }
    }

    // Collect video artifact if video recording was enabled
    let videoPath = null;
    if (videoMode !== 'off') {
      try {
        const videoResultsDir = path.join(tempDir, 'test-results');
        const findVideoFile = async (dir) => {
          let entries; try { entries = await fs.readdir(dir); } catch { return null; }
          const vid = entries.find(e => e.endsWith('.webm') || e.endsWith('.mp4'));
          if (vid) return path.join(dir, vid);
          for (const e of entries) {
            const full = path.join(dir, e);
            try { const st = await fs.stat(full); if (st.isDirectory()) { const found = await findVideoFile(full); if (found) return found; } } catch {}
          }
          return null;
        };
        const foundVideo = await findVideoFile(videoResultsDir);
        if (foundVideo) {
          const vidExt = path.extname(foundVideo);
          const vidFolderName = `video-${Date.now()}`;
          const vidDestDir = path.join(reportsDir, vidFolderName);
          await fs.mkdir(vidDestDir, { recursive: true });
          await fs.copyFile(foundVideo, path.join(vidDestDir, `video${vidExt}`));
          videoPath = `${vidFolderName}/video${vidExt}`;
          console.log('✓ Video saved:', videoPath);
        }
      } catch (videoErr) { console.error('Video collection error:', videoErr.message); }
    }

    // Save execution to database
    let executionId = null;
    if (moduleId && testFileId) {
      try {
        // Verify module and test file exist before inserting
        const module = await moduleOperations.getById(moduleId);
        const testFile = await testFileOperations.getById(testFileId);
        
        if (module && testFile) {
          const execution = await executionOperations.create({
            module_id: moduleId,
            test_file_id: testFileId,
            status: 'PASS',
            logs,
            error_message: null,
            screenshot_base64: screenshotBase64,
            duration_ms: durationMs,
            report_path: reportPath,
            trace_path: tracePath,
            video_path: videoPath,
          }, orgId);
          executionId = execution.id;
          console.log('✓ Execution saved to database with ID:', executionId);
        } else {
          console.warn('⚠ Execution not saved: Invalid module or test file');
          console.warn('  - Module exists:', !!module);
          console.warn('  - Test file exists:', !!testFile);
        }
      } catch (dbError) {
        console.error('Failed to save execution:', dbError.message);
      }
    } else {
      console.warn('⚠ Execution not saved: Missing moduleId or testFileId');
      console.warn('  - moduleId:', moduleId);
      console.warn('  - testFileId:', testFileId);
    }

    return res.json({
      success: true,
      logs,
      screenshot: screenshotBase64,
      execution_id: executionId,
      trace_path: tracePath,
      video_path: videoPath,
    });

  } catch (error) {
    // Failure - non-zero exit code or execution error
    const combinedError = [error.stderr, error.stdout].filter(s => s && s.trim()).join('\n').trim();
    let errorLogs = dependencyHeader + (combinedError || error.message || 'Test failed');
    const durationMs = Date.now() - startTime;

    // ── AI Healer ──────────────────────────────────────────────────────
    let aiHealAttempted = false, aiHealSucceeded = false, aiFixedCode = null, aiAnalysis = null, aiChanges = null;
    if (orgAiHealEnabled && !debug && specContent && specPath) {
      aiHealAttempted = true;
      try {
        // Build a main-only spec for healing so the AI only fixes the main test.
        // Dep files are supplied as read-only context comments — NOT as editable code.
        const mainFile = filesToRun.find(f => f.label === 'main');
        const mainCode = (mainFile ? mainFile.content : code) || code;
        const beforeDeps = filesToRun.filter(f => f.label === 'before');
        const afterDeps  = filesToRun.filter(f => f.label === 'after');
        let depContext = '';
        if (beforeDeps.length > 0) {
          depContext += `\n// ── BEFORE dependencies (run before this test — DO NOT include in fixedTestBody) ──\n`;
          depContext += beforeDeps.map(d => `// [${d.name}]\n${d.content.split('\n').map(l => '// ' + l).join('\n')}`).join('\n');
          depContext += '\n';
        }
        if (afterDeps.length > 0) {
          depContext += `\n// ── AFTER dependencies (run after this test — DO NOT include in fixedTestBody) ──\n`;
          depContext += afterDeps.map(d => `// [${d.name}]\n${d.content.split('\n').map(l => '// ' + l).join('\n')}`).join('\n');
          depContext += '\n';
        }
        // Wrap only the main test code for healing
        const mainOnlySpec = `import { test, expect } from '@playwright/test';
test(${JSON.stringify(combinedTestName || 'main test')}, async ({ page, request, browser, context, browserName }) => {
${mainCode}
});
`;
        const healResult = await healTestWithAI(mainOnlySpec, combinedError || error.message || '', orgApiKey, depContext);
        aiAnalysis  = healResult.analysis;
        aiChanges   = healResult.changes;
        aiFixedCode = healResult.fixedTestBody;
        const fixedSpec = buildFixedSpec(specContent, healResult.fixedTestBody);
        await fs.writeFile(specPath, fixedSpec, 'utf8');
        try {
          const { stdout: hs, stderr: he } = await execAsync('npx playwright test', {
            cwd: tempDir, timeout: 60000,
            env: { ...process.env, ...globalVarsEnv, NODE_PATH: nodePathEnv },
          });
          aiHealSucceeded = true;
          const healLog = formatHealLog(healResult, true);
          const healedLogs = errorLogs + '\n' + healLog + '\n' + [hs, he].filter(s => s && s.trim()).join('\n');
          let hs64 = null;
          try {
            const trd = path.join(tempDir, 'test-results');
            await fs.access(trd);
            for (const d of await fs.readdir(trd)) {
              const dp = path.join(trd, d);
              if ((await fs.stat(dp)).isDirectory()) {
                const sf = (await fs.readdir(dp)).find(f => f.endsWith('.png'));
                if (sf) { hs64 = (await fs.readFile(path.join(dp, sf))).toString('base64'); break; }
              }
            }
          } catch {}
          let healedReportPath = null;
          try {
            const hrDir = path.join(tempDir, 'playwright-report');
            await fs.access(hrDir);
            const rfn = `report-${Date.now()}`;
            await copyDirectory(hrDir, path.join(reportsDir, rfn));
            healedReportPath = rfn;
          } catch {}
          let healedExecId = null;
          if (moduleId && testFileId) {
            try {
              const m = await moduleOperations.getById(moduleId), t = await testFileOperations.getById(testFileId);
              if (m && t) {
                const ex = await executionOperations.create({ module_id: moduleId, test_file_id: testFileId, status: 'PASS', logs: healedLogs, error_message: null, screenshot_base64: hs64, duration_ms: durationMs, report_path: healedReportPath }, orgId);
                healedExecId = ex.id;
              }
            } catch (dbErr) { console.error('AI heal DB save error:', dbErr.message); }
          }
          return res.json({ success: true, ai_healed: true, ai_heal_succeeded: true, fixed_code: aiFixedCode, heal_analysis: aiAnalysis, heal_changes: aiChanges, logs: healedLogs, screenshot: hs64, execution_id: healedExecId });
        } catch (rerunErr) {
          const rerunOut = [rerunErr.stderr, rerunErr.stdout].filter(s => s && s.trim()).join('\n').trim();
          errorLogs = errorLogs + '\n' + formatHealLog(healResult, false) + (rerunOut ? '\n' + rerunOut : '');
        }
      } catch (healErr) {
        errorLogs = errorLogs + `\n\n\u26A0\uFE0F  AI Healer error: ${healErr.message}`;
      }
    }
    
    // Try to find and read screenshot if test failed
    let screenshotBase64 = null;
    try {
      const testResultsDir = path.join(tempDir, 'test-results');
      
      // Check if test-results directory exists
      try {
        await fs.access(testResultsDir);
        console.log('Screenshot directory found:', testResultsDir);
      } catch {
        // Directory doesn't exist, no screenshot available
        console.log('No test-results directory found');
        
        // Copy HTML report even on failure
        let reportPath = null;
        try {
          const htmlReportDir = path.join(tempDir, 'playwright-report');
          await fs.access(htmlReportDir);
          
          const reportFolderName = `report-${Date.now()}`;
          const reportDestPath = path.join(reportsDir, reportFolderName);
          
          await copyDirectory(htmlReportDir, reportDestPath);
          reportPath = reportFolderName;
          console.log('HTML report saved:', reportDestPath);
        } catch (reportError) {
          console.error('Failed to save HTML report:', reportError.message);
        }
        
        // Save execution to database
        let executionId = null;
        if (moduleId && testFileId) {
          try {
            const module = await moduleOperations.getById(moduleId);
            const testFile = await testFileOperations.getById(testFileId);
            
            if (module && testFile) {
              const execution = await executionOperations.create({
                module_id: moduleId,
                test_file_id: testFileId,
                status: 'FAIL',
                logs: errorLogs,
                error_message: error.message || null,
                screenshot_base64: null,
                duration_ms: durationMs,
                report_path: reportPath,
                trace_path: null,
                video_path: null,
              }, orgId);
              executionId = execution.id;
              console.log('✓ Execution saved to database with ID:', executionId);
            } else {
              console.warn('⚠ Execution not saved: Invalid module or test file');
              console.warn('  - Module exists:', !!module);
              console.warn('  - Test file exists:', !!testFile);
            }
          } catch (dbError) {
            console.error('Failed to save execution:', dbError.message);
          }
        } else {
          console.warn('⚠ Execution not saved: Missing moduleId or testFileId');
          console.warn('  - moduleId:', moduleId);
          console.warn('  - testFileId:', testFileId);
        }
        
        return res.json({
          success: false,
          ai_healed: aiHealAttempted,
          ai_heal_succeeded: aiHealSucceeded,
          fixed_code: aiFixedCode,
          heal_analysis: aiAnalysis,
          heal_changes: aiChanges,
          logs: errorLogs,
          screenshot: null,
          execution_id: executionId,
        });
      }

      // Read all subdirectories in test-results
      const testDirs = await fs.readdir(testResultsDir);
      console.log('Test result directories:', testDirs);
      
      for (const dir of testDirs) {
        const dirPath = path.join(testResultsDir, dir);
        const stat = await fs.stat(dirPath);
        
        if (stat.isDirectory()) {
          // Look for PNG files in this directory
          const files = await fs.readdir(dirPath);
          console.log(`Files in ${dir}:`, files);
          const screenshotFile = files.find(file => file.endsWith('.png'));
          
          if (screenshotFile) {
            const screenshotPath = path.join(dirPath, screenshotFile);
            console.log('Screenshot found:', screenshotPath);
            const screenshotBuffer = await fs.readFile(screenshotPath);
            screenshotBase64 = screenshotBuffer.toString('base64');
            console.log('Screenshot encoded, length:', screenshotBase64.length);
            break;
          }
        }
      }
    } catch (screenshotError) {
      // Screenshot reading failed, continue without it
      console.error('Screenshot reading error:', screenshotError.message);
    }
    
    // Copy HTML report even on failure
    let reportPath = null;
    try {
      const htmlReportDir = path.join(tempDir, 'playwright-report');
      await fs.access(htmlReportDir);
      
      const reportFolderName = `report-${Date.now()}`;
      const reportDestPath = path.join(reportsDir, reportFolderName);
      
      await copyDirectory(htmlReportDir, reportDestPath);
      reportPath = reportFolderName;
      console.log('HTML report saved:', reportDestPath);
    } catch (reportError) {
      console.error('Failed to save HTML report:', reportError.message);
    }

    // Collect trace / video artifacts on failure
    let tracePathFail = null;
    if (traceMode !== 'off') {
      try {
        const trDir = path.join(tempDir, 'test-results');
        const findTzip = async (d) => {
          let es; try { es = await fs.readdir(d); } catch { return null; }
          if (es.includes('trace.zip')) return path.join(d, 'trace.zip');
          for (const e of es) { const f = path.join(d, e); try { const s = await fs.stat(f); if (s.isDirectory()) { const r = await findTzip(f); if (r) return r; } } catch {} }
          return null;
        };
        const fz = await findTzip(trDir);
        if (fz) {
          const fn = `trace-${Date.now()}`; const dd = path.join(reportsDir, fn);
          await fs.mkdir(dd, { recursive: true });
          await fs.copyFile(fz, path.join(dd, 'trace.zip'));
          tracePathFail = `${fn}/trace.zip`;
        }
      } catch {}
    }
    let videoPathFail = null;
    if (videoMode !== 'off') {
      try {
        const vrDir = path.join(tempDir, 'test-results');
        const findVid = async (d) => {
          let es; try { es = await fs.readdir(d); } catch { return null; }
          const v = es.find(e => e.endsWith('.webm') || e.endsWith('.mp4'));
          if (v) return path.join(d, v);
          for (const e of es) { const f = path.join(d, e); try { const s = await fs.stat(f); if (s.isDirectory()) { const r = await findVid(f); if (r) return r; } } catch {} }
          return null;
        };
        const fv = await findVid(vrDir);
        if (fv) {
          const ext = path.extname(fv); const fn = `video-${Date.now()}`; const dd = path.join(reportsDir, fn);
          await fs.mkdir(dd, { recursive: true });
          await fs.copyFile(fv, path.join(dd, `video${ext}`));
          videoPathFail = `${fn}/video${ext}`;
        }
      } catch {}
    }

    // Save execution to database
    let executionId = null;
    if (moduleId && testFileId) {
      try {
        const module = await moduleOperations.getById(moduleId);
        const testFile = await testFileOperations.getById(testFileId);
        
        if (module && testFile) {
          const execution = await executionOperations.create({
            module_id: moduleId,
            test_file_id: testFileId,
            status: 'FAIL',
            logs: errorLogs,
            error_message: error.message || null,
            screenshot_base64: screenshotBase64,
            duration_ms: durationMs,
            report_path: reportPath,
            trace_path: tracePathFail,
            video_path: videoPathFail,
          }, orgId);
          executionId = execution.id;
          console.log('✓ Execution saved to database with ID:', executionId);
        } else {
          console.warn('⚠ Execution not saved: Invalid module or test file');
          console.warn('  - Module exists:', !!module);
          console.warn('  - Test file exists:', !!testFile);
        }
      } catch (dbError) {
        console.error('Failed to save execution:', dbError.message);
      }
    } else {
      console.warn('⚠ Execution not saved: Missing moduleId or testFileId');
      console.warn('  - moduleId:', moduleId);
      console.warn('  - testFileId:', testFileId);
    }
    
    return res.json({
      success: false,
      ai_healed: aiHealAttempted,
      ai_heal_succeeded: aiHealSucceeded,
      fixed_code: aiFixedCode,
      heal_analysis: aiAnalysis,
      heal_changes: aiChanges,
      logs: errorLogs,
      screenshot: screenshotBase64,
      execution_id: executionId,
      trace_path: tracePathFail,
      video_path: videoPathFail,
    });

  } finally {
    // Cleanup: Remove temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
  }
});

// POST /stop-debug - Kill the active Playwright debug session
app.post('/stop-debug', async (req, res) => {
  killDebugSession();
  res.json({ success: true });
});

// GET /execution/:id/report - Serve HTML report for execution
app.get('/execution/:id/report', async (req, res) => {
  try {
    const execution = await executionOperations.getById(req.params.id);
    
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }
    
    if (!execution.report_path) {
      return res.status(404).json({ error: 'No report available for this execution' });
    }
    
    // Check if report folder exists
    const reportFolderPath = path.join(reportsDir, execution.report_path);
    try {
      await fs.access(reportFolderPath);
    } catch {
      return res.status(404).json({ error: 'Report not found on server' });
    }
    
    // Redirect to the HTML report index page
    res.redirect(`/reports/${execution.report_path}/index.html`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /suite-execution/:id/report - Serve HTML report for suite execution
app.get('/suite-execution/:id/report', async (req, res) => {
  try {
    const executionId = parseInt(req.params.id);
    const execution = await suiteExecutionOperations.getById(executionId);
    
    if (!execution) {
      return res.status(404).json({ error: 'Suite execution not found' });
    }
    
    if (!execution.report_path) {
      return res.status(404).json({ error: 'No report available for this suite execution' });
    }
    
    // Check if report folder exists
    const reportFolderPath = path.join(reportsDir, execution.report_path);
    try {
      await fs.access(reportFolderPath);
    } catch {
      return res.status(404).json({ error: 'Report not found on server' });
    }
    
    // Redirect to the HTML report index page
    res.redirect(`/reports/${execution.report_path}/index.html`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Test Suite Endpoints =====

// GET /test-suites - Get all test suites
app.get('/test-suites', async (req, res) => {
  try {
    const orgId = req.session?.orgId || 1;
    const suites = await testSuiteOperations.getAll(orgId);
    
    // For each suite, count the number of test files
    const suitesWithCounts = await Promise.all(suites.map(async suite => {
      const testFiles = await suiteTestFileOperations.getBySuiteId(suite.id);
      return {
        ...suite,
        test_file_count: testFiles.length
      };
    }));
    
    res.json(suitesWithCounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /modules/:id/test-suites - Get test suites for a module
app.get('/modules/:id/test-suites', async (req, res) => {
  try {
    const suites = await testSuiteOperations.getByModuleId(req.params.id);
    
    const suitesWithCounts = await Promise.all(suites.map(async suite => {
      const testFiles = await suiteTestFileOperations.getBySuiteId(suite.id);
      return {
        ...suite,
        test_file_count: testFiles.length
      };
    }));
    
    res.json(suitesWithCounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /test-suites - Create a new test suite
app.post('/test-suites', async (req, res) => {
  try {
    const { moduleId, name, testFileIds } = req.body;
    
    // Create the suite
    const orgId = req.session?.orgId || 1;
    const suite = await testSuiteOperations.create({
      module_id: moduleId,
      name
    }, orgId);
    
    // Add test files to the suite
    if (testFileIds && testFileIds.length > 0) {
      for (const testFileId of testFileIds) {
        await suiteTestFileOperations.add({
          suite_id: suite.id,
          test_file_id: testFileId
        });
      }
    }
    
    res.json(suite);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /test-suites/:id/test-files - Get test files in a suite
app.get('/test-suites/:id/test-files', async (req, res) => {
  try {
    const suiteId = parseInt(req.params.id);
    const testFiles = await suiteTestFileOperations.getBySuiteId(suiteId);
    res.json(testFiles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /test-suites/:id/test-files - Add test files to a suite
app.post('/test-suites/:id/test-files', async (req, res) => {
  try {
    const { testFileIds } = req.body;
    const suiteId = parseInt(req.params.id);
    
    if (!testFileIds || !Array.isArray(testFileIds)) {
      return res.status(400).json({ error: 'testFileIds array is required' });
    }
    
    // Add each test file to the suite
    const addedFiles = [];
    for (const testFileId of testFileIds) {
      const result = await suiteTestFileOperations.add({
        suite_id: suiteId,
        test_file_id: parseInt(testFileId)
      });
      addedFiles.push(result);
    }
    
    res.json({ success: true, added: addedFiles.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /test-suites/:suiteId/test-files/:testFileId - Remove a test file from a suite
app.delete('/test-suites/:suiteId/test-files/:testFileId', async (req, res) => {
  try {
    const suiteId = parseInt(req.params.suiteId);
    const testFileId = parseInt(req.params.testFileId);
    await suiteTestFileOperations.removeBySuiteAndTestFile(suiteId, testFileId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /test-suites/:id - Delete a test suite
app.delete('/test-suites/:id', async (req, res) => {
  try {
    const suiteId = parseInt(req.params.id);
    await testSuiteOperations.delete(suiteId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /suite-executions/:id - Get suite execution by ID
app.get('/suite-executions/:id', async (req, res) => {
  try {
    const executionId = parseInt(req.params.id);
    const execution = await suiteExecutionOperations.getById(executionId);
    if (!execution) {
      return res.status(404).json({ error: 'Suite execution not found' });
    }
    res.json(execution);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /suite-executions/:id/results - Get test results for a suite execution
app.get('/suite-executions/:id/results', async (req, res) => {
  try {
    const executionId = parseInt(req.params.id);
    const results = await suiteTestResultOperations.getBySuiteExecutionId(executionId);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Global Variables CRUD ────────────────────────────────────────────────────

app.get('/global-variables', async (req, res) => {
  try {
    res.json(await globalVariableOperations.getAll(req.session?.orgId || 1));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/global-variables', async (req, res) => {
  try {
    const { key, value, description } = req.body;
    if (!key || !key.trim()) return res.status(400).json({ error: 'key is required' });
    const created = await globalVariableOperations.create({ key: key.trim(), value: value ?? '', description: description ?? '' }, req.session?.orgId || 1);
    res.status(201).json(created);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: `Variable key "${req.body.key}" already exists` });
    }
    res.status(500).json({ error: err.message });
  }
});

app.put('/global-variables/:id', async (req, res) => {
  try {
    const { key, value, description } = req.body;
    if (!key || !key.trim()) return res.status(400).json({ error: 'key is required' });
    const updated = await globalVariableOperations.update(parseInt(req.params.id), { key: key.trim(), value: value ?? '', description: description ?? '' });
    if (!updated) return res.status(404).json({ error: 'Variable not found' });
    res.json(updated);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: `Variable key "${req.body.key}" already exists` });
    }
    res.status(500).json({ error: err.message });
  }
});

app.delete('/global-variables/:id', async (req, res) => {
  try {
    await globalVariableOperations.delete(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Object Repository ────────────────────────────────────────────────────────
app.get('/object-repository', async (req, res) => {
  try {
    res.json(await objectRepositoryOperations.getAll(req.session?.orgId || 1));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/object-repository', async (req, res) => {
  try {
    const { page_name, object_name, selector, description, folder_id } = req.body;
    if (!page_name?.trim() || !object_name?.trim() || !selector?.trim())
      return res.status(400).json({ error: 'page_name, object_name and selector are required' });
    const created = await objectRepositoryOperations.create(
      { page_name, object_name, selector, description, folder_id }, req.session?.orgId || 1
    );
    res.status(201).json(created);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/object-repository/:id', async (req, res) => {
  try {
    const { page_name, object_name, selector, description, folder_id } = req.body;
    if (!page_name?.trim() || !object_name?.trim() || !selector?.trim())
      return res.status(400).json({ error: 'page_name, object_name and selector are required' });
    const updated = await objectRepositoryOperations.update(
      parseInt(req.params.id), { page_name, object_name, selector, description, folder_id }
    );
    if (!updated) return res.status(404).json({ error: 'Object not found' });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/object-repository/:id', async (req, res) => {
  try {
    await objectRepositoryOperations.delete(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── OR Folders ─────────────────────────────────────────────────────
app.get('/or-folders', async (req, res) => {
  try {
    res.json(await orFolderOperations.getAll(req.session?.orgId || 1));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/or-folders', async (req, res) => {
  try {
    const { name, parent_id } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const folder = await orFolderOperations.create({ name, parent_id }, req.session?.orgId || 1);
    res.status(201).json(folder);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/or-folders/:id', async (req, res) => {
  try {
    const { name, parent_id } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const folder = await orFolderOperations.update(parseInt(req.params.id), { name, parent_id });
    res.json(folder);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/or-folders/:id', async (req, res) => {
  try {
    await orFolderOperations.delete(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /global-variables/by-key/:key — read a variable by key name at runtime.
app.get('/global-variables/by-key/:key', async (req, res) => {
  try {
    const key = req.params.key;
    const orgId = req.session?.orgId || 1;
    const existing = (await globalVariableOperations.getAll(orgId)).find(v => v.key === key);
    if (!existing) return res.status(404).json({ error: `Variable "${key}" not found` });
    res.json(existing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /global-variables/by-key/:key — upsert a variable by key name.
// Tests can call this at runtime to write back values (e.g. auth tokens,
// generated IDs) so later tests can read them as process.env.KEY.
app.patch('/global-variables/by-key/:key', async (req, res) => {
  try {
    const key = req.params.key;
    const { value, description } = req.body;
    const orgId = req.session?.orgId || 1;
    if (value === undefined) return res.status(400).json({ error: 'value is required' });
    const existing = (await globalVariableOperations.getAll(orgId)).find(v => v.key === key);
    if (existing) {
      const updated = await globalVariableOperations.update(existing.id, {
        key,
        value: String(value),
        description: description !== undefined ? description : existing.description,
      });
      return res.json(updated);
    }
    const created = await globalVariableOperations.create({ key, value: String(value), description: description ?? '' }, orgId);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /executions/all — wipe all execution history (single runs + suite runs)
app.delete('/executions/all', async (req, res) => {
  try {
    await pool.query('DELETE FROM suite_test_results');
    await pool.query('DELETE FROM suite_executions');
    await pool.query('DELETE FROM executions');
    res.json({ success: true, message: 'All execution data cleared.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /analytics/test-health — per-test health: consistently failing, flaky, slowest
app.get('/analytics/test-health', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        str.test_file_id,
        tf.name        AS test_name,
        ts.name        AS suite_name,
        str.status,
        COALESCE(str.duration_ms, 0) AS duration_ms,
        se.created_at
      FROM suite_test_results str
      JOIN test_files      tf ON str.test_file_id      = tf.id
      JOIN suite_executions se ON str.suite_execution_id = se.id
      JOIN test_suites      ts ON se.suite_id            = ts.id
      ORDER BY se.created_at DESC
    `);

    // Group by test_file_id, runs already sorted desc (newest first)
    const byTest = {};
    rows.forEach(r => {
      if (!byTest[r.test_file_id]) {
        byTest[r.test_file_id] = { test_name: r.test_name, suite_name: r.suite_name, runs: [] };
      }
      byTest[r.test_file_id].runs.push({ status: r.status, duration_ms: r.duration_ms, created_at: r.created_at });
    });

    const tests = Object.values(byTest).map(t => {
      const last5 = t.runs.slice(0, 5);
      const totalRuns = t.runs.length;
      const passCount = t.runs.filter(r => r.status === 'PASS').length;
      const failCount = totalRuns - passCount;
      const last5Fails = last5.filter(r => r.status !== 'PASS').length;
      const last5Passes = last5.length - last5Fails;
      const avgDuration = t.runs.reduce((s, r) => s + r.duration_ms, 0) / totalRuns;

      // Consecutive failing streak from most recent
      let streak = 0;
      for (const r of t.runs) {
        if (r.status !== 'PASS') streak++; else break;
      }

      return {
        test_name:             t.test_name,
        suite_name:            t.suite_name,
        total_runs:            totalRuns,
        pass_count:            passCount,
        fail_count:            failCount,
        pass_rate:             totalRuns > 0 ? Math.round((passCount / totalRuns) * 100) : 0,
        avg_duration_ms:       Math.round(avgDuration),
        last_run:              t.runs[0]?.created_at,
        last5_statuses:        last5.map(r => r.status),
        failing_streak:        streak,
        is_consistently_failing: last5.length >= 2 && last5Fails === last5.length,
        is_flaky:              last5.length >= 3 && last5Passes > 0 && last5Fails > 0,
        is_never_passed:       totalRuns >= 1 && passCount === 0,
      };
    });

    res.json({
      consistentlyFailing: tests.filter(t => t.is_consistently_failing).sort((a, b) => b.failing_streak - a.failing_streak),
      flaky:               tests.filter(t => t.is_flaky).sort((a, b) => a.pass_rate - b.pass_rate),
      slowest:             [...tests].filter(t => t.total_runs > 0).sort((a, b) => b.avg_duration_ms - a.avg_duration_ms).slice(0, 6),
      mostFailed:          [...tests].filter(t => t.fail_count > 0).sort((a, b) => b.fail_count - a.fail_count).slice(0, 6),
      neverPassed:         tests.filter(t => t.is_never_passed && !t.is_consistently_failing),
      totalTests:          tests.length,
    });
  } catch (err) {
    console.error('analytics/test-health error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /test-suites/:suiteId/executions - Get execution history for a suite (last 30)
app.get('/test-suites/:suiteId/executions', async (req, res) => {
  try {
    const suiteId = parseInt(req.params.suiteId);
    const executions = await suiteExecutionOperations.getBySuiteId(suiteId, 30);
    res.json(executions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /suite-executions/:id/logs/stream — SSE real-time log stream for CI runs
app.get('/suite-executions/:id/logs/stream', async (req, res) => {
  const executionId = parseInt(req.params.id);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.flushHeaders();

  const entry = runLogs.get(executionId);
  if (!entry) {
    // Run already finished and buffer was cleaned up — send done immediately
    res.write(`event: done\ndata: {}\n\n`);
    res.end();
    return;
  }

  // Replay buffered lines so a client connecting mid-run gets full history
  for (const line of entry.lines) {
    res.write(`data: ${JSON.stringify(line)}\n\n`);
  }
  if (entry.done) {
    res.write(`event: done\ndata: {}\n\n`);
    res.end();
    return;
  }

  entry.clients.add(res);
  req.on('close', () => {
    const e = runLogs.get(executionId);
    if (e) e.clients.delete(res);
  });
});

// GET /suite-executions/:id/logs — fetch stored or buffered log lines for a completed run
app.get('/suite-executions/:id/logs', async (req, res) => {
  const executionId = parseInt(req.params.id);
  // Check in-memory buffer first (run still active or recently finished)
  const entry = runLogs.get(executionId);
  if (entry) return res.json(entry.lines);
  // Fall back to persisted logs in DB
  try {
    const result = await pool.query('SELECT logs_json FROM suite_executions WHERE id=$1', [executionId]);
    const row = result.rows[0];
    res.json(row?.logs_json ? JSON.parse(row.logs_json) : []);
  } catch (_) {
    res.json([]);
  }
});

// POST /run-suite/:suiteId - Execute all tests in a suite
app.post('/run-suite/:suiteId', async (req, res) => {
  const suiteId = parseInt(req.params.suiteId);

  try {
    // 1. Fetch suite by ID
    const suite = await testSuiteOperations.getById(suiteId);
    if (!suite) {
      return res.status(404).json({ error: 'Suite not found' });
    }

    // 2. Fetch all associated test files
    const suiteTestFiles = await suiteTestFileOperations.getBySuiteId(suiteId);
    if (!suiteTestFiles || suiteTestFiles.length === 0) {
      return res.json({
        suite_id: parseInt(suiteId),
        total_tests: 0,
        passed: 0,
        failed: 0,
        duration_ms: 0,
        tests: []
      });
    }

    // Capture everything we need from req NOW — before res.json() is called.
    // After the response is sent Express may release the req object and any
    // in-flight reads of req.session / req.body inside setImmediate will return
    // undefined, causing the org to silently fall back to 1.
    const capturedOrgId = req.session?.orgId || suite.org_id || 1;
    const capturedBody   = req.body || {};

    // 3. Create execution record immediately — gives the frontend an ID right away
    //    so the user can navigate to the detail page before tests finish.
    const suiteExecution = await suiteExecutionOperations.create({
      suite_id: parseInt(suiteId),
      status: 'running',
      total_tests: suiteTestFiles.length,
      passed: 0,
      failed: 0,
      duration_ms: 0,
      report_path: null
    }, capturedOrgId);
    const suiteExecutionId = suiteExecution.id;

    // Initialize real-time log buffer — must be done before res.json() so a
    // client that immediately opens the SSE stream after receiving the ID finds
    // the entry in the map.
    runLogs.set(suiteExecutionId, { lines: [], clients: new Set(), done: false });

    // Respond immediately — client is no longer blocked waiting for tests.
    res.json({
      suite_id: parseInt(suiteId),
      suite_execution_id: suiteExecutionId,
      status: 'running',
      total_tests: suiteTestFiles.length,
      passed: 0,
      failed: 0,
      duration_ms: 0,
      tests: []
    });

    // Run tests in background so navigation doesn't interrupt the run.
    setImmediate(async () => {
      const startTime = Date.now();
      let tempDir = null;
      try {
        // Create temp directory
        tempDir = path.join(dataDir, 'temp', `suite-${Date.now()}`);
        await fs.mkdir(tempDir, { recursive: true });

        // Write the Object Repository file so test code can: const OR = require('./_or')
        const suiteOrContent = await objectRepositoryOperations.generateORFileContent(capturedOrgId);
        await fs.writeFile(path.join(tempDir, '_or.js'), suiteOrContent, 'utf8');

        pushLog(suiteExecutionId, `⚙  Suite execution #${suiteExecutionId} started — ${suiteTestFiles.length} test file(s)`);

    // Fetch module-level imports for this suite's module
    let suiteModuleImportBlock = '';
    try {
      const suiteModule = await moduleOperations.getById(suite.module_id);
      if (suiteModule && suiteModule.imports && suiteModule.imports.trim()) {
        suiteModuleImportBlock = '\n' + suiteModule.imports.trim() + '\n';
      }
    } catch (_) {}

    // 3. For each test file, resolve before/after dependencies then wrap in Playwright template and save
    const testFilePromises = suiteTestFiles.map(async (suiteTestFile, index) => {
      // Build execution order: before deps → main → after deps (same logic as /run-test)
      let filesToRun = [];

      if (suiteTestFile.test_file_id) {
        try {
          const execOrder = await testFileDependencyOperations.getExecutionOrder(parseInt(suiteTestFile.test_file_id));

          // Before dependencies
          for (const dep of (execOrder.before || [])) {
            const depFile = await testFileOperations.getById(dep.dependency_file_id);
            if (depFile && depFile.content) {
              filesToRun.push({ label: 'before', name: dep.dependency_name || depFile.name, content: depFile.content });
            }
          }

          // Main test — use the saved content from the suite record
          const mainName = execOrder.self ? execOrder.self.name : suiteTestFile.test_file_name;
          filesToRun.push({ label: 'main', name: mainName, content: suiteTestFile.test_file_content || '' });

          // After dependencies
          for (const dep of (execOrder.after || [])) {
            const depFile = await testFileOperations.getById(dep.dependency_file_id);
            if (depFile && depFile.content) {
              filesToRun.push({ label: 'after', name: dep.dependency_name || depFile.name, content: depFile.content });
            }
          }
        } catch (depErr) {
          console.warn(`Could not resolve dependencies for "${suiteTestFile.test_file_name}", running main only:`, depErr.message);
          filesToRun.push({ label: 'main', name: suiteTestFile.test_file_name, content: suiteTestFile.test_file_content || '' });
        }
      } else {
        filesToRun.push({ label: 'main', name: suiteTestFile.test_file_name, content: suiteTestFile.test_file_content || '' });
      }

      // Combine all steps into one test block so they share the same browser/page
      const combinedSteps = filesToRun
        .map(f => {
          // Strip any user-written `const OR = require('./_or')` — OR is auto-imported at the top
          const cleaned = f.content.replace(/^[^\S\n]*const\s+OR\s*=\s*require\s*\(['"]\.\/(_or|_or\.js)['"]\)\s*;?\s*$/gm, '');
          const indented = cleaned.trim().split('\n').join('\n  ');
          return `  // ── ${f.name} (${f.label}) ──\n  ${indented}`;
        })
        .join('\n\n');

      const combinedTestName = filesToRun.length > 1
        ? filesToRun.map(f => f.name).join(' → ')
        : suiteTestFile.test_file_name;

      // Log the execution order when dependencies are present
      if (filesToRun.length > 1) {
        pushLog(suiteExecutionId, `📋 ${suiteTestFile.test_file_name} execution order: ${filesToRun.map((f, i) => `${i + 1}. ${f.name} (${f.label})`).join(', ')}`);
      }

      const testContent = `import { test, expect } from '@playwright/test';
import OR from './_or.js';${suiteModuleImportBlock}
test('${combinedTestName}', async ({ page, request, browser, context, browserName }) => {
${combinedSteps}
});
`;

      const fileName = `test-${index + 1}-${suiteTestFile.test_file_name.replace(/[^a-zA-Z0-9]/g, '_')}.spec.ts`;
      const testFilePath = path.join(tempDir, fileName);
      await fs.writeFile(testFilePath, testContent, 'utf8');

      return {
        fileName,
        testName: combinedTestName
      };
    });

    const testFileNames = await Promise.all(testFilePromises);

    // Create package.json
    const packageJsonContent = JSON.stringify({
      "type": "module",
      "name": "temp-suite-test",
      "version": "1.0.0"
    }, null, 2);
    await fs.writeFile(path.join(tempDir, 'package.json'), packageJsonContent, 'utf8');

    // Determine execution mode
    const useDocker = capturedBody.useDocker === true;
    const suiteWorkers = capturedBody.workers ? capturedBody.workers : 1;
    const suiteFullyParallel = capturedBody.fullyParallel === true;
    const suiteScreenshotMode = capturedBody.screenshotMode || 'only-on-failure';
    const suiteTraceMode = capturedBody.traceMode || 'off';
    const suiteVideoMode = capturedBody.videoMode || 'off';
    // Use the orgId captured before res.json() — accessing req.session inside
    // setImmediate is unreliable after the response has been sent.
    const suiteRunOrgId = capturedOrgId;
    const suiteOrgForHeal = await organizationOperations.getById(suiteRunOrgId);
    const suiteAiApiKey = suiteOrgForHeal?.openai_api_key || process.env.OPENAI_API_KEY || '';
    const suiteGlobalVarsEnv = await globalVariableOperations.getAllAsEnv(suiteRunOrgId);
    pushLog(suiteExecutionId, `⚙  Org: ${suiteOrgForHeal?.name || suiteRunOrgId} | AI healing: ${suiteOrgForHeal?.ai_healing_enabled === 1 ? 'enabled' : 'disabled'} | API key: ${suiteAiApiKey ? 'configured' : 'not set'}`);

    // Create playwright.config.ts — headless for Docker, headed for local
    const configContent = useDocker
      ? `import { defineConfig } from '@playwright/test';

export default defineConfig({
  fullyParallel: ${suiteFullyParallel},
  workers: ${suiteWorkers},
  use: {
    headless: true,
    screenshot: '${suiteScreenshotMode}',
    trace: '${suiteTraceMode}',
    video: '${suiteVideoMode}',
  },
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results.json' }],
    ['html', { open: 'never', outputFolder: 'playwright-report' }]
  ],
});
`
      : `import { defineConfig } from '@playwright/test';

export default defineConfig({
  fullyParallel: ${suiteFullyParallel},
  workers: ${suiteWorkers},
  use: {
    headless: ${FORCE_HEADLESS},
    slowMo: ${FORCE_HEADLESS ? 0 : 500},
    screenshot: '${suiteScreenshotMode}',
    trace: '${suiteTraceMode}',
    video: '${suiteVideoMode}',
  },
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results.json' }],
    ['html', { open: 'never', outputFolder: 'playwright-report' }]
  ],
});
`
    await fs.writeFile(path.join(tempDir, 'playwright.config.ts'), configContent, 'utf8');
    pushLog(suiteExecutionId, `✓  ${suiteTestFiles.length} test file(s) written to workspace`);

    // 4. Execute tests
    let exitCode = 0;
    let stdout = '';
    let stderr = '';

    // Use the Playwright binary bundled with this server — no Docker or external tools needed.
    // This mirrors how Azure DevOps / GitHub Actions agents work: a pre-installed Playwright
    // binary runs tests in a clean temp directory. "headless" mode = CI-style (no browser
    // window), normal mode = headed with slow-mo so you can watch the run.
    const playwrightBin = path.join(
      __dirname, 'node_modules', '.bin',
      process.platform === 'win32' ? 'playwright.cmd' : 'playwright'
    );
    const runLabel = useDocker ? 'headless (CI mode)' : 'headed';
    console.log(`▶  Running suite [${runLabel}] via local Playwright…`);
    pushLog(suiteExecutionId, `▶  Launching Playwright (${runLabel})...`);
    await new Promise((resolve) => {
      // Use shell:true so .cmd wrapper files work on Windows
      const proc = spawn(`"${playwrightBin}" test`, [], {
        cwd: tempDir,
        shell: true,
        env: { ...process.env, ...suiteGlobalVarsEnv, NODE_PATH: nodePathEnv }
      });
      proc.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        stdout += text;
        text.split('\n').forEach(line => { if (line.trim()) pushLog(suiteExecutionId, line); });
      });
      proc.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderr += text;
        text.split('\n').forEach(line => { if (line.trim()) pushLog(suiteExecutionId, line); });
      });
      proc.on('close', (code) => { exitCode = code || 0; resolve(); });
      proc.on('error', (err) => {
        stderr += err.message;
        pushLog(suiteExecutionId, `✗  Process error: ${err.message}`);
        exitCode = 1;
        resolve();
      });
    });
    pushLog(suiteExecutionId, `\n✓  Playwright run finished (exit ${exitCode})`);

    // 5. Read JSON results
    const resultsJsonPath = path.join(tempDir, 'test-results.json');
    let testResults = [];
    let totalTests = 0;
    let passed = 0;
    let failed = 0;

    try {
      const jsonContent = await fs.readFile(resultsJsonPath, 'utf8');
      const resultsData = JSON.parse(jsonContent);

      // Parse Playwright JSON reporter format
      if (resultsData.suites && resultsData.suites.length > 0) {
        for (const suite of resultsData.suites) {
          if (suite.specs) {
            for (const spec of suite.specs) {
              totalTests++;
              
              const testResult = {
                test_name: spec.title || 'Unknown Test',
                status: 'UNKNOWN',
                duration_ms: 0,
                error_message: null,
                screenshot_base64: null
              };

              // Check test status from results
              if (spec.tests && spec.tests.length > 0) {
                const test = spec.tests[0];
                if (test.results && test.results.length > 0) {
                  const result = test.results[0];
                  testResult.duration_ms = result.duration || 0;
                  
                  if (result.status === 'passed') {
                    testResult.status = 'PASS';
                    passed++;
                  } else if (result.status === 'failed') {
                    testResult.status = 'FAIL';
                    failed++;
                    testResult.error_message = result.error?.message || 'Test failed';
                  } else if (result.status === 'skipped') {
                    testResult.status = 'SKIPPED';
                  } else if (result.status === 'timedOut') {
                    testResult.status = 'TIMEOUT';
                    failed++;
                    testResult.error_message = 'Test timed out';
                  }

                  // Try to find screenshot in attachments
                  if (result.attachments && result.attachments.length > 0) {
                    for (const attachment of result.attachments) {
                      if (attachment.name === 'screenshot' && attachment.path) {
                        try {
                          // Docker paths start with /work/ — remap to local tempDir
                          let screenshotPath;
                          if (useDocker && attachment.path.startsWith('/work/')) {
                            screenshotPath = path.join(tempDir, attachment.path.slice('/work/'.length));
                          } else {
                            screenshotPath = path.isAbsolute(attachment.path)
                              ? attachment.path
                              : path.join(tempDir, attachment.path);
                          }
                          const screenshotBuffer = await fs.readFile(screenshotPath);
                          testResult.screenshot_base64 = screenshotBuffer.toString('base64');
                          break;
                        } catch (screenshotError) {
                          console.error('Failed to read screenshot:', screenshotError.message);
                        }
                      }
                    }
                  }
                }
              }

              testResults.push(testResult);
            }
          }
        }
      }
    } catch (parseError) {
      console.error('Failed to parse test results JSON:', parseError.message);
      // If we can't parse results, infer from exit code
      totalTests = suiteTestFiles.length;
      if (exitCode === 0) {
        passed = totalTests;
      } else {
        failed = totalTests;
      }
      
      testResults = suiteTestFiles.map(sf => ({
        test_name: sf.test_file_name,
        status: exitCode === 0 ? 'PASS' : 'FAIL',
        duration_ms: 0,
        error_message: exitCode !== 0 ? 'Test execution failed' : null
      }));
    }

    // ── AI Suite Healer ────────────────────────────────────────────────────
    // Only heal when the super-admin has enabled AI healing for this org
    // AND an API key is available.  Defects are only raised AFTER the healer
    // has had exactly one attempt (see auto-bug block below).
    const suiteAiHeal = suiteOrgForHeal?.ai_healing_enabled === 1;
    if (suiteAiHeal && suiteAiApiKey && failed > 0) {
      pushLog(suiteExecutionId, `\n\uD83E\uDD16  AI Healer: ${failed} failing test(s) — attempting fixes before raising defects...`);
      let healedCount = 0;
      for (let ri = 0; ri < testResults.length; ri++) {
        const tr = testResults[ri];
        if (tr.status !== 'FAIL' && tr.status !== 'TIMEOUT') continue;
        const fileInfo = testFileNames.find(fn => fn.testName === tr.test_name);
        if (!fileInfo) continue;
        const specFilePath = path.join(tempDir, fileInfo.fileName);
        let specText = '';
        try { specText = await fs.readFile(specFilePath, 'utf8'); } catch { continue; }
        pushLog(suiteExecutionId, `  \uD83D\uDD0D Analyzing "${tr.test_name}"...`);
        try {
          const healResult = await healTestWithAI(specText, tr.error_message || 'Test failed', suiteAiApiKey);
          pushLog(suiteExecutionId, `  \uD83D\uDCCB ${healResult.analysis}`);
          for (const c of (healResult.changes || [])) {
            pushLog(suiteExecutionId, `     Line ${c.line}: ${c.reason}`);
          }
          const fixedSpec = buildFixedSpec(specText, healResult.fixedTestBody);
          await fs.writeFile(specFilePath, fixedSpec, 'utf8');
          let rerunExit = 0;
          await new Promise((resolve) => {
            const p = spawn(`"${playwrightBin}" test "${fileInfo.fileName}"`, [], {
              cwd: tempDir, shell: true,
              env: { ...process.env, ...suiteGlobalVarsEnv, NODE_PATH: nodePathEnv }
            });
            p.stdout.on('data', c => c.toString().split('\n').forEach(l => { if (l.trim()) pushLog(suiteExecutionId, `    ${l}`); }));
            p.stderr.on('data', c => c.toString().split('\n').forEach(l => { if (l.trim()) pushLog(suiteExecutionId, `    ${l}`); }));
            p.on('close', code => { rerunExit = code || 0; resolve(); });
            p.on('error', () => { rerunExit = 1; resolve(); });
          });
          if (rerunExit === 0) {
            pushLog(suiteExecutionId, `  \u2705 "${tr.test_name}" healed and passing!`);
            testResults[ri] = { ...tr, status: 'PASS', ai_healed: true, ai_heal_succeeded: true, fixed_code: healResult.fixedTestBody, heal_analysis: healResult.analysis, heal_changes: healResult.changes };
            passed++; failed--; healedCount++;
          } else {
            pushLog(suiteExecutionId, `  \u274C "${tr.test_name}" still failing after AI fix.`);
            testResults[ri] = { ...tr, ai_healed: true, ai_heal_succeeded: false, fixed_code: healResult.fixedTestBody };
          }
        } catch (healErr) {
          pushLog(suiteExecutionId, `  \u26A0\uFE0F  Heal error for "${tr.test_name}": ${healErr.message}`);
        }
      }
      if (healedCount > 0) {
        pushLog(suiteExecutionId, `\n\uD83E\uDD16  AI Healer: fixed ${healedCount} test(s) — passed: ${passed}, failed: ${failed}`);
      }
    }

    const durationMs = Date.now() - startTime;

    // Copy HTML report to reports directory
    let reportPath = null;
    try {
      const htmlReportDir = path.join(tempDir, 'playwright-report');
      await fs.access(htmlReportDir);
      
      const reportFolderName = `suite-report-${Date.now()}`;
      const reportDestPath = path.join(reportsDir, reportFolderName);
      
      await copyDirectory(htmlReportDir, reportDestPath);
      reportPath = reportFolderName;
      console.log('✓ HTML report saved:', reportDestPath);
    } catch (reportError) {
      console.error('Failed to save HTML report:', reportError.message);
    }

    // Update suite execution record with final results
    try {
      const overallStatus = failed === 0 ? 'PASS' : 'FAIL';

      await suiteExecutionOperations.update(suiteExecutionId, {
        status: overallStatus,
        total_tests: totalTests,
        passed: passed,
        failed: failed,
        duration_ms: durationMs,
        report_path: reportPath
      });
      console.log('✓ Suite execution updated in database, ID:', suiteExecutionId);

      // Save individual test results
      for (let index = 0; index < testResults.length; index++) {
        const testResult = testResults[index];
        // Find the corresponding test file ID from the original suiteTestFiles array
        const testFileId = suiteTestFiles[index]?.test_file_id || null;

        if (testFileId) {
          // Collect per-test trace and video artifacts if configured
          let suiteTestTracePath = null;
          let suiteTestVideoPath = null;
          const testResultsBase = path.join(tempDir, 'test-results');
          const testPrefix = `test-${index + 1}-`;
          try {
            const trEntries = await fs.readdir(testResultsBase).catch(() => []);
            // Find subdirs that belong to this test spec (prefix match)
            const matchDirs = [];
            for (const e of trEntries) {
              if (e.startsWith(testPrefix)) {
                const ep = path.join(testResultsBase, e);
                try { const s = await fs.stat(ep); if (s.isDirectory()) matchDirs.push(ep); } catch {}
              }
            }
            // Recursive helpers
            const findTzip = async (d) => {
              let es; try { es = await fs.readdir(d); } catch { return null; }
              if (es.includes('trace.zip')) return path.join(d, 'trace.zip');
              for (const e of es) { const f = path.join(d, e); try { const s = await fs.stat(f); if (s.isDirectory()) { const r = await findTzip(f); if (r) return r; } } catch {} }
              return null;
            };
            const findVid = async (d) => {
              let es; try { es = await fs.readdir(d); } catch { return null; }
              const v = es.find(e => e.endsWith('.webm') || e.endsWith('.mp4'));
              if (v) return path.join(d, v);
              for (const e of es) { const f = path.join(d, e); try { const s = await fs.stat(f); if (s.isDirectory()) { const r = await findVid(f); if (r) return r; } } catch {} }
              return null;
            };
            // Search matching dirs for artifacts
            for (const md of matchDirs) {
              if (suiteTraceMode !== 'off' && !suiteTestTracePath) {
                const fz = await findTzip(md);
                if (fz) {
                  const fn = `trace-${Date.now()}-t${index}`; const dd = path.join(reportsDir, fn);
                  await fs.mkdir(dd, { recursive: true });
                  await fs.copyFile(fz, path.join(dd, 'trace.zip'));
                  suiteTestTracePath = `${fn}/trace.zip`;
                }
              }
              if (suiteVideoMode !== 'off' && !suiteTestVideoPath) {
                const fv = await findVid(md);
                if (fv) {
                  const ext = path.extname(fv); const fn = `video-${Date.now()}-t${index}`; const dd = path.join(reportsDir, fn);
                  await fs.mkdir(dd, { recursive: true });
                  await fs.copyFile(fv, path.join(dd, `video${ext}`));
                  suiteTestVideoPath = `${fn}/video${ext}`;
                }
              }
            }
          } catch (artifactErr) { console.error(`Artifact collection error for test ${index}:`, artifactErr.message); }

          await suiteTestResultOperations.create({
            suite_execution_id: suiteExecutionId,
            test_file_id: testFileId,
            status: testResult.status,
            duration_ms: testResult.duration_ms,
            error_message: testResult.error_message,
            logs: stdout || stderr || null,
            screenshot_base64: testResult.screenshot_base64 || null,
            trace_path: suiteTestTracePath,
            video_path: suiteTestVideoPath,
          });
        }
      }

      console.log('✓ Saved', testResults.length, 'test results to database');

      // ── Instant Bug Creation ─────────────────────────────────────────────
      // Only raise defects for tests that STILL fail after the AI healer had
      // its one attempt.  Tests the AI fixed (status=PASS / ai_heal_succeeded=true)
      // are excluded.  Deduplicates on title so reruns don't flood the board.
      const failedForBugs = testResults
        .map((tr, idx) => ({ ...tr, testFileId: null }))   // test_file_ids are not test_case ids — keep null to avoid FK errors
        .filter(tr => tr.status === 'FAIL' || tr.status === 'TIMEOUT');

      if (failedForBugs.length > 0) {
        const aiNote = !suiteAiHeal
          ? ' (AI healing not enabled for this org)'
          : !suiteAiApiKey
            ? ' (AI healing enabled but no OpenAI API key configured)'
            : ' (AI heal attempted but could not fix)';
        pushLog(suiteExecutionId, `\n🐛  Auto Bug Creation: ${failedForBugs.length} test(s) still failing${aiNote}...`);
        let bugsCreated = 0;
        for (const tr of failedForBugs) {
          try {
            // Deduplication: skip if any Open or In Progress auto-defect for this
            // test already exists — match on test name substring to survive AI title rewrites.
            const dupCheck = await pool.query(
              `SELECT id, title FROM defects WHERE title LIKE $1 AND status IN ('Open','In Progress') AND org_id = $2 LIMIT 1`,
              [`[Auto]%${tr.test_name}%`, suiteRunOrgId]
            );
            if (dupCheck.rows.length > 0) {
              pushLog(suiteExecutionId, `  ⏭  Skipped "${tr.test_name}" — open defect #${dupCheck.rows[0].id} already exists`);
              continue;
            }

            // Build rich description with every debugging artifact we have
            const logSnippet = (stdout + '\n' + stderr)
              .split('\n')
              .map(l => l.trim())
              .filter(Boolean)
              .slice(-60)
              .join('\n');

            const aiHealNote = !suiteAiHeal
              ? `Not enabled for this organisation`
              : !suiteAiApiKey
                ? `Enabled but no OpenAI API key configured`
                : tr.ai_healed
                  ? `Attempted — fix did not resolve the failure`
                  : `Attempted — could not locate test file in temp workspace`;

            // Read spec source if available (used both for AI description + heal note)
            let specContent = '';
            try {
              const fileInfo = testFileNames.find(fn => fn.testName === tr.test_name);
              if (fileInfo) specContent = await fs.readFile(path.join(tempDir, fileInfo.fileName), 'utf8');
            } catch (_) {}

            let bugTitle = `[Auto] ${tr.test_name} — test ${tr.status.toLowerCase()}`;
            let description;

            // Try AI-generated structured description if key is available
            if (suiteAiApiKey) {
              try {
                pushLog(suiteExecutionId, `  ✏️  Generating AI defect description for "${tr.test_name}"...`);
                const aiDefect = await generateDefectWithAI({
                  testName: tr.test_name,
                  suiteName: suite.name,
                  errorMessage: tr.error_message,
                  specContent,
                  logSnippet,
                  aiHealNote
                }, suiteAiApiKey);
                bugTitle = `[Auto] ${aiDefect.title}`;
                description = aiDefect.description;
                pushLog(suiteExecutionId, `  ✅  AI description generated`);
              } catch (aiErr) {
                pushLog(suiteExecutionId, `  ⚠️  AI description failed (${aiErr.message}) — using template`);
              }
            }

            // Fallback plain-text description if AI was skipped or failed
            if (!description) {
              description = [
                `## Summary`,
                `Automated test "${tr.test_name}" failed in suite "${suite.name}".`,
                ``,
                `## Steps to Reproduce`,
                `1. Run suite: ${suite.name}`,
                `2. Execute test: ${tr.test_name}`,
                ``,
                `## Expected Behavior`,
                `Test should pass without errors.`,
                ``,
                `## Actual Behavior`,
                tr.error_message || 'Test failed — no error message captured.',
                ``,
                `## Execution Details`,
                `- **Suite:** ${suite.name}`,
                `- **Test:** ${tr.test_name}`,
                `- **Result:** ${tr.status}`,
                `- **Duration:** ${tr.duration_ms}ms`,
                `- **Execution ID:** #${suiteExecutionId}`,
                `- **AI Heal:** ${aiHealNote}`,
                ``,
                logSnippet ? `## Execution Logs\n\`\`\`\n${logSnippet}\n\`\`\`` : ''
              ].filter(l => l !== undefined).join('\n').trim();
            }

            const severity = tr.status === 'TIMEOUT' ? 'Medium' : 'High';
            const screenshotData = tr.screenshot_base64
              ? `data:image/png;base64,${tr.screenshot_base64}`
              : null;

            const defect = await defectOperations.create({
              title: bugTitle,
              description,
              severity,
              status: 'Open',
              linked_test_case_id: tr.testFileId || null,
              sprint_id: null,
              screenshot: screenshotData,
              created_by: 'system (auto)',
              assigned_to: null
            }, suiteRunOrgId);

            bugsCreated++;
            pushLog(suiteExecutionId, `  🐛 Created defect #${defect.id} for "${tr.test_name}"`);
          } catch (bugErr) {
            pushLog(suiteExecutionId, `  ⚠️  Could not create defect for "${tr.test_name}": ${bugErr.message}`);
          }
        }
        if (bugsCreated > 0) {
          pushLog(suiteExecutionId, `🐛  ${bugsCreated} new defect(s) auto-created — check the Defects page`);
        } else {
          pushLog(suiteExecutionId, `🐛  All failing tests already have open defects — no duplicates created`);
        }
      }
      // ────────────────────────────────────────────────────────────────────

      pushLog(suiteExecutionId, `\n🏁  Done — ${passed} passed, ${failed} failed`);
    } catch (dbError) {
      console.error('Failed to update suite execution in database:', dbError.message);
    }

  } catch (bgError) {
    console.error('Suite background execution error:', bgError);
    try {
      await suiteExecutionOperations.update(suiteExecutionId, {
        status: 'FAIL',
        total_tests: suiteTestFiles.length,
        passed: 0,
        failed: suiteTestFiles.length,
        duration_ms: Date.now() - startTime,
        report_path: null
      });
    } catch (_) {}
  } finally {
    // Persist log lines to DB before cleanup so historical runs can show logs
    try {
      const logLines = runLogs.get(suiteExecutionId)?.lines || [];
      await pool.query('UPDATE suite_executions SET logs_json=$1 WHERE id=$2', [JSON.stringify(logLines), suiteExecutionId]);
    } catch (_) {}
    finishLog(suiteExecutionId);  // Signal all SSE clients that the run is done
    // Cleanup: Remove temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }
  }
    }); // end setImmediate background run

  } catch (error) {
    console.error('Suite execution error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: error.message,
        suite_id: parseInt(suiteId),
        total_tests: 0,
        passed: 0,
        failed: 0,
        duration_ms: 0,
        tests: []
      });
    }
  }
});

// ===== Features Endpoints =====

// GET /features - Get all features
app.get('/features', async (req, res) => {
  try {
    const features = await featureOperations.getAll(req.session?.orgId || 1);
    res.json(features);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /features/:id - Get a single feature
app.get('/features/:id', async (req, res) => {
  try {
    const feature = await featureOperations.getById(parseInt(req.params.id));
    if (!feature) {
      return res.status(404).json({ error: 'Feature not found' });
    }
    res.json(feature);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /features/:id/requirements - Get all requirements for a feature
app.get('/features/:id/requirements', async (req, res) => {
  try {
    const requirements = await requirementOperations.getByFeatureId(parseInt(req.params.id));
    res.json(requirements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /features/generate-ai - Generate features from a URL + description using AI
app.post('/features/generate-ai', async (req, res) => {
  try {
    const orgId = req.session?.orgId || 1;
    const org = await organizationOperations.getById(orgId);
    if (org?.ai_healing_enabled !== 1) {
      return res.status(403).json({ error: 'AI feature generation is only available for AI-enabled organizations.' });
    }
    const apiKey = org?.openai_api_key || process.env.OPENAI_API_KEY || '';
    if (!apiKey) return res.status(400).json({ error: 'No OpenAI API key configured for this organization.' });

    const { url, description, count = 5 } = req.body;
    if (!description) return res.status(400).json({ error: 'description is required.' });

    const featureCount = Math.min(Math.max(parseInt(count) || 5, 1), 10);

    const prompt = `You are a senior product manager and QA architect. Analyse the following application details and generate ${featureCount} detailed, testable software features.

APPLICATION URL: ${url || '(not provided)'}
DESCRIPTION / FOCUS AREA: ${description}

Rules:
- Each feature must be a clear, testable capability of the application.
- Name: short, precise, action-or-noun form (max 60 chars).
- Description: 2–4 sentences covering what the feature does, key behaviours, and why it matters. Be specific and technical.
- Priority: assign High / Medium / Low based on business impact and user value.
- Cover a mix of priorities; avoid generating all the same priority.
- Do NOT add numbering, markdown, or commentary — return ONLY valid JSON.

Return a JSON array with exactly ${featureCount} objects:
[
  {
    "name": "Feature name",
    "description": "Detailed description of the feature.",
    "priority": "High|Medium|Low"
  }
]`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }], temperature: 0.4, max_tokens: 2000 }),
    });
    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: `OpenAI error ${response.status}: ${errText.slice(0, 200)}` });
    }
    const aiData = await response.json();
    const raw = aiData.choices?.[0]?.message?.content || '';
    const jsonStr = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let features;
    try { features = JSON.parse(jsonStr); } catch {
      return res.status(502).json({ error: 'AI returned invalid JSON.', raw });
    }
    if (!Array.isArray(features)) return res.status(502).json({ error: 'AI did not return an array.' });

    const created = [];
    const createdBy = req.session?.username || null;
    for (const f of features) {
      if (!f.name) continue;
      const priority = ['High', 'Medium', 'Low'].includes(f.priority) ? f.priority : 'Medium';
      const saved = await featureOperations.create({
        name: `AI: ${f.name}`,
        description: f.description || '',
        priority,
        created_by: createdBy,
      }, orgId);
      created.push(saved);
    }

    res.status(201).json({ created });
  } catch (error) {
    console.error('generate-ai features error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /features - Create a new feature
app.post('/features', async (req, res) => {
  try {
    const { name, description, priority } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Validate priority if provided
    if (priority && !['Low', 'Medium', 'High'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority. Must be Low, Medium, or High' });
    }
    
    const feature = await featureOperations.create({
      name,
      description,
      priority: priority || 'Medium',
      created_by: req.session?.username || null
    }, req.session?.orgId || 1);
    
    res.status(201).json(feature);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /features/:id - Update a feature
app.put('/features/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, priority } = req.body;
    
    // Check if feature exists
    const existing = await featureOperations.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Feature not found' });
    }
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Validate priority if provided
    if (priority && !['Low', 'Medium', 'High'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority. Must be Low, Medium, or High' });
    }
    
    const feature = await featureOperations.update(id, { name, description, priority });

    // Log history for changed fields
    const orgId = req.session?.orgId || 1;
    const changedById = req.session?.userId || null;
    const changedByUsername = req.session?.username || null;
    const tracked = { name, description: description || '', priority };
    const prev = { name: existing.name, description: existing.description || '', priority: existing.priority };
    for (const field of Object.keys(tracked)) {
      if (String(tracked[field]) !== String(prev[field])) {
        await featureHistoryOperations.create({ featureId: id, changedById, changedByUsername, field, oldValue: prev[field], newValue: tracked[field] }, orgId);
      }
    }

    res.json(feature);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /features/:id - Delete a feature
app.delete('/features/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Check if feature exists
    const existing = await featureOperations.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Feature not found' });
    }
    
    await featureOperations.delete(id);
    res.json({ message: 'Feature deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /features/:id/comments
app.get('/features/:id/comments', async (req, res) => {
  try {
    res.json(await featureCommentOperations.getByFeatureId(parseInt(req.params.id)));
  } catch (error) { res.status(500).json({ error: error.message }); }
});
// POST /features/:id/comments
app.post('/features/:id/comments', async (req, res) => {
  try {
    const orgId = req.session?.orgId || 1;
    const comment = await featureCommentOperations.create({
      featureId: parseInt(req.params.id),
      authorId: req.session?.userId || null,
      authorName: req.session?.username || req.body.authorName || null,
      content: req.body.content
    }, orgId);
    res.json(comment);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
// GET /features/:id/history
app.get('/features/:id/history', async (req, res) => {
  try {
    res.json(await featureHistoryOperations.getByFeatureId(parseInt(req.params.id)));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ===== Requirements Endpoints =====

// GET /requirements - Get all requirements
app.get('/requirements', async (req, res) => {
  try {
    const requirements = await requirementOperations.getAll(req.session?.orgId || 1);
    res.json(requirements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /requirements/:id - Get a single requirement
app.get('/requirements/:id', async (req, res) => {
  try {
    const requirement = await requirementOperations.getById(parseInt(req.params.id));
    if (!requirement) {
      return res.status(404).json({ error: 'Requirement not found' });
    }
    res.json(requirement);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /requirements/generate-ai — Generate requirements for a feature using GPT-4o (AI orgs only)
app.post('/requirements/generate-ai', async (req, res) => {
  try {
    const orgId = req.session?.orgId || 1;
    const org = await organizationOperations.getById(orgId);
    if (org?.ai_healing_enabled !== 1) {
      return res.status(403).json({ error: 'AI requirement generation is only available for AI-enabled organizations.' });
    }
    const apiKey = org?.openai_api_key || process.env.OPENAI_API_KEY || '';
    if (!apiKey) return res.status(400).json({ error: 'No OpenAI API key configured for this organization.' });

    const { featureId, focus, count = 5 } = req.body;
    if (!featureId) return res.status(400).json({ error: 'featureId is required.' });

    const feature = await featureOperations.getById(featureId);
    if (!feature) return res.status(404).json({ error: 'Feature not found.' });

    const reqCount = Math.min(Math.max(parseInt(count) || 5, 1), 10);

    const prompt = `You are a senior business analyst and QA architect. Generate ${reqCount} detailed, testable requirements for the following software feature.

FEATURE NAME: ${feature.name}
FEATURE DESCRIPTION: ${feature.description || '(no description provided)'}
${focus ? `FOCUS AREA: ${focus}` : ''}

Rules:
- Each requirement must be a specific, verifiable, user-facing behaviour or system constraint.
- Title: clear, concise action statement starting with a verb (e.g. "Allow users to…", "System must…"). Max 80 chars.
- Description: 2–4 sentences. Include acceptance criteria hints (given/when/then style if applicable), edge cases, and any important constraints.
- Priority: High / Medium / Low based on business impact.
- Status: always "Draft".
- Cover a realistic mix of priorities.
- Do NOT add numbering or markdown — return ONLY valid JSON.

Return a JSON array of exactly ${reqCount} objects:
[
  {
    "title": "Requirement title",
    "description": "Detailed description with acceptance criteria.",
    "priority": "High|Medium|Low"
  }
]`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }], temperature: 0.4, max_tokens: 2500 }),
    });
    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: `OpenAI error ${response.status}: ${errText.slice(0, 200)}` });
    }
    const aiData = await response.json();
    const raw = aiData.choices?.[0]?.message?.content || '';
    const jsonStr = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let items;
    try { items = JSON.parse(jsonStr); } catch {
      return res.status(502).json({ error: 'AI returned invalid JSON.', raw });
    }
    if (!Array.isArray(items)) return res.status(502).json({ error: 'AI did not return an array.' });

    const created = [];
    const createdBy = req.session?.username || null;
    for (const item of items) {
      if (!item.title) continue;
      const priority = ['High', 'Medium', 'Low'].includes(item.priority) ? item.priority : 'Medium';
      const saved = await requirementOperations.create({
        feature_id: featureId,
        title: `AI: ${item.title}`,
        description: item.description || '',
        priority,
        status: 'Draft',
        sprint_id: null,
        created_by: createdBy,
      }, orgId);
      created.push(saved);
    }

    res.status(201).json({ created });
  } catch (error) {
    console.error('generate-ai requirements error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /requirements - Create a new requirement
app.post('/requirements', async (req, res) => {
  try {
    const { featureId, organizationId, sprintId, title, description, status, priority } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    if (!featureId) {
      return res.status(400).json({ error: 'Feature ID is required' });
    }
    
    // Validate feature exists
    const feature = await featureOperations.getById(featureId);
    if (!feature) {
      return res.status(400).json({ error: 'Feature not found' });
    }
    
    // Validate sprint exists if provided
    if (sprintId) {
      const sprint = await sprintOperations.getById(sprintId);
      if (!sprint) {
        return res.status(400).json({ error: 'Sprint not found' });
      }
    }
    
    // Validate status if provided
    if (status && !['Draft', 'Approved', 'Implemented'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be Draft, Approved, or Implemented' });
    }
    
    // Validate priority if provided
    if (priority && !['Low', 'Medium', 'High'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority. Must be Low, Medium, or High' });
    }
    
    const requirement = await requirementOperations.create({
      feature_id: featureId,
      sprint_id: sprintId,
      title,
      description,
      status: status || 'Draft',
      priority: priority || 'Medium',
      created_by: req.session?.username || null
    }, req.session?.orgId || 1);
    
    res.status(201).json(requirement);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /requirements/:id - Update a requirement
app.put('/requirements/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { featureId, organizationId, sprintId, title, description, status, priority } = req.body;
    
    // Check if requirement exists
    const existing = await requirementOperations.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Requirement not found' });
    }
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    if (!featureId) {
      return res.status(400).json({ error: 'Feature ID is required' });
    }
    
    // Validate feature exists
    const feature = await featureOperations.getById(featureId);
    if (!feature) {
      return res.status(400).json({ error: 'Feature not found' });
    }
    
    // Validate sprint exists if provided
    if (sprintId) {
      const sprint = await sprintOperations.getById(sprintId);
      if (!sprint) {
        return res.status(400).json({ error: 'Sprint not found' });
      }
    }
    
    // Validate status if provided
    if (status && !['Draft', 'Approved', 'Implemented'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be Draft, Approved, or Implemented' });
    }
    
    // Validate priority if provided
    if (priority && !['Low', 'Medium', 'High'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority. Must be Low, Medium, or High' });
    }
    
    const requirement = await requirementOperations.update(id, {
      feature_id: featureId,
      sprint_id: sprintId,
      title,
      description,
      status,
      priority
    });

    // Log history for changed fields
    const orgId = req.session?.orgId || 1;
    const changedById = req.session?.userId || null;
    const changedByUsername = req.session?.username || null;
    const reqTracked = { title, description: description || '', status, priority };
    const reqPrev = { title: existing.title, description: existing.description || '', status: existing.status, priority: existing.priority };
    for (const field of Object.keys(reqTracked)) {
      if (String(reqTracked[field]) !== String(reqPrev[field])) {
        await requirementHistoryOperations.create({ requirementId: id, changedById, changedByUsername, field, oldValue: reqPrev[field], newValue: reqTracked[field] }, orgId);
      }
    }

    res.json(requirement);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /requirements/:id/comments
app.get('/requirements/:id/comments', async (req, res) => {
  try {
    res.json(await requirementCommentOperations.getByRequirementId(parseInt(req.params.id)));
  } catch (error) { res.status(500).json({ error: error.message }); }
});
// POST /requirements/:id/comments
app.post('/requirements/:id/comments', async (req, res) => {
  try {
    const orgId = req.session?.orgId || 1;
    const comment = await requirementCommentOperations.create({
      requirementId: parseInt(req.params.id),
      authorId: req.session?.userId || null,
      authorName: req.session?.username || req.body.authorName || null,
      content: req.body.content
    }, orgId);
    res.json(comment);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
// GET /requirements/:id/history
app.get('/requirements/:id/history', async (req, res) => {
  try {
    res.json(await requirementHistoryOperations.getByRequirementId(parseInt(req.params.id)));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// DELETE /requirements/:id - Delete a requirement
app.delete('/requirements/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Check if requirement exists
    const existing = await requirementOperations.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Requirement not found' });
    }
    
    await requirementOperations.delete(id);
    res.json({ message: 'Requirement deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Test Cases Endpoints =====

// GET /test-cases - Get all test cases
app.get('/test-cases', async (req, res) => {
  try {
    const testCases = await testCaseOperations.getAll(req.session?.orgId || 1);
    res.json(testCases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /test-cases/:id - Get a single test case
app.get('/test-cases/:id', async (req, res) => {
  try {
    const testCase = await testCaseOperations.getById(parseInt(req.params.id));
    if (!testCase) {
      return res.status(404).json({ error: 'Test case not found' });
    }
    res.json(testCase);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /requirements/:id/test-cases - Get test cases for a requirement
app.get('/requirements/:id/test-cases', async (req, res) => {
  try {
    const testCases = await testCaseOperations.getByRequirementId(parseInt(req.params.id));
    res.json(testCases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /requirements/:id/test-files - Get automation test files for a requirement
app.get('/requirements/:id/test-files', async (req, res) => {
  try {
    const testFiles = await testFileOperations.getByRequirementId(parseInt(req.params.id));
    res.json(testFiles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /test-cases/generate-ai — Generate test cases for a requirement using GPT-4o (AI orgs only)
app.post('/test-cases/generate-ai', async (req, res) => {
  try {
    const orgId = req.session?.orgId || 1;
    const org = await organizationOperations.getById(orgId);
    if (org?.ai_healing_enabled !== 1) {
      return res.status(403).json({ error: 'AI test case generation is only available for AI-enabled organizations.' });
    }
    const apiKey = org?.openai_api_key || process.env.OPENAI_API_KEY || '';
    if (!apiKey) return res.status(400).json({ error: 'No OpenAI API key configured for this organization.' });

    const { requirementId, testTypes = [], focus, count = 5 } = req.body;
    if (!requirementId) return res.status(400).json({ error: 'requirementId is required.' });

    const requirement = await requirementOperations.getById(requirementId);
    if (!requirement) return res.status(404).json({ error: 'Requirement not found.' });

    const tcCount = Math.min(Math.max(parseInt(count) || 5, 1), 10);
    const typesLabel = testTypes.length > 0 ? testTypes.join(', ') : 'Happy Path';

    const prompt = `You are a senior QA engineer. Generate up to ${tcCount} detailed, executable manual test cases for the following software requirement.

REQUIREMENT TITLE: ${requirement.title?.replace(/^AI:\s*/, '')}
REQUIREMENT DESCRIPTION: ${requirement.description || '(no description provided)'}
${focus ? `FOCUS AREA: ${focus}` : ''}

TEST TYPES — GENERATE ONLY THESE TYPES: ${typesLabel}

STRICT RULES:
- ONLY generate test cases that belong to the exact test type(s) listed above. Do NOT add any other test type to fill the count.
- If you can only produce fewer than ${tcCount} meaningful test cases for these specific type(s), return fewer — do NOT pad with unrelated types.
- Title: concise, action-oriented, prefixed with the test type in brackets e.g. "[Security] SQL injection on login form". Max 90 chars.
- Preconditions: 1–2 sentences of setup needed before executing steps.
- Steps: 3–7 steps, each with a clear action and expected result.
- Priority: High / Medium / Low based on risk.
- Type: always "Manual".
- Do NOT add numbering or markdown — return ONLY valid JSON.

Return a JSON array of at most ${tcCount} objects:
[
  {
    "title": "[Type] Test case title",
    "preconditions": "Any setup or prerequisites.",
    "steps": [
      { "action": "User action or system event", "expected": "Expected result" }
    ],
    "priority": "High|Medium|Low"
  }
]`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }], temperature: 0.4, max_tokens: 3500 }),
    });
    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: `OpenAI error ${response.status}: ${errText.slice(0, 200)}` });
    }
    const aiData = await response.json();
    const raw = aiData.choices?.[0]?.message?.content || '';
    const jsonStr = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let items;
    try { items = JSON.parse(jsonStr); } catch {
      return res.status(502).json({ error: 'AI returned invalid JSON.', raw });
    }
    if (!Array.isArray(items)) return res.status(502).json({ error: 'AI did not return an array.' });

    const created = [];
    const createdBy = req.session?.username || null;
    for (const item of items) {
      if (!item.title) continue;
      const priority = ['High', 'Medium', 'Low'].includes(item.priority) ? item.priority : 'Medium';
      const stepsJson = JSON.stringify(
        Array.isArray(item.steps) && item.steps.length > 0
          ? item.steps
          : [{ action: 'Execute the scenario described in the title', expected: 'System behaves as specified in the requirement' }]
      );
      const saved = await testCaseOperations.create({
        requirement_id: requirementId,
        title: `AI: ${item.title}`,
        description: '',
        preconditions: item.preconditions || '',
        test_steps: stepsJson,
        expected_result: '',
        type: 'Manual',
        priority,
        status: 'Draft',
        created_by: createdBy,
      }, orgId);
      created.push(saved);
    }

    res.status(201).json({
      created,
      note: created.length < tcCount
        ? `Only ${created.length} test case${created.length === 1 ? '' : 's'} could be generated for the selected type${testTypes.length === 1 ? '' : 's'} (${typesLabel}). Try reducing the count or selecting additional types to generate more.`
        : null,
    });
  } catch (error) {
    console.error('generate-ai test-cases error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /test-cases - Create a new test case
app.post('/test-cases', async (req, res) => {
  try {
    const { requirementId, title, description, preconditions, testSteps, expectedResult, type, priority, status, testFileId } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    // Validate type if provided
    if (type && !['Manual', 'Automated'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be Manual or Automated' });
    }
    
    // Validate priority if provided
    if (priority && !['Low', 'Medium', 'High'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority. Must be Low, Medium, or High' });
    }
    
    // Validate status if provided
    if (status && !['Draft', 'Ready', 'Deprecated'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be Draft, Ready, or Deprecated' });
    }
    
    const testCase = await testCaseOperations.create({
      requirement_id: requirementId || null,
      sprint_id: req.body.sprintId || null,
      title,
      description,
      preconditions,
      test_steps: testSteps,
      expected_result: expectedResult,
      type: type || 'Manual',
      priority: priority || 'Medium',
      status: status || 'Draft',
      test_file_id: testFileId || null,
      created_by: req.session?.username || null
    }, req.session?.orgId || 1);
    
    res.status(201).json(testCase);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /test-cases/:id - Update a test case
app.put('/test-cases/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { requirementId, title, description, preconditions, testSteps, expectedResult, type, priority, status, testFileId } = req.body;
    
    // Check if test case exists
    const existing = await testCaseOperations.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Test case not found' });
    }
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    // Validate type if provided
    if (type && !['Manual', 'Automated'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be Manual or Automated' });
    }
    
    // Validate priority if provided
    if (priority && !['Low', 'Medium', 'High'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority. Must be Low, Medium, or High' });
    }
    
    // Validate status if provided
    if (status && !['Draft', 'Ready', 'Deprecated'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be Draft, Ready, or Deprecated' });
    }
    
    const { sprintId } = req.body;
    const testCase = await testCaseOperations.update(id, {
      requirement_id: requirementId !== undefined ? (requirementId || null) : existing.requirement_id,
      sprint_id: sprintId !== undefined ? (sprintId || null) : existing.sprint_id,
      title,
      description,
      preconditions,
      test_steps: testSteps,
      expected_result: expectedResult,
      type,
      priority,
      status,
      test_file_id: testFileId !== undefined ? testFileId : existing.test_file_id
    });

    // Log history for changed fields
    const tcOrgId = req.session?.orgId || 1;
    const tcChangedById = req.session?.userId || null;
    const tcChangedByUsername = req.session?.username || null;
    const tcTracked = { title, type, priority, status };
    const tcPrev = { title: existing.title, type: existing.type, priority: existing.priority, status: existing.status };
    for (const field of Object.keys(tcTracked)) {
      if (tcTracked[field] !== undefined && String(tcTracked[field]) !== String(tcPrev[field])) {
        await testCaseHistoryOperations.create({ testCaseId: id, changedById: tcChangedById, changedByUsername: tcChangedByUsername, field, oldValue: tcPrev[field], newValue: tcTracked[field] }, tcOrgId);
      }
    }

    res.json(testCase);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /test-cases/:id/comments
app.get('/test-cases/:id/comments', async (req, res) => {
  try {
    res.json(await testCaseCommentOperations.getByTestCaseId(parseInt(req.params.id)));
  } catch (error) { res.status(500).json({ error: error.message }); }
});
// POST /test-cases/:id/comments
app.post('/test-cases/:id/comments', async (req, res) => {
  try {
    const orgId = req.session?.orgId || 1;
    const comment = await testCaseCommentOperations.create({
      testCaseId: parseInt(req.params.id),
      authorId: req.session?.userId || null,
      authorName: req.session?.username || req.body.authorName || null,
      content: req.body.content
    }, orgId);
    res.json(comment);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
// GET /test-cases/:id/history
app.get('/test-cases/:id/history', async (req, res) => {
  try {
    res.json(await testCaseHistoryOperations.getByTestCaseId(parseInt(req.params.id)));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// DELETE /test-cases/:id - Delete a test case
app.delete('/test-cases/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Check if test case exists
    const existing = await testCaseOperations.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Test case not found' });
    }
    
    await testCaseOperations.delete(id);
    res.json({ message: 'Test case deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Manual Test Runs Endpoints =====

// GET /manual-test-runs - Get all manual test runs
app.get('/manual-test-runs', async (req, res) => {
  try {
    const testRuns = await manualTestRunOperations.getAll(req.session?.orgId || 1);
    res.json(testRuns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /manual-test-runs/:id - Get a single manual test run
app.get('/manual-test-runs/:id', async (req, res) => {
  try {
    const testRun = await manualTestRunOperations.getById(parseInt(req.params.id));
    if (!testRun) {
      return res.status(404).json({ error: 'Manual test run not found' });
    }
    res.json(testRun);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /test-cases/:id/manual-test-runs - Get manual test runs for a test case
app.get('/test-cases/:id/manual-test-runs', async (req, res) => {
  try {
    const testRuns = await manualTestRunOperations.getByTestCaseId(parseInt(req.params.id));
    res.json(testRuns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /manual-test-runs - Create a new manual test run
app.post('/manual-test-runs', async (req, res) => {
  try {
    const { testCaseId, status, executedBy, executionNotes } = req.body;
    
    if (!testCaseId) {
      return res.status(400).json({ error: 'Test case ID is required' });
    }
    
    // Validate status if provided
    if (status && !['Passed', 'Failed', 'Blocked'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be Passed, Failed, or Blocked' });
    }
    
    // Check if test case exists
    const testCase = await testCaseOperations.getById(testCaseId);
    if (!testCase) {
      return res.status(404).json({ error: 'Test case not found' });
    }
    
    const testRun = await manualTestRunOperations.create({
      test_case_id: testCaseId,
      status: status || 'Passed',
      executed_by: executedBy,
      execution_notes: executionNotes
    }, req.session?.orgId || 1);
    
    res.status(201).json(testRun);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /manual-test-runs/:id - Update a manual test run
app.put('/manual-test-runs/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, executedBy, executionNotes } = req.body;
    
    // Check if test run exists
    const existing = await manualTestRunOperations.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Manual test run not found' });
    }
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    // Validate status
    if (!['Passed', 'Failed', 'Blocked'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be Passed, Failed, or Blocked' });
    }
    
    const testRun = await manualTestRunOperations.update(id, {
      status,
      executed_by: executedBy,
      execution_notes: executionNotes
    });
    
    res.json(testRun);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /manual-test-runs/:id - Delete a manual test run
app.delete('/manual-test-runs/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Check if test run exists
    const existing = await manualTestRunOperations.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Manual test run not found' });
    }
    
    await manualTestRunOperations.delete(id);
    res.json({ message: 'Manual test run deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============== DEFECTS ENDPOINTS ===============

// Get all defects
app.get('/defects', async (req, res) => {
  try {
    const defects = await defectOperations.getAll(req.session?.orgId || 1);
    res.json(defects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get defect by id
app.get('/defects/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const defect = await defectOperations.getById(id);
    
    if (!defect) {
      return res.status(404).json({ error: 'Defect not found' });
    }
    
    res.json(defect);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new defect
app.post('/defects', async (req, res) => {
  try {
    const { title, description, severity, status, linkedTestCaseId, linkedExecutionId, sprintId, screenshot, assignedTo } = req.body;
    
    // Validate required fields
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    // Validate severity if provided
    if (severity && !['Low', 'Medium', 'High', 'Critical'].includes(severity)) {
      return res.status(400).json({ error: 'Severity must be one of: Low, Medium, High, Critical' });
    }
    
    // Validate status if provided
    if (status && !['Open', 'In Progress', 'Resolved', 'Closed'].includes(status)) {
      return res.status(400).json({ error: 'Status must be one of: Open, In Progress, Resolved, Closed' });
    }
    
    // Validate sprint exists if provided
    if (sprintId) {
      const sprint = await sprintOperations.getById(sprintId);
      if (!sprint) {
        return res.status(400).json({ error: 'Sprint not found' });
      }
    }
    
    const defect = await defectOperations.create({
      title,
      description,
      severity,
      status,
      linked_test_case_id: linkedTestCaseId,
      linked_execution_id: linkedExecutionId,
      sprint_id: sprintId,
      screenshot: screenshot || null,
      created_by: req.session?.username || null,
      assigned_to: assignedTo || null
    }, req.session?.orgId || 1);
    
    res.status(201).json(defect);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update defect
app.put('/defects/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description, severity, status, linkedTestCaseId, linkedExecutionId, sprintId, screenshot, assignedTo } = req.body;
    
    // Check if defect exists
    const existing = await defectOperations.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Defect not found' });
    }
    
    // Validate required fields
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    // Validate severity
    if (severity && !['Low', 'Medium', 'High', 'Critical'].includes(severity)) {
      return res.status(400).json({ error: 'Severity must be one of: Low, Medium, High, Critical' });
    }
    
    // Validate status
    if (status && !['Open', 'In Progress', 'Resolved', 'Closed'].includes(status)) {
      return res.status(400).json({ error: 'Status must be one of: Open, In Progress, Resolved, Closed' });
    }
    
    // Validate sprint exists if provided
    if (sprintId) {
      const sprint = await sprintOperations.getById(sprintId);
      if (!sprint) {
        return res.status(400).json({ error: 'Sprint not found' });
      }
    }
    
    const defect = await defectOperations.update(id, {
      title,
      description,
      severity,
      status,
      linked_test_case_id: linkedTestCaseId,
      linked_execution_id: linkedExecutionId,
      sprint_id: sprintId,
      screenshot: screenshot !== undefined ? screenshot : existing.screenshot,
      assigned_to: assignedTo !== undefined ? assignedTo : existing.assigned_to
    });

    // Record history for changed fields
    const orgId = req.session?.orgId || 1;
    const changedById = req.session?.userId || null;
    const changedByUsername = req.session?.username || null;
    const tracked = { title, description: description || '', severity, status, assigned_to: assignedTo || '' };
    const prev = { title: existing.title, description: existing.description || '', severity: existing.severity, status: existing.status, assigned_to: existing.assigned_to || '' };
    for (const field of Object.keys(tracked)) {
      if (String(tracked[field]) !== String(prev[field])) {
        await defectHistoryOperations.create({ defectId: id, changedById, changedByUsername, field, oldValue: prev[field], newValue: tracked[field] }, orgId);
      }
    }
    
    res.json(defect);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete defect
app.delete('/defects/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Check if defect exists
    const existing = await defectOperations.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Defect not found' });
    }
    
    await defectOperations.delete(id);
    res.json({ message: 'Defect deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /defects/:id/comments
app.get('/defects/:id/comments', async (req, res) => {
  try {
    res.json(await defectCommentOperations.getByDefectId(parseInt(req.params.id)));
  } catch (error) { res.status(500).json({ error: error.message }); }
});
// POST /defects/:id/comments
app.post('/defects/:id/comments', async (req, res) => {
  try {
    const orgId = req.session?.orgId || 1;
    const comment = await defectCommentOperations.create({
      defectId: parseInt(req.params.id),
      authorId: req.session?.userId || null,
      authorName: req.session?.username || req.body.authorName || null,
      content: req.body.content
    }, orgId);
    res.json(comment);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
// GET /defects/:id/history
app.get('/defects/:id/history', async (req, res) => {
  try {
    res.json(await defectHistoryOperations.getByDefectId(parseInt(req.params.id)));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// =============== SPRINTS ENDPOINTS ===============

// Get all sprints
app.get('/sprints', requireAuth, async (req, res) => {
  try {
    const sprints = await sprintOperations.getAll(req.session.orgId);
    res.json(sprints);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sprint by id
app.get('/sprints/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const sprint = await sprintOperations.getByIdWithMetrics(id);
    
    if (!sprint) {
      return res.status(404).json({ error: 'Sprint not found' });
    }
    
    res.json(sprint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new sprint
app.post('/sprints', requireAuth, async (req, res) => {
  try {
    const { name, goal, startDate, endDate, status } = req.body;
    
    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Validate status if provided
    if (status && !['Planned', 'Active', 'Completed', 'Cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Status must be one of: Planned, Active, Completed, Cancelled' });
    }
    
    const sprint = await sprintOperations.create({
      name,
      goal,
      start_date: startDate,
      end_date: endDate,
      status
    }, req.session.orgId);
    
    res.status(201).json(sprint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update sprint
app.put('/sprints/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, goal, startDate, endDate, status } = req.body;
    
    // Check if sprint exists
    const existing = await sprintOperations.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Sprint not found' });
    }
    
    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Validate status
    if (status && !['Planned', 'Active', 'Completed', 'Cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Status must be one of: Planned, Active, Completed, Cancelled' });
    }
    
    const sprint = await sprintOperations.update(id, {
      name,
      goal,
      start_date: startDate,
      end_date: endDate,
      status
    });
    
    res.json(sprint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete sprint
app.delete('/sprints/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Check if sprint exists
    const existing = await sprintOperations.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Sprint not found' });
    }
    
    await sprintOperations.delete(id);
    res.json({ message: 'Sprint deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Auth / Session Management =====
const sessions = new Map(); // token -> { userId, username, role, orgId, ... }

// Reload persisted sessions from DB into the in-memory map on startup
// so sessions survive server restarts (e.g. Railway deploys).
(async () => {
  try {
    const rows = await sessionOperations.getAll();
    for (const row of rows) {
      sessions.set(row.token, {
        userId: row.user_id,
        username: row.username,
        role: row.role,
        orgId: row.org_id,
        customRoleId: row.custom_role_id,
        permissions: row.permissions ? JSON.parse(row.permissions) : null,
        customRoleName: row.custom_role_name,
      });
    }
    console.log(`[sessions] Loaded ${rows.length} session(s) from DB`);
  } catch (err) {
    console.error('[sessions] Failed to reload from DB:', err.message);
  }
})();

// ===== Task Routes =====
app.get('/tasks', requireAuth, async (req, res) => {
  try {
    const { sprintId } = req.query;
    const orgId = req.session.orgId;
    const tasks = sprintId ? await taskOperations.getBySprintId(parseInt(sprintId)) : await taskOperations.getAll(orgId);
    res.json(tasks);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/tasks', requireAuth, async (req, res) => {
  try {
    const { title, description, sprintId, assigneeId, status, priority, createdBy, startDate, endDate, plannedHours, completedHours, requirementId } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const task = await taskOperations.create({ title, description, sprintId, assigneeId, status, priority, createdBy, startDate, endDate, plannedHours, completedHours, requirementId }, req.session.orgId);
    res.status(201).json(task);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/tasks/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await taskOperations.getById(id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    const { title, description, sprintId, assigneeId, status, priority, startDate, endDate, plannedHours, completedHours, requirementId } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const task = await taskOperations.update(id, { title, description, sprintId, assigneeId, status, priority, startDate, endDate, plannedHours, completedHours, requirementId });
    // Log history for changed fields (wrapped in try-catch so a schema/DB issue never fails the update itself)
    try {
      const actor = req.session?.username || null;
      const actorId = req.session?.userId || null;
      const orgId = req.session?.orgId || 1;
      const tracked = [
        ['title', existing.title, title],
        ['status', existing.status, status],
        ['priority', existing.priority, priority],
        ['assignee', existing.assignee_id ? String(existing.assignee_id) : null, assigneeId ? String(assigneeId) : null],
      ];
      for (const [field, oldVal, newVal] of tracked) {
        if (String(oldVal ?? '') !== String(newVal ?? '')) {
          let oldDisplay = oldVal, newDisplay = newVal;
          if (field === 'assignee') {
            const allUsers = await userOperations.getAll(orgId);
            const findName = uid => allUsers.find(u => String(u.id) === String(uid))?.username || uid || '—';
            oldDisplay = oldVal ? findName(oldVal) : '—';
            newDisplay = newVal ? findName(newVal) : '—';
          }
          await taskHistoryOperations.create({ taskId: id, changedById: actorId, changedByUsername: actor, field, oldValue: oldDisplay, newValue: newDisplay }, orgId);
        }
      }
    } catch (histErr) {
      console.warn('Task history logging failed (non-fatal):', histErr.message);
    }
    res.json(task);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/tasks/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!await taskOperations.getById(id)) return res.status(404).json({ error: 'Task not found' });
    await taskOperations.delete(id);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Task comments
app.get('/tasks/:id/comments', requireAuth, async (req, res) => {
  try {
    const comments = await taskCommentOperations.getByTaskId(parseInt(req.params.id));
    res.json(comments);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/tasks/:id/comments', requireAuth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content is required' });
    const comment = await taskCommentOperations.create({
      taskId: parseInt(req.params.id),
      authorId: req.session.userId,
      authorName: req.session.username,
      content: content.trim(),
    }, req.session.orgId);
    res.status(201).json(comment);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Task history
app.get('/tasks/:id/history', requireAuth, async (req, res) => {
  try {
    const history = await taskHistoryOperations.getByTaskId(parseInt(req.params.id));
    res.json(history);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Basic user list for assignee pickers — orgId from query param (most reliable) or session
app.get('/users/list', async (req, res) => {
  try {
    const token = req.headers['x-auth-token'];
    const session = token ? sessions.get(token) : null;
    const orgId = req.query.orgId
      ? parseInt(req.query.orgId)
      : (session?.orgId || req.session?.orgId || 1);
    const users = (await userOperations.getAll(orgId)).map(u => ({ id: u.id, username: u.username, role: u.role }));
    res.json(users);
  } catch (error) { res.status(500).json({ error: error.message }); }
});



function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.session = sessions.get(token);
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!['admin', 'super_admin'].includes(req.session.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

function requireSuperAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.session.role !== 'super_admin') {
      return res.status(403).json({ error: 'Super admin access required' });
    }
    next();
  });
}

// POST /auth/register-org  — create a new organization + its first admin user
// This is a public endpoint (no auth needed) for SaaS onboarding.
app.post('/auth/register-org', async (req, res) => {
  try {
    const { orgName, orgSlug, adminUsername, adminPassword, plan, maxUsers, pocName, pocEmail } = req.body;
    if (!orgName || !orgSlug || !adminUsername || !adminPassword) {
      return res.status(400).json({ error: 'orgName, orgSlug, adminUsername, and adminPassword are required' });
    }
    // Ensure slug is URL-safe
    const slug = orgSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (await organizationOperations.getBySlug(slug)) {
      return res.status(409).json({ error: 'An organization with that slug already exists' });
    }
    if (await userOperations.getByUsername(adminUsername)) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    // Self-signup always creates a free org: 5 seats, no AI features
    const org = await organizationOperations.create({ name: orgName, slug, plan: 'free', maxUsers: 5, pocName: pocName || null, pocEmail: pocEmail || null, aiHealingEnabled: 0, openaiApiKey: null });
    const adminUser = await userOperations.create({
      username: adminUsername,
      password: adminPassword,
      role: 'admin',
      createdBy: null
    }, org.id);
    res.status(201).json({
      org: { id: org.id, name: org.name, slug: org.slug, plan: org.plan },
      user: { id: adminUser.id, username: adminUser.username, role: adminUser.role }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Public org endpoint (no auth needed) ───────────────────────────────────
app.get('/public/org/:slug', async (req, res) => {
  try {
    const org = await organizationOperations.getBySlug(req.params.slug.toLowerCase());
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    res.json({ id: org.id, name: org.name, slug: org.slug, plan: org.plan, aiHealingEnabled: org.ai_healing_enabled === 1 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /public/enquiry — landing page contact form (no auth)
app.post('/public/enquiry', async (req, res) => {
  try {
    const { name, email, company, team_size, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'name, email and message are required.' });
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) return res.status(400).json({ error: 'Invalid email address.' });

    const saved = await enquiryOperations.create({ name, email, company, team_size, message });
    console.log(`📥 Enquiry stored: ${name} <${email}>`);
    res.json({ ok: true, id: saved.id });
  } catch (error) {
    console.error('enquiry error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /enquiries — list all enquiries (super_admin only)
app.get('/enquiries', requireAuth, async (req, res) => {
  if (req.session.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const rows = await enquiryOperations.getAll();
    res.json(rows);
  } catch (error) {
    console.error('enquiries fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Organization management (super_admin only) ──────────────────────────────

// GET /orgs  — list all organizations
app.get('/orgs', requireAuth, async (req, res) => {
  if (req.session.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  try {
    const orgs = await organizationOperations.getAll();
    // Attach user count per org
    const orgsWithCounts = await Promise.all(orgs.map(async org => {
      const { rows } = await pool.query('SELECT COUNT(*) as count FROM users WHERE org_id = $1', [org.id]);
      return { ...org, user_count: parseInt(rows[0]?.count, 10) || 0 };
    }));
    res.json(orgsWithCounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /orgs/:id  — update org name, plan, is_active, or max_users
app.put('/orgs/:id', requireAuth, async (req, res) => {
  if (req.session.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  try {
    const { name, plan, is_active, maxUsers, pocName, pocEmail, aiHealingEnabled, openaiApiKey } = req.body;
    const parsedMaxUsers = (maxUsers !== null && maxUsers !== undefined && maxUsers !== '') ? parseInt(maxUsers, 10) : null;
    const updated = await organizationOperations.update(req.params.id, {
      name, plan, is_active,
      maxUsers: parsedMaxUsers,
      pocName: pocName ?? null,
      pocEmail: pocEmail ?? null,
      aiHealingEnabled: aiHealingEnabled !== undefined ? (aiHealingEnabled ? 1 : 0) : undefined,
      openaiApiKey: openaiApiKey !== undefined ? (openaiApiKey || null) : undefined,
    });
    if (!updated) return res.status(404).json({ error: 'Organization not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /orgs/:orgId/users — super_admin only
app.get('/orgs/:orgId/users', requireAuth, async (req, res) => {
  if (req.session.role !== 'super_admin') return res.status(403).json({ error: 'Super admin access required' });
  try {
    res.json(await userOperations.getAll(parseInt(req.params.orgId)));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// POST /orgs/:orgId/users — super_admin only (create user in a specific org)
app.post('/orgs/:orgId/users', requireAuth, async (req, res) => {
  if (req.session.role !== 'super_admin') return res.status(403).json({ error: 'Super admin access required' });
  try {
    const orgId = parseInt(req.params.orgId);
    const { username, password, role, permissions } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
    if (!role || !role.trim()) return res.status(400).json({ error: 'Role is required' });
    if (role === 'super_admin') return res.status(403).json({ error: 'Cannot create super admin accounts' });
    // Enforce user limit if set
    const org = await organizationOperations.getById(orgId);
    if (org && org.max_users) {
      const { rows: countRows } = await pool.query('SELECT COUNT(*) as count FROM users WHERE org_id = $1', [orgId]);
      if (parseInt(countRows[0].count, 10) >= org.max_users) {
        return res.status(403).json({ error: `User limit reached. This organization allows a maximum of ${org.max_users} user${org.max_users !== 1 ? 's' : ''}.` });
      }
    }
    const existing = await userOperations.getByUsername(username);
    if (existing) return res.status(409).json({ error: 'Username already exists' });
    const user = await userOperations.create({ username, password, role, customRoleId: null, createdBy: req.session.userId,
      permissions: Array.isArray(permissions) ? permissions : null }, orgId);
    res.status(201).json(user);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// PUT /orgs/:orgId/users/:userId — super_admin only (edit a user in a specific org)
app.put('/orgs/:orgId/users/:userId', requireAuth, async (req, res) => {
  if (req.session.role !== 'super_admin') return res.status(403).json({ error: 'Super admin access required' });
  try {
    const id = parseInt(req.params.userId);
    const { username, password, role, is_active, permissions } = req.body;
    const targetUser = await userOperations.getById(id);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (targetUser.role === 'super_admin') return res.status(403).json({ error: 'Cannot modify super admin accounts' });
    if (role === 'super_admin') return res.status(403).json({ error: 'Cannot assign super admin role' });
    const updated = await userOperations.update(id, { username, password, role, customRoleId: null, is_active,
      permissions: Array.isArray(permissions) ? permissions : null });
    if (!is_active || password) {
      for (const [token, sess] of sessions.entries()) {
        if (sess.userId === id) sessions.delete(token);
      }
      await sessionOperations.deleteByUserId(id);
    }
    res.json(updated);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// DELETE /orgs/:orgId/users/:userId — super_admin only
app.delete('/orgs/:orgId/users/:userId', requireAuth, async (req, res) => {
  if (req.session.role !== 'super_admin') return res.status(403).json({ error: 'Super admin access required' });
  try {
    const id = parseInt(req.params.userId);
    const targetUser = await userOperations.getById(id);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (targetUser.role === 'super_admin') return res.status(403).json({ error: 'Super admin accounts cannot be deleted' });
    for (const [token, sess] of sessions.entries()) {
      if (sess.userId === id) sessions.delete(token);
    }
    await sessionOperations.deleteByUserId(id);
    await userOperations.delete(id);
    res.json({ message: 'User deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const user = await userOperations.getByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is disabled' });
    }
    const valid = await userOperations.verifyPassword(password, user.password_hash, user.salt);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    let permissions = null;
    let customRoleName = null;
    if (user.role === 'custom' && user.custom_role_id) {
      const cr = await customRoleOperations.getById(user.custom_role_id);
      if (cr) {
        permissions = JSON.parse(cr.permissions || '[]');
        customRoleName = cr.name;
      }
    } else if (!['admin', 'contributor', 'super_admin'].includes(user.role)) {
      // Free-text custom role — permissions stored directly on user record
      customRoleName = user.role;
      if (user.permissions) {
        try { permissions = JSON.parse(user.permissions); } catch (_) { permissions = []; }
      } else {
        permissions = [];
      }
    }
    const token = crypto.randomBytes(32).toString('hex');
    const sessionData = { userId: user.id, username: user.username, role: user.role,
      orgId: user.org_id || 1,
      customRoleId: user.custom_role_id || null, permissions, customRoleName };
    sessions.set(token, sessionData);
    await sessionOperations.create(token, sessionData);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role,
      orgId: user.org_id || 1, permissions, customRoleName } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /auth/logout
app.post('/auth/logout', async (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) { sessions.delete(token); await sessionOperations.delete(token); }
  res.json({ message: 'Logged out' });
});

// GET /auth/me  — validate stored token
app.get('/auth/me', async (req, res) => {
  const token = req.headers['x-auth-token'];
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const sess = sessions.get(token);
  res.json({ user: { id: sess.userId, username: sess.username, role: sess.role,
    customRoleId: sess.customRoleId || null, permissions: sess.permissions || null,
    customRoleName: sess.customRoleName || null } });
});

// GET /auth/team — any authenticated user can see the team list
app.get('/auth/team', requireAuth, async (req, res) => {
  try {
    const users = (await userOperations.getAll(req.session.orgId)).map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      is_active: u.is_active,
      created_at: u.created_at
    }));
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /auth/users (admin only)
app.get('/auth/users', requireAdmin, async (req, res) => {
  try {
    res.json(await userOperations.getAll(req.session.orgId));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /auth/users (admin only)
app.post('/auth/users', requireAdmin, async (req, res) => {
  try {
    const { username, password, role, customRoleId } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    // Role permission rules
    const callerRole = req.session.role;
    if (role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot create super admin accounts' });
    }
    if (callerRole === 'admin' && role !== 'contributor') {
      return res.status(403).json({ error: 'Admin can only create contributor accounts' });
    }
    if (!['admin', 'contributor', 'custom'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (role === 'custom' && !customRoleId) {
      return res.status(400).json({ error: 'Custom role ID required for custom role users' });
    }
    // Enforce user seat limit
    const limitVal = await settingsOperations.get('user_limit');
    const limit = parseInt(limitVal || '0');
    if (limit > 0) {
      const currentCount = (await userOperations.getAll(req.session.orgId)).filter(u => u.role !== 'super_admin').length;
      if (currentCount >= limit) {
        return res.status(403).json({ error: `User limit of ${limit} reached. Increase the seat limit to add more users.` });
      }
    }
    // Check existing
    const existing = await userOperations.getByUsername(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    const user = await userOperations.create({ username, password, role, customRoleId: customRoleId || null, createdBy: req.session.userId }, req.session.orgId);
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /auth/users/:id (admin only)
app.put('/auth/users/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { username, password, role, customRoleId, is_active } = req.body;
    const callerRole = req.session.role;
    // Prevent changing a super_admin's role
    const targetUser = await userOperations.getById(id);
    if (targetUser && targetUser.role === 'super_admin' && callerRole !== 'super_admin') {
      return res.status(403).json({ error: 'Cannot modify super admin accounts' });
    }
    if (role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot assign super admin role' });
    }
    // Prevent admin from disabling their own account
    if (id === req.session.userId && is_active === false) {
      return res.status(400).json({ error: 'You cannot disable your own account' });
    }
    const updated = await userOperations.update(id, { username, password, role, customRoleId: customRoleId || null, is_active });
    // Invalidate sessions for this user if deactivated or password changed
    if (!is_active || password) {
      for (const [token, sess] of sessions.entries()) {
        if (sess.userId === id) sessions.delete(token);
      }
      await sessionOperations.deleteByUserId(id);
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /auth/users/:id (admin only)
app.delete('/auth/users/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (id === req.session.userId) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    // Block deletion of super_admin accounts from the frontend
    const targetUser = await userOperations.getById(id);
    if (targetUser && targetUser.role === 'super_admin') {
      return res.status(403).json({ error: 'Super admin accounts cannot be deleted from the frontend' });
    }
    // Invalidate any active sessions for deleted user
    for (const [token, sess] of sessions.entries()) {
      if (sess.userId === id) sessions.delete(token);
    }
    await sessionOperations.deleteByUserId(id);
    await userOperations.delete(id);
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Custom Roles endpoints (super_admin only for write, requireAdmin for read) ─

// GET /auth/roles
app.get('/auth/roles', requireAdmin, async (req, res) => {
  try {
    res.json(await customRoleOperations.getAll(req.session.orgId));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /auth/roles
app.post('/auth/roles', requireSuperAdmin, async (req, res) => {
  try {
    const { name, permissions } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Role name is required' });
    }
    const role = await customRoleOperations.create({ name: name.trim(), permissions: permissions || [], createdBy: req.session.userId }, req.session.orgId);
    res.status(201).json(role);
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A role with that name already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT /auth/roles/:id
app.put('/auth/roles/:id', requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, permissions } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Role name is required' });
    }
    const existing = await customRoleOperations.getById(id);
    if (!existing) return res.status(404).json({ error: 'Role not found' });
    const updated = await customRoleOperations.update(id, { name: name.trim(), permissions: permissions || [] });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /auth/roles/:id
app.delete('/auth/roles/:id', requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await customRoleOperations.getById(id);
    if (!existing) return res.status(404).json({ error: 'Role not found' });
    await customRoleOperations.delete(id);
    res.json({ message: 'Role deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Settings endpoints ───────────────────────────────────────────────────

// GET /auth/settings  – any admin/super_admin can read
app.get('/auth/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await settingsOperations.getAll();
    // Override user_limit with the org's max_users (per-org limit takes precedence)
    const orgId = req.session?.orgId || 1;
    const org = await organizationOperations.getById(orgId);
    if (org && org.max_users != null) {
      settings.user_limit = String(org.max_users);
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /auth/settings  – super_admin only
app.put('/auth/settings', requireSuperAdmin, async (req, res) => {
  try {
    const { user_limit } = req.body;
    if (user_limit !== undefined) {
      const val = parseInt(user_limit);
      if (isNaN(val) || val < 0) {
        return res.status(400).json({ error: 'user_limit must be a non-negative integer (0 = unlimited)' });
      }
      await settingsOperations.set('user_limit', val);
      // Also update the org's max_users so it stays in sync
      const orgId = req.session?.orgId || 1;
      const org = await organizationOperations.getById(orgId);
      if (org) {
        await organizationOperations.update(orgId, {
          name: org.name, plan: org.plan, is_active: org.is_active,
          maxUsers: val === 0 ? null : val,
          pocName: org.poc_name, pocEmail: org.poc_email,
          aiHealingEnabled: org.ai_healing_enabled, openaiApiKey: null
        });
      }
    }
    // Return with org-specific user_limit
    const settings = await settingsOperations.getAll();
    const orgId = req.session?.orgId || 1;
    const org = await organizationOperations.getById(orgId);
    if (org && org.max_users != null) {
      settings.user_limit = String(org.max_users);
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Wiki endpoints (all require auth) ────────────────────────────────────

// GET /wiki/pages  – list all pages (no content, just metadata)
app.get('/wiki/pages', requireAuth, async (req, res) => {
  try {
    res.json(await wikiOperations.getAll(req.session.orgId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /wiki/pages/:id  – get single page with full content
app.get('/wiki/pages/:id', requireAuth, async (req, res) => {
  try {
    const page = await wikiOperations.getById(parseInt(req.params.id));
    if (!page) return res.status(404).json({ error: 'Page not found' });
    res.json(page);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /wiki/pages  – create page
app.post('/wiki/pages', requireAuth, async (req, res) => {
  try {
    const { title, content, parentId } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
    const page = await wikiOperations.create({
      title: title.trim(),
      content: content || '',
      parentId: parentId || null,
      createdBy: req.session.username
    }, req.session.orgId);
    res.status(201).json(page);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /wiki/pages/:id  – update page
app.put('/wiki/pages/:id', requireAuth, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
    const existing = await wikiOperations.getById(parseInt(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Page not found' });
    const page = await wikiOperations.update(parseInt(req.params.id), {
      title: title.trim(),
      content: content !== undefined ? content : existing.content
    });
    res.json(page);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /wiki/pages/:id  – delete page (cascades to children)
app.delete('/wiki/pages/:id', requireAuth, async (req, res) => {
  try {
    const existing = await wikiOperations.getById(parseInt(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Page not found' });
    await wikiOperations.delete(parseInt(req.params.id));
    res.json({ message: 'Page deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  res.json({ status: 'ok' });
});

// ─── TEMPORARY: migrate global vars from org 1 to org 2 ─────────────────────
app.post('/debug-migrate-globalvars', async (req, res) => {
  const { fromOrg = 1, toOrg } = req.body;
  if (!toOrg) return res.status(400).json({ error: 'toOrg required' });
  try {
    const r = await pool.query(
      'UPDATE global_variables SET org_id = $1 WHERE org_id = $2 RETURNING id, key, org_id',
      [toOrg, fromOrg]
    );
    res.json({ migrated: r.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── TEMPORARY DEBUG: session + global vars check ────────────────────────────
app.get('/debug-session', async (req, res) => {
  const token = req.headers['x-auth-token'];
  const inMemory = token ? sessions.has(token) : false;
  let dbRow = null;
  if (token) {
    try {
      const r = await pool.query('SELECT user_id, username, org_id FROM auth_sessions WHERE token = $1', [token]);
      dbRow = r.rows[0] || null;
    } catch (e) { dbRow = { error: e.message }; }
  }
  const orgId = req.session?.orgId || 1;
  let globalVarKeys = [];
  try {
    const env = await globalVariableOperations.getAllAsEnv(orgId);
    globalVarKeys = Object.keys(env);
  } catch (e) { globalVarKeys = [`ERROR: ${e.message}`]; }
  // Show all global vars in DB regardless of org
  let allGlobalVars = [];
  try {
    const r = await pool.query('SELECT id, key, value, org_id FROM global_variables ORDER BY org_id, key');
    allGlobalVars = r.rows;
  } catch (e) { allGlobalVars = [{ error: e.message }]; }
  res.json({
    tokenPresent: !!token,
    inMemorySession: inMemory,
    dbRow,
    resolvedSession: req.session || null,
    orgId,
    globalVarKeys,
    allGlobalVarsInDB: allGlobalVars,
  });
});

// ─── Platform Feature Requests ───────────────────────────────────────────────
// POST /platform-feedback — any authenticated user can submit a feature request
app.post('/platform-feedback', requireAuth, async (req, res) => {
  const { title, description } = req.body;
  if (!title || !description) return res.status(400).json({ error: 'title and description are required' });
  try {
    const record = await platformFeedbackOperations.create({
      title,
      description,
      submitted_by: req.session.username,
      org_slug: req.session.orgSlug || null,
      org_id: req.session.orgId || null
    });
    res.status(201).json(record);
  } catch (err) {
    console.error('platform-feedback create error:', err);
    res.status(500).json({ error: 'Failed to save feature request' });
  }
});

// GET /platform-feedback — super_admin only
app.get('/platform-feedback', requireAuth, async (req, res) => {
  if (req.session.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const rows = await platformFeedbackOperations.getAll();
    res.json(rows);
  } catch (err) {
    console.error('platform-feedback fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch feature requests' });
  }
});

// PATCH /platform-feedback/:id/status — super_admin only
app.patch('/platform-feedback/:id/status', requireAuth, async (req, res) => {
  if (req.session.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status required' });
  try {
    await platformFeedbackOperations.updateStatus(req.params.id, status);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// ─── Platform Bug Reports ─────────────────────────────────────────────────────
// POST /platform-bug-reports — any authenticated user can submit a bug report
app.post('/platform-bug-reports', requireAuth, async (req, res) => {
  const { title, description, steps, severity } = req.body;
  if (!title || !description) return res.status(400).json({ error: 'title and description are required' });
  try {
    const record = await platformBugReportOperations.create({
      title,
      description,
      steps: steps || null,
      severity: severity || 'medium',
      submitted_by: req.session.username,
      org_slug: req.session.orgSlug || null,
      org_id: req.session.orgId || null
    });
    res.status(201).json(record);
  } catch (err) {
    console.error('platform-bug-reports create error:', err);
    res.status(500).json({ error: 'Failed to save bug report' });
  }
});

// GET /platform-bug-reports — super_admin only
app.get('/platform-bug-reports', requireAuth, async (req, res) => {
  if (req.session.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const rows = await platformBugReportOperations.getAll();
    res.json(rows);
  } catch (err) {
    console.error('platform-bug-reports fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch bug reports' });
  }
});

// PATCH /platform-bug-reports/:id/status — super_admin only
app.patch('/platform-bug-reports/:id/status', requireAuth, async (req, res) => {
  if (req.session.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status required' });
  try {
    await platformBugReportOperations.updateStatus(req.params.id, status);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// ============================================================
// PERFORMANCE TESTING — k6-based routes
// ============================================================
// NOTE: top-level `fs` is require('fs').promises — use fsSync for synchronous calls
const fsSync = require('fs');

/**
 * Generate a k6 script from a performance test definition.
 */
function generateK6Script(test) {
  const { template, target_url, vus, ramp_duration, hold_duration, thresholds_json } = test;

  // Build thresholds block
  const thresholdLines = (thresholds_json || []).map(t => {
    const k6MetricMap = {
      p95: 'http_req_duration{quantile:"0.95"}',
      p99: 'http_req_duration{quantile:"0.99"}',
      p50: 'http_req_duration{quantile:"0.5"}',
      avg_latency: 'http_req_duration',
      error_rate: 'http_req_failed',
      req_rate: 'http_reqs',
    };
    const metric = k6MetricMap[t.metric] || t.metric;
    return `    '${metric}': ['${t.operator} ${t.value}']`;
  }).join(',\n');

  const thresholdsBlock = thresholdLines
    ? `  thresholds: {\n${thresholdLines}\n  },\n`
    : '';

  // Build stages by template
  const rampS = ramp_duration || 60;
  const holdS = hold_duration || 300;

  let stages = '';
  switch (template) {
    case 'smoke':
      stages = `[
    { duration: '5s', target: 2 },
    { duration: '30s', target: 2 },
    { duration: '5s', target: 0 },
  ]`;
      break;
    case 'load':
      stages = `[
    { duration: '${rampS}s', target: ${vus} },
    { duration: '${holdS}s', target: ${vus} },
    { duration: '${Math.round(rampS / 2)}s', target: 0 },
  ]`;
      break;
    case 'soak':
      stages = `[
    { duration: '${rampS}s', target: ${vus} },
    { duration: '${holdS}s', target: ${vus} },
    { duration: '60s', target: 0 },
  ]`;
      break;
    case 'spike':
      stages = `[
    { duration: '10s', target: ${vus} },
    { duration: '30s', target: ${vus * 10} },
    { duration: '30s', target: ${vus} },
    { duration: '10s', target: 0 },
  ]`;
      break;
    case 'stress':
      stages = `[
    { duration: '${rampS}s', target: ${vus} },
    { duration: '${holdS}s', target: ${vus * 2} },
    { duration: '${rampS}s', target: ${vus * 4} },
    { duration: '60s', target: 0 },
  ]`;
      break;
    default:
      stages = `[
    { duration: '${rampS}s', target: ${vus} },
    { duration: '${holdS}s', target: ${vus} },
    { duration: '30s', target: 0 },
  ]`;
  }

  return `import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
${thresholdsBlock}  stages: ${stages},
};

export default function () {
  const res = http.get('${target_url}');
  check(res, {
    'status 2xx': (r) => r.status >= 200 && r.status < 400,
  });
  sleep(1);
}
`;
}

/**
 * Parse k6 JSON output (--out json=file) into time-series metric rows.
 * k6 emits one JSON object per line; we aggregate into ~5s buckets.
 */
function parseK6Output(outputText) {
  const lines = outputText.split('\n').filter(Boolean);
  const buckets = {};  // keyed by 5s bucket offset

  let startTs = null;
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.type !== 'Point') continue;
      const ts = new Date(obj.data.time).getTime() / 1000;
      if (startTs === null) startTs = ts;
      const offset = Math.floor((ts - startTs) / 5) * 5;
      if (!buckets[offset]) {
        buckets[offset] = { ts_offset: offset, req_count: 0, req_rate: 0, durations: [], errors: 0, active_vus: 0 };
      }
      const b = buckets[offset];
      const metric = obj.metric;
      const val = obj.data.value;
      if (metric === 'http_reqs') { b.req_count += val; b.req_rate += val; }
      if (metric === 'http_req_duration') { b.durations.push(val); }
      if (metric === 'http_req_failed' && val > 0) { b.errors += 1; }
      if (metric === 'vus') { b.active_vus = Math.max(b.active_vus, val); }
    } catch { /* skip bad lines */ }
  }

  return Object.values(buckets).sort((a, b) => a.ts_offset - b.ts_offset).map(b => {
    const sorted = [...b.durations].sort((x, y) => x - y);
    const pct = (p) => sorted.length ? sorted[Math.floor(sorted.length * p / 100)] || 0 : 0;
    const avg = sorted.length ? sorted.reduce((s, v) => s + v, 0) / sorted.length : 0;
    return {
      ts_offset: b.ts_offset,
      req_count: b.req_count,
      req_rate: parseFloat((b.req_rate / 5).toFixed(2)),
      avg_latency: parseFloat(avg.toFixed(2)),
      p50_latency: parseFloat(pct(50).toFixed(2)),
      p95_latency: parseFloat(pct(95).toFixed(2)),
      p99_latency: parseFloat(pct(99).toFixed(2)),
      error_count: b.errors,
      error_rate: b.req_count > 0 ? parseFloat((b.errors / b.req_count).toFixed(4)) : 0,
      active_vus: b.active_vus,
    };
  });
}

// ── Performance Test CRUD ────────────────────────────────────────────────────
// GET /performance-tests
app.get('/performance-tests', requireAuth, async (req, res) => {
  try {
    const rows = await performanceOperations.getAllTests(req.session.orgId);
    res.json(rows);
  } catch (err) {
    console.error('GET /performance-tests error:', err);
    res.status(500).json({ error: 'Failed to fetch performance tests' });
  }
});

// POST /performance-tests
app.post('/performance-tests', requireAuth, async (req, res) => {
  const { name, description, template, target_url, vus, ramp_duration, hold_duration, thresholds_json } = req.body;
  if (!name || !target_url) return res.status(400).json({ error: 'name and target_url required' });
  try {
    const record = await performanceOperations.createTest({
      org_id: req.session.orgId,
      name, description, template, target_url, vus, ramp_duration, hold_duration,
      thresholds_json: thresholds_json || [],
      created_by: req.session.username,
    });
    res.status(201).json(record);
  } catch (err) {
    console.error('POST /performance-tests error:', err);
    res.status(500).json({ error: 'Failed to create performance test' });
  }
});

// PUT /performance-tests/:id
app.put('/performance-tests/:id', requireAuth, async (req, res) => {
  try {
    const existing = await performanceOperations.getTestById(req.params.id);
    if (!existing || parseInt(existing.org_id) !== parseInt(req.session.orgId)) return res.status(404).json({ error: 'Not found' });
    const updated = await performanceOperations.updateTest(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    console.error('PUT /performance-tests/:id error:', err);
    res.status(500).json({ error: 'Failed to update performance test' });
  }
});

// DELETE /performance-tests/:id
app.delete('/performance-tests/:id', requireAuth, async (req, res) => {
  try {
    const existing = await performanceOperations.getTestById(req.params.id);
    if (!existing || parseInt(existing.org_id) !== parseInt(req.session.orgId)) return res.status(404).json({ error: 'Not found' });
    await performanceOperations.deleteTest(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete performance test' });
  }
});

// POST /performance-tests/:id/run — spawn k6
app.post('/performance-tests/:id/run', requireAuth, async (req, res) => {
  try {
    // Plan gate: only pro/premium/enterprise can run tests
    const orgResult = await pool.query('SELECT plan FROM organizations WHERE id = $1', [req.session.orgId]);
    const plan = orgResult.rows[0]?.plan || 'free';
    if (plan === 'free') {
      return res.status(403).json({ error: 'Performance test execution requires a Pro plan or higher. Upgrade to unlock.' });
    }

    const test = await performanceOperations.getTestById(req.params.id);
    if (!test || parseInt(test.org_id) !== parseInt(req.session.orgId)) return res.status(404).json({ error: 'Not found' });

    // Soak/spike/stress locked to enterprise
    if (['soak', 'spike', 'stress'].includes(test.template) && plan !== 'enterprise') {
      return res.status(403).json({ error: `The "${test.template}" template requires an Enterprise plan.` });
    }

    // Create execution record
    const execution = await performanceOperations.createExecution({
      org_id: req.session.orgId,
      perf_test_id: test.id,
      triggered_by: req.session.username,
    });

    // Write k6 script to temp file
    const scriptDir = path.join(__dirname, 'temp');
    if (!fsSync.existsSync(scriptDir)) fsSync.mkdirSync(scriptDir, { recursive: true });
    const scriptPath = path.join(scriptDir, `perf_${execution.id}.js`);
    const outputPath = path.join(scriptDir, `perf_out_${execution.id}.json`);
    fsSync.writeFileSync(scriptPath, generateK6Script(test));

    // Return execution id + snapshot immediately; spawned process saves results async
    res.status(202).json({ executionId: execution.id, execution });

    // Spawn k6
    const k6 = spawn('k6', ['run', '--out', `json=${outputPath}`, '--no-color', scriptPath], {
      env: { ...process.env },
      cwd: scriptDir,
    });

    // Kill after max possible test duration + 2 min buffer so the execution never stays 'running' forever
    const maxMs = (test.ramp_duration + test.hold_duration + 120) * 1000;
    const killTimer = setTimeout(() => {
      try { k6.kill('SIGTERM'); } catch {}
    }, maxMs);

    const logLines = [];
    k6.stdout.on('data', d => logLines.push(d.toString()));
    k6.stderr.on('data', d => logLines.push(d.toString()));

    k6.on('close', async (code) => {
      clearTimeout(killTimer);
      try {
        // Parse output file if it exists
        let metrics = [];
        if (fsSync.existsSync(outputPath)) {
          const raw = fsSync.readFileSync(outputPath, 'utf8');
          metrics = parseK6Output(raw);
          fsSync.unlinkSync(outputPath);
        }

        // Build summary
        const summary = {};
        if (metrics.length > 0) {
          const allDur = metrics.map(m => m.avg_latency);
          const allP95 = metrics.map(m => m.p95_latency);
          const totalReqs = metrics.reduce((s, m) => s + m.req_count, 0);
          const totalErrors = metrics.reduce((s, m) => s + m.error_count, 0);
          summary.total_requests = totalReqs;
          summary.error_rate = totalReqs > 0 ? parseFloat((totalErrors / totalReqs).toFixed(4)) : 0;
          summary.avg_latency = parseFloat((allDur.reduce((s, v) => s + v, 0) / allDur.length).toFixed(2));
          summary.p95_latency = parseFloat((allP95.reduce((s, v) => s + v, 0) / allP95.length).toFixed(2));
          summary.peak_vus = Math.max(...metrics.map(m => m.active_vus));
          summary.duration_s = metrics[metrics.length - 1]?.ts_offset || 0;
        }
        summary.exit_code = code;
        summary.logs = logLines.join('').slice(-3000);

        // Evaluate thresholds
        const thresholdResults = (test.thresholds_json || []).map(t => {
          let actual = null;
          if (summary.p95_latency !== undefined && t.metric === 'p95') actual = summary.p95_latency;
          if (summary.avg_latency !== undefined && t.metric === 'avg_latency') actual = summary.avg_latency;
          if (summary.error_rate !== undefined && t.metric === 'error_rate') actual = summary.error_rate * 100;
          let passed = false;
          if (actual !== null) {
            if (t.operator === '<') passed = actual < parseFloat(t.value);
            if (t.operator === '>') passed = actual > parseFloat(t.value);
            if (t.operator === '<=') passed = actual <= parseFloat(t.value);
            if (t.operator === '>=') passed = actual >= parseFloat(t.value);
          }
          return { metric: t.metric, operator: t.operator, threshold: parseFloat(t.value), actual, passed };
        });

        const allPassed = thresholdResults.every(t => t.passed);
        const finalStatus = code === 0 && allPassed ? 'passed' : (code === 0 ? 'thresholds_failed' : 'failed');

        await performanceOperations.updateExecutionStatus(execution.id, finalStatus, summary);
        if (metrics.length > 0) await performanceOperations.insertMetrics(execution.id, metrics);
        if (thresholdResults.length > 0) await performanceOperations.insertThresholdResults(execution.id, thresholdResults);
      } catch (saveErr) {
        console.error('Error saving k6 results:', saveErr);
        await performanceOperations.updateExecutionStatus(execution.id, 'failed', { error: saveErr.message });
      } finally {
        try { if (fsSync.existsSync(scriptPath)) fsSync.unlinkSync(scriptPath); } catch {}
      }
    });

    k6.on('error', async (err) => {
      clearTimeout(killTimer);
      console.error('k6 spawn error:', err);
      await performanceOperations.updateExecutionStatus(execution.id, 'failed', { error: err.message });
    });

  } catch (err) {
    console.error('POST /performance-tests/:id/run error:', err);
    res.status(500).json({ error: 'Failed to start performance test' });
  }
});

// ── Performance Execution Routes ─────────────────────────────────────────────
// GET /performance-executions
app.get('/performance-executions', requireAuth, async (req, res) => {
  try {
    const rows = await performanceOperations.getAllExecutions(req.session.orgId);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch executions' });
  }
});

// GET /performance-executions/:id
app.get('/performance-executions/:id', requireAuth, async (req, res) => {
  try {
    // Pass orgId into the query so filtering happens in SQL — avoids JS type mismatch
    const row = await performanceOperations.getExecutionById(req.params.id, req.session.orgId);
    if (!row) {
      // Log for server-side debugging
      const raw = await performanceOperations.getExecutionById(req.params.id);
      console.warn(`GET /performance-executions/${req.params.id}: row.org_id=${raw?.org_id} session.orgId=${req.session.orgId} (no match or missing)`);
      return res.status(404).json({ error: 'Not found' });
    }
    // Auto-recover stale executions: if still 'running'/'pending' after 15+ minutes, mark failed
    if ((row.status === 'running' || row.status === 'pending') && row.started_at) {
      const ageMs = Date.now() - new Date(row.started_at).getTime();
      if (ageMs > 15 * 60 * 1000) {
        await performanceOperations.updateExecutionStatus(row.id, 'failed', { error: 'Execution timed out — process did not complete within 15 minutes.' });
        row.status = 'failed';
        row.summary_json = { error: 'Execution timed out — process did not complete within 15 minutes.' };
      }
    }
    const thresholds = await performanceOperations.getThresholdResults(req.params.id);
    res.json({ ...row, threshold_results: thresholds });
  } catch (err) {
    console.error('GET /performance-executions/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch execution' });
  }
});

// GET /performance-executions/:id/metrics
app.get('/performance-executions/:id/metrics', requireAuth, async (req, res) => {
  try {
    const exec = await performanceOperations.getExecutionById(req.params.id, req.session.orgId);
    if (!exec) return res.status(404).json({ error: 'Not found' });
    const metrics = await performanceOperations.getMetrics(req.params.id);
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// DELETE /performance-executions/:id
app.delete('/performance-executions/:id', requireAuth, async (req, res) => {
  try {
    const exec = await performanceOperations.getExecutionById(req.params.id, req.session.orgId);
    if (!exec) return res.status(404).json({ error: 'Not found' });
    await performanceOperations.deleteExecution(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete execution' });
  }
});

// GET /performance-executions/:id/status — lightweight polling endpoint
app.get('/performance-executions/:id/status', requireAuth, async (req, res) => {
  try {
    const exec = await performanceOperations.getExecutionById(req.params.id, req.session.orgId);
    if (!exec) return res.status(404).json({ error: 'Not found' });
    res.json({ id: exec.id, status: exec.status, started_at: exec.started_at, ended_at: exec.ended_at, summary_json: exec.summary_json });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// ── Perf Folder Routes ───────────────────────────────────────────────────────
app.get('/perf-folders', requireAuth, async (req, res) => {
  try {
    const folders = await perfFolderOperations.getAll(req.session.orgId);
    res.json(folders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

app.post('/perf-folders', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const folder = await perfFolderOperations.create({ org_id: req.session.orgId, name: name.trim() });
    res.status(201).json(folder);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

app.put('/perf-folders/:id', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const updated = await perfFolderOperations.update(req.params.id, req.session.orgId, name.trim());
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update folder' });
  }
});

app.delete('/perf-folders/:id', requireAuth, async (req, res) => {
  try {
    await perfFolderOperations.delete(req.params.id, req.session.orgId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// ── Perf Suite Routes ────────────────────────────────────────────────────────
app.get('/perf-suites', requireAuth, async (req, res) => {
  try {
    const suites = await perfSuiteOperations.getAll(req.session.orgId);
    const suitesWithCount = await Promise.all(suites.map(async (s) => {
      const tests = await perfSuiteOperations.getTests(s.id);
      return { ...s, test_count: tests.length };
    }));
    res.json(suitesWithCount);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch suites' });
  }
});

app.post('/perf-suites', requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const suite = await perfSuiteOperations.create({
      org_id: req.session.orgId, name: name.trim(), description,
    });
    res.status(201).json(suite);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create suite' });
  }
});

app.put('/perf-suites/:id', requireAuth, async (req, res) => {
  try {
    const suite = await perfSuiteOperations.getById(req.params.id, req.session.orgId);
    if (!suite) return res.status(404).json({ error: 'Not found' });
    const updated = await perfSuiteOperations.update(req.params.id, req.session.orgId, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update suite' });
  }
});

app.delete('/perf-suites/:id', requireAuth, async (req, res) => {
  try {
    await perfSuiteOperations.delete(req.params.id, req.session.orgId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete suite' });
  }
});

app.get('/perf-suites/:id/tests', requireAuth, async (req, res) => {
  try {
    const suite = await perfSuiteOperations.getById(req.params.id, req.session.orgId);
    if (!suite) return res.status(404).json({ error: 'Not found' });
    const tests = await perfSuiteOperations.getTests(req.params.id);
    res.json(tests);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch suite tests' });
  }
});

app.post('/perf-suites/:id/tests', requireAuth, async (req, res) => {
  try {
    const suite = await perfSuiteOperations.getById(req.params.id, req.session.orgId);
    if (!suite) return res.status(404).json({ error: 'Not found' });
    const { test_id } = req.body;
    if (!test_id) return res.status(400).json({ error: 'test_id required' });
    const test = await performanceOperations.getTestById(test_id);
    if (!test || parseInt(test.org_id) !== parseInt(req.session.orgId)) {
      return res.status(404).json({ error: 'Test not found' });
    }
    await perfSuiteOperations.addTest(req.params.id, test_id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add test to suite' });
  }
});

app.delete('/perf-suites/:id/tests/:testId', requireAuth, async (req, res) => {
  try {
    const suite = await perfSuiteOperations.getById(req.params.id, req.session.orgId);
    if (!suite) return res.status(404).json({ error: 'Not found' });
    await perfSuiteOperations.removeTest(req.params.id, req.params.testId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove test from suite' });
  }
});

// POST /perf-suites/:id/run — run all tests in suite sequentially
app.post('/perf-suites/:id/run', requireAuth, async (req, res) => {
  try {
    const orgResult = await pool.query('SELECT plan FROM organizations WHERE id = $1', [req.session.orgId]);
    const plan = orgResult.rows[0]?.plan || 'free';
    if (plan === 'free') {
      return res.status(403).json({ error: 'Suite runs require a Pro plan or higher.' });
    }

    const suite = await perfSuiteOperations.getById(req.params.id, req.session.orgId);
    if (!suite) return res.status(404).json({ error: 'Not found' });

    const suiteTests = await perfSuiteOperations.getTests(req.params.id);
    if (suiteTests.length === 0) return res.status(400).json({ error: 'Suite has no tests. Add tests before running.' });

    const suiteExec = await perfSuiteOperations.createExecution({
      suite_id: suite.id,
      org_id: req.session.orgId,
      triggered_by: req.session.username,
    });

    res.status(202).json({ suiteExecutionId: suiteExec.id, suiteExecution: suiteExec });

    // Run tests sequentially in background
    (async () => {
      const results = [];
      for (const st of suiteTests) {
        try {
          const test = await performanceOperations.getTestById(st.perf_test_id);
          if (!test) {
            results.push({ test_id: st.perf_test_id, test_name: st.test_name, status: 'failed', error: 'Test not found' });
            continue;
          }

          const execution = await performanceOperations.createExecution({
            org_id: req.session.orgId,
            perf_test_id: test.id,
            triggered_by: req.session.username,
          });

          results.push({ test_id: test.id, test_name: test.name, execution_id: execution.id, status: 'running' });
          await perfSuiteOperations.updateExecution(suiteExec.id, 'running', { test_executions: results });

          await new Promise((resolve) => {
            const scriptDir = path.join(__dirname, 'temp');
            if (!fsSync.existsSync(scriptDir)) fsSync.mkdirSync(scriptDir, { recursive: true });
            const scriptPath = path.join(scriptDir, `suite_${suiteExec.id}_${execution.id}.js`);
            const outputPath = path.join(scriptDir, `suite_out_${suiteExec.id}_${execution.id}.json`);
            fsSync.writeFileSync(scriptPath, generateK6Script(test));

            const k6 = spawn('k6', ['run', '--out', `json=${outputPath}`, '--no-color', scriptPath], {
              env: { ...process.env }, cwd: scriptDir,
            });

            const maxMs = (test.ramp_duration + test.hold_duration + 120) * 1000;
            const killTimer = setTimeout(() => { try { k6.kill('SIGTERM'); } catch {} }, maxMs);
            const logLines = [];
            k6.stdout.on('data', d => logLines.push(d.toString()));
            k6.stderr.on('data', d => logLines.push(d.toString()));

            k6.on('close', async (code) => {
              clearTimeout(killTimer);
              try {
                let metrics = [];
                if (fsSync.existsSync(outputPath)) {
                  const raw = fsSync.readFileSync(outputPath, 'utf8');
                  metrics = parseK6Output(raw);
                  fsSync.unlinkSync(outputPath);
                }

                const summary = {};
                if (metrics.length > 0) {
                  const allDur = metrics.map(m => m.avg_latency);
                  const allP95 = metrics.map(m => m.p95_latency);
                  const totalReqs = metrics.reduce((s, m) => s + m.req_count, 0);
                  const totalErrors = metrics.reduce((s, m) => s + m.error_count, 0);
                  summary.total_requests = totalReqs;
                  summary.error_rate = totalReqs > 0 ? parseFloat((totalErrors / totalReqs).toFixed(4)) : 0;
                  summary.avg_latency = parseFloat((allDur.reduce((s, v) => s + v, 0) / allDur.length).toFixed(2));
                  summary.p95_latency = parseFloat((allP95.reduce((s, v) => s + v, 0) / allP95.length).toFixed(2));
                  summary.peak_vus = Math.max(...metrics.map(m => m.active_vus));
                }
                summary.exit_code = code;
                summary.logs = logLines.join('').slice(-2000);

                const thresholdResults = (test.thresholds_json || []).map(t => {
                  let actual = null;
                  if (summary.p95_latency !== undefined && t.metric === 'p95') actual = summary.p95_latency;
                  if (summary.avg_latency !== undefined && t.metric === 'avg_latency') actual = summary.avg_latency;
                  if (summary.error_rate !== undefined && t.metric === 'error_rate') actual = summary.error_rate * 100;
                  let passed = false;
                  if (actual !== null) {
                    if (t.operator === '<') passed = actual < parseFloat(t.value);
                    if (t.operator === '>') passed = actual > parseFloat(t.value);
                    if (t.operator === '<=') passed = actual <= parseFloat(t.value);
                    if (t.operator === '>=') passed = actual >= parseFloat(t.value);
                  }
                  return { metric: t.metric, operator: t.operator, threshold: parseFloat(t.value), actual, passed };
                });

                const allPassed = thresholdResults.every(t => t.passed);
                const testStatus = code === 0 && allPassed ? 'passed' : (code === 0 ? 'thresholds_failed' : 'failed');

                await performanceOperations.updateExecutionStatus(execution.id, testStatus, summary);
                if (metrics.length > 0) await performanceOperations.insertMetrics(execution.id, metrics);
                if (thresholdResults.length > 0) await performanceOperations.insertThresholdResults(execution.id, thresholdResults);

                const idx = results.findIndex(r => r.execution_id === execution.id);
                if (idx >= 0) results[idx] = { ...results[idx], status: testStatus, avg_latency: summary.avg_latency, p95_latency: summary.p95_latency, error_rate: summary.error_rate };
              } catch (saveErr) {
                console.error('Suite test save error:', saveErr);
                await performanceOperations.updateExecutionStatus(execution.id, 'failed', { error: saveErr.message });
                const idx = results.findIndex(r => r.execution_id === execution.id);
                if (idx >= 0) results[idx] = { ...results[idx], status: 'failed' };
              } finally {
                try { if (fsSync.existsSync(scriptPath)) fsSync.unlinkSync(scriptPath); } catch {}
                resolve();
              }
            });

            k6.on('error', async (err) => {
              clearTimeout(killTimer);
              console.error('Suite k6 spawn error:', err);
              await performanceOperations.updateExecutionStatus(execution.id, 'failed', { error: err.message });
              const idx = results.findIndex(r => r.execution_id === execution.id);
              if (idx >= 0) results[idx] = { ...results[idx], status: 'failed' };
              resolve();
            });
          });
        } catch (testErr) {
          console.error('Suite test run error:', testErr);
          results.push({ test_id: st.perf_test_id, test_name: st.test_name, status: 'failed', error: testErr.message });
        }
      }

      const anyFailed = results.some(r => r.status === 'failed' || r.status === 'thresholds_failed');
      const finalStatus = anyFailed ? 'failed' : 'passed';
      await perfSuiteOperations.updateExecution(suiteExec.id, finalStatus, {
        test_executions: results,
        total: results.length,
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status !== 'passed').length,
      });
    })().catch(err => {
      console.error('Suite run background error:', err);
      perfSuiteOperations.updateExecution(suiteExec.id, 'failed', { error: err.message });
    });

  } catch (err) {
    console.error('POST /perf-suites/:id/run error:', err);
    res.status(500).json({ error: 'Failed to start suite run' });
  }
});

// ── Perf Suite Execution Routes ──────────────────────────────────────────────
app.get('/perf-suite-executions', requireAuth, async (req, res) => {
  try {
    const execs = await perfSuiteOperations.getAllExecutions(req.session.orgId);
    res.json(execs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch suite executions' });
  }
});

app.get('/perf-suite-executions/:id', requireAuth, async (req, res) => {
  try {
    const exec = await perfSuiteOperations.getExecution(req.params.id, req.session.orgId);
    if (!exec) return res.status(404).json({ error: 'Not found' });
    res.json(exec);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch suite execution' });
  }
});

app.get('/perf-suites/:id/executions', requireAuth, async (req, res) => {
  try {
    const suite = await perfSuiteOperations.getById(req.params.id, req.session.orgId);
    if (!suite) return res.status(404).json({ error: 'Not found' });
    const execs = await perfSuiteOperations.getExecutionsForSuite(req.params.id, req.session.orgId);
    res.json(execs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch suite executions' });
  }
});

app.delete('/perf-suite-executions/:id', requireAuth, async (req, res) => {
  try {
    await perfSuiteOperations.deleteExecution(req.params.id, req.session.orgId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete suite execution' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Perf AI routes — shared helpers
// ─────────────────────────────────────────────────────────────────────────────
async function getPerfAIKey(orgId) {
  const org = await organizationOperations.getById(orgId);
  return org?.openai_api_key || process.env.OPENAI_API_KEY || '';
}
async function callPerfOpenAI(apiKey, messages, maxTokens = 800) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.3, max_tokens: maxTokens }),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(`OpenAI ${r.status}: ${t.slice(0, 200)}`); }
  const data = await r.json();
  return data.choices?.[0]?.message?.content || '';
}

// 1. Threshold recommendations — pure stats, no LLM
app.get('/perf-ai/threshold-recommendations/:testId', requireAuth, async (req, res) => {
  try {
    const { testId } = req.params;
    const orgId = req.session.orgId;
    const r = await pool.query(
      `SELECT summary_json FROM performance_executions
       WHERE perf_test_id=$1 AND org_id=$2 AND status IN ('passed','thresholds_failed','failed')
       ORDER BY started_at DESC LIMIT 20`,
      [testId, orgId]
    );
    if (r.rows.length < 2)
      return res.json({ suggestions: [], message: 'Need at least 2 completed runs for recommendations.' });
    const metricDefs = [
      { key: 'p95_latency',  metric: 'p95',         op: '<', scale: v => Math.ceil(v * 1.5),       fmt: v => `${v.toFixed(0)} ms`,   label: '1.5× avg' },
      { key: 'p99_latency',  metric: 'p99',         op: '<', scale: v => Math.ceil(v * 1.5),       fmt: v => `${v.toFixed(0)} ms`,   label: '1.5× avg' },
      { key: 'avg_latency',  metric: 'avg_latency', op: '<', scale: v => Math.ceil(v * 1.5),       fmt: v => `${v.toFixed(0)} ms`,   label: '1.5× avg' },
      { key: 'error_rate',   metric: 'error_rate',  op: '<', scale: v => Math.max(0.01, +(v * 2 + 0.001).toFixed(4)), fmt: v => `${(v*100).toFixed(2)}%`, label: '2× avg' },
    ];
    const values = {};
    for (const d of metricDefs) values[d.key] = [];
    for (const row of r.rows) {
      let s = row.summary_json;
      if (typeof s === 'string') { try { s = JSON.parse(s); } catch { continue; } }
      for (const d of metricDefs) {
        const v = parseFloat(s?.[d.key]);
        if (!isNaN(v)) values[d.key].push(v);
      }
    }
    const suggestions = [];
    for (const d of metricDefs) {
      const vals = values[d.key];
      if (vals.length < 2) continue;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const max = Math.max(...vals);
      if (avg === 0 && max === 0) continue;
      suggestions.push({
        metric: d.metric, operator: d.op, value: d.scale(avg),
        rationale: `${vals.length} runs · avg ${d.fmt(avg)}, max ${d.fmt(max)} · suggested at ${d.label}`,
      });
    }
    res.json({ suggestions, runCount: r.rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Regression summary — compare two run IDs
app.post('/perf-ai/regression-summary', requireAuth, async (req, res) => {
  try {
    const orgId = req.session.orgId;
    const apiKey = await getPerfAIKey(orgId);
    if (!apiKey) return res.status(400).json({ error: 'No OpenAI API key configured.' });
    const { runAId, runBId } = req.body;
    if (!runAId || !runBId) return res.status(400).json({ error: 'runAId and runBId are required.' });
    const [runA, runB] = await Promise.all([
      performanceOperations.getExecutionById(runAId, orgId),
      performanceOperations.getExecutionById(runBId, orgId),
    ]);
    if (!runA || !runB) return res.status(404).json({ error: 'One or both runs not found.' });
    const fmtRun = r => JSON.stringify({ test: r.test_name, template: r.template, status: r.status, metrics: r.summary_json, started: r.started_at }, null, 2);
    const prompt = `You are a performance testing expert. Compare these two k6 test runs and write a concise analysis (3-5 sentences) covering which metrics changed, by how much, whether regressions/improvements occurred, and a brief hypothesis. Be specific with numbers.\n\nRun A (baseline):\n${fmtRun(runA)}\n\nRun B (latest):\n${fmtRun(runB)}`;
    const summary = await callPerfOpenAI(apiKey, [{ role: 'user', content: prompt }], 500);
    res.json({ summary, runA: { id: runA.id, status: runA.status, started_at: runA.started_at, summary_json: runA.summary_json }, runB: { id: runB.id, status: runB.status, started_at: runB.started_at, summary_json: runB.summary_json } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Anomaly detection — z-score vs history (no LLM)
app.get('/perf-ai/anomaly/:testId', requireAuth, async (req, res) => {
  try {
    const { testId } = req.params;
    const orgId = req.session.orgId;
    const r = await pool.query(
      `SELECT id, summary_json, started_at, status FROM performance_executions
       WHERE perf_test_id=$1 AND org_id=$2 AND status IN ('passed','thresholds_failed','failed')
       ORDER BY started_at DESC LIMIT 21`,
      [testId, orgId]
    );
    if (r.rows.length < 3)
      return res.json({ flagged: [], latestExecution: null, message: 'Need at least 3 runs for anomaly detection.' });
    const rows = r.rows.map(row => {
      let s = row.summary_json;
      if (typeof s === 'string') { try { s = JSON.parse(s); } catch { s = {}; } }
      return { ...row, summary_json: s };
    });
    const latest = rows[0];
    const historical = rows.slice(1);
    const metrics = ['p95_latency', 'p99_latency', 'avg_latency', 'error_rate'];
    const flagged = [];
    for (const m of metrics) {
      const histVals = historical.map(row => row.summary_json?.[m]).filter(v => v != null && !isNaN(parseFloat(v))).map(parseFloat);
      if (histVals.length < 2) continue;
      const latestVal = parseFloat(latest.summary_json?.[m]);
      if (isNaN(latestVal)) continue;
      const mean = histVals.reduce((a, b) => a + b, 0) / histVals.length;
      const variance = histVals.reduce((a, b) => a + (b - mean) ** 2, 0) / histVals.length;
      const stddev = Math.sqrt(variance);
      if (stddev === 0) continue;
      const zScore = (latestVal - mean) / stddev;
      if (Math.abs(zScore) > 2) {
        flagged.push({ metric: m, actual: latestVal, mean: +mean.toFixed(3), stddev: +stddev.toFixed(3), zScore: +zScore.toFixed(2), direction: zScore > 0 ? 'high' : 'low' });
      }
    }
    res.json({ flagged, latestExecution: { id: latest.id, status: latest.status, started_at: latest.started_at, summary_json: latest.summary_json }, historyCount: historical.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. Generate k6 script from natural language
app.post('/perf-ai/generate-script', requireAuth, async (req, res) => {
  try {
    const orgId = req.session.orgId;
    const apiKey = await getPerfAIKey(orgId);
    if (!apiKey) return res.status(400).json({ error: 'No OpenAI API key configured.' });
    const { instruction, template = 'load', targetUrl = '', vus = 10, ramp_duration = 60, hold_duration = 300 } = req.body;
    if (!instruction?.trim()) return res.status(400).json({ error: 'instruction is required.' });
    const prompt = `You are a k6 performance testing expert. Generate a complete, runnable k6 JavaScript test script.\n\nUser description: ${instruction.trim()}\nTemplate type: ${template}\nTarget URL: ${targetUrl || 'as described above'}\nVirtual users: ${vus}\nRamp duration: ${ramp_duration}s\nHold duration: ${hold_duration}s\n\nRequirements:\n- Use modern k6 ES6 syntax with import statements\n- Support __ENV.BASE_URL with a fallback to the target URL\n- Set up stages matching the template (ramp up → hold → ramp down)\n- Add realistic sleep() think time\n- Include meaningful check() assertions on status and response body\n- Add thresholds unless user specified otherwise\n- Return ONLY the JavaScript code, no markdown, no explanation`;
    const script = await callPerfOpenAI(apiKey, [{ role: 'user', content: prompt }], 1500);
    res.json({ script });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. Root cause analysis for a single execution
app.post('/perf-ai/root-cause/:executionId', requireAuth, async (req, res) => {
  try {
    const orgId = req.session.orgId;
    const apiKey = await getPerfAIKey(orgId);
    if (!apiKey) return res.status(400).json({ error: 'No OpenAI API key configured.' });
    const exec = await performanceOperations.getExecutionById(req.params.executionId, orgId);
    if (!exec) return res.status(404).json({ error: 'Execution not found.' });
    const metrics = await performanceOperations.getMetrics(exec.id);
    const s = exec.summary_json || {};
    const durationSec = exec.ended_at ? Math.round((new Date(exec.ended_at) - new Date(exec.started_at)) / 1000) : null;
    const context = {
      test_name: exec.test_name, template: exec.template, target_url: exec.target_url,
      status: exec.status, vus: s.peak_vus, duration: durationSec ? `${durationSec}s` : 'unknown',
      summary: { avg_latency: s.avg_latency, p95_latency: s.p95_latency, p99_latency: s.p99_latency, error_rate: s.error_rate, total_requests: s.total_requests },
      threshold_results: exec.threshold_results,
      metric_trend: metrics.slice(-10).map(m => ({ offset: m.ts_offset, avg: m.avg_latency, p95: m.p95_latency, err: m.error_count, vus: m.active_vus })),
    };
    const prompt = `You are a performance testing expert. Analyze this k6 test execution and provide a root cause analysis in exactly this format:\n\n**Primary Issue:** (1 sentence)\n**Root Cause:** (2-3 sentences referencing specific numbers)\n**Recommendation:** (1-2 actionable sentences)\n\nTest data:\n${JSON.stringify(context, null, 2)}\n\nKeep total response under 160 words. Be specific with numbers from the data.`;
    const analysis = await callPerfOpenAI(apiKey, [{ role: 'user', content: prompt }], 450);
    res.json({ analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. Smart suite suggestions
app.post('/perf-ai/smart-suite', requireAuth, async (req, res) => {
  try {
    const orgId = req.session.orgId;
    const apiKey = await getPerfAIKey(orgId);
    if (!apiKey) return res.status(400).json({ error: 'No OpenAI API key configured.' });
    const tests = await performanceOperations.getAllTests(orgId);
    if (tests.length < 2) return res.status(400).json({ error: 'Need at least 2 tests to suggest suites.' });
    const testList = tests.map(t => ({ id: t.id, name: t.name, template: t.template, url: t.target_url, description: t.description }));
    const prompt = `You are a QA performance testing expert. Given these k6 tests, suggest 2-4 logical test suites grouping related tests for CI/CD pipeline runs.\n\nTests:\n${JSON.stringify(testList, null, 2)}\n\nReturn ONLY valid JSON (no markdown) in this exact structure:\n{"suggestions":[{"name":"Suite Name","description":"brief purpose","testIds":[1,2],"rationale":"why grouped"}]}`;
    let raw = await callPerfOpenAI(apiKey, [{ role: 'user', content: prompt }], 900);
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    let result;
    try { result = JSON.parse(raw); } catch { result = { suggestions: [] }; }
    const validIds = new Set(tests.map(t => t.id));
    if (result.suggestions) {
      result.suggestions = result.suggestions
        .map(s => ({ ...s, testIds: (s.testIds || []).filter(id => validIds.has(id)) }))
        .filter(s => s.testIds.length > 0);
    }
    result.tests = tests.map(t => ({ id: t.id, name: t.name }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => {
  console.log(`TestStudio.Cloud server running on http://localhost:${PORT}`);
});
