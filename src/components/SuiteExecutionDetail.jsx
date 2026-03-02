import React, { useState, useEffect, useMemo, useRef } from 'react';

const API_URL = 'http://localhost:3001';

function SuiteExecutionDetail({ executionId, onBack }) {
  const [execution, setExecution] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('results'); // 'results', 'logs', 'metrics'
  
  // Expandable rows state
  const [expandedRows, setExpandedRows] = useState(new Set());
  
  // Pagination state (for Results tab)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sort state
  const [sortColumn, setSortColumn] = useState('testName');
  const [sortDirection, setSortDirection] = useState('asc')

  // Real-time CI log streaming
  const [liveLog, setLiveLog] = useState([]);
  const liveLogEndRef = useRef(null);
  const eventSourceRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    loadExecutionDetails();
  }, [executionId]);

  // SSE live log connection + status polling while execution is running
  useEffect(() => {
    if (!execution) return;
    if (execution.status !== 'running') return;

    // Auto-switch to Logs tab so the live output is visible immediately
    setActiveTab('logs');
    setLiveLog([]);

    // Open SSE stream
    const es = new EventSource(`${API_URL}/suite-executions/${executionId}/logs/stream`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const line = JSON.parse(e.data);
        setLiveLog(prev => [...prev, line]);
      } catch {}
    };

    es.addEventListener('done', () => {
      es.close();
      eventSourceRef.current = null;
      clearInterval(pollRef.current);
      loadExecutionDetails();
    });

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
    };

    // Poll every 4 s as a safety net (catches the 'done' state if SSE drops)
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${API_URL}/suite-executions/${executionId}`);
        const data = await r.json();
        if (data.status !== 'running') {
          clearInterval(pollRef.current);
          if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
          loadExecutionDetails();
        }
      } catch {}
    }, 4000);

    return () => {
      if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
      clearInterval(pollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execution?.status, executionId]);

  // Auto-scroll live log terminal to the bottom whenever new lines arrive
  useEffect(() => {
    if (liveLogEndRef.current) {
      liveLogEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveLog]);

  const loadExecutionDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load suite execution
      const execResponse = await fetch(`${API_URL}/suite-executions/${executionId}`);
      if (!execResponse.ok) throw new Error('Failed to fetch execution details');
      const execData = await execResponse.json();
      setExecution(execData);

      // Load test results
      const resultsResponse = await fetch(`${API_URL}/suite-executions/${executionId}/results`);
      if (!resultsResponse.ok) throw new Error('Failed to fetch test results');
      const resultsData = await resultsResponse.json();
      setTestResults(resultsData);
    } catch (err) {
      console.error('Failed to load execution details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
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
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const toggleRowExpansion = (resultId) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resultId)) {
        newSet.delete(resultId);
      } else {
        newSet.add(resultId);
      }
      return newSet;
    });
  };

  const handleDownloadLogs = () => {
    const logs = testResults.map(result => {
      return `[${result.status}] ${result.test_file_name}\n` +
             `Duration: ${formatDuration(result.duration_ms)}\n` +
             (result.error_message ? `Error: ${result.error_message}\n` : '') +
             (result.logs ? `Logs:\n${result.logs}\n` : '') +
             '\n' + '='.repeat(80) + '\n\n';
    }).join('');
    
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `suite-execution-${executionId}-logs.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenReport = () => {
    const reportUrl = `http://localhost:3001/suite-execution/${executionId}/report`;
    window.open(reportUrl, '_blank');
  };

  // Calculate summary metrics
  const metrics = useMemo(() => {
    if (!execution || !testResults.length) return null;
    
    const totalTests = testResults.length;
    const passed = testResults.filter(t => t.status === 'PASS').length;
    const failed = testResults.filter(t => t.status === 'FAIL').length;
    const successRate = totalTests > 0 ? Math.round((passed / totalTests) * 100) : 0;
    const totalDuration = testResults.reduce((sum, t) => sum + (t.duration_ms || 0), 0);
    const avgDuration = totalTests > 0 ? Math.round(totalDuration / totalTests) : 0;
    
    return {
      totalTests,
      passed,
      failed,
      successRate,
      totalDuration,
      avgDuration
    };
  }, [execution, testResults]);

  // Filter and sort test results
  const filteredAndSortedResults = useMemo(() => {
    let result = [...testResults];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(test => 
        (test.test_file_name && test.test_file_name.toLowerCase().includes(query)) ||
        (test.error_message && test.error_message.toLowerCase().includes(query))
      );
    }
    
    // Apply sorting
    result.sort((a, b) => {
      if (sortColumn === 'testName') {
        const nameA = (a.test_file_name || '').toLowerCase();
        const nameB = (b.test_file_name || '').toLowerCase();
        return sortDirection === 'asc' 
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      } else if (sortColumn === 'status') {
        const statusOrder = { 'RUNNING': 0, 'FAIL': 1, 'SKIPPED': 2, 'PASS': 3 };
        const statusA = statusOrder[a.status] || 4;
        const statusB = statusOrder[b.status] || 4;
        return sortDirection === 'asc' ? statusA - statusB : statusB - statusA;
      } else if (sortColumn === 'duration') {
        const durA = a.duration_ms || 0;
        const durB = b.duration_ms || 0;
        return sortDirection === 'asc' ? durA - durB : durB - durA;
      }
      return 0;
    });
    
    return result;
  }, [testResults, searchQuery, sortColumn, sortDirection]);
  
  // Pagination
  const totalPages = Math.ceil(filteredAndSortedResults.length / itemsPerPage);
  const paginatedResults = filteredAndSortedResults.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  // Reset to page 1 when search or items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);
  
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto animate-page-transition">
        <div className="animate-pulse space-y-6">
          {/* Header Skeleton */}
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-slate-800 rounded-lg"></div>
            <div className="h-8 bg-slate-800 rounded w-64"></div>
          </div>
          
          {/* Summary Cards Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="h-4 bg-slate-800 rounded w-16 mb-2"></div>
                <div className="h-8 bg-slate-800 rounded w-12"></div>
              </div>
            ))}
          </div>
          
          {/* Content Skeleton */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl h-96"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto animate-page-transition">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors duration-200 rounded-xl hover:bg-slate-900 px-3 py-2 button-scale"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 max-w-md w-full text-center">
            <svg className="mx-auto h-16 w-16 text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-xl font-semibold text-red-400 mb-2">Failed to Load Execution Details</h3>
            <p className="text-slate-400 mb-6">{error}</p>
            <button
              onClick={loadExecutionDetails}
              className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors flex items-center gap-2 mx-auto button-scale"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto animate-page-transition">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors duration-200 rounded-xl hover:bg-slate-900 px-3 py-2 button-scale"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <svg className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg">Execution not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto animate-page-transition">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors duration-200 rounded-xl hover:bg-slate-800 px-3 py-2 button-scale"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Suites
          </button>
          <h1 className="text-2xl font-semibold text-white">Suite Execution Details</h1>
        </div>
        {execution?.report_path && (
          <button
            onClick={handleOpenReport}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-all duration-200 flex items-center gap-2 shadow-lg shadow-indigo-600/50 button-scale"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Open Playwright Report
          </button>
        )}
      </div>

      {/* Summary Panel */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-6">
        {/* Large Status Badge */}
        <div className="md:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center shadow-lg card-hover">
          <div className="text-xs text-slate-400 mb-3 uppercase tracking-wider">Status</div>
          <span className={`inline-flex items-center px-6 py-3 rounded-xl text-2xl font-bold shadow-lg ${
            execution.status === 'PASS' 
              ? 'bg-green-500/10 text-green-400 border-2 border-green-500/30' 
              : 'bg-red-500/10 text-red-400 border-2 border-red-500/30'
          }`}>
            {execution.status}
          </span>
        </div>

        {/* Total Tests */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg card-hover">
          <div className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Total Tests</div>
          <div className="text-3xl font-bold text-white">{metrics?.totalTests || 0}</div>
        </div>

        {/* Passed */}
        <div className="bg-slate-900 border border-green-500/20 rounded-xl p-6 shadow-lg shadow-green-500/5 card-hover">
          <div className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Passed</div>
          <div className="text-3xl font-bold text-green-400">{metrics?.passed || 0}</div>
        </div>

        {/* Failed */}
        <div className="bg-slate-900 border border-red-500/20 rounded-xl p-6 shadow-lg shadow-red-500/5 card-hover">
          <div className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Failed</div>
          <div className="text-3xl font-bold text-red-400">{metrics?.failed || 0}</div>
        </div>

        {/* Success Rate */}
        <div className="bg-slate-900 border border-indigo-600/20 rounded-xl p-6 shadow-lg shadow-indigo-600/5 card-hover">
          <div className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Success Rate</div>
          <div className="text-3xl font-bold text-indigo-400">{metrics?.successRate || 0}%</div>
        </div>

        {/* Total Duration */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg card-hover">
          <div className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Total Duration</div>
          <div className="text-3xl font-bold text-white">{formatDuration(metrics?.totalDuration || 0)}</div>
        </div>

        {/* Avg Duration */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg card-hover">
          <div className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Avg Duration</div>
          <div className="text-3xl font-bold text-white">{formatDuration(metrics?.avgDuration || 0)}</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg mb-6">
        <div className="border-b border-slate-800">
          <div className="flex">
            <button
              onClick={() => setActiveTab('results')}
              className={`px-6 py-4 text-sm font-medium transition-all duration-200 border-b-2 ${
                activeTab === 'results'
                  ? 'border-indigo-600 text-white'
                  : 'border-transparent text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Results ({testResults.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-6 py-4 text-sm font-medium transition-all duration-200 border-b-2 ${
                activeTab === 'logs'
                  ? 'border-indigo-600 text-white'
                  : 'border-transparent text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Logs
              </div>
            </button>
            <button
              onClick={() => setActiveTab('metrics')}
              className={`px-6 py-4 text-sm font-medium transition-all duration-200 border-b-2 ${
                activeTab === 'metrics'
                  ? 'border-indigo-600 text-white'
                  : 'border-transparent text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Metrics
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Results Tab */}
          {activeTab === 'results' && (
            <div>
              {/* Search Bar */}
              <div className="mb-4">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by test name or error message..."
                    className="w-full px-4 py-2 pl-10 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <svg className="absolute left-3 top-2.5 h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {paginatedResults.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="font-medium">No test results found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedResults.map((result) => (
                    <div key={result.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden transition-all duration-200 hover:border-slate-600">
                      {/* Row Header */}
                      <div 
                        onClick={() => toggleRowExpansion(result.id)}
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-750"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          {/* Expand Icon */}
                          <svg 
                            className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${expandedRows.has(result.id) ? 'rotate-90' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>

                          {/* Status Badge */}
                          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-medium ${
                            result.status === 'PASS' 
                              ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
                              : result.status === 'FAIL'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                              : result.status === 'SKIPPED'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'bg-slate-500/10 text-slate-400 border border-slate-500/30'
                          }`}>
                            {result.status === 'PASS' && (
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                            {result.status === 'FAIL' && (
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                            )}
                            {result.status}
                          </span>

                          {/* Test Name */}
                          <div className="flex-1">
                            <div className="text-sm font-medium text-white">{result.test_file_name || 'Unknown Test'}</div>
                            {result.error_message && !expandedRows.has(result.id) && (
                              <div className="text-xs text-red-400 truncate mt-1 max-w-xl">{result.error_message}</div>
                            )}
                          </div>

                          {/* Duration */}
                          <div className="text-sm text-slate-400 tabular-nums">
                            {formatDuration(result.duration_ms)}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {expandedRows.has(result.id) && (
                        <div className="border-t border-slate-700 bg-slate-850 p-6 animate-fadeIn">
                          <div className="space-y-4">
                            {/* Error Message */}
                            {result.error_message && (
                              <div>
                                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Error Message</h4>
                                <div className="bg-red-950/50 border border-red-900/50 rounded-xl p-4">
                                  <pre className="text-sm text-red-300 whitespace-pre-wrap font-mono">{result.error_message}</pre>
                                </div>
                              </div>
                            )}

                            {/* Logs hint */}
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <svg className="w-3.5 h-3.5 flex-shrink-0 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                              </svg>
                              For full execution output, see the{' '}
                              <button
                                onClick={() => setActiveTab('logs')}
                                className="text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-2 transition-colors"
                              >
                                Logs tab
                              </button>
                            </div>

                            {/* Screenshot */}
                            {result.screenshot_base64 && (
                              <div>
                                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Screenshot</h4>
                                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                                  <img
                                    src={`data:image/png;base64,${result.screenshot_base64}`}
                                    alt="Test screenshot"
                                    className="max-w-full h-auto rounded-lg"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination Controls */}
              {filteredAndSortedResults.length > 0 && (
                <div className="bg-slate-800 border-t border-slate-700 rounded-xl mt-4 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-400">
                      Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredAndSortedResults.length)} to {Math.min(currentPage * itemsPerPage, filteredAndSortedResults.length)} of {filteredAndSortedResults.length} results
                    </span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => setItemsPerPage(Number(e.target.value))}
                      className="px-3 py-1 bg-slate-700 border border-slate-600 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                      className="px-3 py-1 bg-slate-700 text-white text-sm rounded-xl hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
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
                      className="px-3 py-1 bg-slate-700 text-white text-sm rounded-xl hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div>
              {/* Sticky Header */}
              <div className="sticky top-0 bg-slate-900 border-b border-slate-700 pb-4 mb-4 flex items-center justify-between z-10">
                <h3 className="text-lg font-medium text-white">Execution Logs</h3>
                <button
                  onClick={handleDownloadLogs}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Logs
                </button>
              </div>

              {/* Terminal-style Logs */}
              {liveLog.length > 0 ? (
                /* ── Live / completed terminal (always shown when logs were streamed) ── */
                <div className={`bg-slate-950 border rounded-xl overflow-hidden ${
                  execution?.status === 'running' ? 'border-indigo-500/40' : 'border-slate-700'
                }`}>
                  <div className={`bg-slate-900 border-b px-4 py-2 flex items-center gap-3 ${
                    execution?.status === 'running' ? 'border-indigo-500/30' : 'border-slate-800'
                  }`}>
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <span className="text-xs text-slate-500 font-mono ml-1">ci-output</span>
                    <div className="flex items-center gap-1.5 ml-auto">
                      {execution?.status === 'running' ? (
                        <>
                          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></div>
                          <span className="text-xs text-indigo-400 font-mono tracking-wide">RUNNING</span>
                        </>
                      ) : (
                        <>
                          <div className={`w-2 h-2 rounded-full ${execution?.status === 'PASS' ? 'bg-green-400' : 'bg-red-400'}`}></div>
                          <span className={`text-xs font-mono tracking-wide ${execution?.status === 'PASS' ? 'text-green-400' : 'text-red-400'}`}>
                            {execution?.status === 'PASS' ? 'PASSED' : 'FAILED'}
                          </span>
                        </>
                      )}
                      <span className="text-xs text-slate-600 font-mono ml-2">{liveLog.length} lines</span>
                    </div>
                  </div>
                  <div className="p-5 font-mono text-xs leading-relaxed max-h-[600px] overflow-y-auto">
                    {liveLog.map((line, i) => (
                      <div key={i} className={`whitespace-pre-wrap ${
                        line.startsWith('✗') || /\bfailed\b/i.test(line) ? 'text-red-400' :
                        line.startsWith('✓') || /\bpassed\b/i.test(line) ? 'text-green-400' :
                        line.startsWith('▶') || line.startsWith('⚙') ? 'text-indigo-400' :
                        line.startsWith('🏁') || line.startsWith('📊') ? 'text-amber-400' :
                        'text-slate-400'
                      }`}>{line}</div>
                    ))}
                    <div ref={liveLogEndRef} />
                  </div>
                </div>
              ) : (
                /* ── Static logs — old run viewed from history, no live stream available ── */
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center gap-2">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <span className="text-xs text-slate-500 font-mono ml-2">test-execution-logs</span>
                  </div>
                  <div className="p-6 font-mono text-sm max-h-[600px] overflow-y-auto">
                    {testResults.length === 0 ? (
                      <div className="text-slate-500">No logs available</div>
                    ) : (
                      testResults.map((result, idx) => (
                        <div key={result.id} className="mb-6 last:mb-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              result.status === 'PASS' ? 'bg-green-500/20 text-green-400' :
                              result.status === 'FAIL' ? 'bg-red-500/20 text-red-400' :
                              'bg-amber-500/20 text-amber-400'
                            }`}>
                              {result.status}
                            </span>
                            <span className="text-slate-300">{result.test_file_name || 'Unknown Test'}</span>
                            <span className="text-slate-500 text-xs">({formatDuration(result.duration_ms)})</span>
                          </div>
                          {result.error_message && (
                            <div className="text-red-400 mb-2 pl-4 border-l-2 border-red-500/50">
                              {result.error_message}
                            </div>
                          )}
                          {result.logs && (
                            <div className="text-slate-400 pl-4 whitespace-pre-wrap text-xs">
                              {result.logs}
                            </div>
                          )}
                          {idx < testResults.length - 1 && (
                            <div className="border-t border-slate-800 mt-4"></div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Metrics Tab */}
          {activeTab === 'metrics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pass/Fail Distribution */}
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-medium text-white mb-6">Test Results Distribution</h3>
                  <div className="flex items-center justify-center">
                    <svg width="200" height="200" viewBox="0 0 200 200" className="transform -rotate-90">
                      {/* Background Circle */}
                      <circle cx="100" cy="100" r="80" fill="none" stroke="#1e293b" strokeWidth="40" />
                      {/* Pass Arc */}
                      <circle 
                        cx="100" 
                        cy="100" 
                        r="80" 
                        fill="none" 
                        stroke="#22c55e" 
                        strokeWidth="40"
                        strokeDasharray={`${(metrics?.passed / metrics?.totalTests * 502.4) || 0} 502.4`}
                        className="transition-all duration-500"
                      />
                      {/* Fail Arc */}
                      <circle 
                        cx="100" 
                        cy="100" 
                        r="80" 
                        fill="none" 
                        stroke="#ef4444" 
                        strokeWidth="40"
                        strokeDasharray={`${(metrics?.failed / metrics?.totalTests * 502.4) || 0} 502.4`}
                        strokeDashoffset={`-${(metrics?.passed / metrics?.totalTests * 502.4) || 0}`}
                        className="transition-all duration-500"
                      />
                    </svg>
                  </div>
                  <div className="mt-6 flex justify-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm text-slate-300">Pass: {metrics?.passed || 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-sm text-slate-300">Fail: {metrics?.failed || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Duration Distribution */}
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-medium text-white mb-6">Duration Distribution</h3>
                  <div className="space-y-3">
                    {testResults.slice(0, 6).map((result, idx) => {
                      const maxDuration = Math.max(...testResults.map(r => r.duration_ms || 0));
                      const percentage = maxDuration > 0 ? ((result.duration_ms || 0) / maxDuration) * 100 : 0;
                      
                      return (
                        <div key={result.id}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-400 truncate max-w-[200px]">
                              {result.test_file_name || `Test ${idx + 1}`}
                            </span>
                            <span className="text-xs text-slate-500 tabular-nums">
                              {formatDuration(result.duration_ms)}
                            </span>
                          </div>
                          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                result.status === 'PASS' ? 'bg-green-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {testResults.length > 6 && (
                    <p className="text-xs text-slate-500 mt-4 text-center">
                      Showing top 6 tests by duration
                    </p>
                  )}
                </div>
              </div>

              {/* Additional Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <div className="text-xs text-slate-400 mb-1">Fastest Test</div>
                  <div className="text-lg font-semibold text-green-400">
                    {formatDuration(Math.min(...testResults.map(r => r.duration_ms || Infinity)))}
                  </div>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <div className="text-xs text-slate-400 mb-1">Slowest Test</div>
                  <div className="text-lg font-semibold text-red-400">
                    {formatDuration(Math.max(...testResults.map(r => r.duration_ms || 0)))}
                  </div>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <div className="text-xs text-slate-400 mb-1">Median Duration</div>
                  <div className="text-lg font-semibold text-indigo-400">
                    {(() => {
                      const sorted = [...testResults].sort((a, b) => (a.duration_ms || 0) - (b.duration_ms || 0));
                      const mid = Math.floor(sorted.length / 2);
                      return formatDuration(sorted[mid]?.duration_ms || 0);
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SuiteExecutionDetail;
