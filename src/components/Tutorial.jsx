import { useState } from 'react';

/* ─────────────────────────── helpers ─────────────────────────── */
function Badge({ children, color = 'indigo' }) {
  const MAP = {
    indigo: 'bg-indigo-900/50 text-indigo-300 border-indigo-700',
    emerald: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
    amber: 'bg-amber-900/50 text-amber-300 border-amber-700',
    rose: 'bg-rose-900/50 text-rose-300 border-rose-700',
    sky: 'bg-sky-900/50 text-sky-300 border-sky-700',
    purple: 'bg-purple-900/50 text-purple-300 border-purple-700',
  };
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${MAP[color] || MAP.indigo}`}>
      {children}
    </span>
  );
}

function Callout({ type = 'tip', children }) {
  const CFG = {
    tip:  { bg: 'bg-indigo-950/60 border-indigo-600/40', icon: '💡', label: 'Tip', tx: 'text-indigo-300', lt: 'text-indigo-200' },
    best: { bg: 'bg-emerald-950/60 border-emerald-600/40', icon: '✅', label: 'Best Practice', tx: 'text-emerald-300', lt: 'text-emerald-200' },
    warn: { bg: 'bg-amber-950/60 border-amber-600/40', icon: '⚠️', label: 'Note', tx: 'text-amber-300', lt: 'text-amber-200' },
    info: { bg: 'bg-sky-950/60 border-sky-600/40', icon: 'ℹ️', label: 'Info', tx: 'text-sky-300', lt: 'text-sky-200' },
  };
  const c = CFG[type] || CFG.tip;
  return (
    <div className={`rounded-lg border px-4 py-3 my-3 ${c.bg}`}>
      <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${c.tx}`}>{c.icon} {c.label}</div>
      <div className={`text-sm leading-relaxed ${c.lt}`}>{children}</div>
    </div>
  );
}

function Step({ number, title, children }) {
  return (
    <div className="flex gap-3 my-3">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{number}</div>
      <div>
        {title && <p className="text-sm font-semibold text-white mb-0.5">{title}</p>}
        <div className="text-sm text-slate-300 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Accordion({ title, badge, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden mb-2">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-750 text-left gap-2"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-200">{title}</span>
          {badge && <Badge color="indigo">{badge}</Badge>}
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 py-3 bg-slate-900/40 border-t border-slate-700">
          {children}
        </div>
      )}
    </div>
  );
}

function FlowCard({ icon, label, arrow = true }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-center gap-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg min-w-[80px] text-center">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-slate-300 font-medium">{label}</span>
      </div>
      {arrow && <svg className="w-4 h-4 text-slate-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>}
    </div>
  );
}

/* ─────────────────────────── chapter content ─────────────────── */
const CHAPTERS = [
  {
    id: 'quickstart',
    title: 'Quick Start',
    icon: '🚀',
    color: 'text-emerald-400',
    dot: 'bg-emerald-400',
    summary: 'Get up and running in minutes',
    content: () => (
      <div>
        <p className="text-slate-300 mb-4 leading-relaxed">
          Welcome to <span className="text-white font-semibold">Test Cloud Studio</span> — a complete test management and automation platform. Follow this guide to set up your first project.
        </p>
        <h4 className="text-white font-semibold mb-3">Recommended Setup Order</h4>
        <div className="flex flex-wrap items-start gap-1 mb-4">
          <FlowCard icon="🏷️" label="Features" />
          <FlowCard icon="📋" label="Requirements" />
          <FlowCard icon="✅" label="Test Cases" />
          <FlowCard icon="🗂️" label="Modules" />
          <FlowCard icon="⚡" label="Test Files" />
          <FlowCard icon="🚀" label="Execute" arrow={false} />
        </div>
        <Callout type="best">Always start by defining your <strong>Features</strong> and <strong>Requirements</strong> before writing test cases. Traceability from requirement → test case → execution is the foundation of quality reporting.</Callout>
        <h4 className="text-white font-semibold mt-5 mb-3">First 10 Minutes Checklist</h4>
        <Step number="1" title="Create a Sprint">Go to <strong>Sprints</strong> → click <strong>New Sprint</strong>. Set a name, goal, and date range. Set status to <em>Active</em>.</Step>
        <Step number="2" title="Define a Feature">Go to <strong>Features</strong> → create your first feature (e.g. "User Authentication").</Step>
        <Step number="3" title="Add Requirements">Under the feature, add requirements that describe expected behaviour.</Step>
        <Step number="4" title="Create Test Cases">Go to <strong>Test Cases</strong> → link each test case to a requirement. Add steps, expected results, and priority.</Step>
        <Step number="5" title="Create a Module">Go to <strong>Modules</strong> → create a folder for your automation project and add test files.</Step>
        <Step number="6" title="Run a Test">Select a test file → click <strong>Execute</strong>. View results in <strong>Single Runs</strong>.</Step>
        <Callout type="tip">Use the <strong>Taskboard</strong> alongside sprints to track non-testing work items (setup, infrastructure, reviews) and link them to requirements.</Callout>
      </div>
    )
  },
  {
    id: 'features-reqs',
    title: 'Features & Requirements',
    icon: '📋',
    color: 'text-sky-400',
    dot: 'bg-sky-400',
    summary: 'Define what you need to test',
    content: () => (
      <div>
        <p className="text-slate-300 mb-4 leading-relaxed">
          <strong className="text-white">Features</strong> represent major areas of your product. <strong className="text-white">Requirements</strong> are the specific behaviours that must be verified within each feature.
        </p>
        <Accordion title="Creating Features" badge="Start here">
          <Step number="1">Navigate to <strong>Features</strong> in the sidebar.</Step>
          <Step number="2">Click <strong>New Feature</strong> and give it a name (e.g. "Login", "Checkout", "API v2").</Step>
          <Step number="3">Add an optional description and priority level.</Step>
          <Callout type="best">Organise features by business domain, not by technical layer. "User Profile" is a better feature name than "Database CRUD Operations".</Callout>
        </Accordion>
        <Accordion title="Writing Good Requirements">
          <p className="text-sm text-slate-300 mb-2">Each requirement should be:</p>
          <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside mb-3">
            <li><strong>Specific</strong> — "Login with valid credentials succeeds" not "Login works"</li>
            <li><strong>Testable</strong> — can be verified with a clear pass/fail outcome</li>
            <li><strong>Linked to a sprint</strong> — so it shows up in sprint reports</li>
          </ul>
          <Callout type="tip">Use the <strong>Status</strong> field (Draft / Review / Approved) to track which requirements are ready to be tested.</Callout>
        </Accordion>
        <Accordion title="Traceability Matrix">
          <p className="text-sm text-slate-300 mb-2">The app automatically builds a traceability path:</p>
          <div className="flex flex-wrap gap-1 my-2">
            <FlowCard icon="🏷️" label="Feature" />
            <FlowCard icon="📋" label="Requirement" />
            <FlowCard icon="✅" label="Test Case" />
            <FlowCard icon="🐛" label="Defect" arrow={false} />
          </div>
          <p className="text-sm text-slate-300 mt-2">You can see this full chain in the <strong>Sprint Detail</strong> view and in <strong>Reports</strong>.</p>
        </Accordion>
        <Callout type="best">Assign requirements to a sprint so they appear in the Sprint Detail Report. This gives stakeholders a clear view of what was planned vs. tested.</Callout>
      </div>
    )
  },
  {
    id: 'testcases',
    title: 'Test Cases',
    icon: '✅',
    color: 'text-indigo-400',
    dot: 'bg-indigo-400',
    summary: 'Write and manage manual tests',
    content: () => (
      <div>
        <p className="text-slate-300 mb-4 leading-relaxed">
          Test Cases let you document <strong className="text-white">manual test scenarios</strong> with steps, expected results, preconditions, and execution history.
        </p>
        <Accordion title="Anatomy of a Test Case" badge="Essential">
          <div className="grid grid-cols-2 gap-2 text-sm text-slate-300">
            {[
              ['Title', 'Clear, action-oriented name'],
              ['Requirement', 'Links to a specific requirement'],
              ['Priority', 'Critical / High / Medium / Low'],
              ['Steps', 'Numbered actions the tester performs'],
              ['Expected Result', 'What success looks like'],
              ['Status', 'Active / Deprecated'],
            ].map(([label, desc]) => (
              <div key={label} className="bg-slate-800 border border-slate-700 rounded px-3 py-2">
                <p className="font-semibold text-white text-xs mb-0.5">{label}</p>
                <p className="text-slate-400 text-xs">{desc}</p>
              </div>
            ))}
          </div>
        </Accordion>
        <Accordion title="Execution Status Tab">
          <p className="text-sm text-slate-300 mb-2">The <strong>Execution Status</strong> tab shows a log of every time a test was run:</p>
          <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
            <li>Filter by sprint to see only relevant runs</li>
            <li>See who executed the test and when</li>
            <li>Export results to Excel for sign-off</li>
          </ul>
          <Callout type="tip">The <em>Executed By</em> field is auto-populated with the logged-in user — no manual entry needed.</Callout>
        </Accordion>
        <Accordion title="Best Practices for Test Cases">
          <Step number="1" title="One assertion per test case">Each test case should verify exactly one thing. If it can fail for two different reasons, split it.</Step>
          <Step number="2" title="Include a data set">Specify exact data values in your steps (e.g. "Enter email: user@test.com") so any tester can execute without guessing.</Step>
          <Step number="3" title="Map to automation">Once a test case has a corresponding Playwright test file, link them via the Module so coverage is tracked.</Step>
        </Accordion>
        <Callout type="best">Regularly retire (deprecate) test cases that are no longer relevant. A clean test suite is easier to maintain than a large stale one.</Callout>
      </div>
    )
  },
  {
    id: 'taskboard',
    title: 'Taskboard',
    icon: '🗂️',
    color: 'text-purple-400',
    dot: 'bg-purple-400',
    summary: 'Track work beyond test execution',
    content: () => (
      <div>
        <p className="text-slate-300 mb-4 leading-relaxed">
          The <strong className="text-white">Taskboard</strong> is a Kanban-style board for tracking any work item in a sprint — from environment setup and code reviews to documentation and CI/CD changes.
        </p>
        <Accordion title="Understanding the Columns" badge="Kanban basics">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ['New', 'slate', 'Not yet started'],
              ['In Progress', 'indigo', 'Actively being worked on'],
              ['Completed', 'emerald', 'Work done, awaiting review'],
              ['Done', 'purple', 'Verified and closed'],
            ].map(([col, color, desc]) => (
              <div key={col} className={`border border-${color}-700/40 bg-${color}-900/20 rounded px-3 py-2`}>
                <p className={`font-semibold text-${color}-300 text-xs mb-0.5`}>{col}</p>
                <p className="text-slate-400 text-xs">{desc}</p>
              </div>
            ))}
          </div>
        </Accordion>
        <Accordion title="Linking Tasks to Requirements">
          <p className="text-sm text-slate-300 mb-2">When creating or editing a task, select a <strong>Linked Requirement</strong>. This lets you answer "why does this task exist?" and shows the requirement title on the card.</p>
          <Callout type="info">Tasks linked to requirements appear in the Sprint Detail view, giving a full picture of both testing and development work.</Callout>
        </Accordion>
        <Accordion title="Effort Tracking">
          <p className="text-sm text-slate-300 mb-2">Each task has <strong>Planned Hours</strong> and <strong>Completed Hours</strong>. A progress bar on the card shows completion percentage.</p>
          <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
            <li>Use 0.5h increments for accuracy</li>
            <li>Update completed hours daily to keep the board current</li>
            <li>The remaining hours are auto-calculated: <code className="text-orange-300 bg-slate-800 px-1 rounded text-xs">Planned − Completed</code></li>
          </ul>
        </Accordion>
        <Callout type="best">Use the <strong>Due Date</strong> field on tasks — cards turn yellow (≤3 days), orange (due today), or red (overdue) automatically.</Callout>
      </div>
    )
  },
  {
    id: 'sprints',
    title: 'Sprints',
    icon: '🏃',
    color: 'text-amber-400',
    dot: 'bg-amber-400',
    summary: 'Plan and review sprint cycles',
    content: () => (
      <div>
        <p className="text-slate-300 mb-4 leading-relaxed">
          Sprints tie everything together — requirements, test cases, tasks, executions, and defects are all scoped to a sprint so you get a complete picture of each iteration.
        </p>
        <Accordion title="Sprint Lifecycle" badge="Process">
          <Step number="1" title="Plan (status: Planned)">Create the sprint, set dates, and assign requirements, test cases, and tasks.</Step>
          <Step number="2" title="Execute (status: Active)">Only one sprint should be Active at a time. Run tests, move tasks, log defects.</Step>
          <Step number="3" title="Review (status: Completed)">Open the Sprint Detail view to see a full report: pass rate, defects, task status, automation coverage.</Step>
          <Callout type="tip">The sprint dropdown in the Taskboard header shows the selected sprint's date range and status, keeping context always visible.</Callout>
        </Accordion>
        <Accordion title="Sprint Detail Report">
          <p className="text-sm text-slate-300 mb-2">The Sprint Detail page includes:</p>
          <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
            <li>Pie charts — test pass/fail ratio, requirement coverage</li>
            <li>Manual test run history with executed-by tracking</li>
            <li>Automation execution log with links to HTML reports</li>
            <li><strong>Tasks in this Sprint</strong> table with status badges</li>
            <li>Defect list with severity and status</li>
          </ul>
        </Accordion>
        <Accordion title="Best Sprint Cadence">
          <Step number="1" title="2-week sprints">Short enough to stay focused, long enough to ship meaningful test coverage.</Step>
          <Step number="2" title="Define a sprint goal">Fill in the Goal field — it appears at the top of the sprint detail report and keeps the team aligned.</Step>
          <Step number="3" title="Review metrics every Friday">Use the dashboard charts to spot failing trends before the sprint ends.</Step>
        </Accordion>
        <Callout type="best">Never delete old sprints — they provide historical trend data in Reports and show stakeholders how quality has improved over time.</Callout>
      </div>
    )
  },
  {
    id: 'automation',
    title: 'Automation',
    icon: '⚡',
    color: 'text-yellow-400',
    dot: 'bg-yellow-400',
    summary: 'Playwright modules, suites & execution',
    content: () => (
      <div>
        <p className="text-slate-300 mb-4 leading-relaxed">
          The automation layer lets you organise, configure, and execute <strong className="text-white">Playwright tests</strong> directly from the browser — no terminal access required.
        </p>
        <Accordion title="Modules & Test Files" badge="Core concept">
          <p className="text-sm text-slate-300 mb-2">A <strong>Module</strong> maps to a Playwright project or feature folder. Inside each module you create <strong>Test Files</strong> (.spec.ts/.spec.js) which can be edited and executed.</p>
          <Step number="1">Create a <strong>Module</strong> with a name and base path.</Step>
          <Step number="2">Add <strong>Test Files</strong> and write your Playwright code in the built-in editor.</Step>
          <Step number="3">Click <strong>Execute</strong> on a test file to run it. Results appear in <strong>Single Runs</strong>.</Step>
        </Accordion>
        <Accordion title="Test Suites">
          <p className="text-sm text-slate-300 mb-2">A <strong>Test Suite</strong> groups multiple test files to run as a batch. Suite executions appear in the <strong>Sprints Detail</strong> Automation section.</p>
          <Callout type="tip">Build suites around feature areas — e.g. "Auth Suite", "Checkout Suite" — so you can run all tests for a feature in one click.</Callout>
        </Accordion>
        <Accordion title="Reading Execution Results">
          <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
            <li><Badge color="emerald">Passed</Badge> — all tests in the file succeeded</li>
            <li><Badge color="rose">Failed</Badge> — one or more tests failed; click "Report" for the full HTML trace</li>
            <li><Badge color="sky">Running</Badge> — execution in progress</li>
          </ul>
          <Callout type="info">Playwright HTML reports include screenshots, network logs, and step traces — invaluable for debugging flaky tests.</Callout>
        </Accordion>
        <Accordion title="Playwright Config Tips">
          <Step number="1" title="Set baseURL">Set it in Config so all page.goto('/') calls resolve correctly without hardcoding the host.</Step>
          <Step number="2" title="Use retries in CI">Set <code className="text-orange-300 bg-slate-800 px-1 rounded text-xs">retries: 2</code> to reduce false failures from timing issues.</Step>
          <Step number="3" title="Save screenshots on failure">Enable <code className="text-orange-300 bg-slate-800 px-1 rounded text-xs">screenshot: 'only-on-failure'</code> for faster diagnosis.</Step>
        </Accordion>
        <Callout type="best">Link each Test File to the corresponding manual Test Cases via requirements. This way the Sprint Report shows both manual execution status and automation coverage for each requirement.</Callout>
      </div>
    )
  },
  {
    id: 'defects',
    title: 'Defects',
    icon: '🐛',
    color: 'text-rose-400',
    dot: 'bg-rose-400',
    summary: 'Log, track and close bugs',
    content: () => (
      <div>
        <p className="text-slate-300 mb-4 leading-relaxed">
          The <strong className="text-white">Defects</strong> module tracks bugs found during testing. Defects link to requirements and sprints, giving a clear quality signal in reports.
        </p>
        <Accordion title="Defect Fields" badge="Required">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ['Title', 'Short, specific description of the bug'],
              ['Severity', 'Critical / High / Medium / Low'],
              ['Status', 'Open → In Progress → Resolved → Closed'],
              ['Sprint', 'Which sprint this was found in'],
              ['Requirement', 'Which requirement it violates'],
              ['Steps to Reproduce', 'Exact steps so devs can replicate it'],
            ].map(([label, desc]) => (
              <div key={label} className="bg-slate-800 border border-slate-700 rounded px-3 py-2">
                <p className="font-semibold text-white text-xs mb-0.5">{label}</p>
                <p className="text-slate-400 text-xs">{desc}</p>
              </div>
            ))}
          </div>
        </Accordion>
        <Accordion title="Defect Lifecycle">
          <div className="flex flex-wrap gap-1 my-2">
            <FlowCard icon="🔴" label="Open" />
            <FlowCard icon="🟡" label="In Progress" />
            <FlowCard icon="🟢" label="Resolved" />
            <FlowCard icon="⬛" label="Closed" arrow={false} />
          </div>
          <Callout type="tip">Only close a defect after re-running the related test case and confirming it passes. Link the closing test execution as evidence.</Callout>
        </Accordion>
        <Accordion title="Best Practices">
          <Step number="1" title="Log defects immediately">Don't wait until end-of-sprint. Immediate logging helps the dev team prioritise fixes.</Step>
          <Step number="2" title="One bug per defect">Avoid "multiple issues" defects. Each unique failure should have its own entry for accurate metrics.</Step>
          <Step number="3" title="Use Critical sparingly">Reserve Critical for production-blocking issues. Overuse dilutes urgency signals.</Step>
        </Accordion>
        <Callout type="best">The Sprint Detail Report shows open defect counts per severity. A increasing defect count across sprints is an early indicator of technical debt.</Callout>
      </div>
    )
  },
  {
    id: 'reports',
    title: 'Reports & Dashboard',
    icon: '📊',
    color: 'text-teal-400',
    dot: 'bg-teal-400',
    summary: 'Understand your testing health',
    content: () => (
      <div>
        <p className="text-slate-300 mb-4 leading-relaxed">
          The <strong className="text-white">Dashboard</strong> and <strong className="text-white">Reports</strong> sections give you real-time insights into coverage, execution trends, and quality metrics.
        </p>
        <Accordion title="Dashboard Widgets" badge="At a glance">
          <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
            <li>Total test cases and pass rate trend</li>
            <li>Requirement coverage — how many reqs have at least one linked test</li>
            <li>Active sprint progress</li>
            <li>Recent executions mini-feed</li>
            <li>Open defect count by severity</li>
          </ul>
        </Accordion>
        <Accordion title="Sprint PDF Export">
          <p className="text-sm text-slate-300 mb-2">Open any Sprint Detail and click <strong>Export PDF</strong> to generate a comprehensive report containing:</p>
          <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
            <li>Sprint summary with goal and dates</li>
            <li>Test case execution results table</li>
            <li>Defect list with severity</li>
            <li>Automation execution log</li>
          </ul>
          <Callout type="tip">Share the PDF with stakeholders who don't have app access — perfect for sprint review meetings.</Callout>
        </Accordion>
        <Accordion title="Excel Export">
          <p className="text-sm text-slate-300 mb-2">In the <strong>Test Cases → Execution Status</strong> tab, click <strong>Export to Excel</strong> to download all execution records for a sprint — useful for compliance sign-off or QA audits.</p>
        </Accordion>
        <Callout type="best">Set a weekly reminder to review the Dashboard. Catching a rising failure rate early is far cheaper than debugging at sprint end.</Callout>
      </div>
    )
  },
  {
    id: 'users',
    title: 'User Management',
    icon: '👥',
    color: 'text-slate-400',
    dot: 'bg-slate-400',
    summary: 'Roles, permissions & teams',
    content: () => (
      <div>
        <p className="text-slate-300 mb-4 leading-relaxed">
          The <strong className="text-white">Users</strong> section (Admin only) lets you manage team access. Each user gets a role that controls which parts of the app they can see and use.
        </p>
        <Accordion title="Role Reference" badge="Admin only">
          <div className="space-y-2">
            {[
              ['super_admin', 'purple', 'Full access including user creation, all data, and system config.'],
              ['admin', 'indigo', 'Full feature access + user management. Cannot create other admins.'],
              ['contributor', 'sky', 'Can read and write all test management and automation features. Cannot manage users.'],
              ['custom', 'amber', 'Access is controlled per-view. Configure in the Permissions panel.'],
            ].map(([role, color, desc]) => (
              <div key={role} className="flex gap-3 items-start">
                <Badge color={color}>{role}</Badge>
                <p className="text-xs text-slate-300">{desc}</p>
              </div>
            ))}
          </div>
        </Accordion>
        <Accordion title="Setting Up Custom Roles">
          <Step number="1">Create a user or edit an existing one.</Step>
          <Step number="2">Set role to <strong>custom</strong>.</Step>
          <Step number="3">In the Permissions section, check each view this user should access (Dashboard, Test Cases, Taskboard, etc.).</Step>
          <Callout type="tip">Use custom roles for external stakeholders or clients who should only see dashboards and reports — not the automation config.</Callout>
        </Accordion>
        <Accordion title="Seat Limits">
          <p className="text-sm text-slate-300">Super admins do not consume a seat. Admin and contributor users count towards your seat limit. The limit is shown in the User Management header.</p>
        </Accordion>
        <Callout type="best">Invite team members early — shared test case ownership is healthier than one person owning the entire test suite.</Callout>
      </div>
    )
  },
  {
    id: 'bestpractices',
    title: 'Best Practices',
    icon: '🏆',
    color: 'text-orange-400',
    dot: 'bg-orange-400',
    summary: 'Proven strategies for quality',
    content: () => (
      <div>
        <p className="text-slate-300 mb-4 leading-relaxed">
          A curated collection of testing strategies that work well with this platform.
        </p>
        <Accordion title="The Testing Pyramid" badge="Strategy">
          <div className="space-y-2 my-2">
            {[
              { label: 'E2E (Playwright)', pct: 20, color: 'bg-rose-500', note: 'Happy-path user journeys only' },
              { label: 'Integration', pct: 30, color: 'bg-amber-500', note: 'API contracts, DB layer' },
              { label: 'Unit Tests', pct: 50, color: 'bg-emerald-500', note: 'Fast, isolated, most numerous' },
            ].map(({ label, pct, color, note }) => (
              <div key={label}>
                <div className="flex justify-between text-xs text-slate-400 mb-0.5">
                  <span>{label}</span><span>{pct}%</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full">
                  <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{note}</p>
              </div>
            ))}
          </div>
          <Callout type="info">Most of this app covers the E2E and manual test layer. Complement it with unit tests in your CI pipeline.</Callout>
        </Accordion>
        <Accordion title="Shift-Left Testing">
          <Step number="1" title="Write test cases before code">Use the Requirements → Test Case flow to define acceptance criteria before a feature is built.</Step>
          <Step number="2" title="Review test cases in sprint planning">Developers reading test cases during planning catch misunderstandings early.</Step>
          <Step number="3" title="Automate regression immediately">As soon as a feature is stable enough, add a Playwright spec. Don't wait until the next sprint.</Step>
        </Accordion>
        <Accordion title="Flaky Test Management">
          <Step number="1" title="Tag and track">Create a defect for every flaky test with Severity: Low. This prevents them from being ignored.</Step>
          <Step number="2" title="Use retries as a short-term fix">Set <code className="text-orange-300 bg-slate-800 px-1 rounded text-xs">retries: 1</code> in Playwright Config to reduce noise, but schedule time to fix the root cause.</Step>
          <Step number="3" title="Isolate test data">Most flakiness comes from shared state. Use unique test data per run.</Step>
        </Accordion>
        <Accordion title="Sprint Quality Gates">
          <p className="text-sm text-slate-300 mb-2">Before marking a sprint Done, verify:</p>
          <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
            <li>All test cases associated with sprint requirements have been executed</li>
            <li>All Critical and High defects are Resolved or have an accepted workaround</li>
            <li>Automation pass rate has not dropped vs. previous sprint</li>
            <li>Sprint PDF exported and shared with stakeholders</li>
          </ul>
        </Accordion>
        <Callout type="best">Quality is a team sport. Rotate test case review responsibility across developers and QAs — shared ownership reduces blind spots.</Callout>
      </div>
    )
  },
];

/* ─────────────────────────── main component ─────────────────── */
export default function Tutorial() {
  const [activeId, setActiveId] = useState('quickstart');
  const [visited, setVisited] = useState(new Set(['quickstart']));

  const chapter = CHAPTERS.find(c => c.id === activeId) || CHAPTERS[0];
  const currentIdx = CHAPTERS.findIndex(c => c.id === activeId);

  const goTo = (id) => {
    setActiveId(id);
    setVisited(prev => new Set([...prev, id]));
  };

  const prev = currentIdx > 0 ? CHAPTERS[currentIdx - 1] : null;
  const next = currentIdx < CHAPTERS.length - 1 ? CHAPTERS[currentIdx + 1] : null;

  return (
    <div className="flex h-full min-h-0">
      {/* ── Sidebar ── */}
      <aside className="w-64 shrink-0 border-r border-slate-700 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="px-5 py-5 border-b border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">📚</span>
            <h2 className="text-base font-bold text-white">Tutorial</h2>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-1.5">
            <div
              className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.round((visited.size / CHAPTERS.length) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">{visited.size} of {CHAPTERS.length} chapters read</p>
        </div>

        {/* Chapter list */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {CHAPTERS.map((ch, i) => {
            const isActive = ch.id === activeId;
            const isVisited = visited.has(ch.id);
            return (
              <button
                key={ch.id}
                onClick={() => goTo(ch.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
                }`}
              >
                <span className="text-base shrink-0 w-6 text-center">{ch.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{ch.title}</p>
                  {!isActive && (
                    <p className="text-xs text-slate-500 truncate">{ch.summary}</p>
                  )}
                </div>
                {isVisited && !isActive && (
                  <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                {!isVisited && (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-700">
          <p className="text-xs text-slate-500 text-center">Expand accordions inside each chapter for details.</p>
        </div>
      </aside>

      {/* ── Content ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Chapter header */}
        <div className="px-8 pt-8 pb-5 border-b border-slate-700 flex items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="text-4xl">{chapter.icon}</span>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-slate-500">Chapter {currentIdx + 1} of {CHAPTERS.length}</span>
                {visited.has(chapter.id) && currentIdx !== 0 && (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    Read
                  </span>
                )}
              </div>
              <h1 className={`text-2xl font-bold ${chapter.color}`}>{chapter.title}</h1>
              <p className="text-sm text-slate-400 mt-0.5">{chapter.summary}</p>
            </div>
          </div>
          {/* Progress dots */}
          <div className="hidden lg:flex items-center gap-1.5 shrink-0">
            {CHAPTERS.map(ch => (
              <button
                key={ch.id}
                onClick={() => goTo(ch.id)}
                title={ch.title}
                className={`rounded-full transition-all ${
                  ch.id === activeId ? `w-4 h-3 ${ch.dot}` : visited.has(ch.id) ? `w-2.5 h-2.5 bg-emerald-600` : 'w-2 h-2 bg-slate-600 hover:bg-slate-500'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Chapter body */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <chapter.content />
        </div>

        {/* Prev / Next */}
        <div className="px-8 py-4 border-t border-slate-700 flex items-center justify-between gap-4">
          {prev ? (
            <button
              onClick={() => goTo(prev.id)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              <div className="text-left">
                <p className="text-xs text-slate-400">Previous</p>
                <p className="font-medium">{prev.icon} {prev.title}</p>
              </div>
            </button>
          ) : <div />}

          {next ? (
            <button
              onClick={() => goTo(next.id)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors ml-auto"
            >
              <div className="text-right">
                <p className="text-xs text-indigo-300">Next up</p>
                <p className="font-medium">{next.icon} {next.title}</p>
              </div>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </button>
          ) : (
            <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-emerald-700/40 border border-emerald-600/40 text-emerald-300 rounded-lg text-sm">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              Tutorial complete!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
