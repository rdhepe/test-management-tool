import { useState, useEffect, useCallback } from 'react';
import API_URL from '../apiUrl';

// ─── helpers ────────────────────────────────────────────────────────────────

const EMPTY_FORM = { page_name: '', object_name: '', selector: '', description: '', folder_id: null };

function buildTree(folders, parentId = null) {
  return folders
    .filter(f => (f.parent_id ?? null) === parentId)
    .map(f => ({ ...f, children: buildTree(folders, f.id) }));
}

function flattenTree(nodes, depth = 0) {
  const list = [];
  for (const n of nodes) {
    list.push({ ...n, depth });
    if (n.children?.length) list.push(...flattenTree(n.children, depth + 1));
  }
  return list;
}

function folderPath(folders, id) {
  const parts = [];
  let cur = folders.find(f => f.id === id);
  while (cur) {
    parts.unshift(cur.name);
    cur = folders.find(f => f.id === cur.parent_id);
  }
  return parts.join(' / ');
}

// ─── FormRow ─────────────────────────────────────────────────────────────────

function FormRow({ form, setForm, error: formErr, onSave, onCancel, saveLabel, flatFolders }) {
  return (
    <tr className="bg-slate-800/60">
      <td colSpan={6} className="px-4 py-3">
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
        <div className="mb-2">
          <select
            value={form.folder_id ?? ''}
            onChange={e => setForm(f => ({ ...f, folder_id: e.target.value ? parseInt(e.target.value) : null }))}
            className="px-3 py-1.5 rounded-lg text-sm bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 w-72"
          >
            <option value="">— No folder —</option>
            {flatFolders.map(ff => (
              <option key={ff.id} value={ff.id}>
                {'\u00a0\u00a0'.repeat(ff.depth)}{ff.name}
              </option>
            ))}
          </select>
        </div>
        {formErr && <p className="text-red-400 text-xs mb-2">{formErr}</p>}
        <div className="flex gap-2">
          <button onClick={onSave} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors">{saveLabel}</button>
          <button onClick={onCancel} className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-lg transition-colors">Cancel</button>
        </div>
      </td>
    </tr>
  );
}

// ─── FolderNode ──────────────────────────────────────────────────────────────

function FolderNode({
  node, depth,
  selectedId, onSelect,
  onAddChild,
  renamingId, renameValue, setRenameValue, onRenameSubmit, onRenameCancel, onStartRename,
  onDelete,
  objectCounts,
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children?.length > 0;
  const isSelected = selectedId === node.id;
  const isRenaming = renamingId === node.id;
  const count = objectCounts[node.id] ?? 0;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer select-none transition-colors ${
          isSelected ? 'bg-indigo-600/20 text-indigo-300' : 'hover:bg-slate-800 text-slate-300'
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        <button
          onClick={() => setExpanded(v => !v)}
          className="shrink-0 w-4 h-4 flex items-center justify-center text-slate-600 hover:text-slate-400"
        >
          {hasChildren ? (
            <svg className={`w-3 h-3 transition-transform ${expanded ? '' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          ) : <span className="w-3" />}
        </button>
        <svg className="w-3.5 h-3.5 shrink-0 text-amber-400/70" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onRenameSubmit(node.id); if (e.key === 'Escape') onRenameCancel(); }}
            onClick={e => e.stopPropagation()}
            className="flex-1 min-w-0 bg-slate-900 border border-indigo-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
          />
        ) : (
          <span className="flex-1 min-w-0 truncate text-xs" onClick={() => onSelect(node.id)}>{node.name}</span>
        )}
        {!isRenaming && count > 0 && (
          <span className="text-[10px] text-slate-600 shrink-0">{count}</span>
        )}
        {!isRenaming && (
          <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
            <button onClick={e => { e.stopPropagation(); onAddChild(node.id); }} className="p-0.5 text-slate-500 hover:text-teal-400 transition-colors" title="Add subfolder">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
            <button onClick={e => { e.stopPropagation(); onStartRename(node.id, node.name); }} className="p-0.5 text-slate-500 hover:text-indigo-400 transition-colors" title="Rename">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(node.id, node.name); }} className="p-0.5 text-slate-500 hover:text-red-400 transition-colors" title="Delete folder">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        )}
        {isRenaming && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={() => onRenameSubmit(node.id)} className="p-0.5 text-green-400 hover:text-green-300">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </button>
            <button onClick={onRenameCancel} className="p-0.5 text-red-400 hover:text-red-300">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <FolderNode
              key={child.id} node={child} depth={depth + 1}
              selectedId={selectedId} onSelect={onSelect} onAddChild={onAddChild}
              renamingId={renamingId} renameValue={renameValue} setRenameValue={setRenameValue}
              onRenameSubmit={onRenameSubmit} onRenameCancel={onRenameCancel} onStartRename={onStartRename}
              onDelete={onDelete} objectCounts={objectCounts}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AddFolderRow ─────────────────────────────────────────────────────────────

function AddFolderRow({ parentLabel, value, onChange, onSave, onCancel }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1">
      <svg className="w-3.5 h-3.5 shrink-0 text-amber-400/50" fill="currentColor" viewBox="0 0 20 20">
        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
      </svg>
      <input
        autoFocus
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
        placeholder={parentLabel ? `Subfolder in ${parentLabel}…` : 'New folder name…'}
        className="flex-1 min-w-0 bg-slate-900 border border-indigo-500 rounded px-1.5 py-0.5 text-xs text-white placeholder-slate-500 focus:outline-none"
      />
      <button onClick={onSave} className="p-0.5 text-green-400 hover:text-green-300 shrink-0">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      </button>
      <button onClick={onCancel} className="p-0.5 text-red-400 hover:text-red-300 shrink-0">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

export default function ObjectRepository() {
  const [objects, setObjects]   = useState([]);
  const [folders, setFolders]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  // Folder tree state
  const [selectedFolderId, setSelectedFolderId] = useState(undefined); // undefined=All, null=Uncategorised, number=folder
  const [renamingFolderId, setRenamingFolderId] = useState(null);
  const [renameValue, setRenameValue]           = useState('');
  const [addingFolderParentId, setAddingFolderParentId] = useState(undefined); // undefined=not adding, null=root, id=child
  const [newFolderName, setNewFolderName]               = useState('');

  // Object form state
  const [adding, setAdding]       = useState(false);
  const [addForm, setAddForm]     = useState(EMPTY_FORM);
  const [addError, setAddError]   = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm]   = useState(EMPTY_FORM);
  const [editError, setEditError] = useState('');

  // UI state
  const [copiedId, setCopiedId]             = useState(null);
  const [collapsedPages, setCollapsedPages] = useState({});
  const [showGuide, setShowGuide]           = useState(false);
  const [filterPage, setFilterPage]         = useState('');

  const authHeader = () => ({ 'x-auth-token': localStorage.getItem('auth_token') || '' });

  const loadObjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/object-repository`, { headers: authHeader() });
      setObjects(await res.json());
    } catch { setError('Failed to load objects'); }
    finally { setLoading(false); }
  }, []);

  const loadFolders = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/or-folders`, { headers: authHeader() });
      const data = await res.json();
      setFolders(Array.isArray(data) ? data : []);
    } catch { setFolders([]); }
  }, []);

  useEffect(() => { loadObjects(); loadFolders(); }, [loadObjects, loadFolders]);

  const tree        = buildTree(folders, null);
  const flatFolders = flattenTree(tree);

  const objectCounts = objects.reduce((acc, obj) => {
    const fid = obj.folder_id != null ? obj.folder_id : '__none__';
    acc[fid] = (acc[fid] || 0) + 1;
    return acc;
  }, {});

  const visibleObjects = selectedFolderId === undefined
    ? objects
    : selectedFolderId === null
    ? objects.filter(o => o.folder_id == null)
    : objects.filter(o => o.folder_id === selectedFolderId);

  const grouped = visibleObjects.reduce((acc, obj) => {
    if (!acc[obj.page_name]) acc[obj.page_name] = [];
    acc[obj.page_name].push(obj);
    return acc;
  }, {});

  const pages = Object.keys(grouped).sort();
  const filteredPages = filterPage.trim()
    ? pages.filter(p => p.toLowerCase().includes(filterPage.toLowerCase()))
    : pages;

  // ── folder CRUD ───────────────────────────────────────────────────────────

  const saveNewFolder = async () => {
    if (!newFolderName.trim()) return;
    await fetch(`${API_URL}/or-folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ name: newFolderName.trim(), parent_id: addingFolderParentId }),
    });
    setAddingFolderParentId(undefined); setNewFolderName(''); loadFolders();
  };

  const submitRename = async (id) => {
    if (!renameValue.trim()) return;
    const folder = folders.find(f => f.id === id);
    await fetch(`${API_URL}/or-folders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ name: renameValue.trim(), parent_id: folder?.parent_id }),
    });
    setRenamingFolderId(null); loadFolders();
  };

  const deleteFolder = async (id, name) => {
    if (!confirm(`Delete folder "${name}"? Objects inside will become uncategorised.`)) return;
    await fetch(`${API_URL}/or-folders/${id}`, { method: 'DELETE', headers: authHeader() });
    if (selectedFolderId === id) setSelectedFolderId(undefined);
    loadFolders();
  };

  // ── object CRUD ───────────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!addForm.page_name.trim())   { setAddError('Page name is required'); return; }
    if (!addForm.object_name.trim()) { setAddError('Object name is required'); return; }
    if (!addForm.selector.trim())    { setAddError('Selector is required'); return; }
    try {
      const res = await fetch(`${API_URL}/object-repository`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error || 'Failed to add'); return; }
      setAdding(false); setAddForm({ ...EMPTY_FORM, folder_id: selectedFolderId ?? null });
      setAddError(''); loadObjects();
    } catch { setAddError('Network error'); }
  };

  const handleEdit = async () => {
    if (!editForm.page_name.trim())   { setEditError('Page name is required'); return; }
    if (!editForm.object_name.trim()) { setEditError('Object name is required'); return; }
    if (!editForm.selector.trim())    { setEditError('Selector is required'); return; }
    try {
      const res = await fetch(`${API_URL}/object-repository/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error || 'Failed to update'); return; }
      setEditingId(null); setEditForm(EMPTY_FORM); setEditError(''); loadObjects();
    } catch { setEditError('Network error'); }
  };

  const handleDelete = async (id, pageName, objectName) => {
    if (!confirm(`Delete "${pageName}.${objectName}"?`)) return;
    await fetch(`${API_URL}/object-repository/${id}`, { method: 'DELETE', headers: authHeader() });
    loadObjects();
  };

  const copyReference = (obj) => {
    navigator.clipboard.writeText(`OR.${obj.page_name}.${obj.object_name}`).catch(() => {});
    setCopiedId(obj.id); setTimeout(() => setCopiedId(null), 1500);
  };

  const startEdit = (obj) => {
    setEditingId(obj.id);
    setEditForm({ page_name: obj.page_name, object_name: obj.object_name, selector: obj.selector, description: obj.description || '', folder_id: obj.folder_id ?? null });
    setEditError(''); setAdding(false);
  };

  const startAdd = () => {
    setAdding(true); setEditingId(null);
    setAddForm({ ...EMPTY_FORM, folder_id: (selectedFolderId !== undefined ? selectedFolderId : null) });
    setAddError('');
  };

  const cancelEdit = () => { setEditingId(null); setEditForm(EMPTY_FORM); setEditError(''); };
  const cancelAdd  = () => { setAdding(false);   setAddForm(EMPTY_FORM); setAddError(''); };
  const togglePage = (page) => setCollapsedPages(prev => ({ ...prev, [page]: !prev[page] }));

  const selectedFolderLabel =
    selectedFolderId === undefined ? null :
    selectedFolderId === null ? 'Uncategorised' :
    folderPath(folders, selectedFolderId);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Folder tree ─────────────────────────────────────────────── */}
      <div className="w-56 shrink-0 flex flex-col border-r border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800 shrink-0">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Folders</span>
          <button
            onClick={() => { setAddingFolderParentId(null); setNewFolderName(''); }}
            className="p-1 text-slate-500 hover:text-teal-400 transition-colors"
            title="New top-level folder"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          <button
            onClick={() => setSelectedFolderId(undefined)}
            className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg transition-colors mx-1 ${
              selectedFolderId === undefined ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>All Objects</span>
            <span className="ml-auto text-[10px] text-slate-600">{objects.length}</span>
          </button>
          <button
            onClick={() => setSelectedFolderId(null)}
            className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg transition-colors mx-1 ${
              selectedFolderId === null ? 'bg-slate-700/50 text-slate-200' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
            }`}
          >
            <svg className="w-3.5 h-3.5 shrink-0 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Uncategorised</span>
            <span className="ml-auto text-[10px] text-slate-600">{objectCounts['__none__'] ?? 0}</span>
          </button>
          <div className="mt-1 border-t border-slate-800/50 pt-1">
            {addingFolderParentId === null && (
              <AddFolderRow parentLabel={null} value={newFolderName} onChange={setNewFolderName} onSave={saveNewFolder} onCancel={() => setAddingFolderParentId(undefined)} />
            )}
            {tree.map(node => (
              <FolderNode
                key={node.id} node={node} depth={0}
                selectedId={selectedFolderId} onSelect={id => setSelectedFolderId(id)}
                onAddChild={parentId => { setAddingFolderParentId(parentId); setNewFolderName(''); }}
                renamingId={renamingFolderId} renameValue={renameValue} setRenameValue={setRenameValue}
                onRenameSubmit={submitRename} onRenameCancel={() => setRenamingFolderId(null)}
                onStartRename={(id, name) => { setRenamingFolderId(id); setRenameValue(name); }}
                onDelete={deleteFolder} objectCounts={objectCounts}
              />
            ))}
            {addingFolderParentId !== null && addingFolderParentId !== undefined && (
              <AddFolderRow parentLabel={folders.find(f => f.id === addingFolderParentId)?.name} value={newFolderName} onChange={setNewFolderName} onSave={saveNewFolder} onCancel={() => setAddingFolderParentId(undefined)} />
            )}
            {folders.length === 0 && addingFolderParentId === undefined && (
              <p className="px-3 py-4 text-xs text-slate-600 text-center leading-relaxed">No folders yet.<br />Click <strong className="text-slate-500">+</strong> to create one.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: Objects area ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-5 max-w-5xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white">Object Repository</h1>
                {selectedFolderLabel && (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                    {selectedFolderLabel}
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-sm mt-1">
                Access in tests via{' '}
                <code className="text-orange-400 bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono">const OR = require('./_or')</code>
                {' '}then{' '}
                <code className="text-orange-400 bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono">page.locator(OR.PageName.objectName)</code>.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setShowGuide(v => !v)} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                How to Use
              </button>
              {!adding && (
                <button onClick={startAdd} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Object
                </button>
              )}
            </div>
          </div>

          {showGuide && (
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-indigo-300">How the Object Repository works</h3>
              <p className="text-sm text-slate-400">TestStudio auto-generates a <code className="text-orange-400 bg-slate-900 px-1 rounded text-xs">_or.js</code> file each time a test runs. Add this at the top of any test:</p>
              <pre className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs font-mono text-emerald-300 overflow-x-auto">{`const OR = require('./_or');\n\nawait page.locator(OR.LoginPage.emailInput).fill('user@test.com');\nawait page.locator(OR.LoginPage.submitButton).click();`}</pre>
              <p className="text-sm text-slate-400"><strong className="text-slate-300">Folders</strong> are for organisation only — they don't affect the generated OR reference.</p>
            </div>
          )}

          {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>}

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 flex-1 max-w-xs">
              <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z" /></svg>
              <input type="text" value={filterPage} onChange={e => setFilterPage(e.target.value)} placeholder="Filter by page name…" className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
            </div>
            <span className="text-xs text-slate-500">{visibleObjects.length} object{visibleObjects.length !== 1 ? 's' : ''} · {pages.length} page{pages.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50">
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Page / Object</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 w-[26%]">Selector</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Description</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 w-[110px]">Folder</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 w-[130px]">Reference</th>
                  <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 w-[80px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {adding && <FormRow form={addForm} setForm={setAddForm} error={addError} onSave={handleAdd} onCancel={cancelAdd} saveLabel="Add Object" flatFolders={flatFolders} />}
                {loading && !objects.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">Loading…</td></tr>}
                {!loading && filteredPages.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">
                    {visibleObjects.length === 0 ? (selectedFolderId === undefined ? 'No objects yet. Click "Add Object" to get started.' : 'No objects in this folder.') : 'No pages match your filter.'}
                  </td></tr>
                )}
                {filteredPages.map(page => (
                  <>
                    <tr key={`hdr-${page}`} className="bg-slate-800/40 cursor-pointer select-none" onClick={() => togglePage(page)}>
                      <td colSpan={6} className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <svg className={`w-3.5 h-3.5 text-slate-500 transition-transform ${collapsedPages[page] ? '-rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">{page}</span>
                          <span className="text-xs text-slate-600 ml-1">{grouped[page].length} object{grouped[page].length !== 1 ? 's' : ''}</span>
                        </div>
                      </td>
                    </tr>
                    {!collapsedPages[page] && grouped[page].map(obj =>
                      editingId === obj.id ? (
                        <FormRow key={obj.id} form={editForm} setForm={setEditForm} error={editError} onSave={handleEdit} onCancel={cancelEdit} saveLabel="Save Changes" flatFolders={flatFolders} />
                      ) : (
                        <tr key={obj.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3"><div className="flex items-center gap-1.5"><span className="text-xs text-slate-600">{obj.page_name}.</span><span className="text-sm font-medium text-white">{obj.object_name}</span></div></td>
                          <td className="px-4 py-3"><code className="text-xs font-mono text-emerald-400 bg-slate-900 px-2 py-1 rounded border border-slate-700">{obj.selector}</code></td>
                          <td className="px-4 py-3 text-sm text-slate-400">{obj.description || <span className="text-slate-600">—</span>}</td>
                          <td className="px-4 py-3">
                            {obj.folder_id ? (
                              <span className="text-[10px] text-amber-400/80 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded truncate block max-w-[90px]" title={folderPath(folders, obj.folder_id)}>{folderPath(folders, obj.folder_id)}</span>
                            ) : <span className="text-slate-600 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => copyReference(obj)} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors bg-slate-800 hover:bg-slate-700 border border-slate-700" title={`Copy OR.${obj.page_name}.${obj.object_name}`}>
                              {copiedId === obj.id ? (<><svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span className="text-green-400">Copied</span></>) : (<><svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg><span className="font-mono text-[10px] text-slate-400">OR.{obj.object_name}</span></>)}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => startEdit(obj)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                              <button onClick={() => handleDelete(obj.id, obj.page_name, obj.object_name)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
