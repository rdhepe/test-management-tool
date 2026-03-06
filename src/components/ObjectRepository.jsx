import { useState, useEffect, useCallback } from 'react';
import API_URL from '../apiUrl';

const EMPTY_FORM = { page_name: '', object_name: '', selector: '', description: '' };

export default function ObjectRepository() {
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add form
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [addError, setAddError] = useState('');

  // Edit form
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editError, setEditError] = useState('');

  // UI state
  const [copiedId, setCopiedId] = useState(null);
  const [collapsedPages, setCollapsedPages] = useState({});
  const [showGuide, setShowGuide] = useState(false);
  const [filterPage, setFilterPage] = useState('');

  const authHeader = () => ({ 'x-auth-token': localStorage.getItem('auth_token') || '' });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/object-repository`, { headers: authHeader() });
      const data = await res.json();
      setObjects(data);
    } catch {
      setError('Failed to load object repository');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group objects by page_name
  const grouped = objects.reduce((acc, obj) => {
    const page = obj.page_name;
    if (!acc[page]) acc[page] = [];
    acc[page].push(obj);
    return acc;
  }, {});

  const pages = Object.keys(grouped).sort();
  const filteredPages = filterPage.trim()
    ? pages.filter(p => p.toLowerCase().includes(filterPage.toLowerCase()))
    : pages;

  const handleAdd = async () => {
    if (!addForm.page_name.trim()) { setAddError('Page name is required'); return; }
    if (!addForm.object_name.trim()) { setAddError('Object name is required'); return; }
    if (!addForm.selector.trim()) { setAddError('Selector is required'); return; }
    try {
      const res = await fetch(`${API_URL}/object-repository`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error || 'Failed to add'); return; }
      setAdding(false);
      setAddForm(EMPTY_FORM);
      setAddError('');
      load();
    } catch { setAddError('Network error'); }
  };

  const handleEdit = async () => {
    if (!editForm.page_name.trim()) { setEditError('Page name is required'); return; }
    if (!editForm.object_name.trim()) { setEditError('Object name is required'); return; }
    if (!editForm.selector.trim()) { setEditError('Selector is required'); return; }
    try {
      const res = await fetch(`${API_URL}/object-repository/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error || 'Failed to update'); return; }
      setEditingId(null);
      setEditForm(EMPTY_FORM);
      setEditError('');
      load();
    } catch { setEditError('Network error'); }
  };

  const handleDelete = async (id, pageName, objectName) => {
    if (!confirm(`Delete "${pageName}.${objectName}" from repository?`)) return;
    try {
      await fetch(`${API_URL}/object-repository/${id}`, { method: 'DELETE', headers: authHeader() });
      load();
    } catch { setError('Failed to delete'); }
  };

  const copyReference = (obj) => {
    navigator.clipboard.writeText(`OR.${obj.page_name}.${obj.object_name}`).catch(() => {});
    setCopiedId(obj.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const startEdit = (obj) => {
    setEditingId(obj.id);
    setEditForm({
      page_name: obj.page_name,
      object_name: obj.object_name,
      selector: obj.selector,
      description: obj.description || '',
    });
    setEditError('');
    setAdding(false);
  };

  const cancelEdit = () => { setEditingId(null); setEditForm(EMPTY_FORM); setEditError(''); };
  const cancelAdd  = () => { setAdding(false); setAddForm(EMPTY_FORM); setAddError(''); };

  const togglePage = (page) =>
    setCollapsedPages(prev => ({ ...prev, [page]: !prev[page] }));

  const FormRow = ({ form, setForm, error: formErr, onSave, onCancel, saveLabel }) => (
    <tr className="bg-slate-800/60">
      <td colSpan={5} className="px-4 py-3">
        <div className="grid grid-cols-4 gap-3 mb-2">
          <input
            placeholder="PageName (e.g. LoginPage)"
            value={form.page_name}
            onChange={e => setForm(f => ({ ...f, page_name: e.target.value }))}
            className="px-3 py-1.5 rounded-lg text-sm bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <input
            placeholder="objectName (e.g. emailInput)"
            value={form.object_name}
            onChange={e => setForm(f => ({ ...f, object_name: e.target.value }))}
            className="px-3 py-1.5 rounded-lg text-sm bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <input
            placeholder="Selector (e.g. #email)"
            value={form.selector}
            onChange={e => setForm(f => ({ ...f, selector: e.target.value }))}
            className="px-3 py-1.5 rounded-lg text-sm bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
          />
          <input
            placeholder="Description (optional)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="px-3 py-1.5 rounded-lg text-sm bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        {formErr && <p className="text-red-400 text-xs mb-2">{formErr}</p>}
        <div className="flex gap-2">
          <button
            onClick={onSave}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >{saveLabel}</button>
          <button
            onClick={onCancel}
            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-lg transition-colors"
          >Cancel</button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Object Repository</h1>
          <p className="text-slate-400 text-sm mt-1">
            Centralise UI element locators. Access them in test files via{' '}
            <code className="text-orange-400 bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono">
              const OR = require('./_or')
            </code>{' '}
            then{' '}
            <code className="text-orange-400 bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono">
              page.locator(OR.PageName.objectName)
            </code>.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowGuide(v => !v)}
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
              Add Object
            </button>
          )}
        </div>
      </div>

      {/* Usage guide */}
      {showGuide && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-indigo-300">How the Object Repository works</h3>
          <p className="text-sm text-slate-400">
            When a test runs, TestStudio auto-generates a <code className="text-orange-400 bg-slate-900 px-1 rounded text-xs">_or.js</code> file
            in the same temp directory as your test. Just add this line at the top of your test:
          </p>
          <pre className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs font-mono text-emerald-300 overflow-x-auto">
{`const OR = require('./_or');

// Then use it anywhere:
await page.locator(OR.LoginPage.emailInput).fill('user@test.com');
await page.locator(OR.LoginPage.submitButton).click();`}
          </pre>
          <p className="text-sm text-slate-400">
            If a selector changes, update it here once — every test using that reference is fixed automatically.
          </p>
          <p className="text-sm text-slate-400">
            Use the{' '}
            <span className="text-indigo-300 font-medium">Copy Reference</span>{' '}
            button on any row to copy the ready-to-paste reference to your clipboard.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
      )}

      {/* Filter + Stats bar */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z" />
          </svg>
          <input
            type="text"
            value={filterPage}
            onChange={e => setFilterPage(e.target.value)}
            placeholder="Filter by page name…"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <span className="text-xs text-slate-500">
          {objects.length} object{objects.length !== 1 ? 's' : ''} across {pages.length} page{pages.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Main table */}
      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50">
              <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Page / Object</th>
              <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 w-[28%]">Selector</th>
              <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Description</th>
              <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 w-[130px]">Reference</th>
              <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 w-[90px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {/* Inline add row — appears at top */}
            {adding && (
              <FormRow
                form={addForm}
                setForm={setAddForm}
                error={addError}
                onSave={handleAdd}
                onCancel={cancelAdd}
                saveLabel="Add Object"
              />
            )}

            {loading && !objects.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">Loading…</td>
              </tr>
            )}

            {!loading && filteredPages.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">
                  {objects.length === 0
                    ? 'No objects yet. Click "Add Object" to create your first entry.'
                    : 'No pages match your filter.'}
                </td>
              </tr>
            )}

            {filteredPages.map(page => (
              <>
                {/* Page group header */}
                <tr key={`hdr-${page}`} className="bg-slate-800/40 cursor-pointer select-none" onClick={() => togglePage(page)}>
                  <td colSpan={5} className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <svg
                        className={`w-3.5 h-3.5 text-slate-500 transition-transform ${collapsedPages[page] ? '-rotate-90' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">{page}</span>
                      <span className="text-xs text-slate-600 ml-1">
                        {grouped[page].length} object{grouped[page].length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </td>
                </tr>

                {/* Rows for this page */}
                {!collapsedPages[page] && grouped[page].map(obj => (
                  editingId === obj.id ? (
                    <FormRow
                      key={obj.id}
                      form={editForm}
                      setForm={setEditForm}
                      error={editError}
                      onSave={handleEdit}
                      onCancel={cancelEdit}
                      saveLabel="Save Changes"
                    />
                  ) : (
                    <tr key={obj.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Page.Object name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-600">{obj.page_name}.</span>
                          <span className="text-sm font-medium text-white">{obj.object_name}</span>
                        </div>
                      </td>
                      {/* Selector */}
                      <td className="px-4 py-3">
                        <code className="text-xs font-mono text-emerald-400 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                          {obj.selector}
                        </code>
                      </td>
                      {/* Description */}
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {obj.description || <span className="text-slate-600">—</span>}
                      </td>
                      {/* Copy reference */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => copyReference(obj)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors bg-slate-800 hover:bg-slate-700 border border-slate-700"
                          title={`Copy OR.${obj.page_name}.${obj.object_name}`}
                        >
                          {copiedId === obj.id ? (
                            <>
                              <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-green-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <span className="text-slate-400 font-mono text-[10px]">OR.{obj.page_name}.{obj.object_name}</span>
                            </>
                          )}
                        </button>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => startEdit(obj)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(obj.id, obj.page_name, obj.object_name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
