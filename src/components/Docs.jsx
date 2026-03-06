import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── Docs content ─────────────────────────────────────────────────────────────
const SECTIONS = [
  {
    title: 'Getting Started',
    icon: '🚀',
    articles: [
      { id: 'gs-overview', title: 'Platform Overview' },
      { id: 'gs-org', title: 'Creating Your Organisation' },
      { id: 'gs-first-module', title: 'Your First Module & Test' },
      { id: 'gs-users', title: 'Inviting Team Members' },
    ],
  },
  {
    title: 'Writing Tests',
    icon: '✍️',
    articles: [
      { id: 'wt-playwright', title: 'Playwright Basics' },
      { id: 'wt-editor', title: 'Using the Test Editor' },
      { id: 'wt-or', title: 'Object Repository' },
      { id: 'wt-deps', title: 'Test Dependencies' },
      { id: 'wt-global-vars', title: 'Global Variables' },
    ],
  },
  {
    title: 'Running Tests',
    icon: '▶️',
    articles: [
      { id: 'run-single', title: 'Single Test Runs' },
      { id: 'run-suite', title: 'CI Suite Runs' },
      { id: 'run-config', title: 'Playwright Config' },
      { id: 'run-trace', title: 'Trace & Video Capture' },
    ],
  },
  {
    title: 'AI Features',
    icon: '🤖',
    articles: [
      { id: 'ai-script', title: 'AI Script Generation' },
      { id: 'ai-testcases', title: 'AI Test Case Generation' },
      { id: 'ai-healing', title: 'AI Self-Healing Tests' },
    ],
  },
  {
    title: 'Test Management',
    icon: '📋',
    articles: [
      { id: 'tm-features', title: 'Features & Requirements' },
      { id: 'tm-testcases', title: 'Test Cases' },
      { id: 'tm-defects', title: 'Defect Tracking' },
      { id: 'tm-sprints', title: 'Sprints & Taskboard' },
    ],
  },
  {
    title: 'Best Practices',
    icon: '✅',
    articles: [
      { id: 'bp-structure', title: 'Structuring Your Tests' },
      { id: 'bp-selectors', title: 'Selector Strategy' },
      { id: 'bp-ci', title: 'CI/CD Integration' },
    ],
  },
  {
    title: 'FAQ',
    icon: '❓',
    articles: [
      { id: 'faq-general', title: 'General Questions' },
      { id: 'faq-troubleshoot', title: 'Troubleshooting' },
    ],
  },
];

const CONTENT = {
  // ── Getting Started ─────────────────────────────────────
  'gs-overview': {
    title: 'Platform Overview',
    content: (
      <>
        <p>TestStudio.cloud is an AI-powered test management and automation platform. It combines requirement tracking, manual test cases, Playwright test automation, and AI capabilities into a single unified workspace.</p>
        <h2>Core concepts</h2>
        <ul>
          <li><strong>Organisation</strong> — your isolated workspace. All data (modules, tests, executions) belongs to an org.</li>
          <li><strong>Module</strong> — a logical grouping of test files, e.g. "Login", "Checkout", "Admin Panel".</li>
          <li><strong>Test File</strong> — a single Playwright spec (TypeScript). Each file lives inside a module.</li>
          <li><strong>Suite</strong> — an ordered collection of test files run together in CI mode.</li>
          <li><strong>Execution</strong> — a recorded test run. Includes logs, screenshots, trace, and video.</li>
        </ul>
        <h2>Navigation overview</h2>
        <table>
          <thead><tr><th>Section</th><th>Purpose</th></tr></thead>
          <tbody>
            <tr><td>Dashboard</td><td>At-a-glance health of all modules and recent runs</td></tr>
            <tr><td>Features / Requirements / Test Cases</td><td>Manual test management lifecycle</td></tr>
            <tr><td>Modules</td><td>Organise and write Playwright test files</td></tr>
            <tr><td>Suite Runs</td><td>Run multiple tests together in CI (headless) mode</td></tr>
            <tr><td>Single Runs</td><td>View execution history for individual test files</td></tr>
            <tr><td>Object Repository</td><td>Centralised element selectors shared across all tests</td></tr>
            <tr><td>Global Variables</td><td>Environment values injected into every test run</td></tr>
            <tr><td>Config</td><td>Playwright runner settings (browser, workers, trace, video, etc.)</td></tr>
            <tr><td>Reports</td><td>Browse HTML Playwright reports from past runs</td></tr>
            <tr><td>Defects</td><td>Bug tracking integrated with test failures</td></tr>
          </tbody>
        </table>
      </>
    ),
  },
  'gs-org': {
    title: 'Creating Your Organisation',
    content: (
      <>
        <p>Each organisation on TestStudio.cloud gets its own isolated database, users, and settings.</p>
        <h2>Steps</h2>
        <ol>
          <li>Navigate to <strong>teststudio.cloud</strong> and click <strong>Login →</strong>.</li>
          <li>On the login screen, click <strong>Create Organisation</strong>.</li>
          <li>Enter your org name (e.g. <code>acmecorp</code>). This becomes your URL slug: <code>teststudio.cloud/org/acmecorp</code>.</li>
          <li>Set an admin password. <strong>Save this — it cannot be recovered.</strong></li>
          <li>You are now logged in as <code>admin</code>.</li>
        </ol>
        <div className="callout-tip">The org slug is permanent and case-insensitive. Choose something memorable.</div>
        <h2>Org settings</h2>
        <p>As admin you can configure:</p>
        <ul>
          <li><strong>OpenAI API Key</strong> — required for AI features (script generation, healing, test case gen).</li>
          <li><strong>AI Healing toggle</strong> — enable/disable auto-healing on test failures.</li>
          <li><strong>User management</strong> — invite contributors, create custom roles.</li>
        </ul>
      </>
    ),
  },
  'gs-first-module': {
    title: 'Your First Module & Test',
    content: (
      <>
        <h2>1. Create a module</h2>
        <ol>
          <li>Go to <strong>Modules</strong> in the sidebar.</li>
          <li>Click <strong>+ New Module</strong>.</li>
          <li>Name it after the feature you're testing (e.g. <code>Login Flow</code>).</li>
        </ol>
        <h2>2. Create a test file</h2>
        <ol>
          <li>Open the module and click <strong>+ New Test File</strong>.</li>
          <li>Name it (e.g. <code>login_happy_path</code>). The <code>.spec.ts</code> extension is added automatically.</li>
          <li>The editor opens with a starter template.</li>
        </ol>
        <h2>3. Write and run</h2>
        <pre>{`import { test, expect } from '@playwright/test';

test('login with valid credentials', async ({ page }) => {
  await page.goto('https://your-app.com/login');
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('secret');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Dashboard')).toBeVisible();
});`}</pre>
        <ol start={4}>
          <li>Click <strong>▶ Run</strong> — the test executes and results appear instantly.</li>
          <li>Click <strong>🐛 Trace</strong> to record a full Playwright trace for debugging.</li>
        </ol>
        <div className="callout-tip">Enable <strong>Trace → On Failure</strong> in Config so traces are automatically captured whenever a test fails — no need to re-run manually.</div>
      </>
    ),
  },
  'gs-users': {
    title: 'Inviting Team Members',
    content: (
      <>
        <h2>Roles</h2>
        <table>
          <thead><tr><th>Role</th><th>Capabilities</th></tr></thead>
          <tbody>
            <tr><td><strong>admin</strong></td><td>Full access to everything except org super-settings</td></tr>
            <tr><td><strong>contributor</strong></td><td>Can write tests, run executions, manage defects — cannot manage users</td></tr>
            <tr><td><strong>custom</strong></td><td>Granular per-view permissions configured by admin</td></tr>
          </tbody>
        </table>
        <h2>Adding a user</h2>
        <ol>
          <li>Go to <strong>Admin → Users</strong>.</li>
          <li>Click <strong>+ Add User</strong>.</li>
          <li>Set a username, password, and role.</li>
          <li>Share the login URL (<code>teststudio.cloud/org/your-slug</code>) and credentials.</li>
        </ol>
        <div className="callout-warn">Passwords are hashed with scrypt. There is no "forgot password" flow — admins can reset passwords from the Users panel.</div>
      </>
    ),
  },

  // ── Writing Tests ────────────────────────────────────────
  'wt-playwright': {
    title: 'Playwright Basics',
    content: (
      <>
        <p>TestStudio.cloud runs <strong>Playwright</strong> tests written in TypeScript. Every test file is a standard <code>.spec.ts</code> file.</p>
        <h2>Available objects</h2>
        <pre>{`test('name', async ({ page, request, browser, context, browserName }) => {
  // page      — browser page for UI interactions
  // request   — APIRequestContext for API testing
  // browser   — Browser instance
  // context   — BrowserContext
  // browserName — 'chromium' | 'firefox' | 'webkit'
});`}</pre>
        <h2>Common actions</h2>
        <table>
          <thead><tr><th>Action</th><th>Code</th></tr></thead>
          <tbody>
            <tr><td>Navigate</td><td><code>await page.goto('https://...')</code></td></tr>
            <tr><td>Click</td><td><code>await page.getByRole('button', {'{ name: "Submit" }'}).click()</code></td></tr>
            <tr><td>Fill input</td><td><code>await page.getByLabel('Email').fill('test@example.com')</code></td></tr>
            <tr><td>Assert visible</td><td><code>await expect(page.getByText('Success')).toBeVisible()</code></td></tr>
            <tr><td>Assert URL</td><td><code>await expect(page).toHaveURL('/dashboard')</code></td></tr>
            <tr><td>Screenshot</td><td><code>await page.screenshot({'{ path: "shot.png" }'})</code></td></tr>
            <tr><td>API GET</td><td><code>const r = await request.get('/api/users')</code></td></tr>
          </tbody>
        </table>
        <h2>Selectors — best to worst</h2>
        <ol>
          <li><code>getByRole</code> — most resilient, tests accessibility tree</li>
          <li><code>getByLabel</code> — great for form inputs</li>
          <li><code>getByText</code> — good for buttons and headings</li>
          <li><code>getByTestId</code> — use with <code>data-testid</code> attributes</li>
          <li><code>locator('css')</code> — last resort, brittle</li>
        </ol>
      </>
    ),
  },
  'wt-editor': {
    title: 'Using the Test Editor',
    content: (
      <>
        <h2>Editor toolbar</h2>
        <table>
          <thead><tr><th>Button</th><th>What it does</th></tr></thead>
          <tbody>
            <tr><td>▶ Run</td><td>Execute the test using your Config settings. Results appear in the right panel.</td></tr>
            <tr><td>🐛 Trace</td><td>Run with full Playwright trace recording — opens the Playwright Trace Viewer link.</td></tr>
            <tr><td>⚡ AI Script</td><td>Enter a plain-English instruction and AI rewrites or appends to your test.</td></tr>
            <tr><td>💾 Save</td><td>Saves the current content. Also auto-saves on run.</td></tr>
          </tbody>
        </table>
        <h2>Keyboard shortcuts</h2>
        <table>
          <thead><tr><th>Shortcut</th><th>Action</th></tr></thead>
          <tbody>
            <tr><td><code>Ctrl + S</code></td><td>Save file</td></tr>
            <tr><td><code>Ctrl + Enter</code></td><td>Run test</td></tr>
          </tbody>
        </table>
        <h2>Results panel</h2>
        <p>After a run the right panel shows:</p>
        <ul>
          <li><strong>Pass / Fail</strong> status badge</li>
          <li>Full Playwright stdout/stderr logs</li>
          <li>Screenshot (if captured)</li>
          <li>Trace Viewer link (if trace was recorded)</li>
          <li>AI healing details (if the test failed and AI fixed it)</li>
        </ul>
      </>
    ),
  },
  'wt-or': {
    title: 'Object Repository',
    content: (
      <>
        <p>The Object Repository (OR) is a centralised store of element selectors. Instead of hardcoding selectors in every test, define them once and reference them anywhere.</p>
        <h2>Creating an entry</h2>
        <ol>
          <li>Go to <strong>Object Repository</strong> in the sidebar.</li>
          <li>Click <strong>+ Add Object</strong>.</li>
          <li>Fill in: <strong>Page</strong> (e.g. <code>LoginPage</code>), <strong>Object Name</strong> (e.g. <code>emailInput</code>), <strong>Selector</strong> (e.g. <code>[data-testid="email"]</code>).</li>
          <li>Optionally assign to a <strong>Folder</strong> for organisation.</li>
        </ol>
        <h2>Using OR in tests</h2>
        <p>The OR object is automatically injected into every test as <code>OR</code>:</p>
        <pre>{`test('login', async ({ page }) => {
  await page.goto('https://your-app.com/login');
  await page.locator(OR.LoginPage.emailInput).fill('user@example.com');
  await page.locator(OR.LoginPage.passwordInput).fill('secret');
  await page.locator(OR.LoginPage.submitBtn).click();
});`}</pre>
        <div className="callout-best">When a UI element changes, update it once in the OR — every test that references it is fixed automatically.</div>
        <h2>Folders</h2>
        <p>Use the left panel in OR to create a folder hierarchy. Drag entries into folders to keep large repositories organised by page or feature area.</p>
      </>
    ),
  },
  'wt-deps': {
    title: 'Test Dependencies',
    content: (
      <>
        <p>Test dependencies let you run prerequisite or cleanup scripts before and after your main test file — without duplicating code.</p>
        <h2>Use cases</h2>
        <ul>
          <li><strong>Before dep</strong> — seed test data, log in, navigate to a starting state</li>
          <li><strong>After dep</strong> — clean up created records, log out, reset state</li>
        </ul>
        <h2>Setting up dependencies</h2>
        <ol>
          <li>Open a test file in the editor.</li>
          <li>Click the <strong>Dependencies</strong> tab.</li>
          <li>Add before/after files from the same module.</li>
          <li>Set the execution order with the number input.</li>
        </ol>
        <p>When you click Run, the order is: <code>before deps → main test → after deps</code>.</p>
        <div className="callout-warn">Dependencies run as separate Playwright spec files in the same temp workspace. They share browser state only if they are part of the same Playwright project context.</div>
      </>
    ),
  },
  'wt-global-vars': {
    title: 'Global Variables',
    content: (
      <>
        <p>Global Variables are key-value pairs injected as environment variables into every test run — both single runs and CI suite runs.</p>
        <h2>Common uses</h2>
        <ul>
          <li>Base URLs: <code>BASE_URL=https://staging.yourapp.com</code></li>
          <li>Test credentials: <code>TEST_USER=qa@yourapp.com</code>, <code>TEST_PASS=secret</code></li>
          <li>API keys: <code>API_TOKEN=abc123</code></li>
          <li>Feature flags: <code>FEATURE_X=true</code></li>
        </ul>
        <h2>Accessing them in tests</h2>
        <pre>{`test('login', async ({ page }) => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const user    = process.env.TEST_USER;
  const pass    = process.env.TEST_PASS;

  await page.goto(\`\${baseUrl}/login\`);
  await page.getByLabel('Email').fill(user);
  await page.getByLabel('Password').fill(pass);
});`}</pre>
        <div className="callout-best">Never hardcode URLs or credentials in test files. Use Global Variables so the same tests run against dev, staging, and prod without edits.</div>
      </>
    ),
  },

  // ── Running Tests ────────────────────────────────────────
  'run-single': {
    title: 'Single Test Runs',
    content: (
      <>
        <p>A <strong>Single Run</strong> executes one test file using the Playwright runner installed on the server. Results are stored in the <strong>Single Runs</strong> history.</p>
        <h2>How to run</h2>
        <ol>
          <li>Open a test file in the editor.</li>
          <li>Click <strong>▶ Run</strong>.</li>
          <li>Results appear in the right panel — logs, screenshot, trace link, and pass/fail status.</li>
        </ol>
        <h2>What gets saved</h2>
        <ul>
          <li>Status (PASS / FAIL)</li>
          <li>Full log output</li>
          <li>Screenshot (based on Config screenshot setting)</li>
          <li>HTML Playwright report</li>
          <li>Trace zip (if trace mode is not Off)</li>
          <li>Video file (if video mode is not Off)</li>
          <li>Duration in milliseconds</li>
        </ul>
        <h2>Viewing history</h2>
        <p>Go to <strong>Single Runs</strong> in the sidebar to see all execution history across all modules and test files. You can filter by module or test file, and open the HTML report directly.</p>
      </>
    ),
  },
  'run-suite': {
    title: 'CI Suite Runs',
    content: (
      <>
        <p>A <strong>Suite</strong> is a named collection of test files that run together in headless (CI) mode. Perfect for regression pipelines.</p>
        <h2>Creating a suite</h2>
        <ol>
          <li>Go to <strong>Suite Runs</strong> in the sidebar.</li>
          <li>Click <strong>+ New Suite</strong>, give it a name.</li>
          <li>Click the suite to open it and add test files from any module.</li>
        </ol>
        <h2>Running a suite</h2>
        <ol>
          <li>Click <strong>▶ Run CI</strong> on a suite.</li>
          <li>The suite runs headless using your <strong>Config</strong> settings (workers, screenshot, trace, video).</li>
          <li>Results are streamed live. Each test file gets an individual result record.</li>
        </ol>
        <h2>Suite execution detail</h2>
        <p>Click any suite execution to see:</p>
        <ul>
          <li>Pass/fail breakdown per test file</li>
          <li>Per-test logs, screenshots, trace, and video artifacts</li>
          <li>AI healing notes (if any tests were auto-healed)</li>
          <li>Link to the overall HTML report</li>
          <li>Defects auto-raised from failures</li>
        </ul>
        <div className="callout-best">Set <strong>Trace → On Failure</strong> and <strong>Screenshots → On Failure</strong> for CI suite runs. This gives you evidence for every failing test without the overhead of recording everything.</div>
      </>
    ),
  },
  'run-config': {
    title: 'Playwright Config',
    content: (
      <>
        <p>The <strong>Config</strong> page (sidebar → Config) stores Playwright runner settings persisted in your browser. These apply to both single runs and CI suite runs.</p>
        <h2>Settings</h2>
        <table>
          <thead><tr><th>Setting</th><th>Options</th><th>Effect</th></tr></thead>
          <tbody>
            <tr><td>Browser</td><td>Chromium, Firefox, WebKit</td><td>Which browser engine Playwright uses</td></tr>
            <tr><td>Execution Mode</td><td>Serial, Parallel</td><td>Serial = one test at a time; Parallel = multiple workers</td></tr>
            <tr><td>Workers</td><td>2–8</td><td>Only visible in Parallel mode. Number of concurrent browser instances.</td></tr>
            <tr><td>Screenshots</td><td>On Failure, Always, Disabled</td><td>When to capture a screenshot</td></tr>
            <tr><td>Trace</td><td>Off, On Retry, On Failure, Always</td><td>When to record a Playwright trace zip</td></tr>
            <tr><td>Video</td><td>Off, On Retry, On Failure, Always</td><td>When to record a browser video (.webm)</td></tr>
          </tbody>
        </table>
        <div className="callout-tip">Click <strong>Save</strong> after changing settings — configuration is stored in localStorage and sent with every run request.</div>
      </>
    ),
  },
  'run-trace': {
    title: 'Trace & Video Capture',
    content: (
      <>
        <p>TestStudio.cloud supports both <strong>Playwright Trace</strong> (DOM snapshots, network, console) and <strong>video recording</strong> — configurable per run.</p>
        <h2>Trace</h2>
        <p>A trace captures everything: DOM tree snapshots at every action, full network activity, console logs, and screenshots. You can step through your test action by action in the Playwright Trace Viewer.</p>
        <h3>How to enable</h3>
        <ol>
          <li>Go to <strong>Config</strong>.</li>
          <li>Under <strong>Trace</strong>, choose a mode:</li>
        </ol>
        <table>
          <thead><tr><th>Mode</th><th>Behaviour</th></tr></thead>
          <tbody>
            <tr><td>Off</td><td>No trace recorded</td></tr>
            <tr><td>On Retry</td><td>Records trace only on retried tests</td></tr>
            <tr><td>On Failure</td><td>Keeps trace only if the test fails</td></tr>
            <tr><td>Always</td><td>Always records trace</td></tr>
          </tbody>
        </table>
        <p>After a run with trace enabled, a <strong>View Trace →</strong> link appears in the results panel. Clicking it opens the trace in the free online Playwright Trace Viewer (<code>trace.playwright.dev</code>).</p>
        <div className="callout-best">Use <strong>On Failure</strong> for CI suites. It's low overhead and gives you a full forensic record whenever something breaks.</div>
        <h2>Video</h2>
        <p>Video records the browser screen as a <code>.webm</code> file throughout the test. Same four modes as Trace.</p>
        <p>Videos are stored alongside trace and report artifacts. They are accessible from the execution detail view in <strong>Single Runs</strong> and <strong>Suite Runs</strong>.</p>
        <div className="callout-warn">Video recording increases test duration slightly (encoder overhead). Use <strong>On Failure</strong> or <strong>On Retry</strong> for CI to keep runs fast.</div>
        <h2>Debug run (🐛 Trace button)</h2>
        <p>The Trace button in the editor always runs with <code>trace: on</code> regardless of Config settings — useful for one-off debugging without changing your saved config.</p>
      </>
    ),
  },

  // ── AI Features ──────────────────────────────────────────
  'ai-script': {
    title: 'AI Script Generation',
    content: (
      <>
        <p>The AI Script Generator turns a plain-English description into Playwright test code — either replacing the current script or appending to it.</p>
        <h2>How to use</h2>
        <ol>
          <li>Open a test file in the editor.</li>
          <li>Click <strong>⚡ AI Script</strong>.</li>
          <li>Enter your instruction, e.g.: <em>"Test that a user can add an item to the cart and proceed to checkout"</em>.</li>
          <li>Choose <strong>Replace</strong> (overwrite) or <strong>Append</strong> (add after existing code).</li>
          <li>Click <strong>Generate</strong>. The AI writes the Playwright steps and fills the editor.</li>
          <li>Click <strong>▶ Run</strong> to verify it works.</li>
        </ol>
        <h2>Tips for better results</h2>
        <ul>
          <li>Be specific: <em>"Click the Login button and verify the error message 'Invalid credentials' appears"</em> works better than <em>"test login"</em>.</li>
          <li>Mention the page URL if the AI doesn't know it.</li>
          <li>Use the Global Variable <code>BASE_URL</code> and tell the AI to reference <code>process.env.BASE_URL</code>.</li>
          <li>After generation, review the selectors — AI uses its best guess. Replace brittle selectors with <code>getByRole</code> or OR references.</li>
        </ul>
        <div className="callout-tip">AI Script Generation requires an <strong>OpenAI API Key</strong> set in your Organisation settings.</div>
      </>
    ),
  },
  'ai-testcases': {
    title: 'AI Test Case Generation',
    content: (
      <>
        <p>AI Test Case Generation creates structured test cases from any requirement or feature description — covering 11 different test types.</p>
        <h2>Test types available</h2>
        <table>
          <thead><tr><th>Type</th><th>What it focuses on</th></tr></thead>
          <tbody>
            <tr><td>Happy Path</td><td>Normal working flow with valid inputs</td></tr>
            <tr><td>Negative / Error</td><td>Invalid inputs, error messages, rejections</td></tr>
            <tr><td>Boundary Value</td><td>Min/max limits, edge of valid ranges</td></tr>
            <tr><td>Edge Case</td><td>Unusual but valid combinations</td></tr>
            <tr><td>Integration</td><td>Interaction between components</td></tr>
            <tr><td>Regression</td><td>Prevents known bugs from coming back</td></tr>
            <tr><td>Smoke</td><td>Bare minimum — is the feature alive?</td></tr>
            <tr><td>Security</td><td>Auth bypass, injection, exposure</td></tr>
            <tr><td>Accessibility</td><td>ARIA, keyboard nav, screen readers</td></tr>
            <tr><td>Performance</td><td>Load time, responsiveness under load</td></tr>
            <tr><td>UI / Visual</td><td>Layout, text, icon correctness</td></tr>
          </tbody>
        </table>
        <h2>How to use</h2>
        <ol>
          <li>Go to <strong>Test Cases</strong>.</li>
          <li>Select a requirement from the dropdown.</li>
          <li>Click <strong>⚡ Generate with AI</strong>.</li>
          <li>Tick the test types you want.</li>
          <li>Click <strong>Generate</strong>. Test cases appear instantly.</li>
        </ol>
      </>
    ),
  },
  'ai-healing': {
    title: 'AI Self-Healing Tests',
    content: (
      <>
        <p>When a test fails, if AI Healing is enabled, the platform automatically attempts to diagnose and fix the failure — then re-runs the test to verify the fix.</p>
        <h2>How it works</h2>
        <ol>
          <li>Test fails with an error.</li>
          <li>The AI analyses the error message and the test code.</li>
          <li>It proposes a fix (selector change, assertion update, wait added).</li>
          <li>The fixed test re-runs in the same session.</li>
          <li>If it passes: execution is saved as PASS with an <em>AI Healed</em> badge. The fix is visible in the results panel.</li>
          <li>If it still fails: execution is saved as FAIL and a defect is raised.</li>
        </ol>
        <div className="callout-best">Review AI-healed fixes and apply them back to your test file source. Healing only fixes the in-memory copy — it doesn't auto-save to the editor.</div>
        <h2>Enabling</h2>
        <ol>
          <li>Go to <strong>Admin → Organizations</strong>.</li>
          <li>Set your <strong>OpenAI API Key</strong>.</li>
          <li>Toggle <strong>AI Healing</strong> to enabled.</li>
        </ol>
      </>
    ),
  },

  // ── Test Management ──────────────────────────────────────
  'tm-features': {
    title: 'Features & Requirements',
    content: (
      <>
        <p>TestStudio.cloud supports a lightweight requirement hierarchy: <strong>Features → Requirements → Test Cases</strong>.</p>
        <h2>Features</h2>
        <p>A Feature represents a high-level product capability (e.g. "User Authentication", "Shopping Cart"). Each feature can have many Requirements.</p>
        <h2>Requirements</h2>
        <p>A Requirement is a specific testable statement (e.g. "Users must be able to log in with email and password"). Requirements live inside a Feature.</p>
        <p>You can link <strong>Playwright test files</strong> to a requirement — so when a linked test fails, the requirement is marked at risk.</p>
        <h2>Creating them</h2>
        <ol>
          <li>Go to <strong>Features</strong> and create a feature.</li>
          <li>Open the feature and click <strong>+ Add Requirement</strong>.</li>
          <li>Enter requirement text, priority, and status.</li>
          <li>Link an automation test file if one exists.</li>
        </ol>
      </>
    ),
  },
  'tm-testcases': {
    title: 'Test Cases',
    content: (
      <>
        <p>Test Cases are manual (or AI-generated) step-by-step test scenarios linked to Requirements.</p>
        <h2>Structure</h2>
        <ul>
          <li><strong>Title</strong> — what is being tested</li>
          <li><strong>Preconditions</strong> — what must be true before the test starts</li>
          <li><strong>Steps</strong> — numbered actions with expected results</li>
          <li><strong>Expected Result</strong> — what a passing run looks like</li>
          <li><strong>Type</strong> — Happy Path, Negative, Security, etc.</li>
          <li><strong>Priority</strong> — Critical, High, Medium, Low</li>
          <li><strong>Status</strong> — Draft, Active, Deprecated</li>
        </ul>
        <h2>Running a test case manually</h2>
        <p>Open a test case and click <strong>▶ Run Manual Test</strong>. Step through each action and mark it Pass/Fail. The result is recorded in the execution history.</p>
      </>
    ),
  },
  'tm-defects': {
    title: 'Defect Tracking',
    content: (
      <>
        <p>Defects can be raised manually or automatically when a test fails after AI healing has been attempted.</p>
        <h2>Auto-raised defects</h2>
        <p>When a suite CI run completes and a test still fails (after AI healing had one attempt), a defect is automatically created with:</p>
        <ul>
          <li>Test name and error message pre-filled</li>
          <li>Link to the failing execution</li>
          <li>Severity set to Medium by default</li>
        </ul>
        <h2>Defect fields</h2>
        <table>
          <thead><tr><th>Field</th><th>Options</th></tr></thead>
          <tbody>
            <tr><td>Status</td><td>Open, In Progress, Resolved, Closed</td></tr>
            <tr><td>Severity</td><td>Critical, High, Medium, Low</td></tr>
            <tr><td>Priority</td><td>Critical, High, Medium, Low</td></tr>
            <tr><td>Assigned To</td><td>Any org user</td></tr>
          </tbody>
        </table>
        <p>Each defect has a comment thread and a full history of status changes.</p>
      </>
    ),
  },
  'tm-sprints': {
    title: 'Sprints & Taskboard',
    content: (
      <>
        <p>TestStudio.cloud includes lightweight sprint planning and a Kanban-style taskboard.</p>
        <h2>Sprints</h2>
        <ol>
          <li>Go to <strong>Sprints</strong> and click <strong>+ New Sprint</strong>.</li>
          <li>Set start/end dates and sprint goal.</li>
          <li>Add test cases or tasks to the sprint.</li>
          <li>Track progress — the sprint shows pass/fail counts from linked test case runs.</li>
        </ol>
        <h2>Taskboard</h2>
        <p>The Taskboard is a Kanban board with columns: <strong>To Do → In Progress → In Review → Done</strong>. Tasks can be linked to test cases, defects, or requirements.</p>
      </>
    ),
  },

  // ── Best Practices ───────────────────────────────────────
  'bp-structure': {
    title: 'Structuring Your Tests',
    content: (
      <>
        <h2>Module naming</h2>
        <p>Name modules after application areas, not test types. Good: <code>LoginFlow</code>, <code>Checkout</code>, <code>AdminPanel</code>. Avoid: <code>SmokeTests</code>, <code>RegressionSuite</code>.</p>
        <h2>Test file granularity</h2>
        <ul>
          <li>One distinct user journey per test file.</li>
          <li>Avoid very long tests (&gt;30 steps) — split them into smaller flows connected by dependencies.</li>
          <li>Keep tests <strong>independent</strong>: each should work standalone. Use before-deps for setup, after-deps for cleanup.</li>
        </ul>
        <h2>Assertions</h2>
        <ul>
          <li>Assert <em>outcomes</em>, not implementation details. Prefer <code>toBeVisible()</code> over checking CSS classes.</li>
          <li>Use <code>await expect(locator).toHaveText(...)</code> rather than reading innerText manually.</li>
          <li>Add meaningful assertions after every major action — don't just click and move on.</li>
        </ul>
        <h2>Data management</h2>
        <ul>
          <li>Use <strong>Global Variables</strong> for all URLs, credentials, and environment-specific values.</li>
          <li>Clean up created data in after-deps. Don't assume production data exists.</li>
        </ul>
        <div className="callout-best">A test that passes reliably on every run is worth more than a comprehensive test that's flaky. Prioritise stability.</div>
      </>
    ),
  },
  'bp-selectors': {
    title: 'Selector Strategy',
    content: (
      <>
        <h2>Priority order</h2>
        <ol>
          <li><strong>Role + name</strong> — <code>getByRole('button', {'{ name: "Submit" }'})</code> — most resilient</li>
          <li><strong>Label</strong> — <code>getByLabel('Email address')</code> — great for forms</li>
          <li><strong>Text</strong> — <code>getByText('Continue to payment')</code></li>
          <li><strong>Test ID</strong> — <code>getByTestId('login-btn')</code> — requires <code>data-testid</code> in source</li>
          <li><strong>Placeholder</strong> — <code>getByPlaceholder('Search...')</code></li>
          <li><strong>CSS / XPath</strong> — last resort, brittle</li>
        </ol>
        <h2>Object Repository strategy</h2>
        <p>Store every reusable selector in the Object Repository. The rule of thumb:</p>
        <ul>
          <li>If a selector is used in more than one test file → put it in the OR.</li>
          <li>If a selector is specific to one test and unlikely to be reused → inline it.</li>
        </ul>
        <h2>Avoiding flakiness</h2>
        <ul>
          <li>Always await navigation before asserting: <code>await page.waitForLoadState('load')</code></li>
          <li>Use Playwright's built-in auto-wait — avoid manual <code>setTimeout</code>.</li>
          <li>For dynamic content, use <code>await expect(locator).toBeVisible({'{ timeout: 5000 }'})</code>.</li>
        </ul>
      </>
    ),
  },
  'bp-ci': {
    title: 'CI/CD Integration',
    content: (
      <>
        <p>TestStudio.cloud runs CI suites in <strong>headless mode</strong> internally — no external CI tool required. But you can also trigger runs via the API.</p>
        <h2>Running a suite via API</h2>
        <pre>{`POST /run-suite/:suiteId
Authorization: x-auth-token <your-token>
Content-Type: application/json

{
  "useDocker": true,
  "workers": 2,
  "fullyParallel": false,
  "screenshotMode": "only-on-failure",
  "traceMode": "retain-on-failure",
  "videoMode": "off"
}`}</pre>
        <p>The response includes <code>suite_execution_id</code> which you can poll for results.</p>
        <h2>Recommended CI pipeline</h2>
        <ol>
          <li><strong>Feature work</strong> — run individual tests via the editor during development.</li>
          <li><strong>Pre-merge</strong> — trigger the suite that covers the changed feature area.</li>
          <li><strong>Post-deploy</strong> — run the full regression suite against the deployed environment using <code>BASE_URL</code> Global Variable pointing at the new environment.</li>
        </ol>
        <div className="callout-best">Keep your regression suite fast (&lt; 10 min). Move slow or exploratory tests to a separate nightly suite.</div>
      </>
    ),
  },

  // ── FAQ ──────────────────────────────────────────────────
  'faq-general': {
    title: 'General Questions',
    content: (
      <>
        <h2>What browsers are supported?</h2>
        <p>Chromium (Chrome), Firefox, and WebKit (Safari). Configured via the Config page.</p>
        <h2>Is Playwright installed on the server?</h2>
        <p>Yes. Playwright and its browser binaries are bundled with the server. No local installation required — you just write your tests in the editor and click Run.</p>
        <h2>Can I import existing Playwright tests?</h2>
        <p>Yes. Paste your existing <code>.spec.ts</code> code directly into the test editor. TestStudio.cloud is fully standards-compatible Playwright.</p>
        <h2>Is there a file size limit for test files?</h2>
        <p>No hard limit, but tests that run for more than 60 seconds will time out (single runs). Suite runs have a 120-second per-test timeout.</p>
        <h2>Can I use npm packages?</h2>
        <p>By default, only Playwright and its utilities are available. Standard Node.js built-ins (<code>fs</code>, <code>path</code>, <code>crypto</code>) also work. Third-party packages are not supported at runtime.</p>
        <h2>Where are test reports stored?</h2>
        <p>HTML reports are saved on the server in the <code>reports/</code> directory and accessible via the Reports section. Trace and video files are stored alongside reports.</p>
      </>
    ),
  },
  'faq-troubleshoot': {
    title: 'Troubleshooting',
    content: (
      <>
        <h2>My test passes locally but fails on the server</h2>
        <ul>
          <li>Check <strong>Global Variables</strong> — is <code>BASE_URL</code> pointing to the right environment?</li>
          <li>The server runs headless. Avoid tests that rely on window focus or clipboard access without explicit browser permissions.</li>
          <li>Enable <strong>Trace → Always</strong> temporarily and click the Trace link to step through what happened.</li>
        </ul>
        <h2>I see "require is not defined"</h2>
        <p>TestStudio.cloud test files use ES modules (<code>"type": "module"</code>). Replace <code>const x = require('...')</code> with <code>import x from '...'</code>. For the Object Repository, just reference <code>OR</code> directly — it's auto-injected.</p>
        <h2>AI features aren't working</h2>
        <ul>
          <li>Go to <strong>Admin → Organizations</strong>.</li>
          <li>Check that an <strong>OpenAI API Key</strong> is set and valid.</li>
          <li>Keys must have access to GPT-4o.</li>
        </ul>
        <h2>Screenshots / trace not appearing after a run</h2>
        <ul>
          <li>Check the <strong>Config</strong> page — Screenshot, Trace, and Video modes default to <strong>Off</strong> / <strong>On Failure</strong>.</li>
          <li>Make sure you clicked <strong>Save</strong> on the Config page after changing settings.</li>
        </ul>
        <h2>Execution shows PASS but the app is broken</h2>
        <p>Your assertions may not be thorough enough. Add explicit <code>expect</code> calls for key outcomes (text visible, URL changed, API response status). Enable <strong>Video → Always</strong> temporarily to watch what the browser actually did.</p>
      </>
    ),
  },
};

// ─── Per-article headings for the right TOC ──────────────────────────────────
const HEADINGS = {
  'gs-overview':       ['Core concepts', 'Navigation overview'],
  'gs-org':            ['Steps', 'Org settings'],
  'gs-first-module':   ['1. Create a module', '2. Create a test file', '3. Write and run'],
  'gs-users':          ['Roles', 'Adding a user'],
  'wt-playwright':     ['Available objects', 'Common actions', 'Selectors — best to worst'],
  'wt-editor':         ['Editor toolbar', 'Keyboard shortcuts', 'Results panel'],
  'wt-or':             ['Creating an entry', 'Using OR in tests', 'Folders'],
  'wt-deps':           ['Use cases', 'Setting up dependencies'],
  'wt-global-vars':    ['Common uses', 'Accessing them in tests'],
  'run-single':        ['How to run', 'What gets saved', 'Viewing history'],
  'run-suite':         ['Creating a suite', 'Running a suite', 'Suite execution detail'],
  'run-config':        ['Settings'],
  'run-trace':         ['Trace', 'Video', 'Debug run'],
  'ai-script':         ['How to use', 'Tips for better results'],
  'ai-testcases':      ['Test types available', 'How to use'],
  'ai-healing':        ['How it works', 'Enabling'],
  'tm-features':       ['Features', 'Requirements', 'Creating them'],
  'tm-testcases':      ['Structure', 'Running a test case manually'],
  'tm-defects':        ['Auto-raised defects', 'Defect fields'],
  'tm-sprints':        ['Sprints', 'Taskboard'],
  'bp-structure':      ['Module naming', 'Test file granularity', 'Assertions', 'Data management'],
  'bp-selectors':      ['Priority order', 'Object Repository strategy', 'Avoiding flakiness'],
  'bp-ci':             ['Running a suite via API', 'Recommended CI pipeline'],
  'faq-general':       ['Supported browsers', 'Playwright on the server', 'Importing existing tests', 'npm packages', 'Reports storage'],
  'faq-troubleshoot':  ['Test passes locally but fails', 'require is not defined', 'AI features not working', 'Screenshots / trace missing', 'PASS but app is broken'],
};

// ─── Renderer ─────────────────────────────────────────────────────────────────
function ArticleContent({ node }) {
  if (!node) return null;
  const type = node.type;

  if (type === 'p') return <p className="text-slate-300 leading-relaxed mb-3">{node.props.children}</p>;
  if (type === 'h2') return <h2 className="text-xl font-bold text-white mt-8 mb-3 border-b border-slate-800 pb-1">{node.props.children}</h2>;
  if (type === 'h3') return <h3 className="text-base font-semibold text-slate-200 mt-5 mb-2">{node.props.children}</h3>;
  if (type === 'ul') return <ul className="list-disc pl-5 space-y-1 mb-3 text-slate-300">{node.props.children}</ul>;
  if (type === 'ol') return <ol className="list-decimal pl-5 space-y-1 mb-3 text-slate-300">{node.props.children}</ol>;
  if (type === 'li') return <li className="leading-relaxed">{node.props.children}</li>;
  if (type === 'pre') return <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 overflow-x-auto mb-4 text-sm font-mono text-slate-300 whitespace-pre-wrap">{node.props.children}</pre>;
  if (type === 'code') return <code className="bg-slate-800 text-orange-300 px-1.5 py-0.5 rounded text-sm font-mono">{node.props.children}</code>;
  if (type === 'strong') return <strong className="text-white font-semibold">{node.props.children}</strong>;
  if (type === 'em') return <em className="text-slate-200 italic">{node.props.children}</em>;
  if (type === 'table') return (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm border-collapse border border-slate-800">{node.props.children}</table>
    </div>
  );
  if (type === 'thead') return <thead className="bg-slate-800">{node.props.children}</thead>;
  if (type === 'tbody') return <tbody>{node.props.children}</tbody>;
  if (type === 'tr') return <tr className="border-b border-slate-800">{node.props.children}</tr>;
  if (type === 'th') return <th className="px-3 py-2 text-left text-slate-300 font-semibold">{node.props.children}</th>;
  if (type === 'td') return <td className="px-3 py-2 text-slate-400">{node.props.children}</td>;
  if (type === 'div' && node.props.className === 'callout tip') return (
    <div className="bg-indigo-950/50 border border-indigo-700/50 rounded-lg px-4 py-3 my-4 text-sm text-indigo-200 leading-relaxed">
      <span className="font-semibold text-indigo-300">💡 Tip — </span>{node.props.children}
    </div>
  );
  if (type === 'div' && node.props.className === 'callout best') return (
    <div className="bg-emerald-950/40 border border-emerald-700/40 rounded-lg px-4 py-3 my-4 text-sm text-emerald-200 leading-relaxed">
      <span className="font-semibold text-emerald-300">✅ Best Practice — </span>{node.props.children}
    </div>
  );
  if (type === 'div' && node.props.className === 'callout warn') return (
    <div className="bg-amber-950/40 border border-amber-700/40 rounded-lg px-4 py-3 my-4 text-sm text-amber-200 leading-relaxed">
      <span className="font-semibold text-amber-300">⚠️ Note — </span>{node.props.children}
    </div>
  );
  return node;
}

// ─── Docs Page ────────────────────────────────────────────────────────────────
export default function Docs() {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState('gs-overview');
  const [search, setSearch] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Flatten all articles for search
  const allArticles = SECTIONS.flatMap(s => s.articles.map(a => ({ ...a, section: s.title })));
  const filtered = search.trim()
    ? allArticles.filter(a => a.title.toLowerCase().includes(search.toLowerCase()) || a.section.toLowerCase().includes(search.toLowerCase()))
    : null;

  const article = CONTENT[activeId];

  useEffect(() => { window.scrollTo(0, 0); }, [activeId]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* ── Top Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="font-bold text-base tracking-tight">TestStudio<span className="text-indigo-400">.cloud</span></span>
            </button>
            <div className="hidden sm:flex items-center gap-1 text-xs bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full text-slate-400">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
              Docs
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/')} className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5">← Back</button>
            <button onClick={() => navigate('/org/default')} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors">Login →</button>
          </div>
        </div>
      </nav>

      <div className="pt-14 max-w-7xl mx-auto flex">
        {/* ── Sidebar ── */}
        <aside className="hidden lg:block w-64 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-slate-800 py-6 px-4">
          {/* Search */}
          <div className="relative mb-5">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search docs..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Search results */}
          {filtered ? (
            <div className="space-y-1">
              <p className="text-xs text-slate-500 mb-2">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
              {filtered.map(a => (
                <button key={a.id} onClick={() => { setActiveId(a.id); setSearch(''); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${activeId === a.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                  <div className="font-medium">{a.title}</div>
                  <div className="text-xs opacity-60">{a.section}</div>
                </button>
              ))}
            </div>
          ) : (
            <nav className="space-y-5">
              {SECTIONS.map(s => (
                <div key={s.title}>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 px-3">
                    <span>{s.icon}</span><span>{s.title}</span>
                  </div>
                  <ul className="space-y-0.5">
                    {s.articles.map(a => (
                      <li key={a.id}>
                        <button onClick={() => setActiveId(a.id)}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${activeId === a.id ? 'bg-indigo-600/20 text-indigo-300 font-medium border-l-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
                          {a.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          )}
        </aside>

        {/* ── Mobile nav toggle ── */}
        <div className="lg:hidden fixed bottom-4 right-4 z-50">
          <button onClick={() => setMobileMenuOpen(o => !o)}
            className="w-12 h-12 bg-indigo-600 rounded-full shadow-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
          {mobileMenuOpen && (
            <div className="absolute bottom-14 right-0 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 max-h-96 overflow-y-auto">
              {SECTIONS.map(s => (
                <div key={s.title} className="mb-3">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{s.icon} {s.title}</div>
                  {s.articles.map(a => (
                    <button key={a.id} onClick={() => { setActiveId(a.id); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm mb-0.5 ${activeId === a.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                      {a.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Main content ── */}
        <main className="flex-1 min-w-0 py-10 px-6 lg:px-12 max-w-3xl">
          {article ? (
            <>
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-6">
                {SECTIONS.find(s => s.articles.some(a => a.id === activeId))?.title}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                <span className="text-slate-400">{article.title}</span>
              </div>

              <h1 className="text-3xl font-bold text-white mb-6">{article.title}</h1>
              <div className="docs-prose">{article.content}</div>

              {/* Prev / Next */}
              <div className="mt-12 pt-6 border-t border-slate-800 flex justify-between gap-4">
                {(() => {
                  const flat = SECTIONS.flatMap(s => s.articles);
                  const idx = flat.findIndex(a => a.id === activeId);
                  const prev = flat[idx - 1];
                  const next = flat[idx + 1];
                  return (
                    <>
                      <div className="flex-1">
                        {prev && (
                          <button onClick={() => setActiveId(prev.id)} className="group flex flex-col items-start gap-1 text-left hover:text-indigo-400 transition-colors">
                            <span className="text-xs text-slate-500 group-hover:text-slate-400">← Previous</span>
                            <span className="text-sm font-medium text-slate-300 group-hover:text-indigo-300">{prev.title}</span>
                          </button>
                        )}
                      </div>
                      <div className="flex-1 flex justify-end">
                        {next && (
                          <button onClick={() => setActiveId(next.id)} className="group flex flex-col items-end gap-1 text-right hover:text-indigo-400 transition-colors">
                            <span className="text-xs text-slate-500 group-hover:text-slate-400">Next →</span>
                            <span className="text-sm font-medium text-slate-300 group-hover:text-indigo-300">{next.title}</span>
                          </button>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </>
          ) : (
            <div className="text-slate-400 text-sm">Select an article from the sidebar.</div>
          )}
        </main>

        {/* ── Right TOC ── */}
        <aside className="hidden xl:block w-52 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-6 px-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">On this page</p>
          {article && (
            <ul className="space-y-1">
              {(HEADINGS[activeId] || []).map(h => (
                <li key={h}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 leading-snug cursor-default">
                  {h}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
