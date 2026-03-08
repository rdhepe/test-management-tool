import React, { useState, useEffect, useCallback, useRef } from 'react';
import API_URL from '../apiUrl';

// ---------------------------------------------------------------------------
// Device catalogue
// ---------------------------------------------------------------------------
const DEVICE_GROUPS = [
  { group: 'iPhone', devices: ['iPhone SE', 'iPhone 15', 'iPhone 15 Pro', 'iPhone 15 Pro Max'] },
  { group: 'Android', devices: ['Pixel 7', 'Galaxy S9+'] },
  { group: 'Tablet', devices: ['iPad Mini', 'iPad Pro 11'] },
  { group: 'Custom', devices: ['Custom'] },
];

const ALL_DEVICES = DEVICE_GROUPS.flatMap(g => g.devices);

function deviceBadgeClass(profile) {
  if (!profile) return 'bg-slate-700 text-slate-300';
  const p = profile.toLowerCase();
  if (p.includes('iphone') || p.includes('ipad')) return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
  if (p.includes('pixel') || p.includes('galaxy')) return 'bg-green-500/20 text-green-300 border border-green-500/30';
  return 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
}

const STATUS_STYLES = {
  running: 'bg-blue-400/15 text-blue-300 border-blue-400/30',
  passed:  'bg-green-400/15 text-green-300 border-green-400/30',
  failed:  'bg-red-400/15 text-red-300 border-red-400/30',
  error:   'bg-red-400/15 text-red-300 border-red-400/30',
  pending: 'bg-slate-400/15 text-slate-300 border-slate-400/30',
  partial: 'bg-yellow-400/15 text-yellow-300 border-yellow-400/30',
};
const STATUS_LABEL = { running: 'Running', passed: 'Passed', failed: 'Failed', error: 'Error', pending: 'Pending', partial: 'Partial' };

function statusBadge(status) {
  return STATUS_STYLES[status] || STATUS_STYLES.pending;
}

function StatusDot({ status }) {
  const label = STATUS_LABEL[status] || status || '—';
  return (
    <span className="inline-flex items-center gap-1.5">
      {status === 'running' && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {label}
    </span>
  );
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgb(var(--border-primary))' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
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
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Stats row */}
        <div className="flex gap-4 px-6 py-4 border-b" style={{ borderColor: 'rgb(var(--border-primary))' }}>
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

        <div className="flex-1 overflow-auto p-6 space-y-4">
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
// SuiteModal — create / edit a mobile suite
// ---------------------------------------------------------------------------
function SuiteModal({ suite, testFiles, onClose, onSave }) {
  const [name, setName]           = useState(suite?.name || '');
  const [device, setDevice]       = useState(suite?.device_profile || 'iPhone 15');
  const [description, setDescription] = useState(suite?.description || '');
  const [selectedIds, setSelectedIds] = useState(new Set((suite?.files || []).map(f => f.test_file_id)));
  const [saving, setSaving]       = useState(false);
  const [search, setSearch]       = useState('');

  const filteredFiles = testFiles.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.module_name || '').toLowerCase().includes(search.toLowerCase())
  );
  const grouped = filteredFiles.reduce((acc, f) => {
    const k = f.module_name || 'Ungrouped';
    (acc[k] = acc[k] || []).push(f);
    return acc;
  }, {});

  const toggle = (id) => setSelectedIds(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });

  const handleSave = async () => {
    if (!name.trim()) { alert('Suite name is required'); return; }
    if (selectedIds.size === 0) { alert('Select at least one test file'); return; }
    setSaving(true);
    const files = testFiles
      .filter(f => selectedIds.has(f.id))
      .map(f => ({ test_file_id: f.id, test_file_name: f.name, module_name: f.module_name || '' }));
    await onSave({ name: name.trim(), device_profile: device, description, files });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgb(var(--border-primary))' }}>
          <h2 className="text-lg font-semibold text-white">{suite ? 'Edit Suite' : 'New Mobile Suite'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-4">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Suite Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Smoke Tests on iPhone"
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Device</label>
              <DeviceSelect value={device} onChange={setDevice}/>
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Description</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional notes"
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"/>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-slate-300 text-sm font-medium">
                Test Files *
                <span className="ml-2 text-slate-500 font-normal">({selectedIds.size} selected)</span>
              </label>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files…"
                className="bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-40"/>
            </div>
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg max-h-60 overflow-auto">
              {Object.entries(grouped).length === 0 && (
                <p className="text-slate-500 text-sm text-center py-8">No test files found</p>
              )}
              {Object.entries(grouped).map(([moduleName, files]) => (
                <div key={moduleName}>
                  <div className="px-3 py-1.5 bg-slate-800/80 border-b border-slate-700 flex items-center gap-2 sticky top-0">
                    <div className="h-3 w-0.5 rounded bg-blue-500"/>
                    <span className="text-slate-400 text-xs font-semibold tracking-wide">{moduleName}</span>
                  </div>
                  {files.map(f => (
                    <label key={f.id} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-700/50 cursor-pointer transition-colors border-b border-slate-800/60 last:border-0">
                      <input type="checkbox" checked={selectedIds.has(f.id)} onChange={() => toggle(f.id)}
                        className="rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-0"/>
                      <span className="text-white text-sm">{f.name}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: 'rgb(var(--border-primary))' }}>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? (
              <><svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Saving…</>
            ) : 'Save Suite'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SuiteRunModal — per-file results of a suite run
// ---------------------------------------------------------------------------
function SuiteRunModal({ run, onClose, onViewExec }) {
  if (!run) return null;
  const isRunning = run.status === 'running';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgb(var(--border-primary))' }}>
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">{run.suite_name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${deviceBadgeClass(run.device_profile)}`}>
                  {run.device_profile}
                </span>
                <span className="text-slate-500 text-xs">{formatDate(run.started_at)}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 border-b" style={{ borderColor: 'rgb(var(--border-primary))' }}>
          {[
            { label: 'Status', content: <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge(run.status)}`}><StatusDot status={run.status}/></span> },
            { label: 'Total',  content: <span className="text-white font-bold text-lg">{run.total_files}</span> },
            { label: 'Passed', content: <span className="text-green-400 font-bold text-lg">{run.passed_files || 0}</span> },
            { label: 'Failed', content: <span className="text-red-400 font-bold text-lg">{run.failed_files || 0}</span> },
          ].map(({ label, content }) => (
            <div key={label} className="p-3 text-center border-r border-slate-700 last:border-r-0">
              <p className="text-slate-400 text-xs mb-1">{label}</p>
              {content}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {isRunning && (!run.executions || run.executions.length === 0) && (
            <div className="flex items-center justify-center gap-3 py-12 text-slate-400">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Suite is running…
            </div>
          )}
          <div className="space-y-2">
            {(run.executions || []).map((exec, idx) => (
              <div key={exec.id} className="border rounded-xl px-3 py-2.5 flex items-center gap-3 transition-colors"
                style={{ borderColor: 'rgb(var(--border-primary))' }}>
                <span className="text-slate-500 text-xs w-5 text-right flex-shrink-0">{idx + 1}.</span>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  exec.status === 'running' ? 'bg-yellow-400 animate-pulse' :
                  exec.status === 'passed'  ? 'bg-green-400' :
                  (exec.status === 'failed' || exec.status === 'error') ? 'bg-red-400' : 'bg-slate-500'
                }`}/>
                <div className="flex-1 min-w-0">
                  <span className="text-white text-sm">{exec.test_file_name}</span>
                  {exec.module_name && <span className="text-slate-500 text-xs ml-2 bg-slate-700 px-1.5 py-0.5 rounded">{exec.module_name}</span>}
                </div>
                <span className="text-slate-400 text-xs flex-shrink-0">{formatDuration(exec.duration_ms)}</span>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border w-20 justify-center flex-shrink-0 ${statusBadge(exec.status)}`}>
                  <StatusDot status={exec.status}/>
                </span>
                {exec.status !== 'running' && (
                  <button onClick={() => onViewExec(exec)}
                    className="text-slate-400 hover:text-indigo-400 p-1.5 rounded-lg hover:bg-slate-700 transition-colors flex-shrink-0"
                    title="View logs">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
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
      className="bg-slate-900 border border-slate-700 text-white text-sm rounded-xl px-2 py-1.5 focus:outline-none focus:border-indigo-500 min-w-[160px]"
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

  // --- suites tab state ---
  const [suites, setSuites]               = useState([]);
  const [suitesLoading, setSuitesLoading] = useState(false);
  const [suitesError, setSuitesError]     = useState('');
  const [showSuiteModal, setShowSuiteModal] = useState(false);
  const [editingSuite, setEditingSuite]   = useState(null); // null = create, obj = edit

  // --- suite runs state ---
  const [suiteRuns, setSuiteRuns]         = useState([]);
  const [suiteRunsLoading, setSuiteRunsLoading] = useState(false);
  const [viewSuiteRun, setViewSuiteRun]   = useState(null); // full run detail w/ executions
  const [runningSuiteIds, setRunningSuiteIds] = useState(new Set());

  // polling refs
  const pollTimers = useRef({});         // execId -> intervalId (individual runs)
  const suiteRunPollTimers = useRef({}); // suiteRunId -> intervalId

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
  // (suites tab fetch registered after fetchSuites/fetchSuiteRuns are declared below)

  // -----------------------------------------------------------------------
  // Fetch suites
  // -----------------------------------------------------------------------
  const fetchSuites = useCallback(async () => {
    setSuitesLoading(true); setSuitesError('');
    try {
      const r = await fetch(`${API_URL}/mobile-suites`, { headers: auth() });
      if (!r.ok) throw new Error(await r.text());
      setSuites(await r.json());
    } catch (e) { setSuitesError(e.message || 'Failed to load suites'); }
    finally { setSuitesLoading(false); }
  }, []);

  // -----------------------------------------------------------------------
  // Fetch suite runs
  // -----------------------------------------------------------------------
  const fetchSuiteRuns = useCallback(async () => {
    setSuiteRunsLoading(true);
    try {
      const r = await fetch(`${API_URL}/mobile-suite-runs/all`, { headers: auth() });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setSuiteRuns(data);
      // Resume polling for any still-running suite runs
      data.filter(sr => sr.status === 'running').forEach(sr => pollSuiteRun(sr.id, sr.suite_id));
    } catch (_) {}
    finally { setSuiteRunsLoading(false); }
  }, []);

  // Trigger fetch when switching to suites tab (placed here after function declarations)
  useEffect(() => { if (activeTab === 'suites') { fetchSuites(); fetchSuiteRuns(); } }, [activeTab, fetchSuites, fetchSuiteRuns]);

  // -----------------------------------------------------------------------
  // Poll a running suite run
  // -----------------------------------------------------------------------
  const pollSuiteRun = useCallback((suiteRunId, suiteId) => {
    if (suiteRunPollTimers.current[suiteRunId]) return;
    const tick = async () => {
      try {
        const r = await fetch(`${API_URL}/mobile-suite-runs/${suiteRunId}`, { headers: auth() });
        if (!r.ok) return;
        const data = await r.json();
        setSuiteRuns(prev => prev.map(sr => sr.id === suiteRunId ? { ...data, executions: undefined } : sr));
        setViewSuiteRun(prev => prev && prev.id === suiteRunId ? data : prev);
        // Refresh suite list to update last_run_status
        setSuites(prev => prev.map(s => s.id === suiteId ? { ...s, last_run_status: data.status, last_run_at: data.started_at } : s));
        if (data.status !== 'running') {
          clearInterval(suiteRunPollTimers.current[suiteRunId]);
          delete suiteRunPollTimers.current[suiteRunId];
          setRunningSuiteIds(prev => { const s = new Set(prev); s.delete(suiteId); return s; });
          fetchSuites(); // refresh file_count + last_run_status
        }
      } catch { /* ignore */ }
    };
    suiteRunPollTimers.current[suiteRunId] = setInterval(tick, 3000);
    tick();
  }, []);

  // -----------------------------------------------------------------------
  // Save suite (create or update)
  // -----------------------------------------------------------------------
  const saveSuite = useCallback(async (form) => {
    try {
      const { files, ...suiteData } = form;
      if (editingSuite) {
        await fetch(`${API_URL}/mobile-suites/${editingSuite.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...auth() },
          body: JSON.stringify({ ...suiteData, files }),
        });
      } else {
        await fetch(`${API_URL}/mobile-suites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...auth() },
          body: JSON.stringify({ ...suiteData, files }),
        });
      }
      setShowSuiteModal(false);
      setEditingSuite(null);
      fetchSuites();
    } catch (e) { alert(`Save failed: ${e.message}`); }
  }, [editingSuite, fetchSuites]);

  // -----------------------------------------------------------------------
  // Open edit modal (fetch suite with files)
  // -----------------------------------------------------------------------
  const openEditSuite = useCallback(async (suite) => {
    try {
      const r = await fetch(`${API_URL}/mobile-suites/${suite.id}`, { headers: auth() });
      if (r.ok) setEditingSuite(await r.json());
      else setEditingSuite(suite);
    } catch { setEditingSuite(suite); }
    setShowSuiteModal(true);
  }, []);

  // -----------------------------------------------------------------------
  // Delete suite
  // -----------------------------------------------------------------------
  const deleteSuite = useCallback(async (suiteId) => {
    if (!window.confirm('Delete this suite?')) return;
    try {
      await fetch(`${API_URL}/mobile-suites/${suiteId}`, { method: 'DELETE', headers: auth() });
      setSuites(prev => prev.filter(s => s.id !== suiteId));
    } catch (e) { alert(`Delete failed: ${e.message}`); }
  }, []);

  // -----------------------------------------------------------------------
  // Run a suite
  // -----------------------------------------------------------------------
  const runSuite = useCallback(async (suite) => {
    setRunningSuiteIds(prev => new Set(prev).add(suite.id));
    try {
      const r = await fetch(`${API_URL}/mobile-suites/${suite.id}/run`, {
        method: 'POST', headers: auth(),
      });
      if (!r.ok) throw new Error(await r.text());
      const { suiteRunId } = await r.json();
      const newRun = {
        id: suiteRunId, suite_id: suite.id, suite_name: suite.name,
        device_profile: suite.device_profile, status: 'running',
        total_files: suite.file_count || 0, passed_files: 0, failed_files: 0,
        started_at: new Date().toISOString(),
      };
      setSuiteRuns(prev => [newRun, ...prev]);
      setSuites(prev => prev.map(s => s.id === suite.id ? { ...s, last_run_status: 'running', last_run_at: newRun.started_at } : s));
      pollSuiteRun(suiteRunId, suite.id);
    } catch (e) {
      alert(`Failed to start suite run: ${e.message}`);
      setRunningSuiteIds(prev => { const s = new Set(prev); s.delete(suite.id); return s; });
    }
  }, [pollSuiteRun]);

  // -----------------------------------------------------------------------
  // View suite run detail
  // -----------------------------------------------------------------------
  const viewSuiteRunDetail = useCallback(async (run) => {
    setViewSuiteRun({ ...run, executions: [] });
    try {
      const r = await fetch(`${API_URL}/mobile-suite-runs/${run.id}`, { headers: auth() });
      if (r.ok) setViewSuiteRun(await r.json());
    } catch { /* show what we have */ }
  }, []);

  // -----------------------------------------------------------------------
  // Delete suite run
  // -----------------------------------------------------------------------
  const deleteSuiteRun = useCallback(async (runId) => {
    if (!window.confirm('Delete this suite run record?')) return;
    try {
      await fetch(`${API_URL}/mobile-suite-runs/${runId}`, { method: 'DELETE', headers: auth() });
      setSuiteRuns(prev => prev.filter(sr => sr.id !== runId));
    } catch (e) { alert(`Delete failed: ${e.message}`); }
  }, []);

  // Cleanup all poll timers on unmount
  useEffect(() => () => {
    Object.values(pollTimers.current).forEach(clearInterval);
    Object.values(suiteRunPollTimers.current).forEach(clearInterval);
  }, []);
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

  // Cleanup all poll timers on unmount
  useEffect(() => () => {
    Object.values(pollTimers.current).forEach(clearInterval);
    Object.values(suiteRunPollTimers.current).forEach(clearInterval);
  }, []);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2.5">
            <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Mobile Tests
          </h1>
          <p className="text-slate-400 text-sm mt-1">Run your existing automation test files on mobile devices using Playwright emulation</p>
        </div>
        <div className="flex items-center gap-3">
          {runningCount > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border bg-blue-400/15 text-blue-300 border-blue-400/30">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              {runningCount} running
            </span>
          )}
          {activeTab === 'suites' && (
            <button
              onClick={() => { setEditingSuite(null); setShowSuiteModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-indigo-600/30"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New Suite
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: 'rgb(var(--border-primary))' }}>
        {[
          { id: 'files',  label: `Files (${testFiles.length})` },
          { id: 'suites', label: `Suites${suites.length > 0 ? ` (${suites.length})` : ''}` },
          { id: 'runs',   label: `Runs${executions.length > 0 ? ` (${executions.length})` : ''}` },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === t.id ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

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
                        ? 'bg-indigo-600 text-white'
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
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-600/20 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No test files found</h3>
                <p className="text-slate-400 text-sm max-w-md">Create automation test files in your modules first, then run them here on any device.</p>
              </div>
            )}

            {!filesLoading && Object.entries(grouped).map(([moduleName, files]) => (
              <div key={moduleName} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-4 w-1 rounded bg-indigo-500"/>
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
                        className="rounded-xl p-4 flex items-center gap-4 border transition-colors hover:border-slate-600"
                        style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}
                      >
                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
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
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadge(lastRun.status)}`}>
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
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex-shrink-0 ${
                            isRunning
                              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
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

        {/* ---- TAB: SUITES ---- */}
        {activeTab === 'suites' && (
          <div>

            {/* Suite cards */}
            {suitesLoading ? (
              <p className="text-slate-400 text-sm">Loading suites…</p>
            ) : suitesError ? (
              <p className="text-red-400 text-sm">{suitesError}</p>
            ) : suites.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-600/20 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h8m-8 4h4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No suites yet</h3>
                <p className="text-slate-400 text-sm max-w-md">Create a suite to group test files and run them together for CI.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {suites.map(suite => {
                  const isRunning = runningSuiteIds.has(suite.id);
                  const lastStatus = suite.last_run_status;
                  return (
                    <div key={suite.id} className="rounded-xl p-5 border transition-colors hover:border-slate-600"
                      style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-semibold text-white">{suite.name}</span>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${STATUS_STYLES[suite.last_run_status] || 'bg-indigo-600/15 text-indigo-300 border-indigo-600/20'}`}>{suite.device_profile}</span>
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-700/60 text-slate-400 border border-slate-600">{suite.file_count ?? 0} file{suite.file_count !== 1 ? 's' : ''}</span>
                            {lastStatus && (
                              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${STATUS_STYLES[lastStatus]}`}>{STATUS_LABEL[lastStatus] || lastStatus}</span>
                            )}
                          </div>
                          {suite.description && (
                            <p className="text-slate-400 text-sm mt-1 truncate">{suite.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => runSuite(suite)}
                            disabled={isRunning}
                            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-2 rounded-xl transition-colors"
                          >
                            {isRunning ? (
                              <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Running…</>
                            ) : (
                              <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Run</>
                            )}
                          </button>
                          <button
                            onClick={() => openEditSuite(suite)}
                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button
                            onClick={() => deleteSuite(suite.id)}
                            className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Suite Runs History */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">Suite Run History</h3>
                <button
                  onClick={fetchSuiteRuns}
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                  title="Refresh"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>
              {suiteRunsLoading ? (
                <p className="text-slate-400 text-sm">Loading…</p>
              ) : suiteRuns.length === 0 ? (
                <p className="text-slate-500 text-sm">No suite runs yet.</p>
              ) : (
                <div className="space-y-2">
                  {suiteRuns.map(run => {
                    const isRunning = run.status === 'running';
                    return (
                      <div key={run.id} className="flex items-center gap-4 rounded-xl border px-4 py-3 text-sm transition-colors"
                        style={{ borderColor: 'rgb(var(--border-primary))' }}>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0 ${STATUS_STYLES[run.status] || STATUS_STYLES.pending}`}>
                          {run.status === 'running' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />}
                          {STATUS_LABEL[run.status] || run.status}
                        </span>
                        <span className="text-white flex-1 font-medium truncate">{run.suite_name}</span>
                        <span className="text-slate-400 text-xs">{run.device_profile}</span>
                        <span className="text-slate-400 text-xs">{run.passed_files}/{run.total_files} passed</span>
                        <span className="text-slate-500 text-xs">{new Date(run.started_at).toLocaleString()}</span>
                        <button
                          onClick={() => viewSuiteRunDetail(run)}
                          className="text-indigo-400 hover:text-indigo-300 p-1.5 rounded-lg hover:bg-slate-700 transition-colors flex-shrink-0"
                          title="View"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                        <button
                          onClick={() => deleteSuiteRun(run.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-600/20 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No runs yet</h3>
                <p className="text-slate-400 text-sm">Go to the Files tab, pick a device and click Run on Device.</p>
              </div>
            )}

            {!runsLoading && executions.length > 0 && (
              <div className="space-y-2">
                {executions.map(exec => (
                  <div
                    key={exec.id}
                    className="rounded-xl px-4 py-3 flex items-center gap-4 border transition-colors hover:border-slate-600"
                    style={{ borderColor: 'rgb(var(--border-primary))' }}
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
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${deviceBadgeClass(exec.device_profile)}`}>
                          {exec.device_profile}
                        </span>
                        <span className="text-slate-500 text-xs">{formatDate(exec.started_at)}</span>
                      </div>
                    </div>

                    {/* Duration */}
                    <div className="text-right hidden sm:block">
                      <p className="text-slate-400 text-xs">{formatDuration(exec.duration_ms)}</p>
                    </div>

                    {/* Status badge */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border w-24 justify-center flex-shrink-0 ${statusBadge(exec.status)}`}>
                      <StatusDot status={exec.status}/>
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => viewExecution(exec)}
                        className="text-slate-400 hover:text-indigo-400 p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
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

      {/* Result modal */}
      {viewExec && (
        <ResultModal
          execution={viewExec}
          onClose={() => setViewExec(null)}
        />
      )}

      {/* Suite create/edit modal */}
      {showSuiteModal && (
        <SuiteModal
          suite={editingSuite}
          testFiles={testFiles}
          onClose={() => { setShowSuiteModal(false); setEditingSuite(null); }}
          onSave={saveSuite}
        />
      )}

      {/* Suite run detail modal */}
      {viewSuiteRun && (
        <SuiteRunModal
          run={viewSuiteRun}
          onClose={() => setViewSuiteRun(null)}
          onViewExec={(exec) => setViewExec(exec)}
        />
      )}
    </div>
  );
}