import React, { useState, useEffect, useRef, useCallback } from 'react';
import API_URL from '../apiUrl';

const TEMPLATES = [
  { id: 'smoke',  label: 'Smoke',  desc: 'Minimal load — sanity check (2 VUs, ~2 min)',       color: 'text-green-400',  bg: 'bg-green-400/10' },
  { id: 'load',   label: 'Load',   desc: 'Typical expected traffic',                             color: 'text-blue-400',   bg: 'bg-blue-400/10' },
  { id: 'soak',   label: 'Soak',   desc: 'Sustained load over long period (memory leaks)',       color: 'text-yellow-400', bg: 'bg-yellow-400/10', enterprise: true },
  { id: 'spike',  label: 'Spike',  desc: '10× sudden VU burst (resilience check)',               color: 'text-orange-400', bg: 'bg-orange-400/10', enterprise: true },
  { id: 'stress', label: 'Stress', desc: 'Ramp until failure — find breaking point',             color: 'text-red-400',    bg: 'bg-red-400/10',    enterprise: true },
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
function ThresholdEditor({ thresholds, onChange }) {
  const add = () => onChange([...thresholds, { metric: 'p95', operator: '<', value: '2000' }]);
  const remove = (i) => onChange(thresholds.filter((_, idx) => idx !== i));
  const update = (i, field, val) => onChange(thresholds.map((t, idx) => idx === i ? { ...t, [field]: val } : t));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Thresholds</span>
        <button type="button" onClick={add} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">+ Add</button>
      </div>
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
// Create / Edit modal
// ─────────────────────────────────────────────────────────────────────────────
function TestModal({ test, onClose, onSave, plan }) {
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
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify(form),
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

          {/* Template picker */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Template *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 lg:grid-cols-5">
              {TEMPLATES.map(tpl => {
                const locked = tpl.enterprise && !isEnterprise;
                return (
                  <button key={tpl.id} type="button"
                    disabled={locked}
                    onClick={() => !locked && set('template', tpl.id)}
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
            <ThresholdEditor thresholds={form.thresholds_json} onChange={val => set('thresholds_json', val)} />
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
function ExecutionDetail({ executionId, onClose }) {
  const [exec, setExec] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

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
    const MAX_POLLS = 300; // 15 min at 3s interval
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
          if (s !== 'running' && s !== 'pending') clearInterval(pollRef.current);
        }, 3000);
      }
    }).catch(() => {});
    return () => clearInterval(pollRef.current);
  }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <svg className="w-6 h-6 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );

  if (!exec) return (
    <div className="text-center py-12 text-slate-400">Execution not found</div>
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

          {/* Summary metrics */}
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

          {/* Threshold results */}
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

          {/* Sparklines */}
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

          {/* Logs */}
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
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function PerformanceTests({ orgInfo, currentUser }) {
  const plan = orgInfo?.plan || 'free';
  const canRun = ['pro', 'premium', 'enterprise'].includes(plan);

  const [tab, setTab] = useState('tests');          // 'tests' | 'runs'
  const [tests, setTests] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTest, setEditTest] = useState(null);
  const [selectedExecId, setSelectedExecId] = useState(null);
  const [runningId, setRunningId] = useState(null);
  const [runError, setRunError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);  // { type, id }

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
      const [testsRes, runsRes] = await Promise.all([
        fetch(`${API_URL}/performance-tests`, { headers }),
        fetch(`${API_URL}/performance-executions`, { headers }),
      ]);
      const testsData = await safeJson(testsRes);
      const runsData = await safeJson(runsRes);
      if (testsData === null) console.warn('[perf] tests fetch failed, status:', testsRes.status);
      if (runsData === null) console.warn('[perf] runs fetch failed, status:', runsRes.status);
      // Only update state if we got valid data — don't wipe on fetch failure
      if (testsData !== null) setTests(testsData);
      if (runsData !== null) setRuns(runsData);
    } catch (e) {
      console.error('perf load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRun = async (test) => {
    if (!canRun) { setRunError('Upgrade to Pro or higher to run performance tests.'); return; }
    setRunError('');
    setRunningId(test.id);
    try {
      const res = await fetch(`${API_URL}/performance-tests/${test.id}/run`, {
        method: 'POST',
        headers: authHeader(),
      });
      const ct = res.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await res.json() : {};
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      const execId = data.executionId;
      if (!execId) throw new Error('Server did not return an execution ID');
      // Immediately add the new execution to the runs list so it appears right away,
      // without waiting for loadData to round-trip
      if (data.execution) {
        setRuns(prev => [data.execution, ...prev.filter(r => r.id !== execId)]);
      }
      // Switch to Runs tab and open detail modal immediately
      setTab('runs');
      setSelectedExecId(execId);
      // Also refresh in background to pick up any race-condition status update
      setTimeout(() => loadData(), 2000);
    } catch (e) {
      setRunError(e.message);
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    const url = type === 'test'
      ? `${API_URL}/performance-tests/${id}`
      : `${API_URL}/performance-executions/${id}`;
      await fetch(url, { method: 'DELETE', headers: authHeader() });
    setDeleteConfirm(null);
    loadData();
  };

  const tpl = (id) => TEMPLATES.find(t => t.id === id) || TEMPLATES[1];

  // ── Locked state for free plan ──
  if (!canRun && tab === 'tests' && tests.length === 0) {
    /* still show the page but with upgrade CTA */
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Performance Testing</h1>
          <p className="text-slate-400 text-sm mt-1">k6-powered load, stress, and spike tests for your application</p>
        </div>
        <button onClick={() => { setEditTest(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-indigo-600/30">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Test
        </button>
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
        {['tests', 'runs'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${tab === t ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
            {t === 'tests' ? `Tests (${tests.length})` : `Runs (${runs.length})`}
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
        /* ── Tests tab ─────────────────────────────────────────────────────── */
        tests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-600/20 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No performance tests yet</h3>
            <p className="text-slate-400 text-sm mb-6 max-w-md">Create your first performance test to measure how your application handles load.</p>
            <button onClick={() => { setEditTest(null); setShowModal(true); }}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors">
              Create First Test
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tests.map(test => {
              const t = tpl(test.template);
              const isRunning = runningId === test.id;
              const recentRuns = runs.filter(r => r.perf_test_id === test.id).slice(0, 3);
              return (
                <div key={test.id} className="border rounded-xl p-5 transition-colors hover:border-slate-600"
                  style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold text-white">{test.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.color} ${t.bg}`}>{t.label}</span>
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
                      {/* Recent runs badges */}
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
        )
      ) : (
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
                    <tr key={run.id} className="transition-colors"
                      style={{ borderColor: 'rgb(var(--border-primary))' }}>
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
      )}

      {/* Modals */}
      {showModal && (
        <TestModal test={editTest} plan={plan}
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
        <ExecutionDetail executionId={selectedExecId} onClose={() => { setSelectedExecId(null); loadData(); }} />
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
