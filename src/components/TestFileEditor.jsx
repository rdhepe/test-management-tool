import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import EditTestFileRequirementModal from './EditTestFileRequirementModal';

function TestFileEditor({ testFile, moduleName, onContentChange, onSave, onRun, onDebug, onStopDebug, debugActive = false, executionStatus, executionResult, requirements = [], onUpdateRequirement }) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('output'); // 'output' or 'problems'
  const [panelHeight, setPanelHeight] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditRequirementModalOpen, setIsEditRequirementModalOpen] = useState(false);
  const panelRef = useRef(null);
  const editorRef = useRef(null);
  
  // Configure Monaco Editor to disable TypeScript errors
  useEffect(() => {
    // This will run when Monaco is loaded
    const configureMonaco = async () => {
      const monaco = await import('monaco-editor');
      
      // Disable TypeScript diagnostics (error checking)
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
        noSuggestionDiagnostics: true,
      });
      
      // Configure compiler options
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        allowNonTsExtensions: true,
        allowJs: true,
      });
    };
    
    configureMonaco().catch(console.error);
  }, []);

  // Open panel when execution starts or completes
  useEffect(() => {
    if (executionStatus === 'running' || executionStatus === 'completed') {
      setIsPanelOpen(true);
      setActiveTab('output');
    }
  }, [executionStatus]);

  // Handle resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newHeight = window.innerHeight - e.clientY - 60; // 60px for navbar
      setPanelHeight(Math.max(150, Math.min(600, newHeight)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  if (!testFile) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-950">
        <div className="text-center">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-xl font-semibold text-slate-300 mb-2">No Test File Selected</h3>
          <p className="text-slate-500">Select a test file from the sidebar to view it</p>
        </div>
      </div>
    );
  }

  const handleEditorChange = (value) => {
    setHasUnsavedChanges(true);
    if (onContentChange) {
      onContentChange(testFile.id, value || '');
    }
  };

  const handleSave = () => {
    if (onSave) {
      onSave();
      setHasUnsavedChanges(false);
    }
  };

  const handleRun = () => {
    if (onRun) {
      onRun();
    }
  };

  const handleDebug = () => {
    if (onDebug) {
      onDebug();
    }
  };

  const handleStopDebug = () => {
    if (onStopDebug) {
      onStopDebug();
    }
  };

  const handleUpdateRequirement = (requirementId) => {
    if (onUpdateRequirement) {
      onUpdateRequirement(testFile.id, requirementId);
    }
  };

  const togglePanel = () => {
    setIsPanelOpen(!isPanelOpen);
  };

  const startResize = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  // Parse problems from execution result
  const problems = executionResult?.error ? [
    {
      severity: 'error',
      message: executionResult.error,
      line: 1
    }
  ] : [];

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-slate-400">{moduleName}</span>
          <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-slate-200 font-medium">{testFile.name}</span>
          {/* Requirement Link Badge */}
          {testFile.requirementTitle && (
            <>
              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-indigo-400 font-medium flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {testFile.requirementTitle}
              </span>
            </>
          )}
        </div>

        {/* Action Buttons & Status */}
        <div className="flex items-center space-x-4">
          {/* Status Indicator */}
          <div className="flex items-center space-x-2">
            {hasUnsavedChanges ? (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <span className="text-xs text-amber-400 font-medium">Unsaved</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-xs text-green-400 font-medium">Saved</span>
              </>
            )}
          </div>

          {/* Edit Requirement Button */}
          <button
            onClick={() => setIsEditRequirementModalOpen(true)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center gap-1.5"
            title="Edit Requirement Link"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            {testFile.requirementTitle ? 'Edit Link' : 'Link to Req'}
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              hasUnsavedChanges
                ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            Save
          </button>

          {/* Run Button */}
          <button
            onClick={handleRun}
            disabled={executionStatus === 'running' || debugActive}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
              executionStatus === 'running' || debugActive
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-500'
            }`}
          >
            {executionStatus === 'running' && !debugActive ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Running...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Run Test</span>
              </>
            )}
          </button>

          {/* Debug / Stop Debug Button */}
          {debugActive ? (
            <button
              onClick={handleStopDebug}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 bg-red-600 text-white hover:bg-red-500"
              title="Kill the Playwright Inspector and stop the debug session"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Stop Debug</span>
            </button>
          ) : (
            <button
              onClick={handleDebug}
              disabled={executionStatus === 'running'}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                executionStatus === 'running'
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-amber-600 text-white hover:bg-amber-500'
              }`}
              title="Open Playwright Inspector for step-by-step debugging"
            >
              {executionStatus === 'running' ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Launching...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Debug</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 overflow-hidden" style={{ height: isPanelOpen ? `calc(100% - ${panelHeight}px - 52px)` : 'calc(100% - 52px)' }}>
        <Editor
          height="100%"
          key={testFile.id}
          defaultLanguage="javascript"
          defaultValue={testFile.content || ''}
          theme="vs-dark"
          onMount={(editor) => { editorRef.current = editor; }}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            tabSize: 2,
          }}
          onChange={handleEditorChange}
        />
      </div>

      {/* Collapsible Execution Panel */}
      {isPanelOpen && (
        <div
          ref={panelRef}
          className="border-t border-slate-800 bg-slate-900 flex flex-col transition-all"
          style={{ height: `${panelHeight}px` }}
        >
          {/* Resize Handle */}
          <div
            onMouseDown={startResize}
            className="h-1 bg-slate-800 hover:bg-indigo-600 cursor-ns-resize transition-colors"
          />

          {/* Panel Header with Tabs */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
            <div className="flex space-x-1">
              {/* Output Tab */}
              <button
                onClick={() => setActiveTab('output')}
                className={`px-4 py-1.5 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === 'output'
                    ? 'bg-slate-950 text-slate-100 border-t-2 border-indigo-500'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Output</span>
                </div>
              </button>

              {/* Problems Tab */}
              <button
                onClick={() => setActiveTab('problems')}
                className={`px-4 py-1.5 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === 'problems'
                    ? 'bg-slate-950 text-slate-100 border-t-2 border-indigo-500'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Problems</span>
                  {problems.length > 0 && (
                    <span className="px-1.5 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">
                      {problems.length}
                    </span>
                  )}
                </div>
              </button>
            </div>

            {/* Copy + Close Buttons */}
            <div className="flex items-center space-x-2">
              {activeTab === 'output' && executionStatus === 'completed' && executionResult && (executionResult.message || executionResult.console_output) && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(executionResult.message || executionResult.console_output || '');
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title="Copy output"
                >
                  {copied ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-green-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Copy</span>
                    </>
                  )}
                </button>
              )}
              <button
                onClick={togglePanel}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-auto p-4 bg-slate-950">
            {activeTab === 'output' && (
              <div className="font-mono text-sm">
                {executionStatus === 'running' ? (
                  <div className="flex items-center space-x-2 text-amber-400">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Test is running...</span>
                  </div>
                ) : executionStatus === 'completed' && executionResult ? (
                  <div>
                    {/* Status Header */}
                    {executionResult.status?.toLowerCase() === 'debug' ? (
                      <div className="flex items-center space-x-2 mb-3 text-blue-400">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-semibold">Debug Session Active</span>
                      </div>
                    ) : (
                      <div className={`flex items-center space-x-2 mb-3 ${executionResult.status?.toLowerCase() === 'pass' ? 'text-green-400' : 'text-red-400'}`}>
                        {executionResult.status?.toLowerCase() === 'pass' ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        <span className="font-semibold">{executionResult.status}</span>
                      </div>
                    )}

                    {/* AI Heal Banner */}
                    {executionResult.aiHealed && (
                      <div className={`flex items-start gap-3 p-3 mb-3 rounded-lg border ${
                        executionResult.aiHealSucceeded
                          ? 'bg-purple-500/10 border-purple-500/30'
                          : 'bg-orange-500/10 border-orange-500/30'
                      }`}>
                        <span className="text-xl mt-0.5">🤖</span>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-semibold mb-1 ${
                            executionResult.aiHealSucceeded ? 'text-purple-300' : 'text-orange-300'
                          }`}>
                            {executionResult.aiHealSucceeded
                              ? 'AI Healer — Fixed & Passing ✅'
                              : 'AI Healer — Fix Applied (Still Failing) ❌'}
                          </div>
                          {executionResult.healAnalysis && (
                            <div className="text-xs text-slate-400 mb-2">{executionResult.healAnalysis}</div>
                          )}
                          {executionResult.healChanges && executionResult.healChanges.length > 0 && (
                            <div className="text-xs space-y-1 mb-2">
                              {executionResult.healChanges.map((c, i) => (
                                <div key={i} className="bg-slate-900 rounded px-2 py-1 font-mono">
                                  <span className="text-slate-500">Line {c.line}: </span>
                                  <span className="text-slate-300">{c.reason}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {executionResult.fixedCode && onContentChange && (
                            <button
                              onClick={() => {
                                if (editorRef.current) {
                                  editorRef.current.setValue(executionResult.fixedCode);
                                }
                                onContentChange(testFile.id, executionResult.fixedCode);
                                setHasUnsavedChanges(true);
                              }}
                              className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                              Apply AI Fix to Editor
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Console / Error Output */}
                    {(executionResult.message || executionResult.console_output) && (
                      <pre className={`whitespace-pre-wrap ${
                        executionResult.status?.toLowerCase() === 'debug'
                          ? 'text-blue-300'
                          : executionResult.status?.toLowerCase() === 'pass'
                          ? 'text-slate-300'
                          : 'text-red-300'
                      }`}>{executionResult.message || executionResult.console_output}</pre>
                    )}

                    {/* Screenshots */}
                    {executionResult.screenshots && executionResult.screenshots.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-slate-400 mb-2">Screenshots:</h4>
                        <div className="flex space-x-2">
                          {executionResult.screenshots.map((screenshot, idx) => (
                            <img
                              key={idx}
                              src={screenshot}
                              alt={`Screenshot ${idx + 1}`}
                              className="max-w-xs rounded border border-slate-700"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-slate-500 text-center py-8">
                    No execution output yet. Click "Run Test" to execute.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'problems' && (
              <div className="space-y-2">
                {problems.length === 0 ? (
                  <div className="text-slate-500 text-center py-8">
                    <svg className="w-12 h-12 mx-auto mb-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>No problems detected</p>
                  </div>
                ) : (
                  problems.map((problem, idx) => (
                    <div key={idx} className="flex items-start space-x-3 p-3 bg-red-500/10 border border-red-500/30 rounded">
                      <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-red-400 text-sm font-medium">{problem.message}</p>
                        {problem.line && (
                          <p className="text-slate-500 text-xs mt-1">Line {problem.line}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Panel Toggle Button (when closed) */}
      {!isPanelOpen && (executionStatus === 'running' || executionStatus === 'completed') && (
        <button
          onClick={togglePanel}
          className="border-t border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors flex items-center justify-between"
        >
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            <span>Show Execution Output</span>
          </div>
          {executionResult && (
            <span className={`px-2 py-0.5 text-xs rounded ${
              executionResult.status?.toLowerCase() === 'pass' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {executionResult.status}
            </span>
          )}
        </button>
      )}

      {/* Edit Requirement Modal */}
      <EditTestFileRequirementModal
        isOpen={isEditRequirementModalOpen}
        onClose={() => setIsEditRequirementModalOpen(false)}
        onSubmit={handleUpdateRequirement}
        currentRequirementId={testFile.requirementId}
        requirements={requirements}
      />
    </div>
  );
}

export default TestFileEditor;
