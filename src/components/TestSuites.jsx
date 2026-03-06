import React, { useState, useEffect, useMemo } from 'react';

import API_URL from '../apiUrl';

function TestSuites({ modules, onNavigateToSuiteExecution }) {
  const [suites, setSuites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [suiteName, setSuiteName] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedTestFiles, setSelectedTestFiles] = useState([]);
  const [availableTestFiles, setAvailableTestFiles] = useState([]);
  const [selectedSuite, setSelectedSuite] = useState(null);
  const [suiteTestFiles, setSuiteTestFiles] = useState([]);
  const [runningDockerSuiteId, setRunningDockerSuiteId] = useState(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [selectedSuiteForHistory, setSelectedSuiteForHistory] = useState(null);
  const [manageFilesModalOpen, setManageFilesModalOpen] = useState(false);
  const [selectedSuiteForManage, setSelectedSuiteForManage] = useState(null);
  const [currentSuiteTestFiles, setCurrentSuiteTestFiles] = useState([]);
  const [availableFilesForManage, setAvailableFilesForManage] = useState([]);
  const [selectedModuleForManage, setSelectedModuleForManage] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Load all test suites
  useEffect(() => {
    loadSuites();
  }, []);

  const loadSuites = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/test-suites`);
      if (!response.ok) throw new Error('Failed to fetch test suites');
      const suitesData = await response.json();
      console.log('Loaded suites:', suitesData);
      setSuites(suitesData);
    } catch (err) {
      console.error('Failed to load test suites:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load test files when a module is selected
  useEffect(() => {
    if (selectedModule) {
      const module = modules.find(m => m.id === parseInt(selectedModule));
      setAvailableTestFiles(module ? module.testFiles : []);
    } else {
      setAvailableTestFiles([]);
    }
  }, [selectedModule, modules]);

  const handleCreateSuite = () => {
    if (modules.length === 0) {
      alert('Please create a module first before creating a test suite');
      return;
    }
    setIsCreateModalOpen(true);
    setSuiteName('');
    setSelectedModule('');
    setSelectedTestFiles([]);
  };

  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    setSuiteName('');
    setSelectedModule('');
    setSelectedTestFiles([]);
  };

  const handleTestFileToggle = (testFileId) => {
    setSelectedTestFiles(prev => {
      if (prev.includes(testFileId)) {
        return prev.filter(id => id !== testFileId);
      } else {
        return [...prev, testFileId];
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!suiteName.trim() || !selectedModule) {
      alert('Please enter a suite name and select a module');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/test-suites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('auth_token') || '' },
        body: JSON.stringify({
          moduleId: parseInt(selectedModule),
          name: suiteName,
          testFileIds: selectedTestFiles
        }),
      });

      if (response.ok) {
        await loadSuites();
        handleCloseModal();
      } else {
        const errorText = await response.text();
        console.error('Server error:', errorText);
        alert(`Failed to create test suite: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error creating test suite:', error);
      alert(`Failed to create test suite: ${error.message}`);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (ms) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getModuleName = (moduleId) => {
    const module = modules.find(m => m.id === moduleId);
    return module ? module.name : 'Unknown Module';
  };

  // Filter and paginate suites
  const filteredAndPaginatedSuites = useMemo(() => {
    let result = [...suites];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(suite => 
        (suite.name && suite.name.toLowerCase().includes(query)) ||
        (getModuleName(suite.module_id).toLowerCase().includes(query))
      );
    }
    
    return result;
  }, [suites, searchQuery, modules]);
  
  // Pagination
  const totalPages = Math.ceil(filteredAndPaginatedSuites.length / itemsPerPage);
  const paginatedSuites = filteredAndPaginatedSuites.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  // Reset to page 1 when search or items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  const handleSuiteClick = async (suite) => {
    console.log('Suite clicked:', suite);
    try {
      const response = await fetch(`${API_URL}/test-suites/${suite.id}/test-files`);
      const testFiles = await response.json();
      console.log('Loaded test files:', testFiles);
      setSuiteTestFiles(testFiles);
      setSelectedSuite(suite);
    } catch (error) {
      console.error('Failed to load suite test files:', error);
    }
  };

  const handleBackToList = () => {
    setSelectedSuite(null);
    setSuiteTestFiles([]);
  };

  const handleRunHeadlessSuite = async (suite, event) => {
    event.stopPropagation();

    if (suite.test_file_count === 0) {
      alert('This suite has no test files to run');
      return;
    }

    setRunningDockerSuiteId(suite.id);

    try {
      let pwWorkersCI = 1;
      let pwFullyParallelCI = false;
      try {
        const pwCfg = localStorage.getItem('playwright_config');
        if (pwCfg) {
          const parsed = JSON.parse(pwCfg);
          pwFullyParallelCI = parsed.executionMode === 'parallel';
          pwWorkersCI = pwFullyParallelCI ? (parsed.workers || 2) : 1;
        }
      } catch {}

      let screenshotModeCI = 'only-on-failure';
      let traceModeCI = 'off';
      let videoModeCI = 'off';
      try {
        const pwCfg = JSON.parse(localStorage.getItem('playwright_config') || '{}');
        screenshotModeCI = pwCfg.screenshotMode || 'only-on-failure';
        traceModeCI = pwCfg.traceMode || 'off';
        videoModeCI = pwCfg.videoMode || 'off';
      } catch {}

      const response = await fetch(`${API_URL}/run-suite/${suite.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('auth_token') || '' },
        body: JSON.stringify({ useDocker: true, workers: pwWorkersCI, fullyParallel: pwFullyParallelCI, screenshotMode: screenshotModeCI, traceMode: traceModeCI, videoMode: videoModeCI }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Headless suite execution result:', result);
        if (result.suite_execution_id && onNavigateToSuiteExecution) {
          onNavigateToSuiteExecution(result.suite_execution_id);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.error || `Failed to run suite headlessly: ${response.status}`);
      }
    } catch (error) {
      console.error('Error running headless suite:', error);
      alert(`Failed to run suite headlessly: ${error.message}`);
    } finally {
      setRunningDockerSuiteId(null);
    }
  };

  const handleViewHistory = async (suite, event) => {
    event.stopPropagation();
    
    try {
      const response = await fetch(`${API_URL}/test-suites/${suite.id}/executions`);
      const history = await response.json();
      setExecutionHistory(history);
      setSelectedSuiteForHistory(suite);
      setHistoryModalOpen(true);
    } catch (error) {
      console.error('Failed to load execution history:', error);
      alert(`Failed to load history: ${error.message}`);
    }
  };

  const handleCloseHistory = () => {
    setHistoryModalOpen(false);
    setExecutionHistory([]);
    setSelectedSuiteForHistory(null);
  };

  const handleManageFiles = async (suite, event) => {
    event.stopPropagation();
    
    try {
      // Load current test files in the suite
      const suiteFilesResponse = await fetch(`${API_URL}/test-suites/${suite.id}/test-files`);
      const suiteFiles = await suiteFilesResponse.json();
      setCurrentSuiteTestFiles(suiteFiles);
      
      // Reset module selection and available files
      setSelectedModuleForManage('');
      setAvailableFilesForManage([]);
      
      setSelectedSuiteForManage(suite);
      setManageFilesModalOpen(true);
    } catch (error) {
      console.error('Failed to load test files:', error);
      alert(`Failed to load test files: ${error.message}`);
    }
  };

  const handleCloseManageFiles = () => {
    setManageFilesModalOpen(false);
    setSelectedSuiteForManage(null);
    setCurrentSuiteTestFiles([]);
    setAvailableFilesForManage([]);
    setSelectedModuleForManage('');
  };

  const handleModuleSelectionForManage = (moduleId) => {
    setSelectedModuleForManage(moduleId);
    if (moduleId) {
      const module = modules.find(m => m.id === parseInt(moduleId));
      setAvailableFilesForManage(module ? module.testFiles || [] : []);
    } else {
      setAvailableFilesForManage([]);
    }
  };

  const handleAddTestFile = async (testFileId) => {
    try {
      const response = await fetch(`${API_URL}/test-suites/${selectedSuiteForManage.id}/test-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('auth_token') || '' },
        body: JSON.stringify({ testFileIds: [testFileId] })
      });

      if (response.ok) {
        // Reload the suite test files
        const suiteFilesResponse = await fetch(`${API_URL}/test-suites/${selectedSuiteForManage.id}/test-files`);
        const suiteFiles = await suiteFilesResponse.json();
        setCurrentSuiteTestFiles(suiteFiles);
        
        // Reload suites to update counts
        await loadSuites();
      } else {
        alert('Failed to add test file');
      }
    } catch (error) {
      console.error('Error adding test file:', error);
      alert(`Failed to add test file: ${error.message}`);
    }
  };

  const handleRemoveTestFile = async (testFileId) => {
    try {
      const response = await fetch(`${API_URL}/test-suites/${selectedSuiteForManage.id}/test-files/${testFileId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Reload the suite test files
        const suiteFilesResponse = await fetch(`${API_URL}/test-suites/${selectedSuiteForManage.id}/test-files`);
        const suiteFiles = await suiteFilesResponse.json();
        setCurrentSuiteTestFiles(suiteFiles);
        
        // Reload suites to update counts
        await loadSuites();
      } else {
        alert('Failed to remove test file');
      }
    } catch (error) {
      console.error('Error removing test file:', error);
      alert(`Failed to remove test file: ${error.message}`);
    }
  };

  const isFileInSuite = (testFileId) => {
    return currentSuiteTestFiles.some(sf => sf.test_file_id === testFileId);
  };

  const handleDeleteSuite = async (suite, e) => {
    e.stopPropagation();
    
    if (!confirm(`Are you sure you want to delete the test suite "${suite.name}"? This will not delete the test files themselves.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/test-suites/${suite.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Reload suites list
        await loadSuites();
        // Close any open modals if the deleted suite was selected
        if (selectedSuiteForManage?.id === suite.id) {
          setManageFilesModalOpen(false);
          setSelectedSuiteForManage(null);
        }
        if (selectedSuiteForHistory?.id === suite.id) {
          setHistoryModalOpen(false);
          setSelectedSuiteForHistory(null);
        }
      } else {
        alert('Failed to delete test suite');
      }
    } catch (error) {
      console.error('Error deleting test suite:', error);
      alert(`Failed to delete test suite: ${error.message}`);
    }
  };

  // If a suite is selected, show detail view
  if (selectedSuite) {
    return (
      <div className="p-6 animate-page-transition">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleBackToList}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors duration-200 rounded-xl hover:bg-slate-800 px-3 py-2 button-scale"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Suites
          </button>
          <h1 className="text-2xl font-semibold text-white">{selectedSuite.name}</h1>
        </div>

        <div className="bg-slate-900 rounded-xl p-6 mb-6 border border-slate-800 shadow-lg">
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <span className="text-slate-400">Module:</span>
              <span className="ml-2 text-white font-medium">{getModuleName(selectedSuite.module_id)}</span>
            </div>
            <div>
              <span className="text-slate-400">Created:</span>
              <span className="ml-2 text-white font-medium">{formatDate(selectedSuite.created_at)}</span>
            </div>
            <div>
              <span className="text-slate-400">Test Files:</span>
              <span className="ml-2 text-white font-medium">{suiteTestFiles.length}</span>
            </div>
          </div>
        </div>

        <h2 className="text-lg font-medium text-white mb-4">Test Files in Suite</h2>
        {suiteTestFiles.length === 0 ? (
          <div className="text-center py-12 bg-slate-900 rounded-xl border border-slate-800 shadow-lg">
            <p className="text-slate-500">No test files in this suite</p>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-lg">
            <table className="w-full">
              <thead className="bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Test File Name
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {suiteTestFiles.map((testFile) => (
                  <tr key={testFile.id} className="hover:bg-slate-800/50 transition-colors duration-200">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">📄</span>
                        <span className="text-sm text-white">{testFile.test_file_name}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 animate-page-transition">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-white">Test Suites</h1>
        <button
          onClick={handleCreateSuite}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 flex items-center gap-2 font-medium shadow-lg shadow-indigo-600/50 button-scale"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Suite
        </button>
      </div>

      {/* Search Bar */}
      {suites.length > 0 && (
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by suite name or module..."
              className="w-full px-4 py-2 pl-10 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <svg className="absolute left-3 top-2.5 h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      )}

      {/* Suites List */}
      {loading ? (
        /* Loading State */
        <div className="bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-800">
          <table className="w-full">
            <thead className="bg-slate-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Suite Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Test Files</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4"><div className="h-4 bg-slate-800 rounded w-32"></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-slate-800 rounded w-16"></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-slate-800 rounded w-28"></div></td>
                  <td className="px-6 py-4"><div className="h-8 bg-slate-800 rounded w-20"></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : error ? (
        /* Error State */
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 max-w-md w-full text-center">
            <svg className="mx-auto h-16 w-16 text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-xl font-semibold text-red-400 mb-2">Failed to Load Test Suites</h3>
            <p className="text-slate-400 mb-6">{error}</p>
            <button
              onClick={loadSuites}
              className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors flex items-center gap-2 mx-auto button-scale"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry
            </button>
          </div>
        </div>
      ) : suites.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="text-center max-w-md">
            <div className="mb-6">
              <svg className="mx-auto h-24 w-24 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-slate-300 mb-3">No Test Suites Yet</h3>
            <p className="text-slate-500 mb-6">Create your first test suite to group and run multiple test files together.</p>
            <button
              onClick={handleCreateSuite}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors inline-flex items-center gap-2 button-scale"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Suite
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-800">
          <table className="w-full">
            <thead className="bg-slate-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Suite Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Test Files
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {paginatedSuites.map((suite) => (
                <tr 
                  key={suite.id} 
                  onClick={() => handleSuiteClick(suite)}
                  className="hover:bg-slate-800/50 transition-colors duration-200 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">{suite.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-400">
                      {suite.test_file_count} {suite.test_file_count === 1 ? 'file' : 'files'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-400">{formatDate(suite.created_at)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleRunHeadlessSuite(suite, e)}
                        disabled={runningDockerSuiteId === suite.id}
                        title="Run headlessly (CI mode) — no browser window, like Azure DevOps / GitHub Actions"
                        className="px-3 py-1 bg-cyan-600 text-white text-sm rounded-xl hover:bg-cyan-700 transition-all duration-200 disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-cyan-600/40 disabled:shadow-none"
                      >
                        {runningDockerSuiteId === suite.id ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            CI Run...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                            CI Run
                          </>
                        )}
                      </button>
                      <button
                        onClick={(e) => handleViewHistory(suite, e)}
                        className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 transition-all duration-200 flex items-center gap-2 shadow-lg shadow-indigo-600/50"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        History
                      </button>
                      <button
                        onClick={(e) => handleManageFiles(suite, e)}
                        className="px-3 py-1 bg-slate-700 text-white text-sm rounded-xl hover:bg-slate-600 transition-all duration-200 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Manage Files
                      </button>
                      <button
                        onClick={(e) => handleDeleteSuite(suite, e)}
                        className="px-3 py-1 bg-red-600/20 text-red-400 border border-red-600/30 text-sm rounded-xl hover:bg-red-600/30 transition-all duration-200 flex items-center gap-2"
                        title="Delete test suite"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
          {filteredAndPaginatedSuites.length > 0 && (
            <div className="bg-slate-950 border-t border-slate-800 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-400">
                  Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredAndPaginatedSuites.length)} to {Math.min(currentPage * itemsPerPage, filteredAndPaginatedSuites.length)} of {filteredAndPaginatedSuites.length} results
                </span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 bg-slate-800 text-white text-sm rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 text-sm rounded-xl transition-colors ${
                          currentPage === pageNum
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 bg-slate-800 text-white text-sm rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Suite Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-800 shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-4">Create Test Suite</h2>
            
            <form onSubmit={handleSubmit}>
              {/* Suite Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Suite Name *
                </label>
                <input
                  type="text"
                  value={suiteName}
                  onChange={(e) => setSuiteName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter suite name"
                  required
                />
              </div>

              {/* Module Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Module *
                </label>
                <select
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                >
                  <option value="">Select a module</option>
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Test Files Selection */}
              {selectedModule && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Select Test Files
                  </label>
                  {availableTestFiles.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">No test files available for this module</p>
                  ) : (
                    <div className="bg-slate-800 rounded-xl p-4 max-h-64 overflow-y-auto border border-slate-700">
                      {availableTestFiles.map((testFile) => (
                        <label
                          key={testFile.id}
                          className="flex items-center gap-3 py-2 px-3 hover:bg-slate-700 rounded-xl cursor-pointer transition-colors duration-200"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTestFiles.includes(testFile.id)}
                            onChange={() => handleTestFileToggle(testFile.id)}
                            className="w-4 h-4 text-indigo-600 bg-slate-700 border-slate-600 rounded focus:ring-indigo-500"
                          />
                          <span className="text-sm text-slate-300">{testFile.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedTestFiles.length} file(s) selected
                  </p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 shadow-lg shadow-indigo-600/50"
                >
                  Create Suite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Execution History Modal */}
      {historyModalOpen && selectedSuiteForHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto border border-slate-800 shadow-lg">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white">Execution History</h2>
                <p className="text-sm text-slate-400 mt-1">{selectedSuiteForHistory.name}</p>
              </div>
              <button
                onClick={handleCloseHistory}
                className="text-slate-400 hover:text-white transition-colors duration-200 hover:bg-slate-800 rounded-xl p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {executionHistory.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500">No execution history available</p>
              </div>
            ) : (
              <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-lg">
                <table className="w-full">
                  <thead className="bg-slate-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Total Tests
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Passed
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Failed
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Executed At
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {executionHistory.map((execution) => (
                      <tr key={execution.id} className="hover:bg-slate-800/50 transition-colors duration-200">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-xl text-xs font-medium ${
                            execution.status === 'PASS' 
                              ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
                              : 'bg-red-500/10 text-red-400 border border-red-500/30'
                          }`}>
                            {execution.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          {execution.total_tests}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-400">
                          {execution.passed}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-400">
                          {execution.failed}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                          {formatDuration(execution.duration_ms)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                          {formatDate(execution.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => {
                              handleCloseHistory();
                              onNavigateToSuiteExecution(execution.id);
                            }}
                            className="p-2 rounded-lg transition-colors duration-200 hover:bg-blue-500/10 text-blue-400"
                            title="View execution details"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={handleCloseHistory}
                className="px-4 py-2 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Test Files Modal */}
      {manageFilesModalOpen && selectedSuiteForManage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-800 shadow-lg">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white">Manage Test Files</h2>
                <p className="text-sm text-slate-400 mt-1">{selectedSuiteForManage.name}</p>
              </div>
              <button
                onClick={handleCloseManageFiles}
                className="text-slate-400 hover:text-white transition-colors duration-200 hover:bg-slate-800 rounded-xl p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Module Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-white mb-2">
                Select Module to Add Files From
              </label>
              <select
                value={selectedModuleForManage}
                onChange={(e) => handleModuleSelectionForManage(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">-- Select a module --</option>
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Available Test Files */}
              <div>
                <h3 className="text-sm font-medium text-white mb-3">Available Test Files</h3>
                {!selectedModuleForManage ? (
                  <div className="text-center py-8 bg-slate-800 rounded-xl border border-slate-700">
                    <p className="text-slate-500 text-sm">Select a module to view test files</p>
                  </div>
                ) : availableFilesForManage.length === 0 ? (
                  <div className="text-center py-8 bg-slate-800 rounded-xl border border-slate-700">
                    <p className="text-slate-500 text-sm">No test files in module</p>
                  </div>
                ) : (
                  <div className="bg-slate-800 rounded-xl border border-slate-700 max-h-96 overflow-y-auto">
                    {availableFilesForManage.map((testFile) => {
                      const inSuite = isFileInSuite(testFile.id);
                      return (
                        <div
                          key={testFile.id}
                          className="flex items-center justify-between p-3 border-b border-slate-700 last:border-b-0 hover:bg-slate-700/50 transition-colors duration-200"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-slate-400">📄</span>
                            <span className="text-sm text-white truncate">{testFile.name}</span>
                            {inSuite && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-xl text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/30">
                                In Suite
                              </span>
                            )}
                          </div>
                          {!inSuite && (
                            <button
                              onClick={() => handleAddTestFile(testFile.id)}
                              className="ml-2 px-3 py-1 bg-indigo-600 text-white text-xs rounded-xl hover:bg-indigo-700 transition-all duration-200 flex items-center gap-1 shadow-lg shadow-indigo-600/50"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Add
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Current Suite Test Files */}
              <div>
                <h3 className="text-sm font-medium text-white mb-3">Files in Suite ({currentSuiteTestFiles.length})</h3>
                {currentSuiteTestFiles.length === 0 ? (
                  <div className="text-center py-8 bg-slate-800 rounded-xl border border-slate-700">
                    <p className="text-slate-500 text-sm">No test files in suite</p>
                    <p className="text-slate-600 text-xs mt-1">Add files from the left panel</p>
                  </div>
                ) : (
                  <div className="bg-slate-800 rounded-xl border border-slate-700 max-h-96 overflow-y-auto">
                    {currentSuiteTestFiles.map((suiteFile) => (
                      <div
                        key={suiteFile.id}
                        className="flex items-center justify-between p-3 border-b border-slate-700 last:border-b-0 hover:bg-slate-700/50 transition-colors duration-200"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-slate-400">📄</span>
                          <span className="text-sm text-white truncate">{suiteFile.test_file_name}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveTestFile(suiteFile.test_file_id)}
                          className="ml-2 px-3 py-1 bg-red-600 text-white text-xs rounded-xl hover:bg-red-700 transition-all duration-200 flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={handleCloseManageFiles}
                className="px-4 py-2 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors duration-200"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TestSuites;
