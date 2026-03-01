import React, { useState, useEffect, useRef, useCallback } from 'react';

const API_URL = 'http://localhost:3001';

// ─── Lightweight markdown → HTML renderer ────────────────────────────────────
function renderMarkdown(md) {
  if (!md) return '';
  let html = md;

  // Escape HTML first (for safety)
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Fenced code blocks (```lang\n...\n```)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="wiki-code-block"${lang ? ` data-lang="${lang}"` : ''}><code>${code.trimEnd()}</code></pre>`;
  });

  // Process line by line for block elements
  const lines = html.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Headings
    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^(#+)/)[1].length;
      const text = line.replace(/^#+\s+/, '');
      out.push(`<h${level} class="wiki-h${level}">${inlineMarkdown(text)}</h${level}>`);
      i++; continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      out.push('<hr class="wiki-hr" />');
      i++; continue;
    }

    // Blockquote
    if (line.startsWith('&gt;')) {
      const text = line.replace(/^&gt;\s?/, '');
      out.push(`<blockquote class="wiki-blockquote">${inlineMarkdown(text)}</blockquote>`);
      i++; continue;
    }

    // Unordered list item
    if (/^[\-\*\+]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[\s]*[\-\*\+]\s/.test(lines[i])) {
        const indent = lines[i].match(/^(\s*)/)[1].length;
        const text = lines[i].replace(/^[\s]*[\-\*\+]\s/, '');
        items.push({ indent, text });
        i++;
      }
      out.push('<ul class="wiki-ul">');
      items.forEach(it => out.push(`<li class="wiki-li" style="margin-left:${it.indent * 8}px">${inlineMarkdown(it.text)}</li>`));
      out.push('</ul>');
      continue;
    }

    // Ordered list item
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      out.push('<ol class="wiki-ol">');
      items.forEach(text => out.push(`<li class="wiki-li">${inlineMarkdown(text)}</li>`));
      out.push('</ol>');
      continue;
    }

    // Table (| col | col |)
    if (line.startsWith('|') && line.endsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        rows.push(lines[i]);
        i++;
      }
      // second row is separator (|---|---|)
      const isHeader = rows.length >= 2 && /^\|[\s\-|:]+\|$/.test(rows[1]);
      out.push('<div class="wiki-table-wrap"><table class="wiki-table">');
      rows.forEach((row, ri) => {
        if (isHeader && ri === 1) return; // skip separator
        const cells = row.split('|').slice(1, -1).map(c => c.trim());
        const tag = (isHeader && ri === 0) ? 'th' : 'td';
        const cls = (isHeader && ri === 0) ? 'wiki-th' : 'wiki-td';
        out.push(`<tr>${cells.map(c => `<${tag} class="${cls}">${inlineMarkdown(c)}</${tag}>`).join('')}</tr>`);
      });
      out.push('</table></div>');
      continue;
    }

    // Empty line → paragraph break
    if (line.trim() === '') {
      if (out.length && !out[out.length - 1].endsWith('</p>') && !out[out.length - 1].endsWith('<br/>')) {
        out.push('<br/>');
      }
      i++; continue;
    }

    // Already a block tag from fenced code
    if (line.startsWith('<pre ')) {
      out.push(line);
      i++; continue;
    }

    // Normal paragraph line
    out.push(`<p class="wiki-p">${inlineMarkdown(line)}</p>`);
    i++;
  }

  return out.join('\n');
}

function inlineMarkdown(text) {
  // Bold+italic
  text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  text = text.replace(/_(.*?)_/g, '<em>$1</em>');
  // Strikethrough
  text = text.replace(/~~(.*?)~~/g, '<del>$1</del>');
  // Inline code
  text = text.replace(/`([^`]+)`/g, '<code class="wiki-code">$1</code>');
  // Links [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="wiki-link" href="$2" target="_blank" rel="noopener">$1</a>');
  // Images ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img class="wiki-img" src="$2" alt="$1" />');
  // Highlight ==text==
  text = text.replace(/==(.*?)==/g, '<mark class="wiki-mark">$1</mark>');
  return text;
}

// ─── Toolbar button helper ────────────────────────────────────────────────────
function insertMarkdown(textarea, before, after = '', placeholder = '') {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.substring(start, end) || placeholder;
  const newText = textarea.value.substring(0, start) + before + selected + after + textarea.value.substring(end);
  return { newContent: newText, newCursor: start + before.length + selected.length + after.length };
}

// ─── Page tree item ───────────────────────────────────────────────────────────
function PageItem({ page, pages, selectedId, onSelect, onNewChild, onDelete, depth = 0 }) {
  const children = pages.filter(p => p.parent_id === page.id);
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <div
        className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer text-sm transition-colors ${
          selectedId === page.id
            ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
            : 'text-slate-300 hover:bg-slate-800'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(page.id)}
      >
        {children.length > 0 ? (
          <button
            onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
            className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-slate-300 flex-shrink-0"
          >
            <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
              <path d="M7.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>
        ) : (
          <span className="w-4 h-4 flex-shrink-0" />
        )}
        <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="flex-1 truncate">{page.title}</span>
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onNewChild(page.id); }}
            className="p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300"
            title="Add sub-page"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(page); }}
            className="p-0.5 rounded hover:bg-red-900/40 text-slate-500 hover:text-red-400"
            title="Delete page"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      {expanded && children.map(child => (
        <PageItem
          key={child.id}
          page={child}
          pages={pages}
          selectedId={selectedId}
          onSelect={onSelect}
          onNewChild={onNewChild}
          onDelete={onDelete}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

// ─── Main Wiki component ──────────────────────────────────────────────────────
export default function Wiki() {
  const [pages, setPages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [page, setPage] = useState(null); // full page with content
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [newPageParent, setNewPageParent] = useState(null); // null = root, id = sub-page
  const [newPageTitle, setNewPageTitle] = useState('');
  const [showNewPageInput, setShowNewPageInput] = useState(false);
  const textareaRef = useRef(null);
  const token = localStorage.getItem('auth_token');

  const headers = { 'Content-Type': 'application/json', 'x-auth-token': token };

  // Load page list
  const loadPages = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/wiki/pages`, { headers });
      if (r.ok) setPages(await r.json());
    } catch {}
  }, []);

  useEffect(() => { loadPages(); }, [loadPages]);

  // Load selected page
  useEffect(() => {
    if (selectedId == null) { setPage(null); return; }
    setLoading(true);
    fetch(`${API_URL}/wiki/pages/${selectedId}`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(p => { setPage(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedId]);

  // Ctrl+S to save
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && editing) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editing, editTitle, editContent]);

  const startEdit = () => {
    if (!page) return;
    setEditTitle(page.title);
    setEditContent(page.content);
    setDirty(false);
    setPreview(false);
    setEditing(true);
  };

  const cancelEdit = () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    setEditing(false);
    setDirty(false);
  };

  const handleSave = async () => {
    if (!editTitle.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(`${API_URL}/wiki/pages/${selectedId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ title: editTitle, content: editContent })
      });
      if (r.ok) {
        const updated = await r.json();
        setPage(updated);
        setEditing(false);
        setDirty(false);
        await loadPages();
      }
    } catch {}
    setSaving(false);
  };

  const handleCreatePage = async () => {
    if (!newPageTitle.trim()) return;
    try {
      const r = await fetch(`${API_URL}/wiki/pages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: newPageTitle.trim(), content: '', parentId: newPageParent })
      });
      if (r.ok) {
        const created = await r.json();
        await loadPages();
        setSelectedId(created.id);
        setNewPageTitle('');
        setShowNewPageInput(false);
        setNewPageParent(null);
        // Auto-enter edit mode with welcome content
        setTimeout(() => {
          setPage(created);
          setEditTitle(created.title);
          setEditContent(`# ${created.title}\n\nStart writing here...\n`);
          setDirty(true);
          setEditing(true);
        }, 150);
      }
    } catch {}
  };

  const handleDelete = async (target) => {
    try {
      const r = await fetch(`${API_URL}/wiki/pages/${target.id}`, { method: 'DELETE', headers });
      if (r.ok) {
        await loadPages();
        if (selectedId === target.id) { setSelectedId(null); setPage(null); }
      }
    } catch {}
    setDeleteTarget(null);
  };

  const toolbar = [
    { icon: 'H1', title: 'Heading 1', action: () => wrapLine('# ') },
    { icon: 'H2', title: 'Heading 2', action: () => wrapLine('## ') },
    { icon: 'H3', title: 'Heading 3', action: () => wrapLine('### ') },
    null,
    { icon: 'B', title: 'Bold (Ctrl+B)', cls: 'font-bold', action: () => wrap('**', '**', 'bold text') },
    { icon: 'I', title: 'Italic (Ctrl+I)', cls: 'italic', action: () => wrap('*', '*', 'italic text') },
    { icon: 'S̶', title: 'Strikethrough', cls: 'line-through', action: () => wrap('~~', '~~', 'text') },
    { icon: '==', title: 'Highlight', action: () => wrap('==', '==', 'text') },
    null,
    { icon: '`', title: 'Inline code', action: () => wrap('`', '`', 'code') },
    { icon: '```', title: 'Code block', action: () => wrap('\n```\n', '\n```\n', 'code here') },
    null,
    { icon: '—', title: 'Horizontal rule', action: () => wrapLine('---\n') },
    { icon: '›', title: 'Blockquote', action: () => wrapLine('> ') },
    { icon: '•', title: 'Unordered list', action: () => wrapLine('- ') },
    { icon: '1.', title: 'Ordered list', action: () => wrapLine('1. ') },
    null,
    { icon: '⎘', title: 'Link', action: () => wrap('[', '](url)', 'link text') },
    { icon: '⊞', title: 'Table', action: () => insertTable() },
  ];

  function wrap(before, after, placeholder) {
    if (!textareaRef.current) return;
    const { newContent, newCursor } = insertMarkdown(textareaRef.current, before, after, placeholder);
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const cursorEnd = start + before.length + (end > start ? end - start : placeholder.length);
    setEditContent(newContent);
    setDirty(true);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + before.length, cursorEnd);
      }
    }, 0);
  }

  function wrapLine(prefix) {
    if (!textareaRef.current) return;
    const ta = textareaRef.current;
    const start = ta.selectionStart;
    const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1;
    const newContent = ta.value.substring(0, lineStart) + prefix + ta.value.substring(lineStart);
    setEditContent(newContent);
    setDirty(true);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(lineStart + prefix.length, lineStart + prefix.length);
    }, 0);
  }

  function insertTable() {
    const table = '\n| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |\n';
    if (!textareaRef.current) return;
    const ta = textareaRef.current;
    const start = ta.selectionStart;
    const newContent = ta.value.substring(0, start) + table + ta.value.substring(start);
    setEditContent(newContent);
    setDirty(true);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + table.length, start + table.length); }, 0);
  }

  const rootPages = pages.filter(p => !p.parent_id);

  return (
    <div className="flex h-full min-h-[600px] gap-0 rounded-xl overflow-hidden border border-slate-800">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <div className="w-60 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="px-3 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pages</span>
          <button
            onClick={() => { setNewPageParent(null); setShowNewPageInput(true); setNewPageTitle(''); }}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="New root page"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* New page input */}
        {showNewPageInput && (
          <div className="px-3 py-2 border-b border-slate-800 bg-slate-800/50">
            <p className="text-[11px] text-slate-500 mb-1">
              {newPageParent ? `Sub-page of "${pages.find(p => p.id === newPageParent)?.title}"` : 'New root page'}
            </p>
            <input
              autoFocus
              type="text"
              value={newPageTitle}
              onChange={e => setNewPageTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreatePage();
                if (e.key === 'Escape') { setShowNewPageInput(false); setNewPageTitle(''); }
              }}
              placeholder="Page title..."
              className="w-full px-2 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex gap-1 mt-1.5">
              <button onClick={handleCreatePage} className="flex-1 px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors">Create</button>
              <button onClick={() => { setShowNewPageInput(false); setNewPageTitle(''); }} className="flex-1 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors">Cancel</button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {rootPages.length === 0 && !showNewPageInput && (
            <p className="text-xs text-slate-600 italic px-2 py-4 text-center">No pages yet.<br/>Click + to add one.</p>
          )}
          {rootPages.map(p => (
            <PageItem
              key={p.id}
              page={p}
              pages={pages}
              selectedId={selectedId}
              onSelect={(id) => {
                if (dirty && editing) {
                  if (!window.confirm('Discard unsaved changes?')) return;
                  setEditing(false); setDirty(false);
                }
                setSelectedId(id); setEditing(false);
              }}
              onNewChild={(parentId) => { setNewPageParent(parentId); setShowNewPageInput(true); setNewPageTitle(''); }}
              onDelete={(pg) => setDeleteTarget(pg)}
            />
          ))}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <div className="w-16 h-16 rounded-xl bg-slate-800 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-400 mb-2">Project Documentation</h3>
            <p className="text-sm text-slate-600 max-w-xs">Select a page from the sidebar or create a new one to start documenting your project.</p>
            <button
              onClick={() => { setShowNewPageInput(true); setNewPageParent(null); setNewPageTitle(''); }}
              className="mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Page
            </button>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center">
            <svg className="w-6 h-6 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : editing ? (
          /* ── Editor ── */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Editor header */}
            <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-3 flex-shrink-0">
              <input
                type="text"
                value={editTitle}
                onChange={e => { setEditTitle(e.target.value); setDirty(true); }}
                className="flex-1 bg-transparent text-xl font-bold text-white focus:outline-none placeholder-slate-600"
                placeholder="Page title"
              />
              {dirty && <span className="text-xs text-amber-400 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>Unsaved</span>}
              <button
                onClick={() => setPreview(v => !v)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${preview ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
              >
                {preview ? 'Editor' : 'Preview'}
              </button>
              <button onClick={cancelEdit} className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving || !editTitle.trim()}
                className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium flex items-center gap-1.5"
              >
                {saving ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>}
                Save
              </button>
            </div>

            {/* Toolbar */}
            {!preview && (
              <div className="px-3 py-1.5 border-b border-slate-800 flex flex-wrap items-center gap-0.5 flex-shrink-0 bg-slate-900/50">
                {toolbar.map((btn, idx) =>
                  btn === null ? (
                    <div key={idx} className="w-px h-5 bg-slate-700 mx-1" />
                  ) : (
                    <button
                      key={idx}
                      onClick={btn.action}
                      title={btn.title}
                      className={`px-2 py-1 text-xs rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors min-w-[28px] ${btn.cls || ''}`}
                    >
                      {btn.icon}
                    </button>
                  )
                )}
                <span className="ml-auto text-[10px] text-slate-600">Ctrl+S to save</span>
              </div>
            )}

            {/* Editor / Preview pane */}
            <div className="flex-1 overflow-hidden">
              {preview ? (
                <div className="h-full overflow-y-auto px-8 py-6">
                  <div
                    className="wiki-content"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(editContent) }}
                  />
                </div>
              ) : (
                <textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={e => { setEditContent(e.target.value); setDirty(true); }}
                  className="w-full h-full p-6 bg-transparent text-slate-300 font-mono text-sm resize-none focus:outline-none placeholder-slate-700"
                  placeholder="Start writing in Markdown..."
                  spellCheck={false}
                />
              )}
            </div>
          </div>
        ) : (
          /* ── View mode ── */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-white">{page?.title}</h2>
                {page?.updated_at && (
                  <p className="text-xs text-slate-600 mt-0.5">
                    Last updated {new Date(page.updated_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    {page.created_by && ` · by ${page.created_by}`}
                  </p>
                )}
              </div>
              <button
                onClick={startEdit}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {page?.content ? (
                <div
                  className="wiki-content"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(page.content) }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <svg className="w-12 h-12 text-slate-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <p className="text-slate-600 text-sm">This page is empty.</p>
                  <button onClick={startEdit} className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm transition-colors">Start writing →</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Delete confirm modal ─────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Page</h3>
            <p className="text-slate-400 text-sm mb-4">
              Delete <strong className="text-white">"{deleteTarget.title}"</strong>? This will also delete all sub-pages. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteTarget)} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
