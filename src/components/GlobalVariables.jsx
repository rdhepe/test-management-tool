import { useState, useEffect, useCallback } from 'react';

const API_URL = 'http://localhost:3001';

const EMPTY_FORM = { key: '', value: '', description: '' };

export default function GlobalVariables() {
  const [vars, setVars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Inline add state
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [addError, setAddError] = useState('');

  // Inline edit state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editError, setEditError] = useState('');

  // Per-row value visibility
  const [visibleValues, setVisibleValues] = useState({});

  // Copied key feedback
  const [copiedId, setCopiedId] = useState(null);

  // Usage guide modal
  const [showGuide, setShowGuide] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/global-variables`);
      const data = await res.json();
      setVars(data);
    } catch {
      setError('Failed to load variables');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!addForm.key.trim()) { setAddError('Key is required'); return; }
    try {
      const res = await fetch(`${API_URL}/global-variables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error || 'Failed to add'); return; }
      setAdding(false);
      setAddForm(EMPTY_FORM);
      setAddError('');
      load();
    } catch {
      setAddError('Network error');
    }
  };

  const handleEdit = async () => {
    if (!editForm.key.trim()) { setEditError('Key is required'); return; }
    try {
      const res = await fetch(`${API_URL}/global-variables/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error || 'Failed to update'); return; }
      setEditingId(null);
      setEditForm(EMPTY_FORM);
      setEditError('');
      load();
    } catch {
      setEditError('Network error');
    }
  };

  const handleDelete = async (id, key) => {
    if (!confirm(`Delete variable "${key}"?`)) return;
    try {
      await fetch(`${API_URL}/global-variables/${id}`, { method: 'DELETE' });
      load();
    } catch {
      setError('Failed to delete');
    }
  };

  const copyEnvKey = (v) => {
    navigator.clipboard.writeText(`process.env.${v.key}`).catch(() => {});
    setCopiedId(v.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const toggleVisibility = (id) =>
    setVisibleValues(prev => ({ ...prev, [id]: !prev[id] }));

  const startEdit = (v) => {
    setEditingId(v.id);
    setEditForm({ key: v.key, value: v.value, description: v.description || '' });
    setEditError('');
    setAdding(false);
  };

  const cancelEdit = () => { setEditingId(null); setEditForm(EMPTY_FORM); setEditError(''); };
  const cancelAdd  = () => { setAdding(false); setAddForm(EMPTY_FORM); setAddError(''); };

  const TABLE_HEADER = (
    <thead>
      <tr className="border-b border-slate-800">
        <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 w-[22%]">Key</th>
        <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 w-[25%]">Value</th>
        <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Description</th>
        <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 w-[120px]">Actions</th>
      </tr>
    </thead>
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Global Variables</h1>
          <p className="text-slate-400 text-sm mt-1">
            Define shared key-value pairs that are injected into every test run as environment variables.
            Access them in your test code via <code className="text-orange-400 bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono">process.env.YOUR_KEY</code>.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How to Use
          </button>
          {!adding && (
            <button
              onClick={() => { setAdding(true); setEditingId(null); }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Variable
            </button>
          )}
        </div>
      </div>

      {/* Main table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-lg overflow-hidden">
        {error && (
          <div className="px-4 py-3 bg-red-950/40 border-b border-red-800/30 text-red-400 text-sm">{error}</div>
        )}

        <table className="w-full text-sm">
          {TABLE_HEADER}
          <tbody className="divide-y divide-slate-800">

            {/* Inline add row */}
            {adding && (
              <tr className="bg-indigo-950/20">
                <td className="px-4 py-3">
                  <input
                    autoFocus
                    className="w-full bg-slate-800 border border-indigo-500/50 rounded-lg px-3 py-1.5 text-white text-sm font-mono focus:outline-none focus:border-indigo-400"
                    placeholder="BASE_URL"
                    value={addForm.key}
                    onChange={e => setAddForm(f => ({ ...f, key: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') cancelAdd(); }}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm font-mono focus:outline-none focus:border-indigo-400"
                    placeholder="https://example.com"
                    value={addForm.value}
                    onChange={e => setAddForm(f => ({ ...f, value: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') cancelAdd(); }}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-400"
                    placeholder="Optional description"
                    value={addForm.description}
                    onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') cancelAdd(); }}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={handleAdd} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">Save</button>
                    <button onClick={cancelAdd} className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">Cancel</button>
                  </div>
                </td>
              </tr>
            )}
            {addError && adding && (
              <tr className="bg-red-950/20">
                <td colSpan={4} className="px-4 py-2 text-red-400 text-xs">{addError}</td>
              </tr>
            )}

            {/* Data rows */}
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500 text-sm">Loading...</td>
              </tr>
            ) : vars.length === 0 && !adding ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <div className="text-slate-500 text-sm">No variables defined yet</div>
                  <button
                    onClick={() => setAdding(true)}
                    className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm underline underline-offset-2 transition-colors"
                  >
                    Add your first variable
                  </button>
                </td>
              </tr>
            ) : (
              vars.map(v => editingId === v.id ? (
                // Inline edit row
                <tr key={v.id} className="bg-indigo-950/10">
                  <td className="px-4 py-3">
                    <input
                      autoFocus
                      className="w-full bg-slate-800 border border-indigo-500/50 rounded-lg px-3 py-1.5 text-white text-sm font-mono focus:outline-none focus:border-indigo-400"
                      value={editForm.key}
                      onChange={e => setEditForm(f => ({ ...f, key: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') handleEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm font-mono focus:outline-none focus:border-indigo-400"
                      value={editForm.value}
                      onChange={e => setEditForm(f => ({ ...f, value: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') handleEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-400"
                      value={editForm.description}
                      onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') handleEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {editError && <span className="text-red-400 text-xs mr-1">{editError}</span>}
                      <button onClick={handleEdit} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">Save</button>
                      <button onClick={cancelEdit} className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">Cancel</button>
                    </div>
                  </td>
                </tr>
              ) : (
                // Read-only row
                <tr key={v.id} className="group hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="text-indigo-300 font-mono text-sm">{v.key}</code>
                      <button
                        onClick={() => copyEnvKey(v)}
                        title="Copy process.env.KEY"
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 transition-all"
                      >
                        {copiedId === v.id ? (
                          <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-slate-300 truncate max-w-[150px]">
                        {visibleValues[v.id] ? v.value : (v.value ? '••••••••' : <span className="text-slate-600 italic text-xs">(empty)</span>)}
                      </span>
                      {v.value && (
                        <button
                          onClick={() => toggleVisibility(v.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 transition-all shrink-0"
                          title={visibleValues[v.id] ? 'Hide value' : 'Show value'}
                        >
                          {visibleValues[v.id] ? (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-sm truncate max-w-xs">{v.description || <span className="text-slate-600">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(v)}
                        className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-slate-700"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(v.id, v.key)}
                        className="text-slate-400 hover:text-red-400 transition-colors p-1 rounded hover:bg-slate-700"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {vars.length > 0 && (
        <p className="text-slate-600 text-xs">{vars.length} variable{vars.length !== 1 ? 's' : ''} defined &bull; All are injected into single runs and suite runs automatically.</p>
      )}

      {/* Usage Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowGuide(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 rounded-t-2xl z-10">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <h2 className="text-lg font-semibold text-white">How to Use Global Variables in Tests</h2>
              </div>
              <button onClick={() => setShowGuide(false)} className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-6 text-sm text-slate-300">

              {/* Reading */}
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Reading a variable</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                  <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                    <div className="text-slate-500 mb-1.5">// Access by key name</div>
                    <div className="text-green-400">const url = process.env.BASE_URL;</div>
                  </div>
                  <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                    <div className="text-slate-500 mb-1.5">// Use directly in actions</div>
                    <div className="text-green-400">await page.goto(process.env.BASE_URL);</div>
                  </div>
                </div>
                <p className="text-slate-500 text-xs mt-2">Variables are snapshotted into <code className="text-orange-400 bg-slate-800 px-1 rounded">process.env</code> at the start of every run — no code changes needed when values change.</p>
              </div>

              <div className="border-t border-slate-800" />

              {/* Writing */}
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Saving a value during a test</div>
                <p className="text-slate-400 text-xs mb-3">Use this when a test produces something you want to keep — like a login token or a generated ID — so other tests can use it later.</p>
                <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 font-mono text-xs space-y-0.5">
                  <div className="text-slate-500">// Replace AUTH_TOKEN with your variable name, and token with the value to save</div>
                  <div className="text-green-400">{'await fetch("http://localhost:3001/global-variables/by-key/AUTH_TOKEN", {'}</div>
                  <div className="text-green-400 pl-4">{'method: "PATCH",'}</div>
                  <div className="text-green-400 pl-4">{'headers: { "Content-Type": "application/json" },'}</div>
                  <div className="text-green-400 pl-4">{'body: JSON.stringify({ value: token }),'}</div>
                  <div className="text-green-400">{'});'}</div>
                  <div className="text-slate-600 mt-2">{'// Creates the variable if it doesn\'t exist, or updates it if it does.'}</div>
                </div>
              </div>

              <div className="border-t border-slate-800" />

              {/* Reading back within same run */}
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Reading a value saved by an earlier test</div>
                <p className="text-slate-400 text-xs mb-3"><code className="text-orange-400 bg-slate-800 px-1 rounded">process.env</code> is locked in when the run starts, so it won't pick up values saved mid-run. Fetch the latest value directly instead:</p>
                <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 font-mono text-xs space-y-0.5">
                  <div className="text-green-400">{'const res = await fetch("http://localhost:3001/global-variables");'}</div>
                  <div className="text-green-400">{'const vars = await res.json();'}</div>
                  <div className="text-green-400">{'const token = vars.find(v => v.key === "AUTH_TOKEN")?.value;'}</div>
                </div>
              </div>

              <div className="bg-amber-950/30 border border-amber-700/30 rounded-xl p-4 text-xs text-amber-300">
                <span className="font-semibold">Tip:</span> For static values set before a run (base URLs, credentials), <code className="text-orange-400 bg-slate-800 px-1 rounded">process.env.KEY</code> is all you need. Only use the fetch approach when a value is written and read within the same run.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
