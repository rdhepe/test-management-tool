import React, { useState, useEffect } from 'react';
import { authFetch } from '../utils/api';
import API_URL from '../apiUrl';

function Avatar({ username }) {
  if (!username) return null;
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-700 text-white text-xs font-bold shrink-0">
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

function Defects({ currentUser }) {
  const [defects, setDefects] = useState([]);
  const [testCases, setTestCases] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterSprint, setFilterSprint] = useState('All');

  // Create / edit panel
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDefect, setEditingDefect] = useState(null);
  const [formData, setFormData] = useState({
    title: '', description: '', severity: 'Medium', status: 'Open',
    linkedTestCaseId: '', sprintId: '', screenshot: null, assignedTo: ''
  });

  // View panel
  const [viewingDefect, setViewingDefect] = useState(null);
  const [viewTab, setViewTab] = useState('details');
  const [defectComments, setDefectComments] = useState([]);
  const [defectHistory, setDefectHistory] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const handleDefectNavigation = (event) => {
      const { defectId } = event.detail || {};
      if (defectId) {
        const defect = defects.find(d => d.id === defectId);
        if (defect) openView(defect);
      }
    };
    window.addEventListener('navigateToDefect', handleDefectNavigation);
    return () => window.removeEventListener('navigateToDefect', handleDefectNavigation);
  }, [defects]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'x-auth-token': token } : {};
      const [dRes, tcRes, spRes, uRes] = await Promise.all([
        fetch(`${API_URL}/defects`, { headers }),
        fetch(`${API_URL}/test-cases`, { headers }),
        fetch(`${API_URL}/sprints`, { headers }),
        fetch(`${API_URL}/auth/team`, { headers }),
      ]);
      if (dRes.ok) setDefects(await dRes.json());
      if (tcRes.ok) setTestCases(await tcRes.json());
      if (spRes.ok) setSprints(await spRes.json());
      if (uRes.ok) setUsers(await uRes.json());
    } catch (err) {
      console.error('Failed to load defects data:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingDefect(null);
    setFormData({ title: '', description: '', severity: 'Medium', status: 'Open', linkedTestCaseId: '', sprintId: '', screenshot: null, assignedTo: '' });
    setIsFormOpen(true);
  };

  const openEdit = (defect) => {
    setEditingDefect(defect);
    setFormData({
      title: defect.title,
      description: defect.description || '',
      severity: defect.severity,
      status: defect.status,
      linkedTestCaseId: defect.linked_test_case_id || '',
      sprintId: defect.sprint_id ? String(defect.sprint_id) : '',
      screenshot: defect.screenshot || null,
      assignedTo: defect.assigned_to || ''
    });
    setIsFormOpen(true);
  };

  const closeForm = () => { setIsFormOpen(false); setEditingDefect(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) { alert('Please enter a defect title'); return; }
    setSaving(true);
    const payload = {
      title: formData.title,
      description: formData.description,
      severity: formData.severity,
      status: formData.status,
      linkedTestCaseId: formData.linkedTestCaseId ? parseInt(formData.linkedTestCaseId) : null,
      sprintId: formData.sprintId ? parseInt(formData.sprintId) : null,
      screenshot: formData.screenshot || null,
      assignedTo: formData.assignedTo || null
    };
    try {
      const url = editingDefect ? `${API_URL}/defects/${editingDefect.id}` : `${API_URL}/defects`;
      const method = editingDefect ? 'PUT' : 'POST';
      const res = await authFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        await loadAll();
        closeForm();
      } else {
        const d = await res.json();
        alert(`Error: ${d.error || 'Failed to save'}`);
      }
    } catch { alert('Failed to save defect'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this defect?')) return;
    try {
      const res = await authFetch(`${API_URL}/defects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await loadAll();
        if (viewingDefect?.id === id) setViewingDefect(null);
      } else {
        const d = await res.json();
        alert(`Error: ${d.error || 'Failed to delete'}`);
      }
    } catch { alert('Failed to delete defect'); }
  };

  const openView = async (defect) => {
    setViewingDefect(defect);
    setViewTab('details');
    setDefectComments([]);
    setDefectHistory([]);
    setCommentText('');
    try {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'x-auth-token': token } : {};
      const [commRes, histRes] = await Promise.all([
        fetch(`${API_URL}/defects/${defect.id}/comments`, { headers }),
        fetch(`${API_URL}/defects/${defect.id}/history`, { headers }),
      ]);
      if (commRes.ok) setDefectComments(await commRes.json());
      if (histRes.ok) setDefectHistory(await histRes.json());
    } catch { /* ignore */ }
  };

  const closeView = () => { setViewingDefect(null); };

  const handleAddComment = async () => {
    if (!commentText.trim() || !viewingDefect) return;
    setSubmittingComment(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/defects/${viewingDefect.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'x-auth-token': token } : {}) },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setDefectComments(prev => [...prev, newComment]);
        setCommentText('');
      }
    } finally { setSubmittingComment(false); }
  };

  const captureScreenshot = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { mediaSource: 'screen' } });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      await new Promise(r => { video.onloadedmetadata = r; });
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      stream.getTracks().forEach(t => t.stop());
      canvas.toBlob(blob => {
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = () => setFormData(f => ({ ...f, screenshot: reader.result }));
          reader.readAsDataURL(blob);
        }
      }, 'image/png');
    } catch (err) {
      if (err.name !== 'NotAllowedError') alert('Failed to capture screenshot.');
    }
  };

  const severityBadge = (s) => ({
    Low: 'bg-blue-900/60 text-blue-300', Medium: 'bg-yellow-900/60 text-yellow-300',
    High: 'bg-orange-900/60 text-orange-300', Critical: 'bg-red-900/60 text-red-300'
  })[s] || 'bg-slate-700 text-slate-300';

  const statusBadge = (s) => ({
    Open: 'bg-red-900/60 text-red-300', 'In Progress': 'bg-blue-900/60 text-blue-300',
    Resolved: 'bg-green-900/60 text-green-300', Closed: 'bg-slate-700 text-slate-400'
  })[s] || 'bg-slate-700 text-slate-300';

  const filteredDefects = defects.filter(d => {
    const s = searchTerm.toLowerCase();
    const matchSearch = d.title.toLowerCase().includes(s) || (d.description || '').toLowerCase().includes(s);
    const matchSev = filterSeverity === 'All' || d.severity === filterSeverity;
    const matchSt = filterStatus === 'All' || d.status === filterStatus;
    const matchSp = filterSprint === 'All' ||
      (filterSprint === 'Unassigned' && !d.sprint_id) ||
      (d.sprint_id && d.sprint_id.toString() === filterSprint);
    return matchSearch && matchSev && matchSt && matchSp;
  });

  if (loading) return <div className="flex items-center justify-center h-64 text-white">Loading defects...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-white">Defects</h1>
        <button onClick={openCreate} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
          + New Defect
        </button>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input type="text" placeholder="Search defects..." value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-red-500" />
        <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-red-500">
          <option value="All">All Severities</option>
          {['Low','Medium','High','Critical'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-red-500">
          <option value="All">All Statuses</option>
          {['Open','In Progress','Resolved','Closed'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterSprint} onChange={e => setFilterSprint(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-red-500">
          <option value="All">All Sprints</option>
          <option value="Unassigned">Unassigned</option>
          {sprints.map(sp => <option key={sp.id} value={sp.id.toString()}>{sp.name}</option>)}
        </select>
      </div>

      <div className="mb-3 text-sm text-slate-400">
        Showing <span className="font-semibold text-white">{filteredDefects.length}</span> of <span className="font-semibold text-white">{defects.length}</span> defects
      </div>

      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900">
            <tr>
              {['#','Title','Severity','Status','Linked Test Case','Created By','Assigned To','Created','Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {filteredDefects.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">No defects found. Create your first defect to get started.</td></tr>
            ) : filteredDefects.map(defect => (
              <tr key={defect.id} className="hover:bg-slate-700/50 transition-colors">
                <td className="px-4 py-3 text-sm text-slate-400">#{defect.id}</td>
                <td className="px-4 py-3 text-sm text-white font-medium max-w-[200px] truncate">{defect.title}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${severityBadge(defect.severity)}`}>{defect.severity}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusBadge(defect.status)}`}>{defect.status}</span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-300">{defect.linked_test_case_title || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{defect.created_by || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{defect.assigned_to || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{new Date(defect.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openView(defect)} className="p-2 rounded-lg hover:bg-blue-500/10 text-blue-400 transition-colors" title="View">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>
                    <button onClick={() => openEdit(defect)} className="p-2 rounded-lg hover:bg-indigo-500/10 text-indigo-400 transition-colors" title="Edit">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => handleDelete(defect.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors" title="Delete">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View Panel */}
      <RightPanel open={!!viewingDefect} onClose={closeView}>
        {viewingDefect && (() => {
          const d = viewingDefect;
          return (
            <>
              <div className="flex items-start justify-between px-5 py-4 border-b border-slate-700 gap-3 shrink-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityBadge(d.severity)}`}>{d.severity}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(d.status)}`}>{d.status}</span>
                    <span className="text-xs text-slate-500">#{d.id}</span>
                  </div>
                  <h2 className="text-base font-semibold text-white leading-snug">{d.title}</h2>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { closeView(); openEdit(d); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Edit
                  </button>
                  <button onClick={closeView} className="p-1 text-slate-500 hover:text-white transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              <div className="flex border-b border-slate-700 px-5 shrink-0">
                {[['details','Details'], ['comments',`Comments${defectComments.length ? ` (${defectComments.length})` : ''}`], ['history','History']].map(([key, label]) => (
                  <button key={key} onClick={() => setViewTab(key)}
                    className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px ${viewTab === key ? 'border-red-500 text-red-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {viewTab === 'details' && (
                  <div className="space-y-4">
                    {d.description && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Description</p>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{d.description}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {d.created_by && (
                        <div className="bg-slate-800 rounded-lg px-3 py-2">
                          <p className="text-xs text-slate-500 mb-0.5">Created By</p>
                          <p className="text-sm text-slate-300">{d.created_by}</p>
                        </div>
                      )}
                      {d.assigned_to && (
                        <div className="bg-slate-800 rounded-lg px-3 py-2">
                          <p className="text-xs text-slate-500 mb-0.5">Assigned To</p>
                          <p className="text-sm text-slate-300">{d.assigned_to}</p>
                        </div>
                      )}
                      <div className="bg-slate-800 rounded-lg px-3 py-2">
                        <p className="text-xs text-slate-500 mb-0.5">Created</p>
                        <p className="text-sm text-slate-300">{new Date(d.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="bg-slate-800 rounded-lg px-3 py-2">
                        <p className="text-xs text-slate-500 mb-0.5">Last Updated</p>
                        <p className="text-sm text-slate-300">{new Date(d.updated_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {d.linked_test_case_title && (
                      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                        <p className="text-xs text-slate-500 mb-0.5">Linked Test Case</p>
                        <p className="text-sm text-slate-300">{d.linked_test_case_title}</p>
                      </div>
                    )}
                    {d.sprint_name && (
                      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                        <p className="text-xs text-slate-500 mb-0.5">Sprint</p>
                        <p className="text-sm text-slate-300">{d.sprint_name}</p>
                      </div>
                    )}
                    {d.screenshot && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Screenshot</p>
                        <img src={d.screenshot} alt="Defect screenshot"
                          className="max-w-full rounded-lg border border-slate-600 cursor-pointer hover:opacity-90 transition-opacity"
                          style={{ maxHeight: '260px', objectFit: 'contain' }}
                          onClick={() => {
                            const w = window.open();
                            w.document.write(`<!DOCTYPE html><html><body style="margin:0;background:#0f172a;display:flex;justify-content:center;align-items:center;min-height:100vh;"><img src="${d.screenshot}" style="max-width:100%;border-radius:8px;"/></body></html>`);
                            w.document.close();
                          }} />
                      </div>
                    )}
                  </div>
                )}

                {viewTab === 'comments' && (
                  <div className="space-y-4">
                    {defectComments.length === 0 ? (
                      <p className="text-xs text-slate-600 italic">No comments yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {defectComments.map(c => (
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
                        placeholder="Add a comment... (Ctrl+Enter to submit)" rows={3}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-red-500 resize-none" />
                      <div className="flex justify-end mt-2">
                        <button onClick={handleAddComment} disabled={!commentText.trim() || submittingComment}
                          className="px-4 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-lg transition-colors">
                          {submittingComment ? 'Posting...' : 'Post Comment'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {viewTab === 'history' && (
                  <div>
                    {defectHistory.length === 0 ? (
                      <p className="text-xs text-slate-600 italic">No changes recorded yet.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {defectHistory.map(h => (
                          <div key={h.id} className="flex gap-2.5 items-start">
                            <Avatar username={h.changed_by_username || '?'} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-300">
                                <span className="font-medium">{h.changed_by_username || 'Someone'}</span>
                                {' changed '}<span className="text-red-400 font-medium">{h.field}</span>
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

      {/* Create / Edit Panel */}
      <RightPanel open={isFormOpen} onClose={closeForm}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-base font-semibold text-white">{editingDefect ? 'Edit Defect' : 'New Defect'}</h2>
          <button onClick={closeForm} className="p-1 text-slate-500 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Title <span className="text-red-400">*</span></label>
            <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required autoFocus
              placeholder="Enter defect title"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-red-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={4}
              placeholder="Describe the defect"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-red-500 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Severity</label>
              <select value={formData.severity} onChange={e => setFormData({ ...formData, severity: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-red-500">
                {['Low','Medium','High','Critical'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
              <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-red-500">
                {['Open','In Progress','Resolved','Closed'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Assigned To</label>
            <select value={formData.assignedTo} onChange={e => setFormData({ ...formData, assignedTo: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-red-500">
              <option value="">— Unassigned —</option>
              {users.map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Link Test Case (Optional)</label>
            <select value={formData.linkedTestCaseId} onChange={e => setFormData({ ...formData, linkedTestCaseId: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-red-500">
              <option value="">— None —</option>
              {testCases.map(tc => <option key={tc.id} value={tc.id}>{tc.title}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Assign to Sprint (Optional)</label>
            <select value={formData.sprintId} onChange={e => setFormData({ ...formData, sprintId: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-red-500">
              <option value="">— No Sprint —</option>
              {sprints.map(sp => <option key={sp.id} value={String(sp.id)}>{sp.name} ({sp.status})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Screenshot</label>
            {!formData.screenshot ? (
              <button type="button" onClick={captureScreenshot}
                className="w-full px-4 py-2 bg-slate-800 text-slate-300 text-sm rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 border border-slate-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Capture Screenshot
              </button>
            ) : (
              <div className="space-y-2">
                <div className="relative inline-block">
                  <img src={formData.screenshot} alt="Defect screenshot"
                    className="max-w-full rounded-lg border border-slate-600 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ maxHeight: '180px' }}
                    onClick={() => {
                      const w = window.open();
                      w.document.write(`<!DOCTYPE html><html><body style="margin:0;background:#0f172a;display:flex;justify-content:center;align-items:center;min-height:100vh;"><img src="${formData.screenshot}" style="max-width:100%;border-radius:8px;"/></body></html>`);
                      w.document.close();
                    }} />
                  <button type="button" onClick={() => setFormData(f => ({ ...f, screenshot: null }))}
                    className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-lg">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <button type="button" onClick={captureScreenshot}
                  className="px-3 py-1 bg-slate-700 text-slate-300 text-xs rounded-lg hover:bg-slate-600 transition-colors">
                  Recapture
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={closeForm}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors">
              {saving ? 'Saving...' : editingDefect ? 'Save Changes' : 'Create Defect'}
            </button>
          </div>
        </form>
      </RightPanel>
    </div>
  );
}

export default Defects;
