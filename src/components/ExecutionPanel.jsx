import React from 'react';

function ExecutionPanel({ isOpen, executionStatus, executionResult, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="border-t border-slate-800 bg-slate-950 h-[250px] flex flex-col">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-300">EXECUTION OUTPUT</span>
          {executionStatus === 'running' && (
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-xs text-indigo-400">Running...</span>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors duration-200 hover:bg-slate-800 rounded-xl p-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-auto p-4 font-mono text-sm">
        {executionStatus === 'running' && (
          <div className="text-slate-400">
            <p>$ playwright test</p>
            <p>Running test file...</p>
          </div>
        )}

        {executionStatus === 'completed' && executionResult && (
          <div>
            {executionResult.status === 'PASS' ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-green-500 font-semibold text-base">PASS</span>
                </div>
                <pre className="text-green-400 whitespace-pre-wrap break-words mb-4">{executionResult.message}</pre>
                
                {/* Display screenshot if available */}
                {executionResult.screenshot && (
                  <div className="mt-4">
                    <div className="text-slate-400 text-sm mb-2">Screenshot:</div>
                    <div className="border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                      <img 
                        src={`data:image/png;base64,${executionResult.screenshot}`}
                        alt="Test screenshot"
                        className="max-w-full h-auto"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-red-500 font-semibold text-base">FAIL</span>
                </div>
                <pre className="text-red-400 whitespace-pre-wrap break-words mb-4">{executionResult.message}</pre>
                
                {/* Display screenshot if available */}
                {executionResult.screenshot && (
                  <div className="mt-4">
                    <div className="text-slate-400 text-sm mb-2">Screenshot on failure:</div>
                    <div className="border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                      <img 
                        src={`data:image/png;base64,${executionResult.screenshot}`}
                        alt="Test failure screenshot"
                        className="max-w-full h-auto"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!executionStatus && (
          <div className="text-slate-500 italic">
            No execution yet. Click Run to execute the test.
          </div>
        )}
      </div>
    </div>
  );
}

export default ExecutionPanel;
