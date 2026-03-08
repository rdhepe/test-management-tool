import React, { useState, useEffect, useCallback } from 'react';
import API_URL from '../apiUrl';

const authHeaders = () => {
  const t = localStorage.getItem('auth_token');
  return t ? { 'x-auth-token': t } : {};
};

// ── Severity styling ──────────────────────────────────────────────────────────
const SEV_STYLES = {
  critical: 'bg-red-500/15 text-red-300 border-red-500/30',
  high:     'bg-orange-400/15 text-orange-300 border-orange-400/30',
  medium:   'bg-yellow-400/15 text-yellow-300 border-yellow-400/30',
  low:      'bg-blue-400/15 text-blue-300 border-blue-400/30',
  info:     'bg-slate-400/15 text-slate-300 border-slate-400/30',
};

const SCAN_STATUS_STYLES = {
  completed: 'bg-green-400/15 text-green-300 border-green-400/30',
  failed:    'bg-red-400/15 text-red-300 border-red-400/30',
  running:   'bg-blue-400/15 text-blue-300 border-blue-400/30',
};

const GRADE_CONFIG = {
  A: { cls: 'text-green-400',  bg: 'bg-green-400/10 border-green-400/20' },
  B: { cls: 'text-blue-400',   bg: 'bg-blue-400/10 border-blue-400/20' },
  C: { cls: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
  D: { cls: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20' },
  F: { cls: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/20' },
};

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

// ── ScanModal (create / edit) ─────────────────────────────────────────────────
function ScanModal({ scan, onClose, onSave }) {
  const [name, setName]           = useState(scan?.name || '');
  const [url, setUrl]             = useState(scan?.target_url || '');
  const [desc, setDesc]           = useState(scan?.description || '');
  const [activeScan, setActiveScan] = useState(scan?.active_scan || false);
  const [schedule, setSchedule]   = useState(scan?.schedule || '');
  const [headerRows, setHeaderRows] = useState(() => {
    const ch = scan?.custom_headers || {};
    const keys = Object.keys(ch);
    return keys.length ? keys.map(k => ({ key: k, value: ch[k] })) : [{ key: '', value: '' }];
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const addRow    = () => setHeaderRows(r => [...r, { key: '', value: '' }]);
  const removeRow = (i) => setHeaderRows(r => r.filter((_, idx) => idx !== i));
  const updateRow = (i, field, val) =>
    setHeaderRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  const handleSave = async () => {
    if (!name.trim()) return setErr('Name is required.');
    if (!url.trim())  return setErr('Target URL is required.');
    try { new URL(url.trim()); } catch { return setErr('Invalid URL \u2014 must start with http:// or https://'); }
    setSaving(true); setErr('');
    try {
      const custom_headers = {};
      for (const row of headerRows) {
        if (row.key.trim()) custom_headers[row.key.trim()] = row.value;
      }
      await onSave({ name: name.trim(), target_url: url.trim(), description: desc, custom_headers, active_scan: activeScan, schedule: schedule.trim() });
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl overflow-hidden border flex flex-col"
        style={{ maxHeight: '90vh', backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'rgb(var(--border-primary))' }}>
          <h2 className="text-lg font-semibold text-white">{scan ? 'Edit Scan Config' : 'New Scan Config'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {err && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">{err}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Production API Scan"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Target URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-indigo-500 transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Description <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
              placeholder="What is being tested…"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none transition-colors" />
          </div>
          {/* Custom request headers */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-slate-300">
                Custom Request Headers <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <button onClick={addRow} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">+ Add</button>
            </div>
            <div className="space-y-2">
              {headerRows.map((row, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={row.key} onChange={e => updateRow(i, 'key', e.target.value)}
                    placeholder="Header-Name"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500 transition-colors" />
                  <input value={row.value} onChange={e => updateRow(i, 'value', e.target.value)}
                    placeholder="value"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500 transition-colors" />
                  {headerRows.length > 1 && (
                    <button onClick={() => removeRow(i)}
                      className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-400/10 transition-colors flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* Active scan toggle */}
          <div className="rounded-xl border p-4 space-y-1" style={{ borderColor: 'rgb(var(--border-primary))' }}>
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveScan(v => !v)}
                className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative ${activeScan ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${activeScan ? 'translate-x-4' : ''}`} />
              </button>
              <p className="text-sm font-medium text-white">Active Scan — SQLi &amp; XSS reflection probing</p>
            </div>
            <p className="text-xs text-slate-400 ml-12">Injects test payloads into query parameters to detect reflected injections. Only enable on URLs you own and control.</p>
          </div>
          {/* Schedule */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Schedule <span className="text-slate-500 font-normal">(5-part cron, optional)</span>
            </label>
            <input value={schedule} onChange={e => setSchedule(e.target.value)}
              placeholder="0 9 * * 1   (every Monday at 9:00)"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-indigo-500 transition-colors" />
            <p className="text-xs text-slate-500 mt-1">Format: minute hour day month weekday. Leave blank for manual runs only.</p>
          </div>
        </div>
        {/* Footer */}
        <div className="flex gap-3 justify-end px-6 py-4 border-t flex-shrink-0"
          style={{ borderColor: 'rgb(var(--border-primary))' }}>
          <button onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors">
            {saving
              ? <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Saving…</>
              : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ResultModal ───────────────────────────────────────────────────────────────
function ResultModal({ run, onClose }) {
  const findings   = Array.isArray(run.findings) ? run.findings : [];
  const categories = [...new Set(findings.map(f => f.category))];
  const grade      = run.grade || '?';
  const gc         = GRADE_CONFIG[grade] || GRADE_CONFIG.F;
  const fails      = findings.filter(f => f.status === 'fail').length;
  const passes     = findings.filter(f => f.status === 'pass').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden border flex flex-col"
        style={{ maxHeight: '90vh', backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'rgb(var(--border-primary))' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-2xl border flex-shrink-0 ${gc.bg} ${gc.cls}`}>
              {grade}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white truncate">{run.scan_name}</h2>
              <p className="text-slate-400 text-sm font-mono truncate">{run.target_url}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition-colors flex-shrink-0 ml-4">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Score row */}
        <div className="flex items-center gap-8 px-6 py-3 border-b flex-shrink-0"
          style={{ borderColor: 'rgb(var(--border-primary))' }}>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{run.score ?? '—'}</p>
            <p className="text-xs text-slate-500 mt-0.5">Score / 100</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-400">{fails}</p>
            <p className="text-xs text-slate-500 mt-0.5">Issues found</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">{passes}</p>
            <p className="text-xs text-slate-500 mt-0.5">Checks passing</p>
          </div>
          <div>
            <p className="text-sm text-slate-300">{formatDate(run.started_at)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Run at</p>
          </div>
        </div>
        {/* Findings */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {run.error && (
            <div className="bg-red-400/10 border border-red-400/20 rounded-xl p-4 text-red-300 text-sm">{run.error}</div>
          )}
          {categories.map(cat => (
            <div key={cat}>
              <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <span className="w-1.5 h-4 rounded bg-indigo-500 inline-block" />
                {cat}
              </h3>
              <div className="space-y-2">
                {findings.filter(f => f.category === cat).map((f, i) => (
                  <div key={i} className={`rounded-xl border p-3.5 ${f.status === 'fail' ? 'border-red-500/20 bg-red-500/5' : 'border-slate-700/40'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {f.status === 'pass'
                          ? <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          : <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                        }
                        <span className="text-sm font-medium text-white">{f.name}</span>
                      </div>
                      {f.status === 'fail' && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${SEV_STYLES[f.severity] || SEV_STYLES.info}`}>
                          {f.severity}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 ml-6">{f.description}</p>
                    {f.recommendation && (
                      <p className="text-xs mt-1 ml-6">
                        <span className="text-slate-500">Fix: </span>
                        <span className="text-indigo-400">{f.recommendation}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {findings.length === 0 && !run.error && (
            <p className="text-slate-400 text-sm text-center py-10">No findings recorded.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SecurityTests({ orgInfo }) {
  const [scans, setScans]           = useState([]);
  const [runs, setRuns]             = useState([]);
  const [tab, setTab]               = useState('scans');
  const [loading, setLoading]       = useState(true);
  const [runsLoading, setRunsLoading] = useState(false);
  const [error, setError]           = useState('');
  const [runningIds, setRunningIds] = useState(new Set()); // scan ids being run
  const [showModal, setShowModal]   = useState(false);
  const [editScan, setEditScan]     = useState(null);
  const [viewRun, setViewRun]       = useState(null);

  const fetchScans = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API_URL}/security-scans`, { headers: authHeaders() });
      if (!r.ok) throw new Error(await r.text());
      setScans(await r.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  const fetchRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const r = await fetch(`${API_URL}/security-scan-runs`, { headers: authHeaders() });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setRuns(data);
      // Clear run IDs that are no longer running
      setRunningIds(prev => {
        const next = new Set(prev);
        data.forEach(run => { if (run.status !== 'running') next.delete(run.id); });
        return next;
      });
    } catch (_) {}
    finally { setRunsLoading(false); }
  }, []);

  useEffect(() => { fetchScans(); fetchRuns(); }, [fetchScans, fetchRuns]);

  // Poll while any run is in-flight
  useEffect(() => {
    if (runningIds.size === 0) return;
    const t = setInterval(() => { fetchScans(); fetchRuns(); }, 3000);
    return () => clearInterval(t);
  }, [runningIds, fetchScans, fetchRuns]);

  const saveScan = async (data) => {
    const method = editScan ? 'PUT' : 'POST';
    const endpoint = editScan ? `${API_URL}/security-scans/${editScan.id}` : `${API_URL}/security-scans`;
    const r = await fetch(endpoint, {
      method,
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(await r.text());
    setShowModal(false); setEditScan(null);
    fetchScans();
  };

  const deleteScan = async (id) => {
    if (!confirm('Delete this scan config and all its history?')) return;
    await fetch(`${API_URL}/security-scans/${id}`, { method: 'DELETE', headers: authHeaders() });
    fetchScans(); fetchRuns();
  };

  const runScan = async (scan) => {
    const key = `scan-${scan.id}`;
    setRunningIds(prev => new Set([...prev, key]));
    try {
      const r = await fetch(`${API_URL}/security-scans/${scan.id}/run`, { method: 'POST', headers: authHeaders() });
      if (!r.ok) { const msg = await r.text(); throw new Error(msg); }
      const { runId } = await r.json();
      // Replace key with the actual run id so we track it
      setRunningIds(prev => { const n = new Set(prev); n.delete(key); n.add(runId); return n; });
      setTab('history');
      fetchRuns();
      // Poll until done
      const poll = setInterval(async () => {
        try {
          const rr = await fetch(`${API_URL}/security-scan-runs/${runId}`, { headers: authHeaders() });
          if (!rr.ok) { clearInterval(poll); return; }
          const run = await rr.json();
          if (run.status !== 'running') {
            clearInterval(poll);
            setRunningIds(prev => { const n = new Set(prev); n.delete(runId); return n; });
            fetchScans(); fetchRuns();
          }
        } catch (_) { clearInterval(poll); }
      }, 2500);
    } catch (e) {
      setRunningIds(prev => { const n = new Set(prev); n.delete(key); return n; });
      alert(`Failed to start scan: ${e.message}`);
    }
  };

  const deleteRun = async (id) => {
    await fetch(`${API_URL}/security-scan-runs/${id}`, { method: 'DELETE', headers: authHeaders() });
    fetchRuns();
  };

  const openRunDetail = async (run) => {
    // findings may already be loaded (from history list which has JSONB)
    if (Array.isArray(run.findings)) { setViewRun(run); return; }
    const r = await fetch(`${API_URL}/security-scan-runs/${run.id}`, { headers: authHeaders() });
    if (r.ok) setViewRun(await r.json());
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2.5">
            <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Security Testing
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Scan URLs for security header gaps, SSL issues, CORS misconfigurations, cookie flags and active injection vulnerabilities
          </p>
        </div>
        <div className="flex items-center gap-3">
          {runningIds.size > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border bg-blue-400/15 text-blue-300 border-blue-400/30">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              {runningIds.size} scanning
            </span>
          )}
          {tab === 'scans' && (
            <button
              onClick={() => { setEditScan(null); setShowModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-indigo-600/30"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Scan
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: 'rgb(var(--border-primary))' }}>
        {[
          { id: 'scans',   label: `Scans${scans.length > 0 ? ` (${scans.length})` : ''}` },
          { id: 'history', label: `History${runs.length > 0 ? ` (${runs.length})` : ''}` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
              tab === t.id ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SCANS TAB ── */}
      {tab === 'scans' && (
        <div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: 'rgb(var(--bg-elevated))' }} />
              ))}
            </div>
          ) : error ? (
            <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl p-4">{error}</div>
          ) : scans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-600/20 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No scan configs yet</h3>
              <p className="text-slate-400 text-sm max-w-md">
                Create a scan config to start checking URLs for security vulnerabilities.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {scans.map(scan => {
                const isRunning = runningIds.has(`scan-${scan.id}`);
                return (
                  <div key={scan.id}
                    className="rounded-xl p-5 border transition-colors hover:border-slate-600"
                    style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white">{scan.name}</span>
                          {scan.active_scan && (
                            <span className="text-xs px-2 py-0.5 rounded-full border bg-orange-400/15 text-orange-300 border-orange-400/30">
                              Active
                            </span>
                          )}
                          {scan.schedule && (
                            <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-400/10 text-slate-400 border-slate-600 font-mono">
                              {scan.schedule}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 text-sm mt-0.5 font-mono truncate">{scan.target_url}</p>
                        {scan.description && (
                          <p className="text-slate-500 text-xs mt-1 truncate">{scan.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {scan.last_run_status && (
                            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${SCAN_STATUS_STYLES[scan.last_run_status] || SCAN_STATUS_STYLES.completed}`}>
                              {scan.last_run_status}
                            </span>
                          )}
                          {scan.last_score != null && (
                            <span className="text-xs text-slate-400">
                              Score: <span className="text-white font-medium">{scan.last_score}/100</span>
                            </span>
                          )}
                          {scan.last_run_at && (
                            <span className="text-xs text-slate-500">{formatDate(scan.last_run_at)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => runScan(scan)}
                          disabled={isRunning}
                          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-2 rounded-xl transition-colors"
                        >
                          {isRunning ? (
                            <>
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                              Scanning…
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              Run Scan
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => { setEditScan(scan); setShowModal(true); }}
                          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteScan(scan.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === 'history' && (
        <div>
          {runsLoading && runs.length === 0 ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: 'rgb(var(--bg-elevated))' }} />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-600/20 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No scan history yet</h3>
              <p className="text-slate-400 text-sm">Run a scan from the Scans tab to see results here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map(run => {
                const isRunning = run.status === 'running';
                const gc = GRADE_CONFIG[run.grade] || GRADE_CONFIG.F;
                return (
                  <div key={run.id}
                    className="flex items-center gap-4 rounded-xl border px-4 py-3 text-sm transition-colors hover:border-slate-600"
                    style={{ borderColor: 'rgb(var(--border-primary))' }}>
                    {/* Grade badge */}
                    {isRunning ? (
                      <span className="w-10 h-10 rounded-xl flex items-center justify-center border bg-blue-400/10 border-blue-400/20 flex-shrink-0">
                        <svg className="w-4 h-4 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                      </span>
                    ) : (
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold border text-lg flex-shrink-0 ${gc.bg} ${gc.cls}`}>
                        {run.grade || '?'}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{run.scan_name}</p>
                      <p className="text-slate-500 text-xs font-mono truncate">{run.target_url}</p>
                    </div>
                    {!isRunning && run.score != null && (
                      <span className="text-slate-300 text-sm font-mono flex-shrink-0">{run.score}/100</span>
                    )}
                    {isRunning && (
                      <span className="text-blue-300 text-xs flex-shrink-0">Scanning…</span>
                    )}
                    <span className="text-slate-500 text-xs flex-shrink-0 hidden sm:block">{formatDate(run.started_at)}</span>
                    {!isRunning && (
                      <button
                        onClick={() => openRunDetail(run)}
                        className="text-indigo-400 hover:text-indigo-300 p-1.5 rounded-lg hover:bg-slate-700 transition-colors flex-shrink-0"
                        title="View results"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => deleteRun(run.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <ScanModal
          scan={editScan}
          onClose={() => { setShowModal(false); setEditScan(null); }}
          onSave={saveScan}
        />
      )}
      {viewRun && (
        <ResultModal run={viewRun} onClose={() => setViewRun(null)} />
      )}
    </div>
  );
}
