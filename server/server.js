require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const crypto = require('crypto');
const { pool, organizationOperations, moduleOperations, testFileOperations, executionOperations, testSuiteOperations, suiteTestFileOperations, suiteExecutionOperations, suiteTestResultOperations, testFileDependencyOperations, featureOperations, requirementOperations, testCaseOperations, manualTestRunOperations, defectOperations, sprintOperations, taskOperations, userOperations, customRoleOperations, wikiOperations, settingsOperations, globalVariableOperations } = require('./db');

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
      p.startsWith('/test-file-dependencies') || p.startsWith('/public')
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
      testFileId: parseInt(req.params.id),
      dependencyFileId,
      dependencyType,
      executionOrder: executionOrder || 0
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
    
    await testFileDependencyOperations.remove(
      parseInt(req.params.id),
      dependencyFileId,
      dependencyType
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
async function healTestWithAI(specContent, errorOutput, apiKey) {
  if (!apiKey) {
    throw new Error('No OpenAI API key configured for this organization.');
  }

  const prompt = `You are an expert Playwright test engineer. A test has failed. Analyze the failure and provide a fix.

## Original Playwright Spec:
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
- fixedTestBody = code INSIDE async ({ page, ... }) => { ... } only, not the wrapper or imports
- Do not change test intent; only fix what is broken
- Use idiomatic Playwright: getByRole, getByLabel, getByText, getByPlaceholder, locator, etc.
- If element not found, use a more resilient selector or add explicit waits
- fixedTestBody must be syntactically valid TypeScript`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
  });

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
  const { code, moduleId, testFileId, browser = 'chromium', debug = false, workers = 1, fullyParallel = false, screenshotMode = 'only-on-failure' } = req.body;

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

  try {
    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });

    // Build the full ordered list of files to execute: before deps → main → after deps
    const filesToRun = []; // [{ label, name, content }]

    if (testFileId) {
      try {
        const execOrder = await testFileDependencyOperations.getExecutionOrder(parseInt(testFileId));

        // Before dependencies
        for (const dep of (execOrder.before || [])) {
          const depFile = await testFileOperations.getById(dep.id);
          if (depFile && depFile.content) {
            filesToRun.push({ label: 'before', name: dep.name, content: depFile.content });
          }
        }

        // Main test — use the live editor code (may have unsaved changes)
        const mainName = execOrder.main ? execOrder.main.name : 'Main Test';
        filesToRun.push({ label: 'main', name: mainName, content: code });

        // After dependencies
        for (const dep of (execOrder.after || [])) {
          const depFile = await testFileOperations.getById(dep.id);
          if (depFile && depFile.content) {
            filesToRun.push({ label: 'after', name: dep.name, content: depFile.content });
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
        const indented = f.content.trim().split('\n').join('\n  ');
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

    specContent = `import { test, expect } from '@playwright/test';${moduleImportBlock}
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
    trace: '${debug ? 'on' : 'off'}',
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
            report_path: reportPath
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
        const healResult = await healTestWithAI(specContent, combinedError || error.message || '', orgApiKey);
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
                report_path: reportPath
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
            report_path: reportPath
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
      moduleId,
      name
    }, orgId);
    
    // Add test files to the suite
    if (testFileIds && testFileIds.length > 0) {
      for (const testFileId of testFileIds) {
        await suiteTestFileOperations.add({
          suiteId: suite.id,
          testFileId
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
        suiteId,
        testFileId: parseInt(testFileId)
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

// GET /global-variables/by-key/:key — read a variable by key name at runtime.
app.get('/global-variables/by-key/:key', async (req, res) => {
  try {
    const key = req.params.key;
    const orgId = req.session?.orgId || 1;
    const existing = await globalVariableOperations.getAll(orgId).find(v => v.key === key);
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
    const existing = await globalVariableOperations.getAll(orgId).find(v => v.key === key);
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
    }, req.session?.orgId || 1);
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
        pushLog(suiteExecutionId, `⚙  Suite execution #${suiteExecutionId} started — ${suiteTestFiles.length} test file(s)`);

    // Fetch module-level imports for this suite's module
    let suiteModuleImportBlock = '';
    try {
      const suiteModule = await moduleOperations.getById(suite.module_id);
      if (suiteModule && suiteModule.imports && suiteModule.imports.trim()) {
        suiteModuleImportBlock = '\n' + suiteModule.imports.trim() + '\n';
      }
    } catch (_) {}

    // 3. For each test file, wrap in Playwright template and save
    const testFilePromises = suiteTestFiles.map(async (suiteTestFile, index) => {
      const userCode = suiteTestFile.test_file_content || '';
      
      const testContent = `import { test, expect } from '@playwright/test';${suiteModuleImportBlock}
test('${suiteTestFile.test_file_name}', async ({ page, request, browser, context, browserName }) => {
${userCode}
});
`;

      const fileName = `test-${index + 1}-${suiteTestFile.test_file_name.replace(/[^a-zA-Z0-9]/g, '_')}.spec.ts`;
      const testFilePath = path.join(tempDir, fileName);
      await fs.writeFile(testFilePath, testContent, 'utf8');
      
      return {
        fileName,
        testName: suiteTestFile.test_file_name
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
    const useDocker = req.body && req.body.useDocker === true;
    const suiteWorkers = (req.body && req.body.workers) ? req.body.workers : 1;
    const suiteFullyParallel = req.body && req.body.fullyParallel === true;
    const suiteScreenshotMode = (req.body && req.body.screenshotMode) || 'only-on-failure';
    // Load global variables and inject them into each test process via env
    const suiteRunOrgId = req.session?.orgId || 1;
    const suiteOrgForHeal = await organizationOperations.getById(suiteRunOrgId);
    const suiteAiHeal = suiteOrgForHeal?.ai_healing_enabled === 1;
    const suiteAiApiKey = suiteOrgForHeal?.openai_api_key || process.env.OPENAI_API_KEY || '';
    const suiteGlobalVarsEnv = await globalVariableOperations.getAllAsEnv(suiteRunOrgId);

    // Create playwright.config.ts — headless for Docker, headed for local
    const configContent = useDocker
      ? `import { defineConfig } from '@playwright/test';

export default defineConfig({
  fullyParallel: ${suiteFullyParallel},
  workers: ${suiteWorkers},
  use: {
    headless: true,
    screenshot: '${suiteScreenshotMode}',
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
    if (suiteAiHeal && failed > 0) {
      pushLog(suiteExecutionId, `\n\uD83E\uDD16  AI Healer: ${failed} failing test(s) detected — attempting to fix...`);
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
          await suiteTestResultOperations.create({
            suite_execution_id: suiteExecutionId,
            test_file_id: testFileId,
            status: testResult.status,
            duration_ms: testResult.duration_ms,
            error_message: testResult.error_message,
            logs: stdout || stderr || null,
            screenshot_base64: testResult.screenshot_base64 || null
          });
        }
      }

      console.log('✓ Saved', testResults.length, 'test results to database');
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
      priority: priority || 'Medium'
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
    
    const feature = await featureOperations.update(id, {
      name,
      description,
      priority
    });
    
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
      priority: priority || 'Medium'
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
    
    res.json(requirement);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
      title,
      description,
      preconditions,
      test_steps: testSteps,
      expected_result: expectedResult,
      type: type || 'Manual',
      priority: priority || 'Medium',
      status: status || 'Draft',
      test_file_id: testFileId || null
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
    
    const testCase = await testCaseOperations.update(id, {
      requirement_id: requirementId !== undefined ? (requirementId || null) : existing.requirement_id,
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
    
    res.json(testCase);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
    const { title, description, severity, status, linkedTestCaseId, linkedExecutionId, sprintId, screenshot } = req.body;
    
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
      screenshot: screenshot || null
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
    const { title, description, severity, status, linkedTestCaseId, linkedExecutionId, sprintId, screenshot } = req.body;
    
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
      screenshot: screenshot !== undefined ? screenshot : existing.screenshot
    });
    
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

// =============== SPRINTS ENDPOINTS ===============

// Get all sprints
app.get('/sprints', async (req, res) => {
  try {
    const sprints = await sprintOperations.getAll(req.session?.orgId || 1);
    res.json(sprints);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sprint by id
app.get('/sprints/:id', async (req, res) => {
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
app.post('/sprints', async (req, res) => {
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
    }, req.session?.orgId || 1);
    
    res.status(201).json(sprint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update sprint
app.put('/sprints/:id', async (req, res) => {
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
app.delete('/sprints/:id', async (req, res) => {
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
const sessions = new Map(); // token -> { userId, username, role, loggedInAt }

// ===== Task Routes =====
app.get('/tasks', async (req, res) => {
  try {
    const { sprintId } = req.query;
    const orgId = req.session?.orgId || 1;
    const tasks = sprintId ? await taskOperations.getBySprintId(parseInt(sprintId)) : await taskOperations.getAll(orgId);
    res.json(tasks);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/tasks', async (req, res) => {
  try {
    const { title, description, sprintId, assigneeId, status, priority, createdBy, startDate, endDate, plannedHours, completedHours, requirementId } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const task = await taskOperations.create({ title, description, sprintId, assigneeId, status, priority, createdBy, startDate, endDate, plannedHours, completedHours, requirementId }, req.session?.orgId || 1);
    res.status(201).json(task);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/tasks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!await taskOperations.getById(id)) return res.status(404).json({ error: 'Task not found' });
    const { title, description, sprintId, assigneeId, status, priority, startDate, endDate, plannedHours, completedHours, requirementId } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const task = await taskOperations.update(id, { title, description, sprintId, assigneeId, status, priority, startDate, endDate, plannedHours, completedHours, requirementId });
    res.json(task);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/tasks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!await taskOperations.getById(id)) return res.status(404).json({ error: 'Task not found' });
    await taskOperations.delete(id);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Basic user list for assignee pickers (no auth required — returns id+username only)
app.get('/users/list', async (req, res) => {
  try {
    const orgId = req.session?.orgId || 1;
    const users = await userOperations.getAll(orgId).map(u => ({ id: u.id, username: u.username, role: u.role }));
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
    const { aiHealingEnabled, openaiApiKey } = req.body;
    const parsedMaxUsers = maxUsers ? parseInt(maxUsers) : null;
    const org = await organizationOperations.create({ name: orgName, slug, plan: plan || 'free', maxUsers: parsedMaxUsers, pocName: pocName || null, pocEmail: pocEmail || null, aiHealingEnabled: aiHealingEnabled ? 1 : 0, openaiApiKey: openaiApiKey || null });
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
    res.json({ id: org.id, name: org.name, slug: org.slug, plan: org.plan });
  } catch (error) {
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
    sessions.set(token, { userId: user.id, username: user.username, role: user.role,
      orgId: user.org_id || 1,
      customRoleId: user.custom_role_id || null, permissions, customRoleName });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role,
      orgId: user.org_id || 1, permissions, customRoleName } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /auth/logout
app.post('/auth/logout', async (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) sessions.delete(token);
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
      const currentCount = await userOperations.getAll(req.session.orgId).filter(u => u.role !== 'super_admin').length;
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

app.listen(PORT, () => {
  console.log(`TestStudio.Cloud server running on http://localhost:${PORT}`);
});
