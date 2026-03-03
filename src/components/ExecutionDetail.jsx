import React from 'react';
import API_URL from '../apiUrl';

function ExecutionDetail({ execution, onBack }) {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatDuration = (ms) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const handleDownloadReport = () => {
    const reportUrl = `${API_URL}/execution/${execution.id}/report`;
    window.open(reportUrl, '_blank');
  };

  if (!execution) {
    return (
      <div className="p-6 animate-page-transition">
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <svg className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-medium">Execution not found</p>
          <p className="text-sm text-slate-500 mt-2">The execution you're looking for doesn't exist or has been deleted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 animate-page-transition">
      {/* Header with back button */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-800 rounded-xl transition-all duration-200 button-scale"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-semibold text-white">Execution Details</h1>
      </div>

      {/* Status badge */}
      <div className="mb-6">
        {execution.status === 'PASS' ? (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-xl text-green-500 shadow-lg">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-semibold text-lg">TEST PASSED</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 shadow-lg">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="font-semibold text-lg">TEST FAILED</span>
          </div>
        )}
      </div>

      {/* Execution info grid */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg card-hover">
          <div className="text-sm text-slate-400 mb-2">Module</div>
          <div className="text-lg font-medium text-white">{execution.module_name || 'Unknown'}</div>
        </div>
        
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg card-hover">
          <div className="text-sm text-slate-400 mb-2">Test File</div>
          <div className="text-lg font-medium text-white">{execution.test_file_name || 'Unknown'}</div>
        </div>
        
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg card-hover">
          <div className="text-sm text-slate-400 mb-2">Executed At</div>
          <div className="text-lg font-medium text-white">{formatDate(execution.created_at)}</div>
        </div>
        
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg card-hover">
          <div className="text-sm text-slate-400 mb-2">Duration</div>
          <div className="text-lg font-medium text-white">{formatDuration(execution.duration_ms)}</div>
        </div>
      </div>

      {/* Playwright Report Button */}
      {execution.report_path && (
        <div className="mb-6">
          <button
            onClick={handleDownloadReport}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all duration-200 font-semibold shadow-lg shadow-indigo-600/50 button-scale"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Open Full Playwright Report</span>
          </button>
        </div>
      )}

      {/* Logs section */}
      <div className="mb-6">
        <h2 className="text-lg font-medium text-white mb-4">Execution Logs</h2>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-sm overflow-auto max-h-96 shadow-lg">
          <pre className={`whitespace-pre-wrap break-words ${execution.status === 'PASS' ? 'text-green-400' : 'text-red-400'}`}>
            {execution.logs || 'No logs available'}
          </pre>
        </div>
      </div>

      {/* Screenshot section */}
      {execution.screenshot_base64 && (
        <div>
          <h2 className="text-lg font-medium text-white mb-4">Screenshot</h2>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
            <img
              src={`data:image/png;base64,${execution.screenshot_base64}`}
              alt="Test screenshot"
              className="max-w-full h-auto rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ExecutionDetail;
