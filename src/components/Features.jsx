import React, { useState, useEffect } from 'react';
import { authFetch } from '../utils/api';
import API_URL from '../apiUrl';

function Avatar({ username }) {
  if (!username) return null;
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-700 text-white text-xs font-bold shrink-0">
      {username.charAt(0).toUpperCase()}
    </span>
  );
}

function RightPanel({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-700 h-full flex flex-col shadow-2xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function Features({ currentUser }) {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('All');

  // Create / edit panel
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', priority: 'Medium' });

  // View panel
  const [viewingFeature, setViewingFeature] = useState(null);
  const [viewTab, setViewTab] = useState('details');
  const [featureRequirements, setFeatureRequirements] = useState([]);
  const [featureComments, setFeatureComments] = useState([]);
  const [featureHistory, setFeatureHistory] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => { loadFeatures(); }, []);

  const loadFeatures = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await authFetch(`${API_URL}/features`);
      if (!res.ok) throw new Error('Failed to fetch features');
      setFeatures(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------- CRUD ----------
  const openCreate = () => {
    setEditingFeature(null);
    setFormData({ name: '', description: '', priority: 'Medium' });
    setIsFormOpen(true);
  };

  const openEdit = (feature) => {
    setEditingFeature(feature);
    setFormData({ name: feature.name, description: feature.description || '', priority: feature.priority });
    setIsFormOpen(true);
  };

  const closeForm = () => { setIsFormOpen(false); setEditingFeature(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { alert('Please enter a feature name'); return; }
    try {
      const url = editingFeature ? `${API_URL}/features/${editingFeature.id}` : `${API_URL}/features`;
      const method = editingFeature ? 'PUT' : 'POST';
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) { await loadFeatures(); closeForm(); }
      else { const d = await res.json(); alert(`Error: ${d.error || 'Failed to save'}`); }
    } catch { alert('Failed to save feature'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this feature? All associated requirements and test cases will also be deleted.')) return;
    try {
      const res = await authFetch(`${API_URL}/features/${id}`, { method: 'DELETE' });
      if (res.ok) { await loadFeatures(); }
      else { const d = await res.json(); alert(`Error: ${d.error || 'Failed to delete'}`); }
    } catch { alert('Failed to delete feature'); }
  };

  // ---------- View panel ----------
  const openView = async (feature) => {
    setViewingFeature(feature);
    setViewTab('details');
    setFeatureRequirements([]);
    setFeatureComments([]);
    setFeatureHistory([]);
    setCommentText('');
    try {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'x-auth-token': token } : {};
      const [reqRes, commRes, histRes] = await Promise.all([
        fetch(`${API_URL}/features/${feature.id}/requirements`, { headers }),
        fetch(`${API_URL}/features/${feature.id}/comments`, { headers }),
        fetch(`${API_URL}/features/${feature.id}/history`, { headers }),
      ]);
      if (reqRes.ok) setFeatureRequirements(await reqRes.json());
      if (commRes.ok) setFeatureComments(await commRes.json());
      if (histRes.ok) setFeatureHistory(await histRes.json());
    } catch { /* ignore */ }
  };

  const closeView = () => { setViewingFeature(null); };

  const handleAddComment = async () => {
    if (!commentText.trim() || !viewingFeature) return;
    setSubmittingComment(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/features/${viewingFeature.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'x-auth-token': token } : {}) },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (res.ok) {
        setFeatureComments(prev => [...prev, await res.json()]);
        setCommentText('');
      }
    } finally { setSubmittingComment(false); }
  };

  // ---------- helpers ----------
  const priorityBadge = (p) => ({
    High: 'bg-red-900/60 text-red-300', Medium: 'bg-yellow-900/60 text-yellow-300', Low: 'bg-green-900/60 text-green-300'
  })[p] || 'bg-slate-700 text-slate-300';

  const filteredFeatures = features.filter(f => {
    const s = searchQuery.toLowerCase();
    return (f.name.toLowerCase().includes(s) || (f.description || '').toLowerCase().includes(s))
      && (filterPriority === 'All' || f.priority === filterPriority);
  });

  if (loading) return <div className="flex items-center justify-center h-64 text-white">Loading features…</div>;
  if (error) return <div className="p-4 bg-red-900 text-red-200 rounded-lg m-4">Error: {error}</div>;

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-white">Features</h1>
        <button onClick={openCreate} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
          + New Feature
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <input type="text" placeholder="Search features…" value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500">
          <option value="All">All Priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      <div className="mb-3 text-sm text-slate-400">
        Showing <span className="font-semibold text-white">{filteredFeatures.length}</span> of <span className="font-semibold text-white">{features.length}</span> features
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900">
            <tr>
              {['Name','Description','Priority','Created','Created By','Actions'].map(h => (
                <th key={h} className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {filteredFeatures.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No features found. Create your first feature to get started.</td></tr>
            ) : filteredFeatures.map(feature => (
              <tr key={feature.id} className="hover:bg-slate-700">
                <td className="px-6 py-4 text-white font-medium">{feature.name}</td>
                <td className="px-6 py-4 text-slate-300 max-w-xs text-sm">
                  {feature.description ? (feature.description.length > 80 ? feature.description.slice(0, 80) + '…' : feature.description) : '—'}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${priorityBadge(feature.priority)}`}>{feature.priority}</span>
                </td>
                <td className="px-6 py-4 text-slate-400 text-sm">{new Date(feature.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-slate-400 text-sm">{feature.created_by || '—'}</td>
                <td className="px-6 py-4">
                  <div className="flex gap-1">
                    <button onClick={() => openView(feature)} className="p-2 rounded-lg hover:bg-blue-500/10 text-blue-400 transition-colors" title="View">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>
                    <button onClick={() => openEdit(feature)} className="p-2 rounded-lg hover:bg-indigo-500/10 text-indigo-400 transition-colors" title="Edit">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => handleDelete(feature.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors" title="Delete">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── View Panel ── */}
      <RightPanel open={!!viewingFeature} onClose={closeView}>
        {viewingFeature && (() => {
          const f = viewingFeature;
          return (
            <>
              {/* Header */}
              <div className="flex items-start justify-between px-5 py-4 border-b border-slate-700 gap-3 shrink-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityBadge(f.priority)}`}>{f.priority}</span>
                    <span className="text-xs text-slate-500">#{f.id}</span>
                  </div>
                  <h2 className="text-base font-semibold text-white leading-snug">{f.name}</h2>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { closeView(); openEdit(f); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Edit
                  </button>
                  <button onClick={closeView} className="p-1 text-slate-500 hover:text-white transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-700 px-5 shrink-0">
                {[['details','Details'], ['comments',`Comments${featureComments.length ? ` (${featureComments.length})` : ''}`], ['history','History']].map(([key, label]) => (
                  <button key={key} onClick={() => setViewTab(key)}
                    className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px ${viewTab === key ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-4">

                {/* Details tab */}
                {viewTab === 'details' && (
                  <div className="space-y-4">
                    {f.description && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Description</p>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{f.description}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-800 rounded-lg px-3 py-2">
                        <p className="text-xs text-slate-500 mb-0.5">Created</p>
                        <p className="text-sm text-slate-300">{new Date(f.created_at).toLocaleDateString()}</p>
                      </div>
                      {f.created_by && (
                        <div className="bg-slate-800 rounded-lg px-3 py-2">
                          <p className="text-xs text-slate-500 mb-0.5">Created By</p>
                          <p className="text-sm text-slate-300">{f.created_by}</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Associated Requirements ({featureRequirements.length})</p>
                      {featureRequirements.length === 0 ? (
                        <p className="text-xs text-slate-600 italic">No requirements associated with this feature yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {featureRequirements.map(req => (
                            <div key={req.id} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-white">{req.title}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${priorityBadge(req.priority)}`}>{req.priority}</span>
                              </div>
                              {req.description && <p className="text-xs text-slate-400">{req.description.slice(0, 80)}{req.description.length > 80 ? '…' : ''}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Comments tab */}
                {viewTab === 'comments' && (
                  <div className="space-y-4">
                    {featureComments.length === 0 ? (
                      <p className="text-xs text-slate-600 italic">No comments yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {featureComments.map(c => (
                          <div key={c.id} className="flex gap-2.5">
                            <Avatar username={c.author_name || '?'} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 mb-0.5">
                                <span className="text-xs font-medium text-slate-300">{c.author_name || 'Unknown'}</span>
                                <span className="text-xs text-slate-600">{new Date(c.created_at).toLocaleString()}</span>
                              </div>
                              <p className="text-sm text-slate-300 whitespace-pre-wrap">{c.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-700">
                      <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddComment(); }}
                        placeholder="Add a comment… (Ctrl+Enter to submit)" rows={3}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 resize-none" />
                      <div className="flex justify-end mt-2">
                        <button onClick={handleAddComment} disabled={!commentText.trim() || submittingComment}
                          className="px-4 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition-colors">
                          {submittingComment ? 'Posting…' : 'Post Comment'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* History tab */}
                {viewTab === 'history' && (
                  <div>
                    {featureHistory.length === 0 ? (
                      <p className="text-xs text-slate-600 italic">No changes recorded yet.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {featureHistory.map(h => (
                          <div key={h.id} className="flex gap-2.5 items-start">
                            <Avatar username={h.changed_by_username || '?'} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-300">
                                <span className="font-medium">{h.changed_by_username || 'Someone'}</span>
                                {' changed '}<span className="text-indigo-400 font-medium">{h.field}</span>
                                {h.old_value ? <> from <span className="text-slate-400">"{h.old_value}"</span></> : null}
                                {' to '}<span className="text-slate-200">"{h.new_value}"</span>
                              </p>
                              <p className="text-xs text-slate-600 mt-0.5">{new Date(h.created_at).toLocaleString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          );
        })()}
      </RightPanel>

      {/* ── Create / Edit Panel ── */}
      <RightPanel open={isFormOpen} onClose={closeForm}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-base font-semibold text-white">{editingFeature ? 'Edit Feature' : 'New Feature'}</h2>
          <button onClick={closeForm} className="p-1 text-slate-500 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Name <span className="text-red-400">*</span></label>
            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required autoFocus
              placeholder="Enter feature name"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={5}
              placeholder="Enter feature description"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Priority</label>
            <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500">
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={closeForm}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors">Cancel</button>
            <button type="submit"
              className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
              {editingFeature ? 'Save Changes' : 'Create Feature'}
            </button>
          </div>
        </form>
      </RightPanel>
    </div>
  );
}

export default Features;
