import React, { useState, useEffect, useCallback } from 'react';
import API_URL from '../apiUrl';

// ---------------------------------------------------------------------------
// Device catalogue
// ---------------------------------------------------------------------------
const DEVICE_GROUPS = [
  { group: '📱 iPhone', devices: ['iPhone SE', 'iPhone 15', 'iPhone 15 Pro Max'] },
  { group: '🤖 Android', devices: ['Pixel 7', 'Galaxy S9+'] },
  { group: '📟 Tablet', devices: ['iPad Mini', 'iPad Pro 11'] },
  { group: '⚙️ Custom', devices: ['Custom'] },
];

const ALL_DEVICES = DEVICE_GROUPS.flatMap(g => g.devices);

function deviceEmoji(profile) {
  if (!profile) return '📱';
  const p = profile.toLowerCase();
  if (p.includes('iphone') || p.includes('ipad')) return '🍎';
  if (p.includes('pixel') || p.includes('galaxy') || p.includes('android')) return '🤖';
  if (p.includes('tablet') || p.includes('ipad')) return '📟';
  return '📱';
}

function deviceBadgeColor(profile) {
  if (!profile) return 'bg-slate-700 text-slate-300';
  const p = profile.toLowerCase();
  if (p.includes('iphone') || p.includes('ipad')) return 'bg-blue-500/20 text-blue-300';
  if (p.includes('pixel') || p.includes('galaxy')) return 'bg-green-500/20 text-green-300';
  return 'bg-purple-500/20 text-purple-300';
}

const auth = () => {
  const t = localStorage.getItem('auth_token');
  return t ? { 'x-auth-token': t } : {};
};

// ---------------------------------------------------------------------------
// TestModal — create / edit
// ---------------------------------------------------------------------------
function TestModal({ test, onClose, onSave, aiEnabled }) {
  const parseExtraPages = (val) => {
    if (!val) return '';
    if (Array.isArray(val)) return val.join('\n');
    try { return JSON.parse(val).join('\n'); } catch { return val; }
  };

  const [form, setForm] = useState({
    name: test?.name || '',
    description: test?.description || '',
    device_profile: test?.device_profile || 'iPhone 15',
    target_url: test?.target_url || '',
    extra_pages: parseExtraPages(test?.extra_pages),
    custom_script: test?.custom_script || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) return setError('Name is required');
    if (!form.target_url.trim()) return setError('Target URL is required');
    setSaving(true);
    setError('');
    const extra_pages = form.extra_pages.split('\n').map(l => l.trim()).filter(Boolean);
    await onSave({ ...form, extra_pages });
    setSaving(false);
  };

  const handleGenScript = async () => {
    if (!aiInstruction.trim()) return;
    setAiLoading(true);
    setAiError('');
    try {
      const r = await fetch(`${API_URL}/mobile-ai/script-gen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({
          instruction: aiInstruction,
          device_profile: form.device_profile,
          target_url: form.target_url || '',
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'AI request failed');
      setForm(f => ({ ...f, custom_script: data.script }));
      setAiError('');
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border shadow-2xl p-6 space-y-4"
        style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
        <h2 className="text-lg font-semibold">{test ? 'Edit Mobile Test' : 'New Mobile Test'}</h2>

        {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

        <div className="space-y-3">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full rounded-xl px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500"
              style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-primary))', color: 'rgb(var(--text-primary))' }}
              placeholder="Mobile Homepage Check" />
          </div>

          {/* Device profile */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Device Profile *</label>
            <select value={form.device_profile} onChange={e => setForm(f => ({ ...f, device_profile: e.target.value }))}
              className="w-full rounded-xl px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500"
              style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-primary))', color: 'rgb(var(--text-primary))' }}>
              {DEVICE_GROUPS.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.devices.map(d => <option key={d} value={d}>{d}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Target URL */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Target URL *</label>
            <input value={form.target_url} onChange={e => setForm(f => ({ ...f, target_url: e.target.value }))}
              className="w-full rounded-xl px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500"
              style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-primary))', color: 'rgb(var(--text-primary))' }}
              placeholder="https://example.com" />
          </div>

          {/* Extra pages */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Additional pages (one URL per line)</label>
            <textarea value={form.extra_pages} onChange={e => setForm(f => ({ ...f, extra_pages: e.target.value }))} rows={3}
              className="w-full rounded-xl px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono resize-none"
              style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-primary))', color: 'rgb(var(--text-primary))' }}
              placeholder="https://example.com/shop&#10;https://example.com/checkout" />
          </div>

          {/* Custom script */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>Custom Script (optional Playwright body)</label>
              {aiEnabled && (
                <button onClick={() => setShowAiPanel(v => !v)}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14v-4H7l5-8v4h4l-5 8z"/></svg>
                  {showAiPanel ? 'Hide AI Generator' : 'AI Script Generator'}
                </button>
              )}
            </div>

            {/* AI Script Generator panel */}
            {aiEnabled && showAiPanel && (
              <div className="mb-2 rounded-xl p-3 border space-y-2"
                style={{ backgroundColor: 'rgb(15,23,42)', borderColor: 'rgba(99,102,241,0.3)' }}>
                <p className="text-xs font-semibold text-indigo-400">Generate mobile script with AI</p>
                <textarea value={aiInstruction} onChange={e => setAiInstruction(e.target.value)} rows={2}
                  className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                  style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-primary))', color: 'rgb(var(--text-primary))' }}
                  placeholder="e.g. Tap the hamburger menu, navigate to Product page, verify Buy button is visible" />
                {aiError && <p className="text-xs text-red-400">{aiError}</p>}
                <button onClick={handleGenScript} disabled={aiLoading || !aiInstruction.trim()}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 transition-colors disabled:opacity-50">
                  {aiLoading ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14v-4H7l5-8v4h4l-5 8z"/></svg>
                  )}
                  {aiLoading ? 'Generating...' : 'Generate Script'}
                </button>
              </div>
            )}

            <textarea value={form.custom_script} onChange={e => setForm(f => ({ ...f, custom_script: e.target.value }))} rows={5}
              className="w-full rounded-xl px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono resize-y"
              style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-primary))', color: 'rgb(var(--text-primary))' }}
              placeholder="// Playwright steps run on the mobile page&#10;// e.g. await page.tap('.menu-btn');&#10;// await page.waitForSelector('.nav-open');" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              className="w-full rounded-xl px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-primary))', color: 'rgb(var(--text-primary))' }}
              placeholder="Optional description" />
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm border transition-colors hover:bg-slate-700"
            style={{ borderColor: 'rgb(var(--border-primary))' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-xl text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : (test ? 'Save Changes' : 'Create Test')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResultModal — shows per-page results with screenshots
// ---------------------------------------------------------------------------
function ResultModal({ execution, onClose }) {
  const results = Array.isArray(execution.results_json)
    ? execution.results_json
    : (execution.results_json ? JSON.parse(execution.results_json) : []);

  const [expanded, setExpanded] = useState(0);

  const statusColor = (s) => {
    if (s === 'passed') return 'bg-green-500/20 text-green-400';
    if (s === 'failed') return 'bg-red-500/20 text-red-400';
    return 'bg-slate-700 text-slate-400';
  };

  const overallColor = execution.status === 'passed' ? 'text-green-400'
    : execution.status === 'failed' ? 'text-red-400'
    : execution.status === 'running' ? 'text-blue-400' : 'text-slate-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl p-6 space-y-5"
        style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{execution.test_name}</h2>
            <p className="text-sm mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>
              {execution.device_profile} · {new Date(execution.started_at).toLocaleString()}
              · <span className={`font-medium ${overallColor}`}>{execution.status}</span>
              · {results.length} page{results.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-700 transition-colors text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {execution.error_message && (
          <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {execution.error_message}
          </div>
        )}

        {results.length === 0 && execution.status !== 'running' && (
          <p className="text-sm text-center py-8" style={{ color: 'rgb(var(--text-secondary))' }}>No page results recorded.</p>
        )}

        {/* Per-page accordion */}
        <div className="space-y-3">
          {results.map((page, idx) => {
            const isOpen = expanded === idx;
            return (
              <div key={idx} className="rounded-xl border overflow-hidden"
                style={{ borderColor: page.status === 'failed' ? 'rgba(239,68,68,0.3)' : 'rgb(var(--border-primary))' }}>
                {/* Accordion header */}
                <button onClick={() => setExpanded(isOpen ? -1 : idx)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/40 transition-colors"
                  style={{ backgroundColor: 'rgb(var(--bg-elevated))' }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(page.status)}`}>
                      {page.status}
                    </span>
                    <span className="text-sm truncate" style={{ color: 'rgb(var(--text-primary))' }}>{page.url}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className="text-xs" style={{ color: 'rgb(var(--text-tertiary))' }}>
                      {page.load_time_ms != null ? `${page.load_time_ms}ms` : ''}
                    </span>
                    {(page.console_errors || []).length > 0 && (
                      <span className="text-xs text-red-400 font-medium">
                        {page.console_errors.length} console error{page.console_errors.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    <svg className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Accordion body */}
                {isOpen && (
                  <div className="px-4 pb-4 pt-2 space-y-4 border-t" style={{ borderColor: 'rgb(var(--border-primary))' }}>
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-primary))' }}>
                        <p className="text-lg font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{page.load_time_ms != null ? `${page.load_time_ms}ms` : '—'}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-tertiary))' }}>Load Time</p>
                      </div>
                      <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-primary))' }}>
                        <p className={`text-lg font-bold ${page.status === 'passed' ? 'text-green-400' : 'text-red-400'}`}>{page.status}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-tertiary))' }}>Status</p>
                      </div>
                      <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-primary))' }}>
                        <p className={`text-lg font-bold ${(page.console_errors || []).length > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {(page.console_errors || []).length}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-tertiary))' }}>Console Errors</p>
                      </div>
                    </div>

                    {/* Console errors */}
                    {(page.console_errors || []).length > 0 && (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--text-tertiary))' }}>Console Errors</p>
                        <div className="space-y-1">
                          {page.console_errors.map((err, i) => (
                            <p key={i} className="text-xs font-mono text-red-400 bg-red-500/10 rounded-lg px-3 py-1.5 break-all">{err}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Screenshot */}
                    {page.screenshot_base64 && (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--text-tertiary))' }}>Screenshot</p>
                        <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgb(var(--border-primary))' }}>
                          <img
                            src={`data:image/jpeg;base64,${page.screenshot_base64}`}
                            alt={`Screenshot of ${page.url}`}
                            className="w-full h-auto max-h-[500px] object-contain"
                            style={{ backgroundColor: '#0f172a' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main MobileTests component
// ---------------------------------------------------------------------------
export default function MobileTests({ orgInfo }) {
  const [tab, setTab] = useState('tests');
  const [tests, setTests] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testModal, setTestModal] = useState(null); // null | 'new' | test object
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [runningIds, setRunningIds] = useState(new Set());
  const [pollingIds, setPollingIds] = useState(new Set());

  const aiEnabled = !!orgInfo?.ai_healing_enabled;

  const loadTests = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/mobile-tests`, { headers: auth() });
      if (r.ok) setTests(await r.json());
    } catch {}
  }, []);

  const loadRuns = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/mobile-tests/executions/all`, { headers: auth() });
      if (r.ok) setRuns(await r.json());
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadTests(), loadRuns()]);
      setLoading(false);
    })();
  }, []);

  // Polling for running executions
  useEffect(() => {
    if (pollingIds.size === 0) return;
    const intervalId = setInterval(async () => {
      for (const execId of pollingIds) {
        try {
          const r = await fetch(`${API_URL}/mobile-tests/executions/${execId}`, { headers: auth() });
          if (r.ok) {
            const exec = await r.json();
            if (exec.status !== 'running') {
              setPollingIds(prev => { const s = new Set(prev); s.delete(execId); return s; });
              setRuns(prev => prev.map(e => e.id === execId ? exec : e));
              setRunningIds(prev => { const s = new Set(prev); s.delete(exec.test_id); return s; });
            }
          }
        } catch {}
      }
    }, 2500);
    return () => clearInterval(intervalId);
  }, [pollingIds]);

  const handleRun = async (test) => {
    setRunningIds(prev => new Set([...prev, test.id]));
    try {
      const r = await fetch(`${API_URL}/mobile-tests/${test.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Run failed'); }
      const { executionId } = await r.json();
      const placeholder = {
        id: executionId,
        test_id: test.id,
        test_name: test.name,
        device_profile: test.device_profile,
        status: 'running',
        started_at: new Date().toISOString(),
        results_json: [],
      };
      setRuns(prev => [placeholder, ...prev]);
      setPollingIds(prev => new Set([...prev, executionId]));
      setTab('runs');
    } catch (err) {
      alert(err.message);
      setRunningIds(prev => { const s = new Set(prev); s.delete(test.id); return s; });
    }
  };

  const handleSaveTest = async (form) => {
    const isEdit = testModal && testModal !== 'new';
    const url = isEdit ? `${API_URL}/mobile-tests/${testModal.id}` : `${API_URL}/mobile-tests`;
    const r = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify(form),
    });
    const data = await r.json();
    if (!r.ok) { alert(data.error || 'Save failed'); return; }
    if (isEdit) {
      setTests(prev => prev.map(t => t.id === data.id ? data : t));
    } else {
      setTests(prev => [data, ...prev]);
    }
    setTestModal(null);
  };

  const handleDeleteTest = async (test) => {
    if (!confirm(`Delete "${test.name}"? All run history will also be deleted.`)) return;
    const r = await fetch(`${API_URL}/mobile-tests/${test.id}`, { method: 'DELETE', headers: auth() });
    if (r.ok) {
      setTests(prev => prev.filter(t => t.id !== test.id));
      setRuns(prev => prev.filter(e => e.test_id !== test.id));
    }
  };

  const handleDeleteRun = async (run) => {
    if (!confirm('Delete this run?')) return;
    const r = await fetch(`${API_URL}/mobile-tests/executions/${run.id}`, { method: 'DELETE', headers: auth() });
    if (r.ok) setRuns(prev => prev.filter(e => e.id !== run.id));
  };

  const openExecution = async (run) => {
    if (!run.results_json || (Array.isArray(run.results_json) && run.results_json.length === 0 && run.status !== 'running')) {
      try {
        const r = await fetch(`${API_URL}/mobile-tests/executions/${run.id}`, { headers: auth() });
        if (r.ok) { setSelectedExecution(await r.json()); return; }
      } catch {}
    }
    setSelectedExecution(run);
  };

  // -------------------------------------------------------------------------
  // Summary helpers
  // -------------------------------------------------------------------------
  const calcDuration = (run) => {
    if (!run.started_at || !run.ended_at) return null;
    const ms = new Date(run.ended_at) - new Date(run.started_at);
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="w-6 h-6 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Mobile Testing</h1>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
            Device emulation via Playwright — iPhone, Android &amp; Tablet profiles
            {aiEnabled && <span className="ml-2 text-xs text-indigo-400 font-medium">· AI Script Generator enabled</span>}
          </p>
        </div>
        {tab === 'tests' && (
          <button onClick={() => setTestModal('new')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium shadow-lg shadow-indigo-600/30 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Test
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b pb-0" style={{ borderColor: 'rgb(var(--border-primary))' }}>
        {[
          { key: 'tests', label: 'Tests', count: tests.length },
          { key: 'runs', label: 'Runs', count: runs.length },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors relative -mb-px border-b-2 ${
              tab === t.key ? 'text-indigo-400 border-indigo-500' : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}>
            {t.label}
            {t.count > 0 && (
              <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ---- TESTS TAB ---- */}
      {tab === 'tests' && (
        <div>
          {tests.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium">No mobile tests yet</p>
              <p className="text-xs mt-1 mb-4" style={{ color: 'rgb(var(--text-tertiary))' }}>
                Create a test to run device-emulated Playwright checks
              </p>
              <button onClick={() => setTestModal('new')}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
                Create your first test
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {tests.map(test => {
                const isRunning = runningIds.has(test.id);
                const recentRun = runs.find(r => r.test_id === test.id);
                const pages = [test.target_url, ...(Array.isArray(test.extra_pages)
                  ? test.extra_pages
                  : (test.extra_pages ? JSON.parse(test.extra_pages || '[]') : []))].filter(Boolean);

                return (
                  <div key={test.id}
                    className="rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-indigo-500/40 transition-colors"
                    style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{test.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${deviceBadgeColor(test.device_profile)}`}>
                          {deviceEmoji(test.device_profile)} {test.device_profile}
                        </span>
                        {recentRun && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            recentRun.status === 'passed' ? 'bg-green-500/20 text-green-400' :
                            recentRun.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                            recentRun.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-slate-700 text-slate-400'
                          }`}>
                            {recentRun.status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'rgb(var(--text-secondary))' }}>{test.target_url}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {pages.length > 1 && (
                          <span className="text-xs" style={{ color: 'rgb(var(--text-tertiary))' }}>
                            {pages.length} pages
                          </span>
                        )}
                        {test.custom_script?.trim() && (
                          <span className="text-xs text-purple-400">has custom script</span>
                        )}
                        {test.description && (
                          <span className="text-xs text-slate-500 truncate max-w-[300px]">{test.description}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {recentRun && recentRun.status !== 'running' && (
                        <button onClick={() => openExecution(recentRun)}
                          className="px-3 py-1.5 rounded-lg text-xs border hover:bg-slate-700 transition-colors"
                          style={{ borderColor: 'rgb(var(--border-primary))' }}>
                          Last Run
                        </button>
                      )}
                      <button onClick={() => handleRun(test)} disabled={isRunning}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-60">
                        {isRunning ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            Running…
                          </>
                        ) : 'Run Test'}
                      </button>
                      <button onClick={() => setTestModal(test)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-700 transition-colors text-slate-400" title="Edit">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button onClick={() => handleDeleteTest(test)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-900/30 transition-colors text-slate-400 hover:text-red-400" title="Delete">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---- RUNS TAB ---- */}
      {tab === 'runs' && (
        <div>
          {runs.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>No runs yet</p>
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-tertiary))' }}>Go to Tests tab and run a mobile test</p>
            </div>
          ) : (
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'rgb(var(--border-primary))' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderBottom: '1px solid rgb(var(--border-primary))' }}>
                    {['Test', 'Device', 'Status', 'Pages', 'Duration', 'Started', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider"
                        style={{ color: 'rgb(var(--text-tertiary))' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'rgb(var(--border-primary))' }}>
                  {runs.map(run => {
                    const pages = Array.isArray(run.results_json)
                      ? run.results_json.length
                      : (run.results_json ? JSON.parse(run.results_json || '[]').length : 0);
                    return (
                      <tr key={run.id} className="hover:bg-slate-800/30 transition-colors group">
                        <td className="px-4 py-3 font-medium truncate max-w-[160px]">{run.test_name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${deviceBadgeColor(run.device_profile)}`}>
                            {deviceEmoji(run.device_profile)} {run.device_profile}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            run.status === 'passed' ? 'bg-green-500/20 text-green-400' :
                            run.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                            run.status === 'error' ? 'bg-orange-500/20 text-orange-400' :
                            run.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-slate-700 text-slate-400'
                          }`}>
                            {run.status === 'running' ? (
                              <span className="flex items-center gap-1">
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                </svg>
                                running
                              </span>
                            ) : run.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-tertiary))' }}>
                          {run.status === 'running' ? '—' : pages}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-tertiary))' }}>
                          {calcDuration(run) || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-tertiary))' }}>
                          {new Date(run.started_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {run.status !== 'running' && (
                              <button onClick={() => openExecution(run)}
                                className="px-2 py-1 rounded-lg text-xs bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 transition-colors">
                                View
                              </button>
                            )}
                            <button onClick={() => handleDeleteRun(run)}
                              className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-900/30 text-slate-500 hover:text-red-400 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {testModal && (
        <TestModal
          test={testModal !== 'new' ? testModal : null}
          onClose={() => setTestModal(null)}
          onSave={handleSaveTest}
          aiEnabled={aiEnabled}
        />
      )}
      {selectedExecution && (
        <ResultModal
          execution={selectedExecution}
          onClose={() => setSelectedExecution(null)}
        />
      )}
    </div>
  );
}
