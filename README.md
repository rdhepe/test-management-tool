# TestStudio.Cloud

A modern SaaS web application layout built with React and Tailwind CSS.

## Features

- **Dark Theme UI**: Clean and minimal dark interface
- **Fixed Sidebar**: 250px wide navigation with menu items
- **Top Navbar**: 60px height header with app branding and user avatar
- **Responsive Layout**: Flexible main content area
- **Tailwind CSS**: Utility-first styling
- **Monaco Editor**: Full-featured code editor with TypeScript support
- **Module Management**: Create and organize test modules
- **Test File Editor**: Write Playwright tests with syntax highlighting
- **Execution Panel**: Mock test execution with pass/fail results
- **Backend Server**: Express server for running Playwright tests

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
├── server/                 # Backend Express server
│   ├── server.js          # Main server file
│   ├── package.json       # Server dependencies
│   └── README.md          # Server documentation
├── src/
│   ├── components/
│   │   ├── Navbar.jsx              # Top navigation bar
│   │   ├── Sidebar.jsx             # Left sidebar navigation
│   │   ├── ModuleList.jsx          # Module cards grid
│   │   ├── ModuleDetailView.jsx    # Individual module view
│   │   ├── TestFileEditor.jsx      # Monaco editor for test files
│   │   ├── ExecutionPanel.jsx      # Bottom execution output panel
│   │   ├── CreateModuleModal.jsx   # Module creation modal
│   │   └── CreateTestFileModal.jsx # Test file creation modal
│   ├── App.jsx             # Main application component
│   ├── main.jsx            # React entry point
│   └── index.css           # Tailwind imports
├── index.html              # HTML template
├── tailwind.config.js      # Tailwind configuration
├── vite.config.js          # Vite configuration
└── package.json            # Dependencies
```

## Features

### Module Management
- Create modules with name, description, base URL
- TypeScript as default language
- Module cards showing metadata

### Test File Editor
- Monaco Editor integration
- TypeScript syntax highlighting
- Auto-save on change
- Save/Unsaved status indicators

### Execution
- Run button in navbar
- Execution panel at bottom
- Mock test execution with spinner
- Pass/Fail results with logs

### Backend API
- **POST /run-test**: Execute Playwright tests
- Temp file management
- Test wrapping and execution
- stdout/stderr capture

## Technologies Used

- React 18
- Tailwind CSS 3
- Vite 5
- Monaco Editor
- Express.js
- Playwright
- CORS
