import React, { useState, useEffect, useCallback, useRef } from 'react';
import API_URL from '../apiUrl';

// ---------------------------------------------------------------------------
// Device catalogue
// ---------------------------------------------------------------------------
const DEVICE_GROUPS = [
  { group: '📱 iPhone', devices: ['iPhone SE', 'iPhone 15', 'iPhone 15 Pro', 'iPhone 15 Pro Max'] },
  { group: '🤖 Android', devices: ['Pixel 7', 'Galaxy S9+'] },
  { group: '📟 Tablet', devices: ['iPad Mini', 'iPad Pro 11'] },
  { group: '⚙️ Custom', devices: ['Custom'] },
];

const ALL_DEVICES = DEVICE_GROUPS.flatMap(g => g.devices);

function deviceEmoji(profile) {
  if (!profile) return '📱';
  const p = profile.toLowerCase();
  if (p.includes('ipad')) return '📟';
  if (p.includes('iphone')) return '🍎';
  if (p.includes('pixel') || p.includes('galaxy')) return '🤖';
  if (p.includes('custom')) return '⚙️';
  return '📱';
}

function deviceBadgeClass(profile) {
  if (!profile) return 'bg-slate-700 text-slate-300';
  const p = profile.toLowerCase();
  if (p.includes('iphone') || p.includes('ipad')) return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
  if (p.includes('pixel') || p.includes('galaxy')) return 'bg-green-500/20 text-green-300 border border-green-500/30';
  return 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
}

function statusBadge(status) {
  if (!status) return null;
  const map = {
    running:  'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
    passed:   'bg-green-500/20  text-green-300  border border-green-500/30',
    failed:   'bg-red-500/20    text-red-300    border border-red-500/30',
    error:    'bg-red-500/20    text-red-300    border border-red-500/30',
    pending:  'bg-slate-600/40  text-slate-300  border border-slate-500/30',
  };
  return map[status] || map.pending;
}

function StatusDot({ status }) {
  if (status === 'running') return (
    <span className="inline-flex items-center gap-1">
      <svg className="animate-spin h-3 w-3 text-yellow-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
      Running
    </span>
  );
  if (status === 'passed')  return <span className="text-green-400">✓ Passed</span>;
  if (status === 'failed')  return <span className="text-red-400">✗ Failed</span>;
  if (status === 'error')   return <span className="text-red-400">✗ Error</span>;
  return <span className="text-slate-400">—</span>;
}

function formatDuration(ms) {
  if (!ms && ms !== 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString();
}

const auth = () => {
  const t = localStorage.getItem('auth_token');
  return t ? { 'x-auth-token': t } : {};
};

// ---------------------------------------------------------------------------
// ResultModal
// ---------------------------------------------------------------------------
function ResultModal({ execution, onClose }) {
  if (!execution) return null;
  const isRunning = execution.status === 'running';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <span className="text-xl">{deviceEmoji(execution.device_profile)}</span>
            <div>
              <h2 className="text-white font-semibold text-lg leading-tight">
                {execution.test_file_name || 'Mobile Run'}
              </h2>
              <p className="text-slate-400 text-sm">
                {execution.module_name && <span className="mr-2">{execution.module_name}</span>}
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${deviceBadgeClass(execution.device_profile)}`}>
                  {execution.device_profile || 'Unknown device'}
                </span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded transition-colors">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>

        {/* Stats row */}
        <div className="flex gap-4 p-4 border-b border-slate-700 bg-slate-900/30">
          <div className="flex-1 text-center">
            <p className="text-slate-400 text-xs mb-1">Status</p>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${statusBadge(execution.status) || ''}`}>
              <StatusDot status={execution.status} />
            </span>
          </div>
          <div className="flex-1 text-center">
            <p className="text-slate-400 text-xs mb-1">Duration</p>
            <p className="text-white font-medium">{formatDuration(execution.duration_ms)}</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-slate-400 text-xs mb-1">Started</p>
            <p className="text-white font-medium text-xs">{formatDate(execution.started_at)}</p>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Screenshot */}
          {execution.screenshot_base64 && (
            <div>
              <p className="text-slate-300 text-sm font-medium mb-2">Screenshot</p>
              <div className="flex justify-center bg-slate-900/40 rounded-lg p-3 border border-slate-700">
                <img
                  src={`data:image/png;base64,${execution.screenshot_base64}`}
                  alt="Test screenshot"
                  className="max-h-64 rounded shadow-md border border-slate-600"
                  style={{ maxWidth: '100%', objectFit: 'contain' }}
                />
              </div>
            </div>
          )}

          {/* Error message */}
          {execution.error_message && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm font-medium mb-1">Error</p>
              <p className="text-red-300 text-sm font-mono whitespace-pre-wrap">{execution.error_message}</p>
            </div>
          )}

          {/* Logs */}
          {execution.logs && (
            <div>
              <p className="text-slate-300 text-sm font-medium mb-2">Logs</p>
              <pre className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 overflow-auto max-h-80 font-mono leading-relaxed whitespace-pre-wrap">
                {execution.logs}
              </pre>
            </div>
          )}

          {isRunning && !execution.logs && (
            <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Test is running…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeviceSelect — per-row device picker
// ---------------------------------------------------------------------------
function DeviceSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[160px]"
    >
      {DEVICE_GROUPS.map(g => (
        <optgroup key={g.group} label={g.group} className="bg-slate-800">
          {g.devices.map(d => (
            <option key={d} value={d} className="bg-slate-800">{d}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function MobileTests() {
  const [activeTab, setActiveTab] = useState('files');

  // --- test files tab state ---
  const [testFiles, setTestFiles]         = useState([]);
  const [filesLoading, setFilesLoading]   = useState(false);
  const [filesError, setFilesError]       = useState('');
  const [moduleFilter, setModuleFilter]   = useState('All');
  const [deviceSelections, setDeviceSelections] = useState({}); // fileId -> device
  const [runningIds, setRunningIds]       = useState(new Set()); // fileIds currently launching

  // --- runs tab state ---
  const [executions, setExecutions]       = useState([]);
  const [runsLoading, setRunsLoading]     = useState(false);
  const [runsError, setRunsError]         = useState('');

  // --- result modal ---
  const [viewExec, setViewExec]           = useState(null);

  // polling refs
  const pollTimers = useRef({}); // execId -> intervalId

  // -----------------------------------------------------------------------
  // Fetch test files
  // -----------------------------------------------------------------------
  const fetchTestFiles = useCallback(async () => {
    setFilesLoading(true);
    setFilesError('');
    try {
      const r = await fetch(`${API_URL}/mobile-tests/test-files`, { headers: auth() });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setTestFiles(data);
      setDeviceSelections(prev => {
        const next = { ...prev };
        data.forEach(f => { if (!next[f.id]) next[f.id] = 'iPhone 15'; });
        return next;
      });
    } catch (e) {
      setFilesError(e.message || 'Failed to load test files');
    } finally {
      setFilesLoading(false);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Fetch executions
  // -----------------------------------------------------------------------
  const fetchExecutions = useCallback(async () => {
    setRunsLoading(true);
    setRunsError('');
    try {
      const r = await fetch(`${API_URL}/mobile-tests/executions/all`, { headers: auth() });
      if (!r.ok) throw new Error(await r.text());
      setExecutions(await r.json());
    } catch (e) {
      setRunsError(e.message || 'Failed to load runs');
    } finally {
      setRunsLoading(false);
    }
  }, []);

  useEffect(() => { fetchTestFiles(); }, [fetchTestFiles]);
  useEffect(() => { if (activeTab === 'runs') fetchExecutions(); }, [activeTab, fetchExecutions]);

  // -----------------------------------------------------------------------
  // Poll a running execution
  // -----------------------------------------------------------------------
  const pollExecution = useCallback((execId, testFileId) => {
    if (pollTimers.current[execId]) return;
    const tick = async () => {
      try {
        const r = await fetch(`${API_URL}/mobile-tests/executions/${execId}`, { headers: auth() });
        if (!r.ok) return;
        const data = await r.json();
        setExecutions(prev => prev.map(e => e.id === execId ? data : e));
        setViewExec(prev => prev && prev.id === execId ? data : prev);
        if (data.status !== 'running') {
          clearInterval(pollTimers.current[execId]);
          delete pollTimers.current[execId];
          setRunningIds(prev => { const s = new Set(prev); s.delete(testFileId); return s; });
        }
      } catch { /* ignore */ }
    };
    pollTimers.current[execId] = setInterval(tick, 2500);
    tick();
  }, []);

  useEffect(() => () => Object.values(pollTimers.current).forEach(clearInterval), []);

  // -----------------------------------------------------------------------
  // Run test file on device
  // -----------------------------------------------------------------------
  const runFile = useCallback(async (file) => {
    const device_profile = deviceSelections[file.id] || 'iPhone 15';
    setRunningIds(prev => new Set(prev).add(file.id));
    try {
      const r = await fetch(`${API_URL}/mobile-tests/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ testFileId: file.id, device_profile }),
      });
      if (!r.ok) throw new Error(await r.text());
      const { executionId } = await r.json();
      const newExec = {
        id: executionId,
        test_file_id: file.id,
        test_file_name: file.name,
        module_name: file.module_name,
        device_profile,
        status: 'running',
        started_at: new Date().toISOString(),
      };
      setExecutions(prev => [newExec, ...prev]);
      pollExecution(executionId, file.id);
      setActiveTab('runs');
    } catch (e) {
      alert(`Failed to start run: ${e.message}`);
      setRunningIds(prev => { const s = new Set(prev); s.delete(file.id); return s; });
    }
  }, [deviceSelections, pollExecution]);

  // -----------------------------------------------------------------------
  // View execution detail
  // -----------------------------------------------------------------------
  const viewExecution = useCallback(async (exec) => {
    setViewExec({ ...exec });
    try {
      const r = await fetch(`${API_URL}/mobile-tests/executions/${exec.id}`, { headers: auth() });
      if (r.ok) setViewExec(await r.json());
    } catch { /* show what we have */ }
  }, []);

  // -----------------------------------------------------------------------
  // Delete execution
  // -----------------------------------------------------------------------
  const deleteExecution = useCallback(async (execId) => {
    if (!window.confirm('Delete this run record?')) return;
    try {
      const r = await fetch(`${API_URL}/mobile-tests/executions/${execId}`, {
        method: 'DELETE', headers: auth(),
      });
      if (!r.ok) throw new Error(await r.text());
      setExecutions(prev => prev.filter(e => e.id !== execId));
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Derived state
  // -----------------------------------------------------------------------
  const moduleNames = ['All', ...Array.from(new Set(testFiles.map(f => f.module_name || 'Ungrouped')))];
  const filteredFiles = moduleFilter === 'All'
    ? testFiles
    : testFiles.filter(f => (f.module_name || 'Ungrouped') === moduleFilter);

  const grouped = filteredFiles.reduce((acc, f) => {
    const key = f.module_name || 'Ungrouped';
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {});

  const runningCount = Object.keys(pollTimers.current).length;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      {/* Page header */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              📱 Mobile Tests
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Run your existing automation test files on mobile devices using Playwright emulation
            </p>
          </div>
          {runningCount > 0 && (
            <span className="flex items-center gap-1.5 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-3 py-1.5 rounded-full text-sm font-medium">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              {runningCount} running
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {[
            { id: 'files', label: 'Test Files', icon: '📄' },
            { id: 'runs',  label: `Runs${executions.length > 0 ? ` (${executions.length})` : ''}`, icon: '▶️' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">

        {/* ---- TAB: TEST FILES ---- */}
        {activeTab === 'files' && (
          <div>
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4 gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-400 text-sm">Module:</span>
                {moduleNames.map(m => (
                  <button
                    key={m}
                    onClick={() => setModuleFilter(m)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      moduleFilter === m
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <button
                onClick={fetchTestFiles}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                title="Refresh"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/>
                </svg>
              </button>
            </div>

            {filesLoading && (
              <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Loading test files…
              </div>
            )}

            {filesError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">{filesError}</div>
            )}

            {!filesLoading && !filesError && filteredFiles.length === 0 && (
              <div className="text-center py-16">
                <div className="text-5xl mb-3">📄</div>
                <p className="text-slate-300 font-medium">No test files found</p>
                <p className="text-slate-500 text-sm mt-1">
                  Create automation test files in your modules first, then run them here on any device.
                </p>
              </div>
            )}

            {!filesLoading && Object.entries(grouped).map(([moduleName, files]) => (
              <div key={moduleName} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-4 w-1 rounded bg-blue-500"/>
                  <h3 className="text-slate-200 font-semibold text-sm tracking-wide">{moduleName}</h3>
                  <span className="text-slate-500 text-xs">({files.length} file{files.length !== 1 ? 's' : ''})</span>
                </div>
                <div className="space-y-2">
                  {files.map(file => {
                    const isRunning = runningIds.has(file.id);
                    const lastRun = executions.find(e => e.test_file_id === file.id);
                    return (
                      <div
                        key={file.id}
                        className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-4 hover:border-slate-600 transition-colors"
                      >
                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">📄</span>
                            <span className="text-white font-medium truncate">{file.name}</span>
                          </div>
                          {file.module_base_url && (
                            <p className="text-slate-500 text-xs mt-0.5 truncate ml-7">{file.module_base_url}</p>
                          )}
                        </div>

                        {/* Last run status */}
                        <div className="text-right text-xs hidden sm:block w-24">
                          {lastRun ? (
                            <>
                              <p className="text-slate-500 mb-0.5">Last run</p>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusBadge(lastRun.status) || ''}`}>
                                <StatusDot status={lastRun.status} />
                              </span>
                            </>
                          ) : (
                            <p className="text-slate-600 text-xs">No runs yet</p>
                          )}
                        </div>

                        {/* Device picker */}
                        <DeviceSelect
                          value={deviceSelections[file.id] || 'iPhone 15'}
                          onChange={v => setDeviceSelections(prev => ({ ...prev, [file.id]: v }))}
                        />

                        {/* Run button */}
                        <button
                          onClick={() => runFile(file)}
                          disabled={isRunning}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${
                            isRunning
                              ? 'bg-yellow-600/40 text-yellow-300 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-500 text-white shadow hover:shadow-blue-500/30'
                          }`}
                        >
                          {isRunning ? (
                            <>
                              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                              </svg>
                              Running…
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/>
                              </svg>
                              Run on Device
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---- TAB: RUNS ---- */}
        {activeTab === 'runs' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-slate-400 text-sm">{executions.length} run{executions.length !== 1 ? 's' : ''} recorded</p>
              <button
                onClick={fetchExecutions}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                title="Refresh"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/>
                </svg>
              </button>
            </div>

            {runsLoading && (
              <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Loading runs…
              </div>
            )}

            {runsError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">{runsError}</div>
            )}

            {!runsLoading && !runsError && executions.length === 0 && (
              <div className="text-center py-16">
                <div className="text-5xl mb-3">▶️</div>
                <p className="text-slate-300 font-medium">No runs yet</p>
                <p className="text-slate-500 text-sm mt-1">
                  Go to the Test Files tab, pick a device and click "Run on Device".
                </p>
              </div>
            )}

            {!runsLoading && executions.length > 0 && (
              <div className="space-y-2">
                {executions.map(exec => (
                  <div
                    key={exec.id}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex items-center gap-4 hover:border-slate-600 transition-colors"
                  >
                    {/* Status dot */}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      exec.status === 'running' ? 'bg-yellow-400 animate-pulse' :
                      exec.status === 'passed'  ? 'bg-green-400' :
                      (exec.status === 'failed' || exec.status === 'error') ? 'bg-red-400' :
                      'bg-slate-500'
                    }`}/>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-medium truncate">{exec.test_file_name || 'Unknown'}</span>
                        {exec.module_name && (
                          <span className="text-slate-500 text-xs bg-slate-700 px-1.5 py-0.5 rounded">{exec.module_name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${deviceBadgeClass(exec.device_profile)}`}>
                          {deviceEmoji(exec.device_profile)} {exec.device_profile}
                        </span>
                        <span className="text-slate-500 text-xs">{formatDate(exec.started_at)}</span>
                      </div>
                    </div>

                    {/* Duration */}
                    <div className="text-right hidden sm:block">
                      <p className="text-slate-400 text-xs">{formatDuration(exec.duration_ms)}</p>
                    </div>

                    {/* Status badge */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium w-24 justify-center flex-shrink-0 ${statusBadge(exec.status) || ''}`}>
                      <StatusDot status={exec.status}/>
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => viewExecution(exec)}
                        className="text-slate-400 hover:text-blue-400 p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                        title="View details"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                        </svg>
                      </button>
                      {exec.status !== 'running' && (
                        <button
                          onClick={() => deleteExecution(exec.id)}
                          className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                          title="Delete"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Result modal */}
      {viewExec && (
        <ResultModal
          execution={viewExec}
          onClose={() => setViewExec(null)}
        />
      )}
    </div>
  );
}