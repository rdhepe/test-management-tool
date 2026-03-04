import React, { useState, useEffect } from 'react';
import API_URL from '../apiUrl';

const SEV_STYLES = {
  low:      'bg-slate-500/15 text-slate-300 border-slate-500/30',
  medium:   'bg-amber-500/15 text-amber-300 border-amber-500/30',
  high:     'bg-orange-500/15 text-orange-300 border-orange-500/30',
  critical: 'bg-red-500/15 text-red-300 border-red-500/30',
};
const STATUS_OPTIONS = ['open', 'investigating', 'in progress', 'fixed', 'closed'];
const STATUS_STYLES = {
  'open':          'bg-slate-500/15 text-slate-300 border-slate-500/30',
  'investigating': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'in progress':   'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  'fixed':         'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'closed':        'bg-slate-700/40 text-slate-500 border-slate-600/30',
};

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function BugReports() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    fetch(`${API_URL}/platform-bug-reports`, { headers: { 'x-auth-token': token } })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => { setItems(data); setLoading(false); })
      .catch(() => { setError('Failed to load bug reports.'); setLoading(false); });
  }, []);

  const updateStatus = async (id, status) => {
    setUpdatingId(id);
    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`${API_URL}/platform-bug-reports/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({ status })
      });
      setItems(prev => prev.map(item => item.id === id ? { ...item, status } : item));
    } catch { /* no-op */ } finally {
      setUpdatingId(null);
    }
  };

  const criticalCount = items.filter(i => i.severity === 'critical' && i.status === 'open').length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Bug Reports</h1>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
            Bugs reported by users from within the app.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <div className="px-3 py-1.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-medium">
              {criticalCount} critical open
            </div>
          )}
          {!loading && items.length > 0 && (
            <div className="px-3 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium">
              {items.length} total
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Loading…
        </div>
      )}
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-3 text-sm">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-xl border border-dashed flex flex-col items-center justify-center py-20 text-slate-500"
          style={{ borderColor: 'rgb(var(--border-primary))' }}>
          <svg className="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">No bug reports yet</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id}
              className="rounded-xl border transition-colors"
              style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
              <button className="w-full text-left px-5 py-4 flex items-start gap-4"
                onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: 'rgb(var(--text-primary))' }}>{item.title}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border capitalize ${SEV_STYLES[item.severity] || SEV_STYLES.medium}`}>
                      {item.severity}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border capitalize ${STATUS_STYLES[item.status] || STATUS_STYLES['open']}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: 'rgb(var(--text-tertiary))' }}>
                    <span>by <strong className="text-slate-400">{item.submitted_by}</strong></span>
                    {item.org_slug && <span>· {item.org_slug}</span>}
                    <span>· {formatDate(item.created_at)}</span>
                  </div>
                </div>
                <svg className={`w-4 h-4 text-slate-500 flex-shrink-0 mt-1 transition-transform ${expanded === item.id ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expanded === item.id && (
                <div className="px-5 pb-5 border-t pt-4 space-y-4" style={{ borderColor: 'rgb(var(--border-primary))' }}>
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'rgb(var(--text-tertiary))' }}>Description</p>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgb(var(--text-secondary))' }}>{item.description}</p>
                  </div>
                  {item.steps && (
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: 'rgb(var(--text-tertiary))' }}>Steps to reproduce</p>
                      <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono rounded-lg px-3 py-2.5"
                        style={{ backgroundColor: 'rgb(var(--bg-secondary))', color: 'rgb(var(--text-secondary))' }}>
                        {item.steps}
                      </pre>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium" style={{ color: 'rgb(var(--text-tertiary))' }}>Update status:</span>
                    {STATUS_OPTIONS.map(s => (
                      <button key={s} onClick={() => updateStatus(item.id, s)}
                        disabled={updatingId === item.id || item.status === s}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all disabled:opacity-40 capitalize ${
                          item.status === s ? (STATUS_STYLES[s] || '') : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                        }`}>
                        {s}
                      </button>
                    ))}
                    {updatingId === item.id && <svg className="w-3.5 h-3.5 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
