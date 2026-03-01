import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import CreateModuleModal from './components/CreateModuleModal';
import CreateTestFileModal from './components/CreateTestFileModal';
import ModuleList from './components/ModuleList';
import ModuleDetailView from './components/ModuleDetailView';
import TestFileEditor from './components/TestFileEditor';
import ExecutionsList from './components/ExecutionsList';
import ExecutionDetail from './components/ExecutionDetail';
import TestSuites from './components/TestSuites';
import SuiteExecutionDetail from './components/SuiteExecutionDetail';
import Dashboard from './components/Dashboard';
import Summary from './components/Summary';
import PlaywrightConfig from './components/PlaywrightConfig';
import TestDependencies from './components/TestDependencies';
import Features from './components/Features';
import Requirements from './components/Requirements';
import TestCases from './components/TestCases';
import Defects from './components/Defects';
import Sprints from './components/Sprints';
import Reports from './components/Reports';

const API_URL = 'http://localhost:3001';

function App() {
  const [modules, setModules] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedTestFile, setSelectedTestFile] = useState(null);
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [isTestFileModalOpen, setIsTestFileModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'modules', 'moduleDetail', 'testFile', 'executions', 'executionDetail', 'testSuites', 'suiteExecutionDetail', 'features', 'requirements', 'testcases', 'defects'
  const [executionStatus, setExecutionStatus] = useState(null); // 'running', 'completed', or null
  const [executionResult, setExecutionResult] = useState(null); // { status: 'pass'|'fail', message: string }
  const [debugActive, setDebugActive] = useState(false); // true while Playwright Inspector is open
  const [executions, setExecutions] = useState([]);
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [selectedSuiteExecutionId, setSelectedSuiteExecutionId] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [dependenciesModalOpen, setDependenciesModalOpen] = useState(false);
  const [dependenciesTestFile, setDependenciesTestFile] = useState(null);

  // Auth state
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const stored = localStorage.getItem('auth_user');
    if (token && stored) {
      // Validate token with server
      fetch(`${API_URL}/auth/me`, { headers: { 'x-auth-token': token } })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => setCurrentUser(data.user))
        .catch(() => {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
        })
        .finally(() => setAuthChecked(true));
    } else {
      setAuthChecked(true);
    }
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView('dashboard');
  };
  
  // Theme management with localStorage persistence
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'dark';
  });

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Listen for sprint navigation events
  useEffect(() => {
    const handleSprintNavigation = (event) => {
      setCurrentView('sprints');
      setSelectedModule(null);
      setSelectedTestFile(null);
    };

    window.addEventListener('navigateToSprint', handleSprintNavigation);
    return () => window.removeEventListener('navigateToSprint', handleSprintNavigation);
  }, []);

  // Listen for defect navigation events
  useEffect(() => {
    const handleDefectNavigation = (event) => {
      setCurrentView('defects');
      setSelectedModule(null);
      setSelectedTestFile(null);
    };

    window.addEventListener('navigateToDefect', handleDefectNavigation);
    return () => window.removeEventListener('navigateToDefect', handleDefectNavigation);
  }, []);

  // Listen for test case navigation events
  useEffect(() => {
    const handleTestCaseNavigation = (event) => {
      setCurrentView('testcases');
      setSelectedModule(null);
      setSelectedTestFile(null);
    };

    window.addEventListener('navigateToTestCase', handleTestCaseNavigation);
    return () => window.removeEventListener('navigateToTestCase', handleTestCaseNavigation);
  }, []);

  // Listen for execution navigation events
  useEffect(() => {
    const handleExecutionNavigation = (event) => {
      const { executionId, type } = event.detail || {};
      if (type === 'suite') {
        setSelectedSuiteExecutionId(executionId);
        setCurrentView('suiteExecutionDetail');
      } else {
        // For single executions, navigate to executions list
        setCurrentView('executions');
      }
      setSelectedModule(null);
      setSelectedTestFile(null);
    };

    window.addEventListener('navigateToExecution', handleExecutionNavigation);
    return () => window.removeEventListener('navigateToExecution', handleExecutionNavigation);
  }, []);

  // Listen for test file navigation events
  useEffect(() => {
    const handleTestFileNavigation = async (event) => {
      const { moduleId, testFileId } = event.detail || {};
      if (moduleId && testFileId) {
        try {
          // Find or fetch the module
          let targetModule = modules.find(m => m.id === moduleId);
          if (!targetModule) {
            // Fetch the module if not in state
            const response = await fetch(`${API_URL}/modules/${moduleId}`);
            const moduleData = await response.json();
            const testFilesResponse = await fetch(`${API_URL}/modules/${moduleId}/test-files`);
            const testFiles = await testFilesResponse.json();
            targetModule = {
              id: moduleData.id,
              name: moduleData.name,
              description: moduleData.description,
              baseUrl: moduleData.base_url,
              language: moduleData.language,
              tags: moduleData.tags || [],
              createdAt: moduleData.created_at,
              testFiles: testFiles.map(tf => ({
                id: tf.id,
                name: tf.name,
                content: tf.content,
                createdAt: tf.created_at,
                updatedAt: tf.updated_at,
                requirementId: tf.requirement_id,
                requirementTitle: tf.requirement_title
              }))
            };
          }
          
          // Find the test file
          const targetTestFile = targetModule.testFiles?.find(tf => tf.id === testFileId);
          if (targetTestFile) {
            setSelectedModule(targetModule);
            setSelectedTestFile(targetTestFile);
            setCurrentView('testFile');
          }
        } catch (error) {
          console.error('Failed to navigate to test file:', error);
        }
      }
    };

    window.addEventListener('navigateToTestFile', handleTestFileNavigation);
    return () => window.removeEventListener('navigateToTestFile', handleTestFileNavigation);
  }, [modules]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Load modules from database on mount
  useEffect(() => {
    const loadModules = async () => {
      try {
        const response = await fetch(`${API_URL}/modules`);
        const modulesData = await response.json();
        
        // Load test files for each module
        const modulesWithTestFiles = await Promise.all(
          modulesData.map(async (module) => {
            const testFilesResponse = await fetch(`${API_URL}/modules/${module.id}/test-files`);
            const testFiles = await testFilesResponse.json();
            return { 
              id: module.id,
              name: module.name,
              description: module.description,
              baseUrl: module.base_url,
              language: module.language,
              tags: module.tags || [],
              createdAt: module.created_at,
              testFiles: testFiles.map(tf => ({
                id: tf.id,
                name: tf.name,
                content: tf.content,
                requirementId: tf.requirement_id,
                requirementTitle: tf.requirement_title,
                createdAt: tf.created_at,
                updatedAt: tf.updated_at
              }))
            };
          })
        );
        
        setModules(modulesWithTestFiles);
      } catch (error) {
        console.error('Failed to load modules:', error);
      }
    };
    
    loadModules();
  }, []);

  // Load executions from database
  useEffect(() => {
    const loadExecutions = async () => {
      try {
        const response = await fetch(`${API_URL}/executions`);
        const executionsData = await response.json();
        setExecutions(executionsData);
      } catch (error) {
        console.error('Failed to load executions:', error);
      }
    };
    
    loadExecutions();
  }, []);

  // Load requirements from database
  useEffect(() => {
    const loadRequirements = async () => {
      try {
        const response = await fetch(`${API_URL}/requirements`);
        const requirementsData = await response.json();
        setRequirements(requirementsData);
      } catch (error) {
        console.error('Failed to load requirements:', error);
      }
    };
    
    loadRequirements();
  }, []);

  const handleCreateModule = async (moduleData) => {
    try {
      const response = await fetch(`${API_URL}/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(moduleData),
      });
      const newModule = await response.json();
      const mappedModule = {
        id: newModule.id,
        name: newModule.name,
        description: newModule.description,
        baseUrl: newModule.base_url,
        language: newModule.language,
        tags: newModule.tags || [],
        createdAt: newModule.created_at,
        testFiles: []
      };
      setModules((prev) => [...prev, mappedModule]);
    } catch (error) {
      console.error('Failed to create module:', error);
    }
  };

  const handleModuleSelect = (module) => {
    setSelectedModule(module);
    setSelectedTestFile(null);
    setCurrentView('moduleDetail');
  };

  const handleBackToModules = () => {
    setSelectedModule(null);
    setSelectedTestFile(null);
    setCurrentView('modules');
  };

  const handleCreateTestFile = async (testFileData) => {
    if (!selectedModule) return;

    try {
      const response = await fetch(`${API_URL}/modules/${selectedModule.id}/test-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testFileData),
      });
      const newTestFile = await response.json();
      const mappedTestFile = {
        id: newTestFile.id,
        name: newTestFile.name,
        content: newTestFile.content,
        requirementId: newTestFile.requirement_id || newTestFile.requirementId,
        requirementTitle: newTestFile.requirement_title,
        createdAt: newTestFile.created_at,
        updatedAt: newTestFile.updated_at
      };

      // Update modules state
      setModules((prev) =>
        prev.map((module) =>
          module.id === selectedModule.id
            ? { ...module, testFiles: [...(module.testFiles || []), mappedTestFile] }
            : module
        )
      );

      // Update selected module with new test file
      setSelectedModule((prev) => ({
        ...prev,
        testFiles: [...(prev.testFiles || []), mappedTestFile],
      }));
    } catch (error) {
      console.error('Failed to create test file:', error);
    }
  };

  const handleTestFileSelect = (testFile) => {
    setSelectedTestFile(testFile);
    setCurrentView('testFile');
  };

  const handleTestFileContentChange = (testFileId, newContent) => {
    if (!selectedModule) return;

    // Update modules state
    setModules((prev) =>
      prev.map((module) =>
        module.id === selectedModule.id
          ? {
              ...module,
              testFiles: module.testFiles.map((file) =>
                file.id === testFileId ? { ...file, content: newContent } : file
              ),
            }
          : module
      )
    );

    // Update selected module state
    setSelectedModule((prev) => ({
      ...prev,
      testFiles: prev.testFiles.map((file) =>
        file.id === testFileId ? { ...file, content: newContent } : file
      ),
    }));

    // Update selected test file state
    setSelectedTestFile((prev) =>
      prev?.id === testFileId ? { ...prev, content: newContent } : prev
    );
  };

  const handleSave = async () => {
    if (selectedTestFile) {
      try {
        await fetch(`${API_URL}/test-files/${selectedTestFile.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: selectedTestFile.content }),
        });
      } catch (error) {
        console.error('Failed to save test file:', error);
      }
    }
  };

  const handleUpdateTestFileRequirement = async (testFileId, requirementId) => {
    try {
      const response = await fetch(`${API_URL}/test-files/${testFileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirementId }),
      });

      if (!response.ok) throw new Error('Failed to update requirement link');

      const updatedTestFile = await response.json();

      // Update the test file in modules state
      setModules(prevModules =>
        prevModules.map(module =>
          module.id === selectedModule?.id
            ? {
                ...module,
                testFiles: module.testFiles.map(file =>
                  file.id === testFileId
                    ? {
                        ...file,
                        requirementId: updatedTestFile.requirement_id,
                        requirementTitle: updatedTestFile.requirement_title
                      }
                    : file
                )
              }
            : module
        )
      );

      // Update selected test file
      setSelectedTestFile(prev => ({
        ...prev,
        requirementId: updatedTestFile.requirement_id,
        requirementTitle: updatedTestFile.requirement_title
      }));

    } catch (error) {
      console.error('Failed to update requirement link:', error);
      alert('Failed to update requirement link');
    }
  };

  const handleDeleteModule = async (moduleId) => {
    if (!confirm('Are you sure you want to delete this module? This will also delete all test files in this module.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/modules/${moduleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete module');

      // Remove module from state
      setModules(prevModules => prevModules.filter(m => m.id !== moduleId));
      
      // Navigate back to modules list
      setSelectedModule(null);
      setSelectedTestFile(null);
      setCurrentView('modules');
    } catch (error) {
      console.error('Failed to delete module:', error);
      alert('Failed to delete module');
    }
  };

  const handleDeleteTestFile = async (testFileId) => {
    if (!confirm('Are you sure you want to delete this test file?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/test-files/${testFileId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete test file');

      // Remove test file from modules state
      setModules(prevModules =>
        prevModules.map(module =>
          module.id === selectedModule?.id
            ? {
                ...module,
                testFiles: module.testFiles.filter(file => file.id !== testFileId)
              }
            : module
        )
      );

      // Update selected module
      setSelectedModule(prev => ({
        ...prev,
        testFiles: prev.testFiles.filter(file => file.id !== testFileId)
      }));

      // Clear selected test file if it was deleted
      if (selectedTestFile?.id === testFileId) {
        setSelectedTestFile(null);
        setCurrentView('moduleDetail');
      }
    } catch (error) {
      console.error('Failed to delete test file:', error);
      alert('Failed to delete test file');
    }
  };

  const handleRun = async () => {
    if (!selectedTestFile || !selectedModule) return;

    setExecutionStatus('running');
    setExecutionResult(null);

    try {
      // Read browser from saved playwright config
      let playwrightBrowser = 'chromium';
      try {
        const pwCfg = localStorage.getItem('playwright_config');
        if (pwCfg) playwrightBrowser = JSON.parse(pwCfg).browser || 'chromium';
      } catch {}

      // Send POST request to backend
      const response = await fetch('http://localhost:3001/run-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: selectedTestFile.content,
          moduleId: selectedModule.id,
          testFileId: selectedTestFile.id,
          browser: playwrightBrowser,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      // Debug logging
      console.log('Test execution response:', {
        success: data.success,
        hasScreenshot: !!data.screenshot,
        screenshotLength: data.screenshot ? data.screenshot.length : 0,
      });

      // Display results based on backend response
      setExecutionStatus('completed');
      setExecutionResult({
        status: data.success ? 'pass' : 'fail',
        message: data.logs || (data.success ? 'Test completed successfully' : 'Test execution failed'),
        screenshot: data.screenshot || null,
      });

      // Refresh executions list
      refreshExecutions();

    } catch (error) {
      // Handle network or server errors
      setExecutionStatus('completed');
      setExecutionResult({
        status: 'fail',
        message: `Error: ${error.message}\n\nMake sure the server is running on http://localhost:3001`,
      });
    }
  };

  const handleDebug = async () => {
    if (!selectedTestFile || !selectedModule) return;

    // Lock UI immediately so the user can't click again while the Inspector is launching
    setDebugActive(true);
    setExecutionStatus('running');
    setExecutionResult(null);

    try {
      let playwrightBrowser = 'chromium';
      try {
        const pwCfg = localStorage.getItem('playwright_config');
        if (pwCfg) playwrightBrowser = JSON.parse(pwCfg).browser || 'chromium';
      } catch {}

      const response = await fetch('http://localhost:3001/run-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: selectedTestFile.content,
          moduleId: selectedModule.id,
          testFileId: selectedTestFile.id,
          browser: playwrightBrowser,
          debug: true,
        }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const data = await response.json();
      // Keep debugActive=true — UI stays locked until user clicks Stop Debug
      setExecutionStatus('completed');
      setExecutionResult({
        status: 'pass',
        message: data.logs || 'Debug session started.',
        screenshot: null,
      });
    } catch (error) {
      setDebugActive(false);
      setExecutionStatus('completed');
      setExecutionResult({
        status: 'fail',
        message: `Error: ${error.message}\n\nMake sure the server is running on http://localhost:3001`,
      });
    }
  };

  const handleStopDebug = async () => {
    try {
      await fetch('http://localhost:3001/stop-debug', { method: 'POST' });
    } catch {}
    setDebugActive(false);
    setExecutionStatus(null);
    setExecutionResult(null);
  };

  const canAccess = (view) => {
    if (!currentUser) return false;
    if (['super_admin', 'admin'].includes(currentUser.role)) return true;
    if (currentUser.role === 'contributor') return view !== 'userManagement';
    if (currentUser.role === 'custom') {
      return Array.isArray(currentUser.permissions) && currentUser.permissions.includes(view);
    }
    return false;
  };

  const handleViewChange = (view) => {
    if (!canAccess(view)) {
      setCurrentView('dashboard');
      setSelectedModule(null);
      setSelectedTestFile(null);
      return;
    }
    if (view === 'dashboard') {
      setCurrentView('dashboard');
      setSelectedModule(null);
      setSelectedTestFile(null);
    } else if (view === 'executions') {
      setCurrentView('executions');
      setSelectedModule(null);
      setSelectedTestFile(null);
    } else if (view === 'modules') {
      setCurrentView('modules');
      setSelectedModule(null);
      setSelectedTestFile(null);
    } else if (view === 'testSuites') {
      setCurrentView('testSuites');
      setSelectedModule(null);
      setSelectedTestFile(null);
    } else if (view === 'features') {
      setCurrentView('features');
      setSelectedModule(null);
      setSelectedTestFile(null);
    } else if (view === 'requirements') {
      setCurrentView('requirements');
      setSelectedModule(null);
      setSelectedTestFile(null);
    } else if (view === 'testcases') {
      setCurrentView('testcases');
      setSelectedModule(null);
      setSelectedTestFile(null);
    } else if (view === 'defects') {
      setCurrentView('defects');
      setSelectedModule(null);
      setSelectedTestFile(null);
    } else if (view === 'sprints') {
      setCurrentView('sprints');
      setSelectedModule(null);
      setSelectedTestFile(null);
    } else if (view === 'reports') {
      setCurrentView('reports');
      setSelectedModule(null);
      setSelectedTestFile(null);
    } else if (view === 'summary') {
      setCurrentView('summary');
      setSelectedModule(null);
      setSelectedTestFile(null);
    } else if (view === 'playwrightConfig') {
      setCurrentView('playwrightConfig');
      setSelectedModule(null);
      setSelectedTestFile(null);
    } else if (view === 'userManagement') {
      setCurrentView('userManagement');
      setSelectedModule(null);
      setSelectedTestFile(null);
    }
  };

  const handleExecutionSelect = (execution) => {
    setSelectedExecution(execution);
    setCurrentView('executionDetail');
  };

  const handleBackFromExecutionDetail = () => {
    setSelectedExecution(null);
    setCurrentView('executions');
  };

  const handleNavigateToSuiteExecution = (suiteExecutionId) => {
    setSelectedSuiteExecutionId(suiteExecutionId);
    setCurrentView('suiteExecutionDetail');
  };

  const handleBackFromSuiteExecutionDetail = () => {
    setSelectedSuiteExecutionId(null);
    setCurrentView('testSuites');
  };

  const refreshExecutions = async () => {
    try {
      const response = await fetch(`${API_URL}/executions`);
      const executionsData = await response.json();
      setExecutions(executionsData);
    } catch (error) {
      console.error('Failed to load executions:', error);
    }
  };

  const handleManageDependencies = (testFile) => {
    setDependenciesTestFile(testFile);
    setDependenciesModalOpen(true);
  };

  const handleCloseDependencies = () => {
    setDependenciesModalOpen(false);
    setDependenciesTestFile(null);
  };

  const handleDependenciesUpdate = () => {
    // Refresh the module view to update dependency indicators
    if (selectedModule) {
      const refreshModule = modules.find(m => m.id === selectedModule.id);
      if (refreshModule) {
        setSelectedModule({...refreshModule});
      }
    }
  };

  return (
    <div className="h-screen" style={{ backgroundColor: 'rgb(var(--bg-primary))', color: 'rgb(var(--text-primary))' }}>
      {/* Auth gate */}
      {!authChecked && (
        <div className="h-screen flex items-center justify-center" style={{ backgroundColor: 'rgb(var(--bg-primary))' }}>
          <svg className="w-8 h-8 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}
      {authChecked && !currentUser && (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
      {authChecked && currentUser && (
        <>
      {/* Top Navbar */}
      <Navbar theme={theme} onToggleTheme={toggleTheme} currentUser={currentUser} onLogout={handleLogout} onNavigate={handleViewChange} />
      
      <div className="flex flex-col h-[calc(100vh-60px)]">
        <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          selectedModule={selectedModule}
          modules={modules}
          selectedTestFile={selectedTestFile}
          onTestFileSelect={handleTestFileSelect}
          onViewChange={handleViewChange}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          currentUser={currentUser}
        />
        
        {/* Main Content Area - with left margin for fixed sidebar */}
        <main className={`flex-1 overflow-auto p-6 transition-all duration-300 ${
          isSidebarCollapsed ? 'ml-[72px]' : 'ml-[280px]'
        }`} style={{ backgroundColor: 'rgb(var(--bg-secondary))' }}>
          <div className="max-w-7xl mx-auto h-full">
            {currentView === 'dashboard' && (
              <Dashboard />
            )}

            {currentView === 'summary' && (
              <Summary />
            )}

            {currentView === 'playwrightConfig' && (
              <PlaywrightConfig />
            )}

            {currentView === 'modules' && (
              <>
                {/* Modules List View */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h1 className="text-2xl font-semibold mb-1">Modules</h1>
                    <p className="text-slate-400 text-sm">
                      Manage your test modules
                    </p>
                  </div>
                  <button
                    onClick={() => setIsModuleModalOpen(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 flex items-center gap-2 font-medium shadow-lg shadow-indigo-600/50"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Module
                  </button>
                </div>

                <ModuleList
                  modules={modules}
                  onModuleSelect={handleModuleSelect}
                  selectedModule={selectedModule}
                />
              </>
            )}

            {currentView === 'moduleDetail' && selectedModule && (
              <>
                {/* Module Detail View */}
                <div className="mb-6">
                  <button
                    onClick={handleBackToModules}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors duration-200 rounded-xl hover:bg-slate-900 px-3 py-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Modules
                  </button>
                </div>
                <ModuleDetailView
                  module={selectedModule}
                  onCreateTestFile={() => setIsTestFileModalOpen(true)}
                  onTestFileClick={handleTestFileSelect}
                  selectedTestFile={selectedTestFile}
                  onManageDependencies={handleManageDependencies}
                  onDeleteModule={handleDeleteModule}
                  onDeleteTestFile={handleDeleteTestFile}
                />
              </>
            )}

            {currentView === 'testFile' && (
              <>
                {/* Test File View */}
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={() => setCurrentView('moduleDetail')}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors duration-200 rounded-xl hover:bg-slate-900 px-3 py-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Module
                  </button>
                </div>
                <TestFileEditor
                  testFile={selectedTestFile}
                  moduleName={selectedModule?.name}
                  onContentChange={handleTestFileContentChange}
                  onSave={handleSave}
                  onRun={handleRun}
                  onDebug={handleDebug}
                  onStopDebug={handleStopDebug}
                  debugActive={debugActive}
                  executionStatus={executionStatus}
                  executionResult={executionResult}
                  requirements={requirements}
                  onUpdateRequirement={handleUpdateTestFileRequirement}
                />
              </>
            )}

            {currentView === 'executions' && (
              <ExecutionsList
                executions={executions}
                onExecutionSelect={handleExecutionSelect}
              />
            )}

            {currentView === 'executionDetail' && (
              <ExecutionDetail
                execution={selectedExecution}
                onBack={handleBackFromExecutionDetail}
              />
            )}

            {currentView === 'testSuites' && (
              <TestSuites 
                modules={modules} 
                onNavigateToSuiteExecution={handleNavigateToSuiteExecution}
              />
            )}

            {currentView === 'suiteExecutionDetail' && (
              <SuiteExecutionDetail
                executionId={selectedSuiteExecutionId}
                onBack={handleBackFromSuiteExecutionDetail}
              />
            )}

            {currentView === 'features' && (
              <Features />
            )}

            {currentView === 'requirements' && (
              <Requirements />
            )}

            {currentView === 'testcases' && (
              <TestCases />
            )}

            {currentView === 'defects' && (
              <Defects />
            )}

            {currentView === 'sprints' && (
              <Sprints />
            )}

            {currentView === 'reports' && (
              <Reports />
            )}

            {currentView === 'userManagement' && ['admin', 'super_admin'].includes(currentUser?.role) && (
              <UserManagement currentUser={currentUser} />
            )}
          </div>
        </main>
        </div>
      </div>

      {/* Create Module Modal */}
      <CreateModuleModal
        isOpen={isModuleModalOpen}
        onClose={() => setIsModuleModalOpen(false)}
        onSubmit={handleCreateModule}
      />

      {/* Create Test File Modal */}
      <CreateTestFileModal
        isOpen={isTestFileModalOpen}
        onClose={() => setIsTestFileModalOpen(false)}
        onSubmit={handleCreateTestFile}
        requirements={requirements}
      />

      {/* Test Dependencies Modal */}
      {dependenciesModalOpen && dependenciesTestFile && (
        <TestDependencies
          testFile={dependenciesTestFile}
          moduleId={selectedModule?.id}
          onClose={handleCloseDependencies}
          onUpdate={handleDependenciesUpdate}
        />
      )}
      </>
      )}
    </div>
  );
}

export default App;
