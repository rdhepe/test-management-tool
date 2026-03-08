import React, { useState, useEffect, useCallback } from 'react';
import API_URL from '../apiUrl';

// ---------------------------------------------------------------------------
// Impact colours
// ---------------------------------------------------------------------------
const IMPACT_COLOR = {
  critical: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30', badge: 'bg-red-600 text-white' },
  serious:  { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30', badge: 'bg-orange-500 text-white' },
  moderate: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30', badge: 'bg-yellow-500 text-black' },
  minor:    { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', badge: 'bg-blue-600 text-white' },
};

function impactColor(impact) {
  return IMPACT_COLOR[impact] || IMPACT_COLOR.minor;
}

const auth = () => {
  const t = localStorage.getItem('auth_token');
  return t ? { 'x-auth-token': t } : {};
};

// ---------------------------------------------------------------------------
// TestModal — create / edit
// ---------------------------------------------------------------------------
function TestModal({ test, onClose, onSave }) {
  const [form, setForm] = useState({
    name: test?.name || '',
    description: test?.description || '',
    target_url: test?.target_url || '',
    pages: Array.isArray(test?.pages) ? test.pages.join('\n') : (test?.pages ? JSON.parse(test.pages || '[]').join('\n') : ''),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.name.trim()) return setError('Name is required');
    if (!form.target_url.trim()) return setError('Target URL is required');
    setSaving(true);
    setError('');
    const pages = form.pages.split('\n').map(l => l.trim()).filter(Boolean);
    await onSave({ ...form, pages });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border shadow-2xl p-6 space-y-4" style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
        <h2 className="text-lg font-semibold">{test ? 'Edit Accessibility Test' : 'New Accessibility Test'}</h2>

        {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full rounded-xl px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500"
              style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-primary))', color: 'rgb(var(--text-primary))' }}
              placeholder="Homepage Accessibility Check" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Target URL *</label>
            <input value={form.target_url} onChange={e => setForm(f => ({ ...f, target_url: e.target.value }))}
              className="w-full rounded-xl px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500"
              style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-primary))', color: 'rgb(var(--text-primary))' }}
              placeholder="https://example.com" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Additional pages (one URL per line)</label>
            <textarea value={form.pages} onChange={e => setForm(f => ({ ...f, pages: e.target.value }))} rows={3}
              className="w-full rounded-xl px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono resize-none"
              style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-primary))', color: 'rgb(var(--text-primary))' }}
              placeholder="https://example.com/about&#10;https://example.com/contact" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              className="w-full rounded-xl px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-primary))', color: 'rgb(var(--text-primary))' }}
              placeholder="Optional description" />
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm border transition-colors hover:bg-slate-700" style={{ borderColor: 'rgb(var(--border-primary))' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : (test ? 'Save Changes' : 'Create Test')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ViolationDetail — modal showing a single violation detail
// ---------------------------------------------------------------------------
function ViolationDetail({ violation, onClose, aiEnabled, aiFix }) {
  const c = impactColor(violation.impact);
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border shadow-2xl p-6 space-y-4" style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-2 ${c.badge}`}>{violation.impact?.toUpperCase()}</span>
            <h3 className="text-base font-semibold">{violation.id}</h3>
            <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>{violation.description}</p>
          </div>
          <button onClick={onClose} className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-700 transition-colors text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'rgb(var(--text-tertiary))' }}>Help</p>
          <p className="text-sm">{violation.help}</p>
          {violation.helpUrl && (
            <a href={violation.helpUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300 underline">
              WCAG Reference ↗
            </a>
          )}
        </div>

        {violation.page && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'rgb(var(--text-tertiary))' }}>Page</p>
            <code className="text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: 'rgb(var(--bg-secondary))', color: 'rgb(var(--text-secondary))' }}>{violation.page}</code>
          </div>
        )}

        {(violation.nodes || []).length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--text-tertiary))' }}>Affected Elements ({violation.nodes.length})</p>
            <div className="space-y-2">
              {violation.nodes.map((node, i) => (
                <div key={i} className="rounded-xl p-3 border space-y-1" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-primary))' }}>
                  {node.html && <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all" style={{ color: 'rgb(var(--text-primary))' }}>{node.html}</pre>}
                  {node.failureSummary && <p className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>{node.failureSummary}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {aiEnabled && aiFix && (
          <div className="rounded-xl p-4 border space-y-2" style={{ backgroundColor: 'rgb(15,23,42)', borderColor: 'rgb(99,102,241,0.4)' }}>
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14v-4H7l5-8v4h4l-5 8z"/></svg>
              <p className="text-xs font-semibold text-indigo-400">AI Fix Suggestion</p>
            </div>
            <p className="text-sm" style={{ color: 'rgb(var(--text-primary))' }}>{aiFix}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExecutionDetail — modal showing full audit results
// ---------------------------------------------------------------------------
function ExecutionDetail({ execution, onClose, aiEnabled }) {
  const [expandedImpact, setExpandedImpact] = useState(null);
  const [selectedViolation, setSelectedViolation] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFixes, setAiFixes] = useState({});
  const [aiError, setAiError] = useState('');

  const violations = Array.isArray(execution.violations_json)
    ? execution.violations_json
    : (execution.violations_json ? JSON.parse(execution.violations_json) : []);

  const bySeverity = { critical: [], serious: [], moderate: [], minor: [] };
  for (const v of violations) {
    if (bySeverity[v.impact]) bySeverity[v.impact].push(v);
    else bySeverity.minor.push(v);
  }

  const statusColor = execution.status === 'passed' ? 'text-green-400' :
    execution.status === 'failed' ? 'text-red-400' :
    execution.status === 'running' ? 'text-blue-400' : 'text-slate-400';

  const fetchAiFixes = async () => {
    if (!aiEnabled) return;
    setAiLoading(true);
    setAiError('');
    try {
      const r = await fetch(`${API_URL}/accessibility-ai/fix-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ violations: violations.slice(0, 10) }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'AI request failed');
      const map = {};
      for (const f of (data.fixes || [])) map[f.id] = f.fix;
      setAiFixes(map);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl p-6 space-y-5" style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{execution.test_name}</h2>
            <p className="text-sm mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>
              Audit · {new Date(execution.started_at).toLocaleString()} · <span className={`font-medium ${statusColor}`}>{execution.status}</span>
              {execution.pages_audited > 0 && <span className="ml-2 text-slate-400">· {execution.pages_audited} page{execution.pages_audited !== 1 ? 's' : ''}</span>}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-700 transition-colors text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Error */}
        {execution.error_message && (
          <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/20 text-sm text-red-400">{execution.error_message}</div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Critical', count: execution.critical_count, color: IMPACT_COLOR.critical },
            { label: 'Serious', count: execution.serious_count, color: IMPACT_COLOR.serious },
            { label: 'Moderate', count: execution.moderate_count, color: IMPACT_COLOR.moderate },
            { label: 'Minor', count: execution.minor_count, color: IMPACT_COLOR.minor },
          ].map(({ label, count, color }) => (
            <div key={label} className={`rounded-xl p-4 border text-center ${color.bg} ${color.border}`}>
              <p className={`text-2xl font-bold ${color.text}`}>{count}</p>
              <p className="text-xs font-medium mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>{label}</p>
            </div>
          ))}
        </div>

        {/* AI fix suggestions button */}
        {aiEnabled && violations.length > 0 && (
          <div>
            {aiError && <p className="text-xs text-red-400 mb-2">{aiError}</p>}
            {Object.keys(aiFixes).length > 0 ? (
              <div className="flex items-center gap-2 text-xs text-green-400 mb-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                AI fix suggestions loaded — click a violation to view
              </div>
            ) : (
              <button onClick={fetchAiFixes} disabled={aiLoading}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 transition-colors disabled:opacity-50">
                {aiLoading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14v-4H7l5-8v4h4l-5 8z"/></svg>
                )}
                {aiLoading ? 'Getting AI fix suggestions…' : 'Get AI Fix Suggestions'}
              </button>
            )}
          </div>
        )}

        {/* Violations by impact */}
        {violations.length === 0 && execution.status !== 'running' && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="text-sm font-medium text-green-400">No violations found!</p>
            <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-tertiary))' }}>All pages passed the accessibility audit.</p>
          </div>
        )}

        {['critical', 'serious', 'moderate', 'minor'].map(impact => {
          const list = bySeverity[impact];
          if (list.length === 0) return null;
          const c = impactColor(impact);
          const isOpen = expandedImpact === impact;
          return (
            <div key={impact} className={`rounded-xl border overflow-hidden ${c.border}`}>
              <button onClick={() => setExpandedImpact(isOpen ? null : impact)}
                className={`w-full flex items-center justify-between px-4 py-3 ${c.bg} transition-colors`}>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>{impact.toUpperCase()}</span>
                  <span className={`text-sm font-medium ${c.text}`}>{list.length} violation{list.length !== 1 ? 's' : ''}</span>
                </div>
                <svg className={`w-4 h-4 ${c.text} transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isOpen && (
                <div className="divide-y" style={{ borderColor: 'rgb(var(--border-primary))' }}>
                  {list.map((v, i) => (
                    <button key={i} onClick={() => setSelectedViolation(v)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-800/50 transition-colors flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{v.id}</p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'rgb(var(--text-secondary))' }}>{v.description}</p>
                        {v.page && <p className="text-xs mt-0.5 text-slate-500 truncate">{v.page}</p>}
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        {aiFixes[v.id] && <span className="text-xs text-indigo-400 font-medium">AI Fix ✓</span>}
                        <p className="text-xs" style={{ color: 'rgb(var(--text-tertiary))' }}>{(v.nodes || []).length} element{(v.nodes || []).length !== 1 ? 's' : ''}</p>
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedViolation && (
        <ViolationDetail
          violation={selectedViolation}
          onClose={() => setSelectedViolation(null)}
          aiEnabled={aiEnabled}
          aiFix={aiFixes[selectedViolation.id]}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main AccessibilityTests component
// ---------------------------------------------------------------------------
export default function AccessibilityTests({ orgInfo }) {
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
      const r = await fetch(`${API_URL}/accessibility-tests`, { headers: auth() });
      if (r.ok) setTests(await r.json());
    } catch {}
  }, []);

  const loadRuns = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/accessibility-tests/executions/all`, { headers: auth() });
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
    const id = setInterval(async () => {
      let allDone = true;
      for (const execId of pollingIds) {
        try {
          const r = await fetch(`${API_URL}/accessibility-tests/executions/${execId}`, { headers: auth() });
          if (r.ok) {
            const exec = await r.json();
            if (exec.status !== 'running') {
              setPollingIds(prev => { const s = new Set(prev); s.delete(execId); return s; });
              setRuns(prev => prev.map(e => e.id === execId ? exec : e));
              setRunningIds(prev => { const s = new Set(prev); s.delete(exec.test_id); return s; });
            } else {
              allDone = false;
            }
          }
        } catch {}
      }
    }, 3000);
    return () => clearInterval(id);
  }, [pollingIds]);

  const handleRun = async (test) => {
    setRunningIds(prev => new Set([...prev, test.id]));
    try {
      const r = await fetch(`${API_URL}/accessibility-tests/${test.id}/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() }
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Run failed'); }
      const { executionId } = await r.json();
      // Add placeholder row to runs list
      const placeholder = { id: executionId, test_id: test.id, test_name: test.name, status: 'running', started_at: new Date().toISOString(), critical_count: 0, serious_count: 0, moderate_count: 0, minor_count: 0 };
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
    const url = isEdit ? `${API_URL}/accessibility-tests/${testModal.id}` : `${API_URL}/accessibility-tests`;
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
    if (!confirm(`Delete "${test.name}"? All audit history will also be deleted.`)) return;
    const r = await fetch(`${API_URL}/accessibility-tests/${test.id}`, { method: 'DELETE', headers: auth() });
    if (r.ok) {
      setTests(prev => prev.filter(t => t.id !== test.id));
      setRuns(prev => prev.filter(e => e.test_id !== test.id));
    }
  };

  const handleDeleteRun = async (run) => {
    if (!confirm('Delete this audit run?')) return;
    const r = await fetch(`${API_URL}/accessibility-tests/executions/${run.id}`, { method: 'DELETE', headers: auth() });
    if (r.ok) setRuns(prev => prev.filter(e => e.id !== run.id));
  };

  const openExecution = async (run) => {
    // Fetch full execution with violations_json if not already loaded
    if (!run.violations_json) {
      try {
        const r = await fetch(`${API_URL}/accessibility-tests/executions/${run.id}`, { headers: auth() });
        if (r.ok) { setSelectedExecution(await r.json()); return; }
      } catch {}
    }
    setSelectedExecution(run);
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
          <h1 className="text-2xl font-semibold">Accessibility Testing</h1>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
            Automated WCAG audits powered by axe-core via Playwright
            {aiEnabled && <span className="ml-2 text-xs text-indigo-400 font-medium">· AI Fix Suggestions enabled</span>}
          </p>
        </div>
        {tab === 'tests' && (
          <button onClick={() => setTestModal('new')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium shadow-lg shadow-indigo-600/30 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Test
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b pb-0" style={{ borderColor: 'rgb(var(--border-primary))' }}>
        {[
          { key: 'tests', label: 'Tests', count: tests.length },
          { key: 'runs', label: 'Audit Runs', count: runs.length },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors relative -mb-px border-b-2 ${
              tab === t.key ? 'text-indigo-400 border-indigo-500' : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}>
            {t.label}
            {t.count > 0 && <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300">{t.count}</span>}
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium">No accessibility tests yet</p>
              <p className="text-xs mt-1 mb-4" style={{ color: 'rgb(var(--text-tertiary))' }}>Create a test and run a WCAG audit on any URL</p>
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
                return (
                  <div key={test.id} className="rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-indigo-500/40 transition-colors"
                    style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{test.name}</h3>
                        {recentRun && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${recentRun.status === 'passed' ? 'bg-green-500/20 text-green-400' : recentRun.status === 'failed' ? 'bg-red-500/20 text-red-400' : recentRun.status === 'running' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-400'}`}>
                            {recentRun.status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'rgb(var(--text-secondary))' }}>{test.target_url}</p>
                      {test.description && <p className="text-xs mt-1 text-slate-500 truncate">{test.description}</p>}
                      {recentRun && recentRun.status !== 'running' && (
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {[
                            { label: 'Critical', val: recentRun.critical_count, color: 'text-red-400' },
                            { label: 'Serious', val: recentRun.serious_count, color: 'text-orange-400' },
                            { label: 'Moderate', val: recentRun.moderate_count, color: 'text-yellow-400' },
                            { label: 'Minor', val: recentRun.minor_count, color: 'text-blue-400' },
                          ].map(({ label, val, color }) => (
                            <span key={label} className="text-xs">
                              <span className={`font-bold ${color}`}>{val}</span>
                              <span className="ml-1" style={{ color: 'rgb(var(--text-tertiary))' }}>{label}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {recentRun && (
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
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                            Auditing…
                          </>
                        ) : 'Run Audit'}
                      </button>
                      <button onClick={() => setTestModal(test)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-700 transition-colors text-slate-400" title="Edit">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button onClick={() => handleDeleteTest(test)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-900/30 transition-colors text-slate-400 hover:text-red-400" title="Delete">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
              <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>No audit runs yet</p>
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-tertiary))' }}>Go to Tests tab and run an audit</p>
            </div>
          ) : (
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'rgb(var(--border-primary))' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderBottom: '1px solid rgb(var(--border-primary))' }}>
                    {['Test', 'Status', 'Critical', 'Serious', 'Moderate', 'Minor', 'Pages', 'Started', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'rgb(var(--text-tertiary))' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'rgb(var(--border-primary))' }}>
                  {runs.map(run => (
                    <tr key={run.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="px-4 py-3 font-medium truncate max-w-[160px]">{run.test_name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          run.status === 'passed' ? 'bg-green-500/20 text-green-400' :
                          run.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          run.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-slate-700 text-slate-400'
                        }`}>
                          {run.status === 'running' ? (
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                              running
                            </span>
                          ) : run.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-red-400 font-semibold">{run.critical_count}</td>
                      <td className="px-4 py-3 text-orange-400 font-semibold">{run.serious_count}</td>
                      <td className="px-4 py-3 text-yellow-400 font-semibold">{run.moderate_count}</td>
                      <td className="px-4 py-3 text-blue-400 font-semibold">{run.minor_count}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{run.pages_audited || '—'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-tertiary))' }}>{new Date(run.started_at).toLocaleString()}</td>
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
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
        />
      )}
      {selectedExecution && (
        <ExecutionDetail
          execution={selectedExecution}
          onClose={() => setSelectedExecution(null)}
          aiEnabled={aiEnabled}
        />
      )}
    </div>
  );
}
