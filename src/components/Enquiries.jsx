import React, { useState, useEffect } from 'react';
import API_URL from '../apiUrl';

function TeamSizeBadge({ value }) {
  if (!value) return <span className="text-slate-500">—</span>;
  return (
    <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
      {value}
    </span>
  );
}

export default function Enquiries() {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    fetch(`${API_URL}/enquiries`, { headers: { 'x-auth-token': token } })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => { setEnquiries(data); setLoading(false); })
      .catch(() => { setError('Failed to load enquiries.'); setLoading(false); });
  }, []);

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
          Enquiries
        </h1>
        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
          Contact form submissions from the landing page.
        </p>
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

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && enquiries.length === 0 && (
        <div className="rounded-xl border border-dashed flex flex-col items-center justify-center py-20 text-slate-500"
          style={{ borderColor: 'rgb(var(--border-primary))' }}>
          <svg className="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">No enquiries yet</p>
        </div>
      )}

      {!loading && enquiries.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgb(var(--border-primary))' }}>
          {/* Summary bar */}
          <div className="px-4 py-3 border-b flex items-center justify-between"
            style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
            <span className="text-sm font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>
              {enquiries.length} {enquiries.length === 1 ? 'enquiry' : 'enquiries'}
            </span>
          </div>

          {/* Table */}
          <div className="divide-y" style={{ divideColor: 'rgb(var(--border-primary))' }}>
            {enquiries.map((enq) => (
              <div key={enq.id}
                className="px-4 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
                style={{ borderColor: 'rgb(var(--border-primary))' }}
                onClick={() => setExpanded(expanded === enq.id ? null : enq.id)}>

                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 text-indigo-300 font-semibold text-sm select-none">
                    {enq.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-medium text-sm" style={{ color: 'rgb(var(--text-primary))' }}>{enq.name}</span>
                      <a href={`mailto:${enq.email}`} onClick={e => e.stopPropagation()}
                        className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors">
                        {enq.email}
                      </a>
                      {enq.company && (
                        <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>{enq.company}</span>
                      )}
                      <TeamSizeBadge value={enq.team_size} />
                    </div>
                    <p className="text-sm mt-1 line-clamp-2" style={{ color: 'rgb(var(--text-secondary))' }}>
                      {enq.message}
                    </p>
                  </div>

                  {/* Date + chevron */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <span className="text-xs" style={{ color: 'rgb(var(--text-tertiary))' }}>
                      {formatDate(enq.created_at)}
                    </span>
                    <svg
                      className={`w-4 h-4 transition-transform ${expanded === enq.id ? 'rotate-180' : ''}`}
                      style={{ color: 'rgb(var(--text-tertiary))' }}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded message */}
                {expanded === enq.id && (
                  <div className="mt-4 ml-13 pl-1">
                    <div className="rounded-lg border p-4"
                      style={{ backgroundColor: 'rgb(var(--bg-primary))', borderColor: 'rgb(var(--border-primary))' }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--text-tertiary))' }}>Message</p>
                      <p className="text-sm whitespace-pre-wrap" style={{ color: 'rgb(var(--text-primary))' }}>{enq.message}</p>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <a href={`mailto:${enq.email}?subject=Re: Your TestStudio.cloud enquiry`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                        onClick={e => e.stopPropagation()}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Reply via email
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
