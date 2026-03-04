import React, { useState, useEffect } from 'react';
import API_URL from '../apiUrl';

const STATUS_OPTIONS = ['open', 'under review', 'planned', 'completed', 'declined'];
const STATUS_STYLES = {
  'open':         'bg-slate-500/15 text-slate-300 border-slate-500/30',
  'under review': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'planned':      'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  'completed':    'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'declined':     'bg-red-500/15 text-red-300 border-red-500/30',
};

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function FeatureRequests() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    fetch(`${API_URL}/platform-feedback`, { headers: { 'x-auth-token': token } })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => { setItems(data); setLoading(false); })
      .catch(() => { setError('Failed to load feature requests.'); setLoading(false); });
  }, []);

  const updateStatus = async (id, status) => {
    setUpdatingId(id);
    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`${API_URL}/platform-feedback/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({ status })
      });
      setItems(prev => prev.map(item => item.id === id ? { ...item, status } : item));
    } catch { /* no-op */ } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Feature Requests</h1>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
            Feature ideas submitted by users across all organisations.
          </p>
        </div>
        {!loading && items.length > 0 && (
          <div className="px-3 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
            {items.length} {items.length === 1 ? 'request' : 'requests'}
          </div>
        )}
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <p className="text-sm">No feature requests yet</p>
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
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: 'rgb(var(--text-primary))' }}>{item.title}</span>
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
                  <p className="text-sm leading-relaxed" style={{ color: 'rgb(var(--text-secondary))' }}>{item.description}</p>
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
