import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import EditTestFileRequirementModal from './EditTestFileRequirementModal';
import API_URL from '../apiUrl';

function TestFileEditor({ testFile, moduleName, onContentChange, onSave, onRun, onDebug, onStopDebug, debugActive = false, executionStatus, executionResult, requirements = [], onUpdateRequirement, orgInfo }) {
  const aiEnabled = orgInfo?.aiHealingEnabled === true || orgInfo?.aiHealingEnabled === 1;
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('output'); // 'output' or 'problems'
  const [panelHeight, setPanelHeight] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditRequirementModalOpen, setIsEditRequirementModalOpen] = useState(false);
  const panelRef = useRef(null);
  const editorRef = useRef(null);

  // AI script generation panel
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiTestName, setAiTestName] = useState('');
  const [aiMode, setAiMode] = useState('replace'); // 'replace' | 'append'
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState(null); // { script, npmNote, extraImports }
  const [aiScriptCopied, setAiScriptCopied] = useState(false);
  const aiInstructionRef = useRef(null);
  
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

  // ---------- AI script generation ----------
  const openAiPanel = () => {
    setAiInstruction('');
    setAiTestName(testFile?.name?.replace(/\.spec\.(ts|js)$/, '') || '');
    setAiMode('replace');
    setAiError('');
    setAiResult(null);
    setIsAiOpen(true);
    setTimeout(() => aiInstructionRef.current?.focus(), 60);
  };
  const closeAiPanel = () => { setIsAiOpen(false); setAiResult(null); setAiError(''); };

  const handleAiGenerate = async (e) => {
    e.preventDefault();
    if (!aiInstruction.trim()) { setAiError('Please describe what the script should do.'); return; }
    setAiLoading(true);
    setAiError('');
    setAiResult(null);
    try {
      const token = localStorage.getItem('auth_token');
      const currentContent = editorRef.current ? editorRef.current.getValue() : (testFile?.content || '');
      const res = await fetch(`${API_URL}/test-files/generate-ai-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'x-auth-token': token } : {}) },
        body: JSON.stringify({
          instruction: aiInstruction.trim(),
          testName: aiTestName.trim() || testFile?.name || 'generated test',
          currentContent: aiMode === 'append' ? currentContent : '',
        }),
      });
      const data = await res.json();
      if (!res.ok) { setAiError(data.error || 'Generation failed.'); return; }
      setAiResult(data);
    } catch { setAiError('Network error. Please try again.'); }
    finally { setAiLoading(false); }
  };

  const applyScriptToEditor = () => {
    if (!aiResult?.script || !editorRef.current) return;
    const newContent = aiMode === 'append'
      ? (editorRef.current.getValue() + '\n\n' + aiResult.script)
      : aiResult.script;
    editorRef.current.setValue(newContent);
    if (onContentChange) onContentChange(testFile.id, newContent);
    setHasUnsavedChanges(true);
    closeAiPanel();
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

          {/* AI Script Generation Button */}
          {aiEnabled && (
            <button
              onClick={openAiPanel}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all bg-violet-700 text-white hover:bg-violet-600 flex items-center gap-1.5"
              title="Generate Playwright script from natural language"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI Script
            </button>
          )}

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

          {/* Trace Run Button */}
          <button
            onClick={handleDebug}
            disabled={executionStatus === 'running'}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
              executionStatus === 'running'
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-amber-600 text-white hover:bg-amber-500'
            }`}
            title="Run test with full Playwright trace recording — view step-by-step in the browser"
          >
            {executionStatus === 'running' ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Tracing...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Trace</span>
              </>
            )}
          </button>
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
                    {executionResult.status?.toLowerCase() === 'trace' ? (
                      <div className="mb-3 space-y-2">
                        <div className="flex items-center space-x-2 text-amber-400">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          <span className="font-semibold">Trace Recorded</span>
                        </div>
                        {executionResult.trace_url && (
                          <a
                            href={executionResult.trace_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            <span>View Trace in Browser</span>
                          </a>
                        )}
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
                        executionResult.status?.toLowerCase() === 'trace'
                          ? 'text-amber-300'
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

      {/* ── AI Script Generation Panel ── */}
      {isAiOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={closeAiPanel} />
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-700 h-full flex flex-col shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white leading-tight">AI Playwright Script Generator</h2>
                  <p className="text-xs text-slate-500">Powered by GPT-4o · Follows your project's Playwright framework</p>
                </div>
              </div>
              <button onClick={closeAiPanel} className="p-1 text-slate-500 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {!aiResult ? (
                <form onSubmit={handleAiGenerate} className="px-5 py-5 space-y-4">

                  <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 px-4 py-3 text-xs text-violet-300 leading-relaxed">
                    Describe what you want the test to do in plain English. AI will generate a complete Playwright script following your framework's structure (<code className="text-violet-200 bg-violet-900/40 px-1 rounded">import &#123; test, expect &#125; from '@playwright/test'</code> + async test block).
                  </div>

                  {/* Instruction */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      What should this test do? <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      ref={aiInstructionRef}
                      value={aiInstruction}
                      onChange={e => setAiInstruction(e.target.value)}
                      rows={6}
                      placeholder={`Examples:\n• Navigate to google.com, type \"playwright\" in the search box, press Enter, and verify the first result contains \"Playwright\"\n• Go to my-app.com/login, enter username admin@test.com and password Secret123, click Login, and assert the dashboard heading is visible\n• Fill out a contact form with fake name and email using faker, submit it, and verify the success message appears`}
                      className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500 resize-none placeholder-slate-600 leading-relaxed font-mono"
                    />
                  </div>

                  {/* Test name */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Test name</label>
                    <input
                      type="text"
                      value={aiTestName}
                      onChange={e => setAiTestName(e.target.value)}
                      placeholder={testFile?.name?.replace(/\.spec\.(ts|js)$/, '') || 'my generated test'}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  {/* Mode */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Insert mode</label>
                    <div className="flex gap-2">
                      {[{ id: 'replace', label: 'Replace file content', desc: 'Overwrites everything in the editor' }, { id: 'append', label: 'Append to file', desc: 'Adds new test after existing content' }].map(m => (
                        <button key={m.id} type="button" onClick={() => setAiMode(m.id)}
                          className={`flex-1 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                            aiMode === m.id ? 'bg-violet-600/20 border-violet-500/50 text-violet-200' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                          }`}>
                          <div className="text-xs font-semibold">{m.label}</div>
                          <div className="text-[10px] mt-0.5 text-slate-500">{m.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {aiError && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-sm text-red-300">{aiError}</div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={closeAiPanel}
                      className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors">
                      Cancel
                    </button>
                    <button type="submit" disabled={aiLoading || !aiInstruction.trim()}
                      className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg transition-colors">
                      {aiLoading ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                          Generating script…
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Generate Script
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="px-5 py-5">

                  {/* Context note */}
                  <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3">
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-xs text-slate-400 leading-relaxed">The generated code is the <span className="text-slate-200 font-medium">step body only</span> — the test name &amp; wrapper are handled by the framework automatically.</p>
                    </div>
                  </div>

                  {/* Extra imports note */}
                  {aiResult.extraImports && (
                    <div className="mb-4 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span className="text-xs font-semibold text-blue-300">Add to Module Imports</span>
                      </div>
                      <p className="text-xs text-blue-200/80 mb-2">Add this import to your module&apos;s imports config (Module Settings → Imports):</p>
                      <code className="block text-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-blue-300 font-mono select-all whitespace-pre">
                        {aiResult.extraImports}
                      </code>
                    </div>
                  )}

                  {/* npm install note */}
                  {aiResult.npmNote && (
                    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs font-semibold text-amber-300">Install required</span>
                      </div>
                      <p className="text-xs text-amber-200/80 mb-2">Run this in your <code className="bg-amber-900/40 px-1 rounded">server/</code> directory before running:</p>
                      <code className="block text-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-amber-300 font-mono select-all">
                        npm install {aiResult.npmNote}
                      </code>
                    </div>
                  )}

                  {/* Generated steps */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-300">Generated Steps</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(aiResult.script);
                          setAiScriptCopied(true);
                          setTimeout(() => setAiScriptCopied(false), 2000);
                        }}
                        className="flex items-center gap-1 text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors">
                        {aiScriptCopied ? (
                          <><svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span className="text-green-400">Copied</span></>
                        ) : (
                          <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
                        )}
                      </button>
                    </div>
                    <pre className="text-xs font-mono text-emerald-300 bg-slate-950 border border-slate-700 rounded-xl p-4 overflow-x-auto whitespace-pre leading-relaxed max-h-80 overflow-y-auto">{aiResult.script}</pre>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => { setAiResult(null); setAiError(''); }}
                      className="flex-1 py-2 text-sm font-medium border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 rounded-lg transition-colors">
                      Regenerate
                    </button>
                    <button
                      onClick={applyScriptToEditor}
                      className="flex-1 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      {aiMode === 'append' ? 'Append to Editor' : 'Apply to Editor'}
                    </button>
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TestFileEditor;
