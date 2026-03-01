const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const crypto = require('crypto');
const { moduleOperations, testFileOperations, executionOperations, testSuiteOperations, suiteTestFileOperations, suiteExecutionOperations, suiteTestResultOperations, testFileDependencyOperations, featureOperations, requirementOperations, testCaseOperations, manualTestRunOperations, defectOperations, sprintOperations, userOperations, customRoleOperations, wikiOperations, settingsOperations } = require('./db');

const execAsync = promisify(exec);
const app = express();
const PORT = 3001;

// Track the currently active debug process so we can kill it before starting a new one
let activeDebugProcess = null;

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
const reportsDir = path.join(__dirname, 'reports');
fs.mkdir(reportsDir, { recursive: true }).catch(console.error);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve reports directory statically
app.use('/reports', express.static(reportsDir));

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
app.get('/modules', (req, res) => {
  try {
    const modules = moduleOperations.getAll();
    res.json(modules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /modules - Create a new module
app.post('/modules', (req, res) => {
  try {
    const module = moduleOperations.create(req.body);
    res.json(module);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /modules/:id - Delete a module
app.delete('/modules/:id', (req, res) => {
  try {
    moduleOperations.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Test File Endpoints =====

// GET /test-files - Get all test files across all modules
app.get('/test-files', (req, res) => {
  try {
    const testFiles = testFileOperations.getAll();
    res.json(testFiles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /modules/:id/test-files - Get all test files for a module
app.get('/modules/:id/test-files', (req, res) => {
  try {
    const testFiles = testFileOperations.getByModuleId(req.params.id);
    res.json(testFiles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /modules/:id/test-files - Create a new test file
app.post('/modules/:id/test-files', (req, res) => {
  try {
    const testFile = testFileOperations.create({
      moduleId: req.params.id,
      name: req.body.name,
      content: req.body.content,
      requirementId: req.body.requirementId || null
    });
    res.json(testFile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /test-files/:id - Update test file content
app.put('/test-files/:id', (req, res) => {
  try {
    const updates = {};
    if (req.body.name !== undefined) {
      updates.name = req.body.name;
    }
    if (req.body.content !== undefined) {
      updates.content = req.body.content;
    }
    if (req.body.requirementId !== undefined) {
      updates.requirementId = req.body.requirementId;
    }
    
    // Support legacy API (just passing content string)
    const updateData = Object.keys(updates).length > 0 ? updates : req.body.content;
    const testFile = testFileOperations.update(req.params.id, updateData);
    res.json(testFile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /test-files/:id - Delete a test file
app.delete('/test-files/:id', (req, res) => {
  try {
    testFileOperations.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Test File Dependency Endpoints =====

// GET /test-files/:id/dependencies - Get all dependencies for a test file
app.get('/test-files/:id/dependencies', (req, res) => {
  try {
    const dependencies = testFileDependencyOperations.getByTestFileId(parseInt(req.params.id));
    res.json(dependencies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /test-files/:id/execution-order - Get execution order for a test file
app.get('/test-files/:id/execution-order', (req, res) => {
  try {
    const executionOrder = testFileDependencyOperations.getExecutionOrder(parseInt(req.params.id));
    res.json(executionOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /test-files/:id/dependencies - Add a dependency to a test file
app.post('/test-files/:id/dependencies', (req, res) => {
  try {
    const { dependencyFileId, dependencyType, executionOrder } = req.body;
    
    if (!dependencyFileId || !dependencyType) {
      return res.status(400).json({ error: 'dependencyFileId and dependencyType are required' });
    }
    
    if (!['before', 'after'].includes(dependencyType)) {
      return res.status(400).json({ error: 'dependencyType must be either "before" or "after"' });
    }
    
    const dependency = testFileDependencyOperations.add({
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
app.delete('/test-files/:id/dependencies', (req, res) => {
  try {
    const { dependencyFileId, dependencyType } = req.body;
    
    if (!dependencyFileId || !dependencyType) {
      return res.status(400).json({ error: 'dependencyFileId and dependencyType are required' });
    }
    
    testFileDependencyOperations.remove(
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
app.get('/executions', (req, res) => {
  try {
    const executions = executionOperations.getAll();
    res.json(executions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /executions/stats - Get execution statistics
app.get('/executions/stats', (req, res) => {
  try {
    const executions = executionOperations.getAll();
    
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
app.get('/executions/:id', (req, res) => {
  try {
    const execution = executionOperations.getById(req.params.id);
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
app.get('/modules/:id/executions', (req, res) => {
  try {
    const executions = executionOperations.getByModuleId(req.params.id);
    res.json(executions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Test Execution Endpoint =====

// POST /run-test endpoint
app.post('/run-test', async (req, res) => {
  const { code, moduleId, testFileId, browser = 'chromium', debug = false } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({
      success: false,
      logs: 'Error: Missing or invalid code parameter',
    });
  }

  const tempDir = path.join(__dirname, 'temp', `test-${Date.now()}`);
  const startTime = Date.now();

  try {
    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });

    // Build the full ordered list of files to execute: before deps → main → after deps
    const filesToRun = []; // [{ label, name, content }]
    let dependencyHeader = '';

    if (testFileId) {
      try {
        const execOrder = testFileDependencyOperations.getExecutionOrder(parseInt(testFileId));

        // Before dependencies
        for (const dep of (execOrder.before || [])) {
          const depFile = testFileOperations.getById(dep.id);
          if (depFile && depFile.content) {
            filesToRun.push({ label: 'before', name: dep.name, content: depFile.content });
          }
        }

        // Main test — use the live editor code (may have unsaved changes)
        const mainName = execOrder.main ? execOrder.main.name : 'Main Test';
        filesToRun.push({ label: 'main', name: mainName, content: code });

        // After dependencies
        for (const dep of (execOrder.after || [])) {
          const depFile = testFileOperations.getById(dep.id);
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

    const combinedTestName = filesToRun.map(f => f.name).join(' → ');

    const specContent = `import { test, expect } from '@playwright/test';

test(${JSON.stringify(combinedTestName)}, async ({ page }) => {
${combinedSteps}
});
`;
    const specPath = path.join(tempDir, 'combined.spec.ts');
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
  use: {
    headless: false,
    slowMo: 500,
    screenshot: 'on',
  },
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report' }]],
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

    // Debug mode: launch Playwright Inspector (fire-and-forget – user drives step-by-step)
    if (debug) {
      // Kill any lingering debug session (full process tree on Windows)
      killDebugSession();

      // spawn with shell:true (needed for npx on Windows) + stdio:ignore (no output buffering
      // which would silently stall the process) + no detached (so the Inspector GUI stays visible).
      const debugProc = spawn('npx', ['playwright', 'test', '--debug', '--headed', '--timeout', '0'], {
        cwd: tempDir,
        shell: true,
        stdio: 'ignore',
        env: { ...process.env, PWDEBUG: '1' },
      });
      debugProc.on('close', () => { activeDebugProcess = null; });
      debugProc.on('error', () => { activeDebugProcess = null; });
      activeDebugProcess = debugProc;

      return res.json({
        success: true,
        debug: true,
        logs:
          '🐛 Debug session started.\n\n' +
          'The Playwright Inspector is opening alongside the browser.\n\n' +
          'Use the Inspector window to:\n' +
          '  • Step through each action one by one\n' +
          '  • Pause / Resume execution\n' +
          '  • Inspect locators and DOM elements\n' +
          '  • View the action log in real time\n\n' +
          'Close the Inspector or the browser window to end the debug session.',
      });
    }

    // Run Playwright test (config will handle headed mode)
    const { stdout, stderr } = await execAsync('npx playwright test', {
      cwd: tempDir,
      timeout: 60000, // 60 second timeout for headed mode
    });

    // Success - exit code 0
    const durationMs = Date.now() - startTime;
    const logs = dependencyHeader + (stdout || stderr || 'Test completed successfully');

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
        const module = moduleOperations.getById(moduleId);
        const testFile = testFileOperations.getById(testFileId);
        
        if (module && testFile) {
          const execution = executionOperations.create({
            moduleId,
            testFileId,
            status: 'PASS',
            logs,
            errorMessage: null,
            screenshotBase64,
            durationMs,
            reportPath
          });
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
    const errorLogs = dependencyHeader + (error.stderr || error.stdout || error.message);
    const durationMs = Date.now() - startTime;
    
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
            const module = moduleOperations.getById(moduleId);
            const testFile = testFileOperations.getById(testFileId);
            
            if (module && testFile) {
              const execution = executionOperations.create({
                moduleId,
                testFileId,
                status: 'FAIL',
                logs: errorLogs,
                errorMessage: error.message || null,
                screenshotBase64: null,
                durationMs,
                reportPath
              });
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
        const module = moduleOperations.getById(moduleId);
        const testFile = testFileOperations.getById(testFileId);
        
        if (module && testFile) {
          const execution = executionOperations.create({
            moduleId,
            testFileId,
            status: 'FAIL',
            logs: errorLogs,
            errorMessage: error.message || null,
            screenshotBase64,
            durationMs,
            reportPath
          });
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
app.post('/stop-debug', (req, res) => {
  killDebugSession();
  res.json({ success: true });
});

// GET /execution/:id/report - Serve HTML report for execution
app.get('/execution/:id/report', async (req, res) => {
  try {
    const execution = executionOperations.getById(req.params.id);
    
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
    const execution = suiteExecutionOperations.getById(executionId);
    
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
app.get('/test-suites', (req, res) => {
  try {
    const suites = testSuiteOperations.getAll();
    
    // For each suite, count the number of test files
    const suitesWithCounts = suites.map(suite => {
      const testFiles = suiteTestFileOperations.getBySuiteId(suite.id);
      return {
        ...suite,
        test_file_count: testFiles.length
      };
    });
    
    res.json(suitesWithCounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /modules/:id/test-suites - Get test suites for a module
app.get('/modules/:id/test-suites', (req, res) => {
  try {
    const suites = testSuiteOperations.getByModuleId(req.params.id);
    
    const suitesWithCounts = suites.map(suite => {
      const testFiles = suiteTestFileOperations.getBySuiteId(suite.id);
      return {
        ...suite,
        test_file_count: testFiles.length
      };
    });
    
    res.json(suitesWithCounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /test-suites - Create a new test suite
app.post('/test-suites', (req, res) => {
  try {
    const { moduleId, name, testFileIds } = req.body;
    
    // Create the suite
    const suite = testSuiteOperations.create({
      moduleId,
      name
    });
    
    // Add test files to the suite
    if (testFileIds && testFileIds.length > 0) {
      testFileIds.forEach(testFileId => {
        suiteTestFileOperations.add({
          suiteId: suite.id,
          testFileId
        });
      });
    }
    
    res.json(suite);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /test-suites/:id/test-files - Get test files in a suite
app.get('/test-suites/:id/test-files', (req, res) => {
  try {
    const suiteId = parseInt(req.params.id);
    const testFiles = suiteTestFileOperations.getBySuiteId(suiteId);
    res.json(testFiles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /test-suites/:id/test-files - Add test files to a suite
app.post('/test-suites/:id/test-files', (req, res) => {
  try {
    const { testFileIds } = req.body;
    const suiteId = parseInt(req.params.id);
    
    if (!testFileIds || !Array.isArray(testFileIds)) {
      return res.status(400).json({ error: 'testFileIds array is required' });
    }
    
    // Add each test file to the suite
    const addedFiles = [];
    testFileIds.forEach(testFileId => {
      const result = suiteTestFileOperations.add({
        suiteId,
        testFileId: parseInt(testFileId)
      });
      addedFiles.push(result);
    });
    
    res.json({ success: true, added: addedFiles.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /test-suites/:suiteId/test-files/:testFileId - Remove a test file from a suite
app.delete('/test-suites/:suiteId/test-files/:testFileId', (req, res) => {
  try {
    const suiteId = parseInt(req.params.suiteId);
    const testFileId = parseInt(req.params.testFileId);
    suiteTestFileOperations.removeBySuiteAndTestFile(suiteId, testFileId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /test-suites/:id - Delete a test suite
app.delete('/test-suites/:id', (req, res) => {
  try {
    const suiteId = parseInt(req.params.id);
    testSuiteOperations.delete(suiteId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /suite-executions/:id - Get suite execution by ID
app.get('/suite-executions/:id', (req, res) => {
  try {
    const executionId = parseInt(req.params.id);
    const execution = suiteExecutionOperations.getById(executionId);
    if (!execution) {
      return res.status(404).json({ error: 'Suite execution not found' });
    }
    res.json(execution);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /suite-executions/:id/results - Get test results for a suite execution
app.get('/suite-executions/:id/results', (req, res) => {
  try {
    const executionId = parseInt(req.params.id);
    const results = suiteTestResultOperations.getBySuiteExecutionId(executionId);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /test-suites/:suiteId/executions - Get execution history for a suite (last 30)
app.get('/test-suites/:suiteId/executions', (req, res) => {
  try {
    const suiteId = parseInt(req.params.suiteId);
    const executions = suiteExecutionOperations.getBySuiteId(suiteId, 30);
    res.json(executions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /run-suite/:suiteId - Execute all tests in a suite
app.post('/run-suite/:suiteId', async (req, res) => {
  const suiteId = parseInt(req.params.suiteId);
  const startTime = Date.now();
  let tempDir = null;

  try {
    // 1. Fetch suite by ID
    const suite = testSuiteOperations.getById(suiteId);
    if (!suite) {
      return res.status(404).json({ error: 'Suite not found' });
    }

    // 2. Fetch all associated test files
    const suiteTestFiles = suiteTestFileOperations.getBySuiteId(suiteId);
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

    // Create temp directory
    tempDir = path.join(__dirname, 'temp', `suite-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // 3. For each test file, wrap in Playwright template and save
    const testFilePromises = suiteTestFiles.map(async (suiteTestFile, index) => {
      const userCode = suiteTestFile.test_file_content || '';
      
      const testContent = `import { test, expect } from '@playwright/test';

test('${suiteTestFile.test_file_name}', async ({ page }) => {
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

    // Create playwright.config.ts — headless for Docker, headed for local
    const configContent = useDocker
      ? `import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    headless: true,
    screenshot: 'on',
  },
  reporter: [
    ['json', { outputFile: 'test-results.json' }],
    ['html', { open: 'never', outputFolder: 'playwright-report' }]
  ],
});
`
      : `import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    headless: false,
    slowMo: 500,
    screenshot: 'on',
  },
  reporter: [
    ['json', { outputFile: 'test-results.json' }],
    ['html', { open: 'never', outputFolder: 'playwright-report' }]
  ],
});
`;
    await fs.writeFile(path.join(tempDir, 'playwright.config.ts'), configContent, 'utf8');

    // 4. Execute tests
    let exitCode = 0;
    let stdout = '';
    let stderr = '';

    if (useDocker) {
      // Verify Docker is running before attempting
      try {
        await execAsync('docker info', { timeout: 8000 });
      } catch {
        return res.status(500).json({
          error: 'Docker is not available or not running. Please start Docker Desktop and try again.',
          suite_id: parseInt(suiteId)
        });
      }

      // Run inside the official Playwright Docker image (fully headless, no display required)
      const dockerImage = 'mcr.microsoft.com/playwright:v1.50.0-jammy';
      // Docker Desktop on Windows accepts Windows paths in -v but needs forward slashes
      const dockerMountPath = tempDir.replace(/\\/g, '/');
      console.log(`🐳 Running suite via Docker: ${dockerImage}`);
      try {
        const result = await execAsync(
          `docker run --rm --ipc=host -v "${dockerMountPath}:/work" -w /work ${dockerImage} npx playwright test`,
          { timeout: 600000 } // 10 min to allow image pull on first run
        );
        stdout = result.stdout;
        stderr = result.stderr;
      } catch (error) {
        exitCode = error.code || 1;
        stdout = error.stdout || '';
        stderr = error.stderr || '';
      }
    } else {
      try {
        const result = await execAsync('npx playwright test', {
          cwd: tempDir,
          timeout: 300000, // 5 minutes timeout
        });
        stdout = result.stdout;
        stderr = result.stderr;
      } catch (error) {
        // Playwright returns non-zero exit code on test failures
        exitCode = error.code || 1;
        stdout = error.stdout || '';
        stderr = error.stderr || '';
      }
    }

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

    // Save suite execution to database
    let suiteExecutionId = null;
    try {
      const overallStatus = failed === 0 ? 'PASS' : 'FAIL';
      
      const suiteExecution = suiteExecutionOperations.create({
        suiteId: parseInt(suiteId),
        status: overallStatus,
        totalTests: totalTests,
        passed: passed,
        failed: failed,
        durationMs: durationMs,
        reportPath: reportPath
      });
      
      suiteExecutionId = suiteExecution.id;
      console.log('✓ Suite execution saved to database with ID:', suiteExecutionId);

      // Save individual test results
      testResults.forEach((testResult, index) => {
        // Find the corresponding test file ID from the original suiteTestFiles array
        const testFileId = suiteTestFiles[index]?.test_file_id || null;
        
        if (testFileId) {
          suiteTestResultOperations.create({
            suiteExecutionId: suiteExecutionId,
            testFileId: testFileId,
            status: testResult.status,
            durationMs: testResult.duration_ms,
            errorMessage: testResult.error_message,
            logs: stdout || stderr || null,
            screenshotBase64: testResult.screenshot_base64 || null
          });
        }
      });
      
      console.log('✓ Saved', testResults.length, 'test results to database');
    } catch (dbError) {
      console.error('Failed to save suite execution to database:', dbError.message);
    }

    // Return response
    res.json({
      suite_id: parseInt(suiteId),
      suite_execution_id: suiteExecutionId,
      total_tests: totalTests,
      passed: passed,
      failed: failed,
      duration_ms: durationMs,
      tests: testResults
    });

  } catch (error) {
    console.error('Suite execution error:', error);
    res.status(500).json({ 
      error: error.message,
      suite_id: parseInt(suiteId),
      total_tests: 0,
      passed: 0,
      failed: 0,
      duration_ms: Date.now() - startTime,
      tests: []
    });
  } finally {
    // Cleanup: Remove temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }
  }
});

// ===== Features Endpoints =====

// GET /features - Get all features
app.get('/features', (req, res) => {
  try {
    const features = featureOperations.getAll();
    res.json(features);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /features/:id - Get a single feature
app.get('/features/:id', (req, res) => {
  try {
    const feature = featureOperations.getById(parseInt(req.params.id));
    if (!feature) {
      return res.status(404).json({ error: 'Feature not found' });
    }
    res.json(feature);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /features/:id/requirements - Get all requirements for a feature
app.get('/features/:id/requirements', (req, res) => {
  try {
    const requirements = requirementOperations.getByFeatureId(parseInt(req.params.id));
    res.json(requirements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /features - Create a new feature
app.post('/features', (req, res) => {
  try {
    const { name, description, priority } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Validate priority if provided
    if (priority && !['Low', 'Medium', 'High'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority. Must be Low, Medium, or High' });
    }
    
    const feature = featureOperations.create({
      name,
      description,
      priority: priority || 'Medium'
    });
    
    res.status(201).json(feature);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /features/:id - Update a feature
app.put('/features/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, priority } = req.body;
    
    // Check if feature exists
    const existing = featureOperations.getById(id);
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
    
    const feature = featureOperations.update(id, {
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
app.delete('/features/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Check if feature exists
    const existing = featureOperations.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Feature not found' });
    }
    
    featureOperations.delete(id);
    res.json({ message: 'Feature deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Requirements Endpoints =====

// GET /requirements - Get all requirements
app.get('/requirements', (req, res) => {
  try {
    const requirements = requirementOperations.getAll();
    res.json(requirements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /requirements/:id - Get a single requirement
app.get('/requirements/:id', (req, res) => {
  try {
    const requirement = requirementOperations.getById(parseInt(req.params.id));
    if (!requirement) {
      return res.status(404).json({ error: 'Requirement not found' });
    }
    res.json(requirement);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /requirements - Create a new requirement
app.post('/requirements', (req, res) => {
  try {
    const { featureId, organizationId, sprintId, title, description, status, priority } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    if (!featureId) {
      return res.status(400).json({ error: 'Feature ID is required' });
    }
    
    // Validate feature exists
    const feature = featureOperations.getById(featureId);
    if (!feature) {
      return res.status(400).json({ error: 'Feature not found' });
    }
    
    // Validate sprint exists if provided
    if (sprintId) {
      const sprint = sprintOperations.getById(sprintId);
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
    
    const requirement = requirementOperations.create({
      featureId,
      organizationId,
      sprintId,
      title,
      description,
      status: status || 'Draft',
      priority: priority || 'Medium'
    });
    
    res.status(201).json(requirement);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /requirements/:id - Update a requirement
app.put('/requirements/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { featureId, organizationId, sprintId, title, description, status, priority } = req.body;
    
    // Check if requirement exists
    const existing = requirementOperations.getById(id);
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
    const feature = featureOperations.getById(featureId);
    if (!feature) {
      return res.status(400).json({ error: 'Feature not found' });
    }
    
    // Validate sprint exists if provided
    if (sprintId) {
      const sprint = sprintOperations.getById(sprintId);
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
    
    const requirement = requirementOperations.update(id, {
      featureId,
      organizationId,
      sprintId,
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
app.delete('/requirements/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Check if requirement exists
    const existing = requirementOperations.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Requirement not found' });
    }
    
    requirementOperations.delete(id);
    res.json({ message: 'Requirement deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Test Cases Endpoints =====

// GET /test-cases - Get all test cases
app.get('/test-cases', (req, res) => {
  try {
    const testCases = testCaseOperations.getAll();
    res.json(testCases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /test-cases/:id - Get a single test case
app.get('/test-cases/:id', (req, res) => {
  try {
    const testCase = testCaseOperations.getById(parseInt(req.params.id));
    if (!testCase) {
      return res.status(404).json({ error: 'Test case not found' });
    }
    res.json(testCase);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /requirements/:id/test-cases - Get test cases for a requirement
app.get('/requirements/:id/test-cases', (req, res) => {
  try {
    const testCases = testCaseOperations.getByRequirementId(parseInt(req.params.id));
    res.json(testCases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /requirements/:id/test-files - Get automation test files for a requirement
app.get('/requirements/:id/test-files', (req, res) => {
  try {
    const testFiles = testFileOperations.getByRequirementId(parseInt(req.params.id));
    res.json(testFiles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /test-cases - Create a new test case
app.post('/test-cases', (req, res) => {
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
    
    const testCase = testCaseOperations.create({
      requirementId,
      title,
      description,
      preconditions,
      testSteps,
      expectedResult,
      type: type || 'Manual',
      priority: priority || 'Medium',
      status: status || 'Draft',
      testFileId: testFileId || null
    });
    
    res.status(201).json(testCase);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /test-cases/:id - Update a test case
app.put('/test-cases/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { requirementId, title, description, preconditions, testSteps, expectedResult, type, priority, status, testFileId } = req.body;
    
    // Check if test case exists
    const existing = testCaseOperations.getById(id);
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
    
    const testCase = testCaseOperations.update(id, {
      requirementId,
      title,
      description,
      preconditions,
      testSteps,
      expectedResult,
      type,
      priority,
      status,
      testFileId: testFileId !== undefined ? testFileId : existing.test_file_id
    });
    
    res.json(testCase);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /test-cases/:id - Delete a test case
app.delete('/test-cases/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Check if test case exists
    const existing = testCaseOperations.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Test case not found' });
    }
    
    testCaseOperations.delete(id);
    res.json({ message: 'Test case deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Manual Test Runs Endpoints =====

// GET /manual-test-runs - Get all manual test runs
app.get('/manual-test-runs', (req, res) => {
  try {
    const testRuns = manualTestRunOperations.getAll();
    res.json(testRuns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /manual-test-runs/:id - Get a single manual test run
app.get('/manual-test-runs/:id', (req, res) => {
  try {
    const testRun = manualTestRunOperations.getById(parseInt(req.params.id));
    if (!testRun) {
      return res.status(404).json({ error: 'Manual test run not found' });
    }
    res.json(testRun);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /test-cases/:id/manual-test-runs - Get manual test runs for a test case
app.get('/test-cases/:id/manual-test-runs', (req, res) => {
  try {
    const testRuns = manualTestRunOperations.getByTestCaseId(parseInt(req.params.id));
    res.json(testRuns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /manual-test-runs - Create a new manual test run
app.post('/manual-test-runs', (req, res) => {
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
    const testCase = testCaseOperations.getById(testCaseId);
    if (!testCase) {
      return res.status(404).json({ error: 'Test case not found' });
    }
    
    const testRun = manualTestRunOperations.create({
      testCaseId,
      status: status || 'Passed',
      executedBy,
      executionNotes
    });
    
    res.status(201).json(testRun);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /manual-test-runs/:id - Update a manual test run
app.put('/manual-test-runs/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, executedBy, executionNotes } = req.body;
    
    // Check if test run exists
    const existing = manualTestRunOperations.getById(id);
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
    
    const testRun = manualTestRunOperations.update(id, {
      status,
      executedBy,
      executionNotes
    });
    
    res.json(testRun);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /manual-test-runs/:id - Delete a manual test run
app.delete('/manual-test-runs/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Check if test run exists
    const existing = manualTestRunOperations.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Manual test run not found' });
    }
    
    manualTestRunOperations.delete(id);
    res.json({ message: 'Manual test run deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============== DEFECTS ENDPOINTS ===============

// Get all defects
app.get('/defects', (req, res) => {
  try {
    const defects = defectOperations.getAll();
    res.json(defects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get defect by id
app.get('/defects/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const defect = defectOperations.getById(id);
    
    if (!defect) {
      return res.status(404).json({ error: 'Defect not found' });
    }
    
    res.json(defect);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new defect
app.post('/defects', (req, res) => {
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
      const sprint = sprintOperations.getById(sprintId);
      if (!sprint) {
        return res.status(400).json({ error: 'Sprint not found' });
      }
    }
    
    const defect = defectOperations.create({
      title,
      description,
      severity,
      status,
      linkedTestCaseId,
      linkedExecutionId,
      sprintId,
      screenshot: screenshot || null
    });
    
    res.status(201).json(defect);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update defect
app.put('/defects/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description, severity, status, linkedTestCaseId, linkedExecutionId, sprintId, screenshot } = req.body;
    
    // Check if defect exists
    const existing = defectOperations.getById(id);
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
      const sprint = sprintOperations.getById(sprintId);
      if (!sprint) {
        return res.status(400).json({ error: 'Sprint not found' });
      }
    }
    
    const defect = defectOperations.update(id, {
      title,
      description,
      severity,
      status,
      linkedTestCaseId,
      linkedExecutionId,
      sprintId,
      screenshot: screenshot !== undefined ? screenshot : existing.screenshot
    });
    
    res.json(defect);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete defect
app.delete('/defects/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Check if defect exists
    const existing = defectOperations.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Defect not found' });
    }
    
    defectOperations.delete(id);
    res.json({ message: 'Defect deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============== SPRINTS ENDPOINTS ===============

// Get all sprints
app.get('/sprints', (req, res) => {
  try {
    const sprints = sprintOperations.getAll();
    res.json(sprints);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sprint by id
app.get('/sprints/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const sprint = sprintOperations.getByIdWithMetrics(id);
    
    if (!sprint) {
      return res.status(404).json({ error: 'Sprint not found' });
    }
    
    res.json(sprint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new sprint
app.post('/sprints', (req, res) => {
  try {
    const { name, goal, startDate, endDate, status } = req.body;
    
    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Validate status if provided
    if (status && !['Planned', 'Active', 'Completed'].includes(status)) {
      return res.status(400).json({ error: 'Status must be one of: Planned, Active, Completed' });
    }
    
    const sprint = sprintOperations.create({
      name,
      goal,
      startDate,
      endDate,
      status
    });
    
    res.status(201).json(sprint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update sprint
app.put('/sprints/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, goal, startDate, endDate, status } = req.body;
    
    // Check if sprint exists
    const existing = sprintOperations.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Sprint not found' });
    }
    
    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Validate status
    if (status && !['Planned', 'Active', 'Completed'].includes(status)) {
      return res.status(400).json({ error: 'Status must be one of: Planned, Active, Completed' });
    }
    
    const sprint = sprintOperations.update(id, {
      name,
      goal,
      startDate,
      endDate,
      status
    });
    
    res.json(sprint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete sprint
app.delete('/sprints/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Check if sprint exists
    const existing = sprintOperations.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Sprint not found' });
    }
    
    sprintOperations.delete(id);
    res.json({ message: 'Sprint deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Auth / Session Management =====
const sessions = new Map(); // token -> { userId, username, role, loggedInAt }

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

// POST /auth/login
app.post('/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const user = userOperations.getByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is disabled' });
    }
    const valid = userOperations.verifyPassword(password, user.password_hash, user.salt);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    let permissions = null;
    let customRoleName = null;
    if (user.role === 'custom' && user.custom_role_id) {
      const cr = customRoleOperations.getById(user.custom_role_id);
      if (cr) {
        permissions = JSON.parse(cr.permissions || '[]');
        customRoleName = cr.name;
      }
    }
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { userId: user.id, username: user.username, role: user.role,
      customRoleId: user.custom_role_id || null, permissions, customRoleName });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role,
      permissions, customRoleName } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /auth/logout
app.post('/auth/logout', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) sessions.delete(token);
  res.json({ message: 'Logged out' });
});

// GET /auth/me  — validate stored token
app.get('/auth/me', (req, res) => {
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
app.get('/auth/team', requireAuth, (req, res) => {
  try {
    const users = userOperations.getAll().map(u => ({
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
app.get('/auth/users', requireAdmin, (req, res) => {
  try {
    res.json(userOperations.getAll());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /auth/users (admin only)
app.post('/auth/users', requireAdmin, (req, res) => {
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
    const limitVal = settingsOperations.get('user_limit');
    const limit = parseInt(limitVal || '0');
    if (limit > 0) {
      const currentCount = userOperations.getAll().filter(u => u.role !== 'super_admin').length;
      if (currentCount >= limit) {
        return res.status(403).json({ error: `User limit of ${limit} reached. Increase the seat limit to add more users.` });
      }
    }
    // Check existing
    const existing = userOperations.getByUsername(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    const user = userOperations.create({ username, password, role, customRoleId: customRoleId || null, createdBy: req.session.userId });
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /auth/users/:id (admin only)
app.put('/auth/users/:id', requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { username, password, role, customRoleId, is_active } = req.body;
    const callerRole = req.session.role;
    // Prevent changing a super_admin's role
    const targetUser = userOperations.getById(id);
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
    const updated = userOperations.update(id, { username, password, role, customRoleId: customRoleId || null, is_active });
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
app.delete('/auth/users/:id', requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (id === req.session.userId) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    // Block deletion of super_admin accounts from the frontend
    const targetUser = userOperations.getById(id);
    if (targetUser && targetUser.role === 'super_admin') {
      return res.status(403).json({ error: 'Super admin accounts cannot be deleted from the frontend' });
    }
    // Invalidate any active sessions for deleted user
    for (const [token, sess] of sessions.entries()) {
      if (sess.userId === id) sessions.delete(token);
    }
    userOperations.delete(id);
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Custom Roles endpoints (super_admin only for write, requireAdmin for read) ─

// GET /auth/roles
app.get('/auth/roles', requireAdmin, (req, res) => {
  try {
    res.json(customRoleOperations.getAll());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /auth/roles
app.post('/auth/roles', requireSuperAdmin, (req, res) => {
  try {
    const { name, permissions } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Role name is required' });
    }
    const role = customRoleOperations.create({ name: name.trim(), permissions: permissions || [], createdBy: req.session.userId });
    res.status(201).json(role);
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A role with that name already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT /auth/roles/:id
app.put('/auth/roles/:id', requireSuperAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, permissions } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Role name is required' });
    }
    const existing = customRoleOperations.getById(id);
    if (!existing) return res.status(404).json({ error: 'Role not found' });
    const updated = customRoleOperations.update(id, { name: name.trim(), permissions: permissions || [] });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /auth/roles/:id
app.delete('/auth/roles/:id', requireSuperAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = customRoleOperations.getById(id);
    if (!existing) return res.status(404).json({ error: 'Role not found' });
    customRoleOperations.delete(id);
    res.json({ message: 'Role deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Settings endpoints ───────────────────────────────────────────────────

// GET /auth/settings  – any admin/super_admin can read
app.get('/auth/settings', requireAdmin, (req, res) => {
  try {
    res.json(settingsOperations.getAll());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /auth/settings  – super_admin only
app.put('/auth/settings', requireSuperAdmin, (req, res) => {
  try {
    const { user_limit } = req.body;
    if (user_limit !== undefined) {
      const val = parseInt(user_limit);
      if (isNaN(val) || val < 0) {
        return res.status(400).json({ error: 'user_limit must be a non-negative integer (0 = unlimited)' });
      }
      settingsOperations.set('user_limit', val);
    }
    res.json(settingsOperations.getAll());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Wiki endpoints (all require auth) ────────────────────────────────────

// GET /wiki/pages  – list all pages (no content, just metadata)
app.get('/wiki/pages', requireAuth, (req, res) => {
  try {
    res.json(wikiOperations.getAll());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /wiki/pages/:id  – get single page with full content
app.get('/wiki/pages/:id', requireAuth, (req, res) => {
  try {
    const page = wikiOperations.getById(parseInt(req.params.id));
    if (!page) return res.status(404).json({ error: 'Page not found' });
    res.json(page);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /wiki/pages  – create page
app.post('/wiki/pages', requireAuth, (req, res) => {
  try {
    const { title, content, parentId } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
    const page = wikiOperations.create({
      title: title.trim(),
      content: content || '',
      parentId: parentId || null,
      createdBy: req.session.username
    });
    res.status(201).json(page);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /wiki/pages/:id  – update page
app.put('/wiki/pages/:id', requireAuth, (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
    const existing = wikiOperations.getById(parseInt(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Page not found' });
    const page = wikiOperations.update(parseInt(req.params.id), {
      title: title.trim(),
      content: content !== undefined ? content : existing.content
    });
    res.json(page);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /wiki/pages/:id  – delete page (cascades to children)
app.delete('/wiki/pages/:id', requireAuth, (req, res) => {
  try {
    const existing = wikiOperations.getById(parseInt(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Page not found' });
    wikiOperations.delete(parseInt(req.params.id));
    res.json({ message: 'Page deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Test Cloud Studio server running on http://localhost:${PORT}`);
});
