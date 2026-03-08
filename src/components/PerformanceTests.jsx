import React, { useState, useEffect, useRef, useCallback } from 'react';
import API_URL from '../apiUrl';

const TEMPLATES = [
  { id: 'smoke',  label: 'Smoke',  desc: 'Minimal load — sanity check (2 VUs, ~2 min)',       color: 'text-green-400',  bg: 'bg-green-400/10',  defaults: { vus: 2,   ramp_duration: 30,  hold_duration: 120  } },
  { id: 'load',   label: 'Load',   desc: 'Typical expected traffic',                             color: 'text-blue-400',   bg: 'bg-blue-400/10',   defaults: { vus: 10,  ramp_duration: 60,  hold_duration: 300  } },
  { id: 'soak',   label: 'Soak',   desc: 'Sustained load over long period (memory leaks)',       color: 'text-yellow-400', bg: 'bg-yellow-400/10', defaults: { vus: 20,  ramp_duration: 120, hold_duration: 7200 }, enterprise: true },
  { id: 'spike',  label: 'Spike',  desc: '10× sudden VU burst (resilience check)',               color: 'text-orange-400', bg: 'bg-orange-400/10', defaults: { vus: 100, ramp_duration: 10,  hold_duration: 60   }, enterprise: true },
  { id: 'stress', label: 'Stress', desc: 'Ramp until failure — find breaking point',             color: 'text-red-400',    bg: 'bg-red-400/10',    defaults: { vus: 50,  ramp_duration: 300, hold_duration: 600  }, enterprise: true },
];

const METRIC_OPTIONS = ['p95', 'p99', 'p50', 'avg_latency', 'error_rate'];
const OPERATOR_OPTIONS = ['<', '>', '<=', '>='];

const STATUS_STYLES = {
  running:           'bg-blue-400/15 text-blue-300 border-blue-400/30',
  passed:            'bg-green-400/15 text-green-300 border-green-400/30',
  thresholds_failed: 'bg-yellow-400/15 text-yellow-300 border-yellow-400/30',
  failed:            'bg-red-400/15 text-red-300 border-red-400/30',
  pending:           'bg-slate-400/15 text-slate-300 border-slate-400/30',
};

const STATUS_LABEL = {
  running:           'Running',
  passed:            'Passed',
  thresholds_failed: 'Thresholds Failed',
  failed:            'Failed',
  pending:           'Pending',
};

function fmt(ms) {
  if (ms == null || isNaN(ms)) return '—';
  return `${ms.toFixed(0)} ms`;
}

function fmtRate(r) {
  if (r == null || isNaN(r)) return '—';
  return `${r.toFixed(2)}/s`;
}

function fmtDatetime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString();
}

function fmtDuration(s, e) {
  if (!s || !e) return '—';
  const ms = new Date(e) - new Date(s);
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini sparkline (SVG)
// ─────────────────────────────────────────────────────────────────────────────
function Sparkline({ data, valueKey, color = '#818cf8', height = 40, width = 120 }) {
  if (!data || data.length < 2) return <span className="text-slate-600 text-xs">—</span>;
  const values = data.map(d => parseFloat(d[valueKey]) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Threshold row editor
// ─────────────────────────────────────────────────────────────────────────────
function ThresholdEditor({ thresholds, onChange, testId, aiEnabled }) {
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState(null);

  const add = () => onChange([...thresholds, { metric: 'p95', operator: '<', value: '2000' }]);
  const remove = (i) => onChange(thresholds.filter((_, idx) => idx !== i));
  const update = (i, field, val) => onChange(thresholds.map((t, idx) => idx === i ? { ...t, [field]: val } : t));

  const fetchSuggestions = async () => {
    if (!testId) return;
    setSuggesting(true);
    try {
      const r = await fetch(`${API_URL}/perf-ai/threshold-recommendations/${testId}`, {
        headers: { 'x-auth-token': localStorage.getItem('auth_token') },
      });
      setSuggestions(await r.json());
    } catch {} finally { setSuggesting(false); }
  };

  const applySuggestion = (s) => {
    onChange([...thresholds, { metric: s.metric, operator: s.operator, value: String(s.value) }]);
    setSuggestions(prev => prev ? { ...prev, suggestions: prev.suggestions.filter(x => x.metric !== s.metric) } : prev);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Thresholds</span>
        <div className="flex items-center gap-3">
          {testId && aiEnabled && (
            <button type="button" onClick={fetchSuggestions} disabled={suggesting}
              className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 disabled:opacity-50">
              {suggesting ? 'Loading…' : (
                <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg> AI Suggest</>
              )}
            </button>
          )}
          <button type="button" onClick={add} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">+ Add</button>
        </div>
      </div>

      {suggestions?.suggestions?.length > 0 && (
        <div className="mb-3 bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 space-y-2">
          <p className="text-xs font-medium text-purple-300">AI suggestions based on {suggestions.runCount} run{suggestions.runCount !== 1 ? 's' : ''}</p>
          {suggestions.suggestions.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="font-mono text-slate-300">{s.metric} {s.operator} {s.value}</span>
              <span className="text-slate-500 flex-1 text-right truncate hidden sm:block">{s.rationale}</span>
              <button type="button" onClick={() => applySuggestion(s)}
                className="text-purple-400 hover:text-purple-300 border border-purple-500/30 rounded-lg px-2 py-0.5 flex-shrink-0">
                Apply
              </button>
            </div>
          ))}
        </div>
      )}
      {suggestions?.message && (
        <p className="text-xs text-slate-500 italic mb-2">{suggestions.message}</p>
      )}

      {thresholds.length === 0 && (
        <p className="text-xs text-slate-500 italic">No thresholds — test always passes.</p>
      )}
      <div className="space-y-2">
        {thresholds.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <select value={t.metric} onChange={e => update(i, 'metric', e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500">
              {METRIC_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={t.operator} onChange={e => update(i, 'operator', e.target.value)}
              className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500">
              {OPERATOR_OPTIONS.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
            <input type="number" value={t.value} onChange={e => update(i, 'value', e.target.value)}
              className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              placeholder="value" />
            <button type="button" onClick={() => remove(i)} className="text-slate-500 hover:text-red-400 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create / Edit modal (with folder picker)
// ─────────────────────────────────────────────────────────────────────────────
function TestModal({ test, onClose, onSave, plan, folders, aiEnabled }) {
  const isEnterprise = plan === 'enterprise';
  const [form, setForm] = useState({
    name: test?.name || '',
    description: test?.description || '',
    template: test?.template || 'load',
    target_url: test?.target_url || '',
    vus: test?.vus ?? 10,
    ramp_duration: test?.ramp_duration ?? 60,
    hold_duration: test?.hold_duration ?? 300,
    thresholds_json: test?.thresholds_json || [],
    folder_id: test?.folder_id || '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const selectedTpl = TEMPLATES.find(t => t.id === form.template);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setErr('Name is required'); return; }
    if (!form.target_url.trim()) { setErr('Target URL is required'); return; }
    setSaving(true);
    setErr('');
    try {
      const token = localStorage.getItem('auth_token');
      const url = test ? `${API_URL}/performance-tests/${test.id}` : `${API_URL}/performance-tests`;
      const method = test ? 'PUT' : 'POST';
      const body = { ...form, folder_id: form.folder_id || null };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Save failed');
      }
      const saved = await res.json();
      onSave(saved);
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgb(var(--border-primary))' }}>
          <h2 className="text-lg font-semibold text-white">{test ? 'Edit Performance Test' : 'New Performance Test'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[80vh] space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Test Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="Homepage Load Test" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
            <input value={form.description} onChange={e => set('description', e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="Optional description" />
          </div>

          {/* Folder */}
          {folders && folders.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Folder</label>
              <select value={form.folder_id} onChange={e => set('folder_id', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors">
                <option value="">No folder</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          )}

          {/* Template picker */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Template *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 lg:grid-cols-5">
              {TEMPLATES.map(tpl => {
                const locked = tpl.enterprise && !isEnterprise;
                return (
                  <button key={tpl.id} type="button"
                    disabled={locked}
                    onClick={() => { if (!locked) { setForm(f => ({ ...f, template: tpl.id, ...tpl.defaults })); } }}
                    className={`relative p-3 rounded-xl border text-left transition-all ${locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:border-indigo-500/50'}
                      ${form.template === tpl.id ? 'border-indigo-500 bg-indigo-600/10' : 'border-slate-700 bg-slate-900/50'}`}>
                    {locked && (
                      <span className="absolute top-1 right-1">
                        <svg className="w-3 h-3 text-slate-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                      </span>
                    )}
                    <span className={`text-xs font-semibold ${locked ? 'text-slate-500' : tpl.color}`}>{tpl.label}</span>
                    <p className="text-xs text-slate-500 mt-0.5 leading-tight">{tpl.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target URL */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Target URL *</label>
            <input value={form.target_url} onChange={e => set('target_url', e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="https://your-app.example.com/api/health" />
          </div>

          {/* VUs + Durations */}
          {form.template !== 'smoke' && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Virtual Users</label>
                <input type="number" min={1} max={500} value={form.vus} onChange={e => set('vus', parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Ramp-up (s)</label>
                <input type="number" min={5} value={form.ramp_duration} onChange={e => set('ramp_duration', parseInt(e.target.value) || 30)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Hold Duration (s)</label>
                <input type="number" min={10} value={form.hold_duration} onChange={e => set('hold_duration', parseInt(e.target.value) || 60)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
            </div>
          )}

          {/* Thresholds */}
          <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
            <ThresholdEditor thresholds={form.thresholds_json} onChange={val => set('thresholds_json', val)} testId={test?.id} aiEnabled={aiEnabled} />
          </div>

          {err && <p className="text-red-400 text-sm">{err}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors text-sm disabled:opacity-60">
              {saving ? 'Saving...' : (test ? 'Update Test' : 'Create Test')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Execution Detail panel
// ─────────────────────────────────────────────────────────────────────────────
function ExecutionDetail({ executionId, onClose, aiEnabled }) {
  const [exec, setExec] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rcaResult, setRcaResult] = useState(null);
  const [rcaLoading, setRcaLoading] = useState(false);
  const [rcaError, setRcaError] = useState('');
  const pollRef = useRef(null);

  const fetchRCA = async (execId) => {
    setRcaLoading(true); setRcaError(''); setRcaResult(null);
    try {
      const r = await fetch(`${API_URL}/perf-ai/root-cause/${execId}`, {
        method: 'POST',
        headers: { 'x-auth-token': localStorage.getItem('auth_token') },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Analysis failed');
      setRcaResult(data.analysis);
    } catch (e) { setRcaError(e.message); } finally { setRcaLoading(false); }
  };

  const safeJson = async (res) => {
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    try { return await res.json(); } catch { return null; }
  };

  const load = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    try {
      const [execRes, metricsRes] = await Promise.all([
        fetch(`${API_URL}/performance-executions/${executionId}`, { headers: { 'x-auth-token': token } }),
        fetch(`${API_URL}/performance-executions/${executionId}/metrics`, { headers: { 'x-auth-token': token } }),
      ]);
      const execData = await safeJson(execRes);
      const metricsData = (await safeJson(metricsRes)) ?? [];
      setExec(execData);
      setMetrics(metricsData);
      return execData?.status;
    } catch (e) {
      console.error('ExecutionDetail load error:', e);
      return null;
    } finally {
      setLoading(false);
    }
  }, [executionId]);

  useEffect(() => {
    let pollCount = 0;
    const MAX_POLLS = 300;
    load().then(status => {
      if (status === 'running' || status === 'pending') {
        pollRef.current = setInterval(async () => {
          pollCount++;
          if (pollCount >= MAX_POLLS) {
            clearInterval(pollRef.current);
            setExec(prev => prev ? { ...prev, status: 'failed', summary_json: { ...prev.summary_json, error: 'Timed out waiting for result' } } : prev);
            setLoading(false);
            return;
          }
          const s = await load().catch(() => null);
          const terminal = ['passed', 'failed', 'thresholds_failed'];
          if (s !== null && terminal.includes(s)) clearInterval(pollRef.current);
        }, 3000);
      }
    }).catch(() => {});
    return () => clearInterval(pollRef.current);
  }, [load]);

  const modalShell = (body) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgb(var(--border-primary))' }}>
          <h2 className="text-lg font-semibold text-white">Execution Detail</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{body}</div>
      </div>
    </div>
  );

  if (loading) return modalShell(
    <div className="flex items-center justify-center h-48">
      <svg className="w-6 h-6 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );

  if (!exec) return modalShell(
    <div className="text-center py-12">
      <p className="text-slate-400 mb-2">Execution not found</p>
      <p className="text-xs text-slate-500">Execution ID: {executionId}</p>
    </div>
  );

  const s = exec.summary_json || {};
  const statusStyle = STATUS_STYLES[exec.status] || STATUS_STYLES.pending;
  const thresholds = exec.threshold_results || [];
  const isRunning = exec.status === 'running' || exec.status === 'pending';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgb(var(--border-primary))' }}>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">{exec.test_name}</h2>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusStyle}`}>
              {isRunning && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />}
              {STATUS_LABEL[exec.status] || exec.status}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isRunning && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-400/10 border border-blue-400/20 text-blue-300 text-sm">
              <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Test is running — results will appear automatically when complete.
            </div>
          )}

          {!isRunning && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Total Requests', value: s.total_requests?.toLocaleString() ?? '—' },
                { label: 'Avg Latency', value: fmt(s.avg_latency) },
                { label: 'P95 Latency', value: fmt(s.p95_latency) },
                { label: 'Error Rate', value: s.error_rate != null ? `${(s.error_rate * 100).toFixed(2)}%` : '—' },
                { label: 'Peak VUs', value: s.peak_vus ?? '—' },
                { label: 'Duration', value: fmtDuration(exec.started_at, exec.ended_at) },
              ].map(m => (
                <div key={m.label} className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/50">
                  <p className="text-xs text-slate-400 mb-1">{m.label}</p>
                  <p className="text-lg font-semibold text-white">{m.value}</p>
                </div>
              ))}
            </div>
          )}

          {thresholds.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Threshold Results</h3>
              <div className="space-y-2">
                {thresholds.map((t, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border text-sm ${t.passed ? 'bg-green-400/5 border-green-400/20' : 'bg-red-400/5 border-red-400/20'}`}>
                    {t.passed
                      ? <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      : <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    }
                    <span className="font-mono text-slate-200">{t.metric} {t.operator} {t.threshold}</span>
                    <span className="ml-auto text-slate-400">
                      actual: <span className={t.passed ? 'text-green-300' : 'text-red-300'}>{t.actual != null ? t.actual.toFixed(2) : '—'}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {metrics.length > 1 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Metrics Over Time</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-2">Avg Latency (ms)</p>
                  <Sparkline data={metrics} valueKey="avg_latency" color="#818cf8" />
                </div>
                <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-2">P95 Latency (ms)</p>
                  <Sparkline data={metrics} valueKey="p95_latency" color="#f59e0b" />
                </div>
                <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-2">Req/s</p>
                  <Sparkline data={metrics} valueKey="req_rate" color="#34d399" />
                </div>
                <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-2">Error Count</p>
                  <Sparkline data={metrics} valueKey="error_count" color="#f87171" />
                </div>
                <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-2">Active VUs</p>
                  <Sparkline data={metrics} valueKey="active_vus" color="#60a5fa" />
                </div>
              </div>
            </div>
          )}

          {s.logs && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">k6 Output</h3>
              <pre className="bg-black/40 border border-slate-700 rounded-xl p-4 text-xs text-slate-400 overflow-x-auto whitespace-pre-wrap max-h-64">{s.logs}</pre>
            </div>
          )}

          {s.error && (
            <div className="p-4 rounded-xl bg-red-400/10 border border-red-400/20 text-red-300 text-sm">
              <strong>Error:</strong> {s.error}
            </div>
          )}

          {/* Root Cause Analysis */}
          {aiEnabled && ['failed', 'thresholds_failed'].includes(exec.status) && (
            <div className="border border-purple-500/20 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-purple-500/5">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                  <span className="text-sm font-medium text-purple-300">AI Root Cause Analysis</span>
                </div>
                {!rcaResult && (
                  <button onClick={() => fetchRCA(exec.id)} disabled={rcaLoading}
                    className="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50">
                    {rcaLoading ? 'Analysing…' : 'Analyse'}
                  </button>
                )}
              </div>
              {rcaError && <p className="px-4 py-2 text-xs text-red-400">{rcaError}</p>}
              {rcaResult && (
                <div className="px-4 py-3 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{rcaResult}</div>
              )}
            </div>
          )}

          <div className="text-xs text-slate-500 space-y-1">
            <p>Started: {fmtDatetime(exec.started_at)}</p>
            {exec.ended_at && <p>Ended: {fmtDatetime(exec.ended_at)}</p>}
            {exec.triggered_by && <p>Triggered by: {exec.triggered_by}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite Execution Detail modal
// ─────────────────────────────────────────────────────────────────────────────
function SuiteExecutionDetail({ suiteExecId, onClose, onViewTestRun }) {
  const [exec, setExec] = useState(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`${API_URL}/perf-suite-executions/${suiteExecId}`, { headers: { 'x-auth-token': token } });
      if (!res.ok) return null;
      const data = await res.json();
      setExec(data);
      return data?.status;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [suiteExecId]);

  useEffect(() => {
    let count = 0;
    load().then(status => {
      if (status === 'running') {
        pollRef.current = setInterval(async () => {
          count++;
          if (count >= 200) { clearInterval(pollRef.current); return; }
          const s = await load().catch(() => null);
          if (s && s !== 'running') clearInterval(pollRef.current);
        }, 3000);
      }
    });
    return () => clearInterval(pollRef.current);
  }, [load]);

  const modalShell = (body) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgb(var(--border-primary))' }}>
          <h2 className="text-lg font-semibold text-white">Suite Run Detail</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{body}</div>
      </div>
    </div>
  );

  if (loading) return modalShell(
    <div className="flex items-center justify-center h-40">
      <svg className="w-6 h-6 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
  if (!exec) return modalShell(<div className="text-center text-slate-400 py-12">Suite execution not found.</div>);

  const isRunning = exec.status === 'running';
  const summary = typeof exec.summary_json === 'string' ? JSON.parse(exec.summary_json || '{}') : (exec.summary_json || {});
  const testResults = summary.test_executions || [];
  const statusStyle = STATUS_STYLES[exec.status] || STATUS_STYLES.pending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgb(var(--border-primary))' }}>
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">{exec.suite_name}</h2>
              <p className="text-xs text-slate-500">Suite Run #{exec.id}</p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusStyle}`}>
              {isRunning && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />}
              {STATUS_LABEL[exec.status] || exec.status}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isRunning && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-400/10 border border-blue-400/20 text-blue-300 text-sm">
              <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Suite is running tests sequentially — live progress below.
            </div>
          )}

          {/* Summary stats */}
          {testResults.length > 0 && !isRunning && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Tests', value: summary.total ?? testResults.length },
                { label: 'Passed', value: summary.passed ?? testResults.filter(t => t.status === 'passed').length, color: 'text-green-400' },
                { label: 'Failed', value: summary.failed ?? testResults.filter(t => t.status !== 'passed').length, color: 'text-red-400' },
              ].map(m => (
                <div key={m.label} className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/50 text-center">
                  <p className="text-xs text-slate-400 mb-1">{m.label}</p>
                  <p className={`text-2xl font-semibold ${m.color || 'text-white'}`}>{m.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Per-test results */}
          {testResults.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Test Results</h3>
              <div className="space-y-2">
                {testResults.map((tr, i) => {
                  const ts = STATUS_STYLES[tr.status] || STATUS_STYLES.pending;
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl border"
                      style={{ borderColor: 'rgb(var(--border-primary))' }}>
                      <span className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${ts}`}>
                        {tr.status === 'running' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />}
                        {STATUS_LABEL[tr.status] || tr.status}
                      </span>
                      <span className="text-sm text-white flex-1 truncate">{tr.test_name}</span>
                      {tr.avg_latency != null && (
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          avg: {fmt(tr.avg_latency)} · p95: {fmt(tr.p95_latency)}
                        </span>
                      )}
                      {tr.execution_id && onViewTestRun && (
                        <button onClick={() => onViewTestRun(tr.execution_id)}
                          className="flex-shrink-0 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                          View →
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {testResults.length === 0 && !isRunning && (
            <p className="text-slate-400 text-sm text-center py-8">No test results available.</p>
          )}

          <div className="text-xs text-slate-500 space-y-1">
            <p>Started: {fmtDatetime(exec.started_at)}</p>
            {exec.ended_at && <p>Ended: {fmtDatetime(exec.ended_at)}</p>}
            {exec.triggered_by && <p>Triggered by: {exec.triggered_by}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite Manage Drawer (slide-in from right)
// ─────────────────────────────────────────────────────────────────────────────
function SuiteDrawer({ suite, allTests, onClose, onRunSuite, canRun }) {
  const [suiteTests, setSuiteTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const authHeader = () => ({ 'x-auth-token': localStorage.getItem('auth_token') });

  const loadTests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/perf-suites/${suite.id}/tests`, { headers: authHeader() });
      if (res.ok) setSuiteTests(await res.json());
    } catch {}
    finally { setLoading(false); }
  }, [suite.id]);

  useEffect(() => { loadTests(); }, [loadTests]);

  const addTest = async (testId) => {
    await fetch(`${API_URL}/perf-suites/${suite.id}/tests`, {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ test_id: testId }),
    });
    loadTests();
  };

  const removeTest = async (testId) => {
    await fetch(`${API_URL}/perf-suites/${suite.id}/tests/${testId}`, {
      method: 'DELETE', headers: authHeader(),
    });
    loadTests();
  };

  const handleRun = async () => {
    if (!canRun) { setError('Upgrade to Pro or higher to run suite.'); return; }
    setRunning(true); setError('');
    try {
      const res = await fetch(`${API_URL}/perf-suites/${suite.id}/run`, {
        method: 'POST', headers: authHeader(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Run failed');
      onRunSuite(data.suiteExecutionId);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const suiteTestIds = new Set(suiteTests.map(t => t.perf_test_id));
  const unaddedTests = allTests.filter(t => !suiteTestIds.has(t.id));

  return (
    <div className="fixed inset-0 z-50 flex" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="ml-auto w-full max-w-lg h-full flex flex-col border-l shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgb(var(--border-primary))' }}>
          <div>
            <h2 className="text-lg font-semibold text-white">{suite.name}</h2>
            <p className="text-xs text-slate-400">{suiteTests.length} test{suiteTests.length !== 1 ? 's' : ''} in suite</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleRun} disabled={running || suiteTests.length === 0 || !canRun}
              title={!canRun ? 'Upgrade to run suites' : suiteTests.length === 0 ? 'Add tests first' : 'Run suite'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${canRun && suiteTests.length > 0 ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400 cursor-not-allowed'} ${running ? 'opacity-60' : ''}`}>
              {running
                ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Starting...</>
                : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Run Suite</>
              }
            </button>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-400/10 border border-red-400/20 text-red-300 text-sm flex items-center justify-between">
            {error}
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300 ml-2">×</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Tests in suite */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Tests in Suite</h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <svg className="w-5 h-5 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : suiteTests.length === 0 ? (
              <p className="text-slate-500 text-sm italic">No tests yet. Add tests from below.</p>
            ) : (
              <div className="space-y-2">
                {suiteTests.map((t, i) => {
                  const tpl = TEMPLATES.find(tp => tp.id === t.template) || TEMPLATES[1];
                  return (
                    <div key={t.perf_test_id} className="flex items-center gap-3 p-3 rounded-xl border"
                      style={{ borderColor: 'rgb(var(--border-primary))' }}>
                      <span className="text-xs text-slate-500 w-5 flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{t.test_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs ${tpl.color}`}>{tpl.label}</span>
                          <span className="text-xs text-slate-500">{t.target_url}</span>
                        </div>
                      </div>
                      <button onClick={() => removeTest(t.perf_test_id)}
                        className="flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        title="Remove from suite">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add tests picker */}
          {unaddedTests.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Add Tests</h3>
              <div className="space-y-2">
                {unaddedTests.map(t => {
                  const tpl = TEMPLATES.find(tp => tp.id === t.template) || TEMPLATES[1];
                  return (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border"
                      style={{ borderColor: 'rgb(var(--border-primary))' }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{t.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs ${tpl.color}`}>{tpl.label}</span>
                          <span className="text-xs text-slate-500 truncate">{t.target_url}</span>
                        </div>
                      </div>
                      <button onClick={() => addTest(t.id)}
                        className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/40 transition-colors text-xs font-medium">
                        + Add
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {unaddedTests.length === 0 && suiteTests.length > 0 && (
            <p className="text-slate-500 text-sm text-center">All available tests are in this suite.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
// Generate k6 Script modal
// ─────────────────────────────────────────────────────────────────────────────
function GenerateScriptModal({ onClose }) {
  const [form, setForm] = useState({ instruction: '', template: 'load', targetUrl: '', vus: 10, ramp_duration: 60, hold_duration: 300 });
  const [loading, setLoading] = useState(false);
  const [script, setScript] = useState('');
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!form.instruction.trim()) { setErr('Describe what you want to test.'); return; }
    setLoading(true); setErr(''); setScript('');
    try {
      const r = await fetch(`${API_URL}/perf-ai/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('auth_token') },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Generation failed');
      setScript(data.script);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  };

  const copy = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgb(var(--border-primary))' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            </div>
            <h2 className="text-lg font-semibold text-white">Generate k6 Script with AI</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Describe what you want to test *</label>
            <textarea value={form.instruction} onChange={e => setForm(f => ({ ...f, instruction: e.target.value }))}
              rows={3} placeholder="e.g. Test the /api/login endpoint — simulate 100 users logging in, browsing products, and checking out. Fail if error rate exceeds 1% or p95 latency exceeds 3000ms."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Template</label>
              <select value={form.template} onChange={e => setForm(f => ({ ...f, template: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Target URL (optional)</label>
              <input value={form.targetUrl} onChange={e => setForm(f => ({ ...f, targetUrl: e.target.value }))}
                placeholder="https://example.com/api"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[['Virtual Users', 'vus', 1], ['Ramp-up (s)', 'ramp_duration', 5], ['Hold Duration (s)', 'hold_duration', 10]].map(([label, key, min]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
                <input type="number" min={min} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: parseInt(e.target.value) || min }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
            ))}
          </div>
          {err && <p className="text-red-400 text-sm">{err}</p>}
          {script && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-300">Generated k6 Script</h3>
                <button onClick={copy} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                  {copied ? '\u2713 Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-black/40 border border-slate-700 rounded-xl p-4 text-xs text-slate-300 overflow-x-auto overflow-y-auto max-h-72 whitespace-pre">{script}</pre>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t flex-shrink-0 flex gap-3" style={{ borderColor: 'rgb(var(--border-primary))' }}>
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm">Close</button>
          <button onClick={generate} disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors text-sm disabled:opacity-60 flex items-center justify-center gap-2">
            {loading
              ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Generating…</>
              : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg> Generate Script</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function PerformanceTests({ orgInfo, currentUser }) {
  const plan = orgInfo?.plan || 'free';
  const canRun = ['pro', 'premium', 'enterprise'].includes(plan);
  const aiEnabled = !!orgInfo?.ai_healing_enabled;

  const [tab, setTab] = useState('tests');          // 'tests' | 'suites' | 'runs'
  const [tests, setTests] = useState([]);
  const [runs, setRuns] = useState([]);
  const [folders, setFolders] = useState([]);
  const [suites, setSuites] = useState([]);
  const [suiteRuns, setSuiteRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tests tab state
  const [selectedFolder, setSelectedFolder] = useState(null);   // null = all
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTest, setEditTest] = useState(null);
  const [selectedExecId, setSelectedExecId] = useState(null);
  const [runningId, setRunningId] = useState(null);
  const [runError, setRunError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);  // { type, id }

  // Suites tab state
  const [showSuiteModal, setShowSuiteModal] = useState(false);
  const [editSuite, setEditSuite] = useState(null);
  const [suiteForm, setSuiteForm] = useState({ name: '', description: '' });
  const [suiteModalSaving, setSuiteModalSaving] = useState(false);
  const [suiteModalErr, setSuiteModalErr] = useState('');
  const [managingSuite, setManagingSuite] = useState(null);
  const [selectedSuiteExecId, setSelectedSuiteExecId] = useState(null);
  const [viewingTestRunFromSuite, setViewingTestRunFromSuite] = useState(null);

  // AI Insights state
  const [aiAnomalies, setAiAnomalies] = useState(null);
  const [aiAnomaliesLoading, setAiAnomaliesLoading] = useState(false);
  const [regressionRunA, setRegressionRunA] = useState('');
  const [regressionRunB, setRegressionRunB] = useState('');
  const [regressionResult, setRegressionResult] = useState(null);
  const [regressionError, setRegressionError] = useState('');
  const [regressionLoading, setRegressionLoading] = useState(false);
  const [smartSuiteResult, setSmartSuiteResult] = useState(null);
  const [smartSuiteLoading, setSmartSuiteLoading] = useState(false);
  const [generateScriptOpen, setGenerateScriptOpen] = useState(false);

  const authHeader = () => ({ 'x-auth-token': localStorage.getItem('auth_token') });

  const safeJson = async (res) => {
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    try { return await res.json(); } catch { return null; }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = authHeader();
      const [testsRes, runsRes, foldersRes, suitesRes, suiteRunsRes] = await Promise.all([
        fetch(`${API_URL}/performance-tests`, { headers }),
        fetch(`${API_URL}/performance-executions`, { headers }),
        fetch(`${API_URL}/perf-folders`, { headers }),
        fetch(`${API_URL}/perf-suites`, { headers }),
        fetch(`${API_URL}/perf-suite-executions`, { headers }),
      ]);
      const [testsData, runsData, foldersData, suitesData, suiteRunsData] = await Promise.all([
        safeJson(testsRes), safeJson(runsRes), safeJson(foldersRes), safeJson(suitesRes), safeJson(suiteRunsRes),
      ]);
      if (testsData !== null) setTests(testsData);
      if (runsData !== null) setRuns(runsData);
      if (foldersData !== null) setFolders(foldersData);
      if (suitesData !== null) setSuites(suitesData);
      if (suiteRunsData !== null) setSuiteRuns(suiteRunsData);
    } catch (e) {
      console.error('perf load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Folder CRUD ──────────────────────────────────────────────────────────
  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    const res = await fetch(`${API_URL}/perf-folders`, {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFolderName.trim() }),
    });
    if (res.ok) {
      const f = await res.json();
      setFolders(prev => [...prev, f]);
    }
    setNewFolderName('');
    setShowFolderInput(false);
  };

  const deleteFolder = async (id) => {
    await fetch(`${API_URL}/perf-folders/${id}`, { method: 'DELETE', headers: authHeader() });
    setFolders(prev => prev.filter(f => f.id !== id));
    if (selectedFolder === id) setSelectedFolder(null);
  };

  // ── Individual test run ───────────────────────────────────────────────────
  const handleRun = async (test) => {
    if (!canRun) { setRunError('Upgrade to Pro or higher to run performance tests.'); return; }
    setRunError('');
    setRunningId(test.id);
    try {
      const res = await fetch(`${API_URL}/performance-tests/${test.id}/run`, {
        method: 'POST', headers: authHeader(),
      });
      const ct = res.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await res.json() : {};
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      const execId = data.executionId;
      if (!execId) throw new Error('Server did not return an execution ID');
      if (data.execution) setRuns(prev => [data.execution, ...prev.filter(r => r.id !== execId)]);
      setTab('runs');
      setSelectedExecId(execId);
      setTimeout(() => loadData(), 2000);
    } catch (e) {
      setRunError(e.message);
    } finally {
      setRunningId(null);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    const urlMap = {
      test: `${API_URL}/performance-tests/${id}`,
      run: `${API_URL}/performance-executions/${id}`,
      suite: `${API_URL}/perf-suites/${id}`,
      suiteRun: `${API_URL}/perf-suite-executions/${id}`,
    };
    await fetch(urlMap[type], { method: 'DELETE', headers: authHeader() });
    setDeleteConfirm(null);
    loadData();
  };

  // ── Suite CRUD ────────────────────────────────────────────────────────────
  const openSuiteModal = (suite = null) => {
    setEditSuite(suite);
    setSuiteForm({ name: suite?.name || '', description: suite?.description || '' });
    setSuiteModalErr('');
    setShowSuiteModal(true);
  };

  const saveSuite = async () => {
    if (!suiteForm.name.trim()) { setSuiteModalErr('Name required'); return; }
    setSuiteModalSaving(true); setSuiteModalErr('');
    try {
      const url = editSuite ? `${API_URL}/perf-suites/${editSuite.id}` : `${API_URL}/perf-suites`;
      const method = editSuite ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(suiteForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      if (editSuite) {
        setSuites(prev => prev.map(s => s.id === data.id ? { ...s, ...data } : s));
      } else {
        setSuites(prev => [{ ...data, test_count: 0 }, ...prev]);
      }
      setShowSuiteModal(false);
    } catch (e) {
      setSuiteModalErr(e.message);
    } finally {
      setSuiteModalSaving(false);
    }
  };

  const tpl = (id) => TEMPLATES.find(t => t.id === id) || TEMPLATES[1];

  // ── AI handlers ───────────────────────────────────────────────────────────────────
  const scanAnomalies = async () => {
    setAiAnomaliesLoading(true);
    try {
      const headers = authHeader();
      const results = await Promise.all(
        tests.map(async (t) => {
          const r = await fetch(`${API_URL}/perf-ai/anomaly/${t.id}`, { headers });
          const data = await r.json();
          return { testId: t.id, testName: t.name, flagged: data.flagged || [], message: data.message };
        })
      );
      setAiAnomalies(results);
    } catch (e) { console.error(e); } finally { setAiAnomaliesLoading(false); }
  };

  const compareRuns = async () => {
    if (!regressionRunA || !regressionRunB) return;
    setRegressionLoading(true); setRegressionResult(null); setRegressionError('');
    try {
      const r = await fetch(`${API_URL}/perf-ai/regression-summary`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ runAId: regressionRunA, runBId: regressionRunB }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Comparison failed');
      setRegressionResult(data.summary);
    } catch (e) { setRegressionError(e.message); } finally { setRegressionLoading(false); }
  };

  const getSmartSuites = async () => {
    setSmartSuiteLoading(true); setSmartSuiteResult(null);
    try {
      const r = await fetch(`${API_URL}/perf-ai/smart-suite`, {
        method: 'POST', headers: { ...authHeader(), 'Content-Type': 'application/json' },
      });
      const data = await r.json();
      if (!r.ok) setSmartSuiteResult({ error: data.error || 'Failed' });
      else setSmartSuiteResult(data);
    } catch (e) { setSmartSuiteResult({ error: e.message }); } finally { setSmartSuiteLoading(false); }
  };

  const createSmartSuite = async (suggestion) => {
    try {
      const r = await fetch(`${API_URL}/perf-suites`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: suggestion.name, description: suggestion.description || '' }),
      });
      const suite = await r.json();
      if (!r.ok) return;
      for (const testId of suggestion.testIds) {
        await fetch(`${API_URL}/perf-suites/${suite.id}/tests`, {
          method: 'POST',
          headers: { ...authHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ test_id: testId }),
        });
      }
      loadData();
      setTab('suites');
    } catch {}
  };

  // Filter tests by folder
  const filteredTests = selectedFolder
    ? tests.filter(t => t.folder_id === selectedFolder || String(t.folder_id) === String(selectedFolder))
    : tests;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Performance Testing</h1>
          <p className="text-slate-400 text-sm mt-1">k6-powered load, stress, and spike tests for your application</p>
        </div>
        {tab === 'tests' && (
          <button onClick={() => { setEditTest(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-indigo-600/30">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Test
          </button>
        )}
        {tab === 'suites' && (
          <button onClick={() => openSuiteModal()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-indigo-600/30">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Suite
          </button>
        )}
        {tab === 'ai' && aiEnabled && (
          <button onClick={() => setGenerateScriptOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-purple-600/30">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            Generate Script
          </button>
        )}
      </div>

      {/* Plan banner */}
      {!canRun && (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-amber-400/10 border border-amber-400/20">
          <svg className="w-5 h-5 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="text-sm text-amber-200">
            You can create test definitions on the free plan, but <strong>running tests requires Pro or higher</strong>.
            <a href="#" className="ml-2 underline text-amber-300 hover:text-amber-200">Upgrade now →</a>
          </p>
        </div>
      )}

      {runError && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-400/10 border border-red-400/20 text-red-300 text-sm">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          {runError}
          <button onClick={() => setRunError('')} className="ml-auto text-red-400 hover:text-red-300">×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: 'rgb(var(--border-primary))' }}>
        {[
          { key: 'tests',  label: `Tests (${tests.length})` },
          { key: 'suites', label: `Suites (${suites.length})` },
          { key: 'runs',   label: `Runs (${runs.length})` },
          ...(aiEnabled ? [{ key: 'ai', label: '\u2728 AI Insights' }] : []),
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${tab === t.key ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="w-6 h-6 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : tab === 'tests' ? (
        /* ── Tests tab (with folder sidebar) ─────────────────────────────── */
        <div className="flex gap-5">
          {/* Folder sidebar */}
          <div className="w-48 flex-shrink-0 space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">Folders</p>
            <button onClick={() => setSelectedFolder(null)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${selectedFolder === null ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
              <span className="truncate flex-1">All Tests</span>
              <span className="text-xs text-slate-500">{tests.length}</span>
            </button>

            {folders.map(f => (
              <div key={f.id} className="group relative">
                <button onClick={() => setSelectedFolder(f.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left pr-7 ${selectedFolder === f.id ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                  <span className="truncate flex-1">{f.name}</span>
                  <span className="text-xs text-slate-500">
                    {tests.filter(t => String(t.folder_id) === String(f.id)).length}
                  </span>
                </button>
                <button onClick={() => deleteFolder(f.id)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center justify-center w-5 h-5 rounded text-slate-500 hover:text-red-400 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}

            {/* Add folder */}
            {showFolderInput ? (
              <div className="px-2">
                <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') { setShowFolderInput(false); setNewFolderName(''); } }}
                  placeholder="Folder name…"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 mb-1" />
                <div className="flex gap-1">
                  <button onClick={createFolder} className="flex-1 text-xs py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">Add</button>
                  <button onClick={() => { setShowFolderInput(false); setNewFolderName(''); }} className="flex-1 text-xs py-1 text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowFolderInput(true)}
                className="w-full flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-indigo-400 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                New Folder
              </button>
            )}
          </div>

          {/* Test list */}
          <div className="flex-1 min-w-0">
            {filteredTests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-600/20 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {selectedFolder ? 'No tests in this folder' : 'No performance tests yet'}
                </h3>
                <p className="text-slate-400 text-sm mb-6 max-w-md">
                  {selectedFolder ? 'Create a test and assign it to this folder.' : 'Create your first performance test to measure how your application handles load.'}
                </p>
                <button onClick={() => { setEditTest(null); setShowModal(true); }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors">
                  Create First Test
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTests.map(test => {
                  const t = tpl(test.template);
                  const isRunning = runningId === test.id;
                  const recentRuns = runs.filter(r => r.perf_test_id === test.id).slice(0, 3);
                  const folder = folders.find(f => String(f.id) === String(test.folder_id));
                  return (
                    <div key={test.id} className="border rounded-xl p-5 transition-colors hover:border-slate-600"
                      style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold text-white">{test.name}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.color} ${t.bg}`}>{t.label}</span>
                            {folder && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 border border-slate-600 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                                {folder.name}
                              </span>
                            )}
                          </div>
                          {test.description && <p className="text-slate-400 text-sm mt-1">{test.description}</p>}
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                              <span className="truncate max-w-xs">{test.target_url}</span>
                            </span>
                            <span>{test.vus} VUs</span>
                            <span>ramp {test.ramp_duration}s</span>
                            <span>hold {test.hold_duration}s</span>
                          </div>
                          {recentRuns.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-3">
                              <span className="text-xs text-slate-500">Recent:</span>
                              {recentRuns.map(r => (
                                <button key={r.id} onClick={() => setSelectedExecId(r.id)}
                                  className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer hover:opacity-80 transition-opacity ${STATUS_STYLES[r.status] || STATUS_STYLES.pending}`}>
                                  {STATUS_LABEL[r.status] || r.status}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => handleRun(test)} disabled={isRunning || !canRun}
                            title={!canRun ? 'Upgrade to run tests' : 'Run test'}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${canRun ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400 cursor-not-allowed'} ${isRunning ? 'opacity-60' : ''}`}>
                            {isRunning
                              ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Running</>
                              : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Run</>
                            }
                          </button>
                          <button onClick={() => { setEditTest(test); setShowModal(true); }}
                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button onClick={() => setDeleteConfirm({ type: 'test', id: test.id })}
                            className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : tab === 'suites' ? (
        /* ── Suites tab ───────────────────────────────────────────────────── */
        <div className="space-y-6">
          {/* Suite list */}
          {suites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-600/20 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h8m-8 4h4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No performance suites yet</h3>
              <p className="text-slate-400 text-sm mb-6 max-w-md">Create a suite to group multiple tests and run them sequentially in CI style.</p>
              <button onClick={() => openSuiteModal()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors">
                Create First Suite
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {suites.map(suite => {
                const recentRuns = suiteRuns.filter(r => r.suite_id === suite.id).slice(0, 3);
                return (
                  <div key={suite.id} className="border rounded-xl p-5 transition-colors hover:border-slate-600"
                    style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-semibold text-white">{suite.name}</h3>
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-600/15 text-purple-300 border border-purple-600/20 font-medium">
                            {suite.test_count ?? 0} test{(suite.test_count ?? 0) !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {suite.description && <p className="text-slate-400 text-sm mt-1">{suite.description}</p>}
                        {recentRuns.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-3">
                            <span className="text-xs text-slate-500">Recent runs:</span>
                            {recentRuns.map(r => {
                              const summary = typeof r.summary_json === 'string' ? JSON.parse(r.summary_json || '{}') : (r.summary_json || {});
                              return (
                                <button key={r.id} onClick={() => setSelectedSuiteExecId(r.id)}
                                  className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer hover:opacity-80 transition-opacity ${STATUS_STYLES[r.status] || STATUS_STYLES.pending}`}>
                                  {r.status === 'running' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1 animate-pulse" />}
                                  {STATUS_LABEL[r.status] || r.status}
                                  {summary.total ? ` ${summary.passed ?? 0}/${summary.total}` : ''}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => setManagingSuite(suite)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors text-sm">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                          Manage
                        </button>
                        <button onClick={() => openSuiteModal(suite)}
                          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => setDeleteConfirm({ type: 'suite', id: suite.id })}
                          className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Suite run history */}
          {suiteRuns.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-white mb-3">Suite Run History</h2>
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgb(var(--border-primary))' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-slate-400 text-xs uppercase tracking-wider" style={{ borderColor: 'rgb(var(--border-primary))', backgroundColor: 'rgb(var(--bg-elevated))' }}>
                      <th className="px-4 py-3 text-left">Suite</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Results</th>
                      <th className="px-4 py-3 text-left">Started</th>
                      <th className="px-4 py-3 text-left">Duration</th>
                      <th className="px-4 py-3 text-left">Triggered By</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ divideColor: 'rgb(var(--border-primary))' }}>
                    {suiteRuns.map(run => {
                      const summary = typeof run.summary_json === 'string' ? JSON.parse(run.summary_json || '{}') : (run.summary_json || {});
                      return (
                        <tr key={run.id} className="transition-colors" style={{ borderColor: 'rgb(var(--border-primary))' }}>
                          <td className="px-4 py-3 text-white font-medium">{run.suite_name}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_STYLES[run.status] || STATUS_STYLES.pending}`}>
                              {run.status === 'running' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />}
                              {STATUS_LABEL[run.status] || run.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs">
                            {summary.total ? `${summary.passed ?? 0}/${summary.total} passed` : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{fmtDatetime(run.started_at)}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{fmtDuration(run.started_at, run.ended_at)}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{run.triggered_by || '—'}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => setSelectedSuiteExecId(run.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              </button>
                              <button onClick={() => setDeleteConfirm({ type: 'suiteRun', id: run.id })}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : tab === 'runs' ? (
        /* ── Runs tab ──────────────────────────────────────────────────────── */
        runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-700/30 border border-slate-700 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No runs yet</h3>
            <p className="text-slate-400 text-sm">Run a performance test to see results here.</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgb(var(--border-primary))' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-400 text-xs uppercase tracking-wider" style={{ borderColor: 'rgb(var(--border-primary))', backgroundColor: 'rgb(var(--bg-elevated))' }}>
                  <th className="px-4 py-3 text-left">Test</th>
                  <th className="px-4 py-3 text-left">Template</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Started</th>
                  <th className="px-4 py-3 text-left">Duration</th>
                  <th className="px-4 py-3 text-left">Triggered By</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ divideColor: 'rgb(var(--border-primary))' }}>
                {runs.map(run => {
                  const t = tpl(run.template);
                  return (
                    <tr key={run.id} className="transition-colors" style={{ borderColor: 'rgb(var(--border-primary))' }}>
                      <td className="px-4 py-3 text-white font-medium">{run.test_name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.color} ${t.bg}`}>{t.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_STYLES[run.status] || STATUS_STYLES.pending}`}>
                          {run.status === 'running' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />}
                          {STATUS_LABEL[run.status] || run.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{fmtDatetime(run.started_at)}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{fmtDuration(run.started_at, run.ended_at)}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{run.triggered_by || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setSelectedExecId(run.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </button>
                          <button onClick={() => setDeleteConfirm({ type: 'run', id: run.id })}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* ── AI Insights tab ──────────────────────────────────────────────────────────── */
        <div className="space-y-6">

          {/* Anomaly Monitor */}
          <div className="border rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgb(var(--border-primary))' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Anomaly Monitor</h3>
                  <p className="text-xs text-slate-400">Z-score analysis — flags metrics deviating &gt;2σ from historical baseline</p>
                </div>
              </div>
              <button onClick={scanAnomalies} disabled={aiAnomaliesLoading || tests.length === 0}
                className="px-4 py-2 bg-orange-600/80 hover:bg-orange-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
                {aiAnomaliesLoading ? 'Scanning…' : 'Scan All Tests'}
              </button>
            </div>
            {aiAnomalies && (
              <div className="p-6">
                {aiAnomalies.every(r => r.flagged.length === 0 && !r.message) ? (
                  <p className="text-sm text-slate-400">No anomalies detected. All metrics within 2σ of historical baseline.</p>
                ) : (
                  <div className="space-y-3">
                    {aiAnomalies.map((item, idx) => (
                      <div key={idx} className="border rounded-xl overflow-hidden" style={{ borderColor: 'rgb(var(--border-primary))' }}>
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/40">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.flagged.length > 0 ? 'bg-orange-400' : 'bg-green-400'}`} />
                            <span className="text-sm font-medium text-white">{item.testName}</span>
                          </div>
                          {item.flagged.length > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-400/15 text-orange-300 border border-orange-400/30">
                              {item.flagged.length} anomal{item.flagged.length === 1 ? 'y' : 'ies'}
                            </span>
                          )}
                        </div>
                        {item.message && <p className="px-4 py-2 text-xs text-slate-500 italic">{item.message}</p>}
                        {item.flagged.length > 0 && (
                          <div className="px-4 pb-3 pt-1 space-y-1.5">
                            {item.flagged.map((f, fi) => (
                              <div key={fi} className="flex items-center gap-3 text-xs py-1.5 border-b border-slate-800 last:border-0">
                                <span className={`px-1.5 py-0.5 rounded font-mono ${f.direction === 'high' ? 'bg-red-400/15 text-red-300' : 'bg-blue-400/15 text-blue-300'}`}>{f.metric}</span>
                                <span className="text-slate-300">actual: <strong>{f.metric === 'error_rate' ? `${(f.actual * 100).toFixed(2)}%` : `${f.actual.toFixed(0)} ms`}</strong></span>
                                <span className="text-slate-500">mean: {f.metric === 'error_rate' ? `${(f.mean * 100).toFixed(2)}%` : `${f.mean.toFixed(0)} ms`}</span>
                                <span className={`ml-auto font-semibold ${f.direction === 'high' ? 'text-red-400' : 'text-blue-400'}`}>z={f.zScore} {f.direction === 'high' ? '\u2191' : '\u2193'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Regression Compare */}
          <div className="border rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: 'rgb(var(--border-primary))' }}>
              <div className="flex items-center gap-3 mb-0.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <h3 className="text-sm font-semibold text-white">Regression Compare</h3>
              </div>
              <p className="text-xs text-slate-400 ml-11">Select two runs — AI writes a natural-language performance comparison</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Baseline Run (A)</label>
                  <select value={regressionRunA} onChange={e => setRegressionRunA(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                    <option value="">— select run —</option>
                    {runs.filter(r => ['passed', 'failed', 'thresholds_failed'].includes(r.status)).map(r => (
                      <option key={r.id} value={r.id}>{r.test_name} — {STATUS_LABEL[r.status]} — {new Date(r.started_at).toLocaleDateString()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Latest Run (B)</label>
                  <select value={regressionRunB} onChange={e => setRegressionRunB(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                    <option value="">— select run —</option>
                    {runs.filter(r => ['passed', 'failed', 'thresholds_failed'].includes(r.status)).map(r => (
                      <option key={r.id} value={r.id}>{r.test_name} — {STATUS_LABEL[r.status]} — {new Date(r.started_at).toLocaleDateString()}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={compareRuns} disabled={regressionLoading || !regressionRunA || !regressionRunB}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
                  {regressionLoading ? 'Comparing…' : 'Compare Runs'}
                </button>
              </div>
              {regressionResult && (
                <div className="bg-blue-400/5 border border-blue-400/20 rounded-xl p-4 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{regressionResult}</div>
              )}
              {regressionError && <p className="text-red-400 text-sm">{regressionError}</p>}
            </div>
          </div>

          {/* Smart Suite Builder */}
          <div className="border rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgb(var(--border-primary))' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Smart Suite Builder</h3>
                  <p className="text-xs text-slate-400">AI groups your tests into logical CI/CD suite suggestions</p>
                </div>
              </div>
              <button onClick={getSmartSuites} disabled={smartSuiteLoading || tests.length < 2}
                className="px-4 py-2 bg-green-700/80 hover:bg-green-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
                {smartSuiteLoading ? 'Thinking…' : 'Suggest Suites'}
              </button>
            </div>
            {smartSuiteResult && (
              <div className="p-6 space-y-4">
                {smartSuiteResult.error && <p className="text-red-400 text-sm">{smartSuiteResult.error}</p>}
                {smartSuiteResult.suggestions?.map((s, idx) => (
                  <div key={idx} className="border border-slate-700 rounded-xl p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-white">{s.name}</h4>
                        {s.description && <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>}
                      </div>
                      <button onClick={() => createSmartSuite(s)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0">
                        Create Suite
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {s.testIds.map(id => {
                        const t = smartSuiteResult.tests?.find(x => x.id === id);
                        return t ? <span key={id} className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">{t.name}</span> : null;
                      })}
                    </div>
                    {s.rationale && <p className="text-xs text-slate-500 italic">{s.rationale}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showModal && (
        <TestModal test={editTest} plan={plan} folders={folders} aiEnabled={aiEnabled}
          onClose={() => { setShowModal(false); setEditTest(null); }}
          onSave={(saved) => {
            if (editTest) {
              setTests(prev => prev.map(t => t.id === saved.id ? saved : t));
            } else {
              setTests(prev => [saved, ...prev]);
            }
          }}
        />
      )}

      {selectedExecId && (
        <ExecutionDetail executionId={selectedExecId} aiEnabled={aiEnabled} onClose={() => { setSelectedExecId(null); loadData(); }} />
      )}

      {generateScriptOpen && (
        <GenerateScriptModal onClose={() => setGenerateScriptOpen(false)} />
      )}

      {/* Suite create/edit modal */}
      {showSuiteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
            style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgb(var(--border-primary))' }}>
              <h2 className="text-lg font-semibold text-white">{editSuite ? 'Edit Suite' : 'New Performance Suite'}</h2>
              <button onClick={() => setShowSuiteModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Suite Name *</label>
                <input value={suiteForm.name} onChange={e => setSuiteForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Smoke Suite" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                <input value={suiteForm.description} onChange={e => setSuiteForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Optional description" />
              </div>
              {suiteModalErr && <p className="text-red-400 text-sm">{suiteModalErr}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowSuiteModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm">
                  Cancel
                </button>
                <button onClick={saveSuite} disabled={suiteModalSaving}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors text-sm disabled:opacity-60">
                  {suiteModalSaving ? 'Saving...' : (editSuite ? 'Update Suite' : 'Create Suite')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suite Manage Drawer */}
      {managingSuite && (
        <SuiteDrawer
          suite={managingSuite}
          allTests={tests}
          canRun={canRun}
          onClose={() => { setManagingSuite(null); loadData(); }}
          onRunSuite={(suiteExecId) => {
            loadData();
            setTab('suites');
            setSelectedSuiteExecId(suiteExecId);
          }}
        />
      )}

      {/* Suite Execution Detail */}
      {selectedSuiteExecId && !viewingTestRunFromSuite && (
        <SuiteExecutionDetail
          suiteExecId={selectedSuiteExecId}
          onClose={() => { setSelectedSuiteExecId(null); loadData(); }}
          onViewTestRun={(execId) => {
            setViewingTestRunFromSuite(execId);
          }}
        />
      )}

      {/* Individual test run detail opened from suite detail */}
      {viewingTestRunFromSuite && (
        <ExecutionDetail
          executionId={viewingTestRunFromSuite}
          aiEnabled={aiEnabled}
          onClose={() => setViewingTestRunFromSuite(null)}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-sm rounded-2xl border p-6 shadow-xl"
            style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
            <h3 className="text-lg font-semibold text-white mb-2">Confirm delete</h3>
            <p className="text-slate-400 text-sm mb-6">
              {deleteConfirm.type === 'test'
                ? 'This will delete the test definition and all its run history permanently.'
                : deleteConfirm.type === 'suite'
                ? 'This will delete the suite and all its run history permanently.'
                : deleteConfirm.type === 'suiteRun'
                ? 'This will delete this suite run record permanently.'
                : 'This will delete this run and its metrics permanently.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm">
                Cancel
              </button>
              <button onClick={handleDelete}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
