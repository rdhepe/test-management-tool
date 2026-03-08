# TestStudio.Cloud

A full-featured SaaS test management and automation platform built with React, Tailwind CSS, and Node.js/Express.

## Features

### Core Platform
- **Dark Theme UI**: Clean and minimal dark interface
- **Collapsible Sidebar**: Section headers collapse/expand; icon-only mode; preferences persisted to localStorage
- **Top Navbar**: App branding, org context, and user avatar
- **Responsive Layout**: Flexible main content area
- **Tailwind CSS**: Utility-first styling

### Test Management
- **Features & Requirements**: Define product features, attach requirements, build traceability matrix
- **Test Cases**: Manual test scenarios with steps, expected results, execution history, and Excel export
- **Sprints**: Plan iterations, track progress, and generate Sprint Detail PDFs
- **Taskboard**: Kanban board for non-testing work items linked to requirements
- **Defects**: Log, track, and close bugs with severity and sprint scoping

### Automation (Playwright)
- **Module Management**: Organise test files into project modules
- **Test File Editor**: Monaco editor with TypeScript syntax highlighting
- **Single Runs & Suite Runs**: Execute individual files or batched test suites
- **HTML Reports**: Full Playwright trace/screenshot reports per execution

### Performance Testing (k6)
- **Test Types**: Smoke, Load, Stress, Spike, Soak — each with sensible VU/duration defaults
- **Folders**: Organise tests by feature area
- **Suite Runs**: Execute multiple k6 tests in one batch with aggregate results
- **AI Insights** *(AI Healing plan required)*:
  - Threshold Recommendations — suggests p95/p99 thresholds from run history
  - Regression Compare — flags metric regressions vs a baseline run
  - Anomaly Detection — detects unusual latency/error patterns
  - Script Generator — natural-language → ready-to-run k6 script
  - Root Cause Analysis — explains why a test failed or regressed
  - Smart Suite Builder — recommends an optimal subset of tests for a suite

### Accessibility Testing (axe-core + Playwright)
- **WCAG Audits**: Automated scans via Playwright + axe-core on any URL
- **Extra Pages**: Audit multiple paths in a single test run
- **Violation Grouping**: Results categorised by impact — Critical / Serious / Moderate / Minor
- **Run History**: Per-test audit history with violation counts and full detail
- **AI Fix Suggestions** *(AI Healing plan required)*: Code-level fix recommendations for each violation

### Reports & Dashboard
- **Dashboard Widgets**: Pass rate trends, requirement coverage, open defects, recent executions
- **Sprint PDF Export**: Full sprint report for stakeholder sign-off
- **Excel Export**: Test case execution records for compliance audits

## Getting Started

### Frontend Setup

#### Install Dependencies

```bash
npm install
```

#### Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Backend Setup

#### Navigate to Server Directory

```bash
cd server
```

#### Install Server Dependencies

```bash
npm install
```

#### Install Playwright Browsers

```bash
npx playwright install
```

#### Start the Server

```bash
npm start
```

The server will run on `http://localhost:3001`

### Build for Production

```bash
npm run build
```

## Project Structure

```
├── server/                      # Backend Express server
│   ├── server.js               # API routes (Playwright, k6, axe-core, AI)
│   ├── db.js                   # PostgreSQL operations
│   ├── package.json            # Server dependencies
│   └── README.md               # Server documentation
├── src/
│   ├── components/
│   │   ├── Navbar.jsx                  # Top navigation bar
│   │   ├── Sidebar.jsx                 # Collapsible sidebar with section headers
│   │   ├── ModuleList.jsx              # Playwright module cards
│   │   ├── ModuleDetailView.jsx        # Individual module view
│   │   ├── TestFileEditor.jsx          # Monaco editor for test files
│   │   ├── PerformanceTests.jsx        # k6 performance testing module
│   │   ├── AccessibilityTests.jsx      # axe-core/Playwright accessibility audits
│   │   ├── Tutorial.jsx                # In-app guide (this file)
│   │   └── ...                         # Other feature components
│   ├── App.jsx             # Main application with keep-alive view mounting
│   ├── main.jsx            # React entry point
│   └── index.css           # Tailwind imports
├── index.html              # HTML template (Vite shell)
├── tailwind.config.js      # Tailwind configuration
├── vite.config.js          # Vite configuration
└── package.json            # Frontend dependencies
```

## Technologies Used

**Frontend**
- React 18
- Tailwind CSS 3
- Vite 5
- Monaco Editor

**Backend**
- Express.js
- PostgreSQL
- Playwright (automation + accessibility auditing)
- axe-core (WCAG violation scanning)
- k6 (performance/load testing)
- OpenAI API (AI Insights & fix suggestions — optional)
- CORS

