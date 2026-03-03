import React, { useState, useEffect, useMemo } from 'react';
import API_URL from '../apiUrl';

function ExecutionsList({ executions, onExecutionSelect }) {
  const [stats, setStats] = useState({ total: 0, passed: 0, failed: 0, passPercentage: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sort state
  const [sortColumn, setSortColumn] = useState('date'); // 'date' or 'status'
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${API_URL}/executions/stats`);
        if (!response.ok) throw new Error('Failed to fetch stats');
        const statsData = await response.json();
        setStats(statsData);
      } catch (err) {
        console.error('Failed to load execution stats:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [executions]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatDuration = (ms) => {
    if (!ms) return 'N/A';
    return `${ms}ms`;
  };

  // Filter and sort executions
  const filteredAndSortedExecutions = useMemo(() => {
    let result = [...executions];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(exec => 
        (exec.moduleName && exec.moduleName.toLowerCase().includes(query)) ||
        (exec.module_name && exec.module_name.toLowerCase().includes(query)) ||
        (exec.testFileName && exec.testFileName.toLowerCase().includes(query)) ||
        (exec.test_file_name && exec.test_file_name.toLowerCase().includes(query))
      );
    }
    
    // Apply sorting
    result.sort((a, b) => {
      if (sortColumn === 'date') {
        const dateA = new Date(a.executedAt || a.created_at);
        const dateB = new Date(b.executedAt || b.created_at);
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      } else if (sortColumn === 'status') {
        const statusOrder = { 'RUNNING': 0, 'FAIL': 1, 'PASS': 2 };
        const statusA = statusOrder[a.status] || 3;
        const statusB = statusOrder[b.status] || 3;
        return sortDirection === 'asc' ? statusA - statusB : statusB - statusA;
      }
      return 0;
    });
    
    return result;
  }, [executions, searchQuery, sortColumn, sortDirection]);
  
  // Pagination
  const totalPages = Math.ceil(filteredAndSortedExecutions.length / itemsPerPage);
  const paginatedExecutions = filteredAndSortedExecutions.slice(
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
      setSortDirection('desc');
    }
  };

  return (
    <div className="p-6 animate-page-transition">
      <h1 className="text-2xl font-semibold text-white mb-6">Executions</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg card-hover">
          <div className="text-sm text-slate-400 mb-2">Total Runs</div>
          <div className="text-3xl font-bold text-white">{stats.total}</div>
        </div>
        
        <div className="bg-slate-900 border border-green-500/20 rounded-xl p-6 shadow-lg shadow-green-500/10 card-hover">
          <div className="text-sm text-slate-400 mb-2">Passed</div>
          <div className="text-3xl font-bold text-green-500">{stats.passed}</div>
        </div>
        
        <div className="bg-slate-900 border border-red-500/20 rounded-xl p-6 shadow-lg shadow-red-500/10 card-hover">
          <div className="text-sm text-slate-400 mb-2">Failed</div>
          <div className="text-3xl font-bold text-red-500">{stats.failed}</div>
        </div>
        
        <div className="bg-slate-900 border border-indigo-600/20 rounded-xl p-6 shadow-lg shadow-indigo-600/10 card-hover">
          <div className="text-sm text-slate-400 mb-2">Pass Rate</div>
          <div className="text-3xl font-bold text-indigo-500">{stats.passPercentage}%</div>
        </div>
      </div>
      
      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by module name or test file name..."
            className="w-full px-4 py-2 pl-10 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <svg className="absolute left-3 top-2.5 h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
      
      {/* Loading State */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <table className="w-full">
            <thead className="bg-slate-950 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Module</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Test File</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4"><div className="h-4 bg-slate-800 rounded w-24"></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-slate-800 rounded w-32"></div></td>
                  <td className="px-6 py-4"><div className="h-6 bg-slate-800 rounded w-16"></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-slate-800 rounded w-36"></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-slate-800 rounded w-16"></div></td>
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
            <h3 className="text-xl font-semibold text-red-400 mb-2">Failed to Load Executions</h3>
            <p className="text-slate-400 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors flex items-center gap-2 mx-auto button-scale"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry
            </button>
          </div>
        </div>
      ) : executions.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="text-center max-w-md">
            <div className="mb-6">
              <svg className="mx-auto h-24 w-24 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-slate-300 mb-3">No Test Executions Yet</h3>
            <p className="text-slate-500 mb-6">Get started by running your first test. Test results will appear here once you execute them.</p>
            <button
              onClick={() => window.location.href = '#'}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors inline-flex items-center gap-2 button-scale"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run Your First Test
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <table className="w-full">
            <thead className="bg-slate-950 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  <button 
                    onClick={() => handleSort('status')}
                    className="flex items-center gap-2 hover:text-white transition-colors"
                  >
                    Status
                    {sortColumn === 'status' && (
                      <svg className={`w-4 h-4 transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Module Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Test File Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Duration (ms)
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  <button 
                    onClick={() => handleSort('date')}
                    className="flex items-center gap-2 hover:text-white transition-colors"
                  >
                    Date
                    {sortColumn === 'date' && (
                      <svg className={`w-4 h-4 transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {paginatedExecutions.map((execution) => (
                <tr 
                  key={execution.id}
                  className="hover:bg-slate-800/50 transition-colors duration-200"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    {execution.status === 'PASS' ? (
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-green-500/10 text-green-500 font-medium text-sm border border-green-500/30">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        PASS
                      </span>
                    ) : execution.status === 'RUNNING' ? (
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-500/10 text-amber-400 font-medium text-sm border border-amber-500/30">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        RUNNING
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-red-500/10 text-red-500 font-medium text-sm border border-red-500/30">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        FAIL
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                    {execution.module_name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                    {execution.test_file_name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                    {formatDuration(execution.duration_ms)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                    {formatDate(execution.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => onExecutionSelect(execution)}
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
          
          {/* Pagination Controls */}
          <div className="bg-slate-950 border-t border-slate-800 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400">
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredAndSortedExecutions.length)} to {Math.min(currentPage * itemsPerPage, filteredAndSortedExecutions.length)} of {filteredAndSortedExecutions.length} results
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
        </div>
      )}
    </div>
  );
}

export default ExecutionsList;
