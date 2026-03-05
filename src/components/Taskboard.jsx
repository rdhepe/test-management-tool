import { useState, useEffect } from 'react';
import API_URL from '../apiUrl';
import { authFetch } from '../utils/api';

const STATUSES = ['New', 'In Progress', 'Completed', 'Done'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const PRIORITY_COLORS = {
  Low:      { dot: 'bg-slate-400',   badge: 'bg-slate-700 text-slate-300',       border: 'border-l-slate-500' },
  Medium:   { dot: 'bg-blue-400',    badge: 'bg-blue-900/60 text-blue-300',       border: 'border-l-blue-500' },
  High:     { dot: 'bg-orange-400',  badge: 'bg-orange-900/60 text-orange-300',   border: 'border-l-orange-500' },
  Critical: { dot: 'bg-red-500',     badge: 'bg-red-900/60 text-red-300',         border: 'border-l-red-500' },
};

const STATUS_STYLES = {
  'New':         { header: 'border-slate-600',   count: 'bg-slate-700 text-slate-300',     label: 'text-slate-400' },
  'In Progress': { header: 'border-indigo-500',  count: 'bg-indigo-900/60 text-indigo-300', label: 'text-indigo-400' },
  'Completed':   { header: 'border-emerald-500', count: 'bg-emerald-900/60 text-emerald-300', label: 'text-emerald-400' },
  'Done':        { header: 'border-purple-500',  count: 'bg-purple-900/60 text-purple-300', label: 'text-purple-400' },
};

const BLANK_FORM = { title: '', description: '', priority: 'Medium', status: 'New', assigneeId: '', sprintId: '', startDate: '', endDate: '', plannedHours: '', completedHours: '', requirementId: '' };

function daysRemaining(endDate) {
  if (!endDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end   = new Date(endDate); end.setHours(0, 0, 0, 0);
  return Math.round((end - today) / (1000 * 60 * 60 * 24));
}

function DueBadge({ endDate }) {
  if (!endDate) return null;
  const days = daysRemaining(endDate);
  let cls, label;
  if (days < 0)        { cls = 'bg-red-900/60 text-red-300';       label = `${Math.abs(days)}d overdue`; }
  else if (days === 0) { cls = 'bg-orange-900/60 text-orange-300';  label = 'Due today'; }
  else if (days <= 3)  { cls = 'bg-yellow-900/60 text-yellow-300';  label = `${days}d left`; }
  else                 { cls = 'bg-slate-700 text-slate-400';        label = `${days}d left`; }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>{label}</span>
  );
}

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

export default function Taskboard({ currentUser }) {
  const [sprints, setSprints]   = useState([]);
  const [tasks, setTasks]       = useState([]);
  const [users, setUsers]             = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState('');
  const [userFilter, setUserFilter] = useState('');   // '' = all users
  const [loading, setLoading]   = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modal state
  const [showModal, setShowModal]   = useState(false);
  const [editingTask, setEditingTask] = useState(null); // null = create
  const [form, setForm]             = useState(BLANK_FORM);
  const [saving, setSaving]         = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // View modal state (read-only)
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingTask, setViewingTask]     = useState(null);
  const [viewTab, setViewTab]             = useState('details'); // 'details' | 'comments' | 'history'
  const [taskComments, setTaskComments]   = useState([]);
  const [taskHistory, setTaskHistory]     = useState([]);
  const [commentText, setCommentText]     = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // ---------- data fetching ----------
  useEffect(() => {
    async function loadSprints() {
      try {
        const res = await authFetch(`${API_URL}/sprints`);
        if (!res.ok) return;
        const data = await res.json();
        setSprints(data);
        setSelectedSprint(prev => {
          if (prev) return prev; // already selected
          if (data.length === 0) return '';
          const active = data.find(s => s.status === 'Active');
          return String((active || data[0]).id);
        });
      } catch { /* server not reachable */ }
    }
    async function loadUsers() {
      try {
        const res = await authFetch(`${API_URL}/auth/team`);
        if (res.ok) setUsers(await res.json());
      } catch { /* ignore */ }
    }
    async function loadRequirements() {
      try {
        const res = await authFetch(`${API_URL}/requirements`);
        if (res.ok) setRequirements(await res.json());
      } catch { /* ignore */ }
    }
    loadSprints();
    loadUsers();
    loadRequirements();
  }, []);

  useEffect(() => {
    async function loadTasks() {
      setLoading(true);
      try {
        const url = selectedSprint
          ? `${API_URL}/tasks?sprintId=${selectedSprint}`
          : `${API_URL}/tasks`;
        const res = await authFetch(url);
        if (!res.ok) return;
        const data = await res.json();
        setTasks(data);
      } catch { /* server not reachable */ }
      finally { setLoading(false); }
    }
    loadTasks();
  }, [selectedSprint, refreshKey]);

  const refresh = () => setRefreshKey(k => k + 1);

  // ---------- helpers ----------
  const tasksByStatus = (status) => tasks.filter(t => {
    if (t.status !== status) return false;
    if (userFilter) {
      if (userFilter === '__unassigned__') return !t.assignee_id;
      return String(t.assignee_id) === userFilter;
    }
    return true;
  });
  const userObj = (id) => users.find(u => u.id === id);

  // ---------- modal helpers ----------
  const openCreate = (status = 'New') => {
    setEditingTask(null);
    setForm({ ...BLANK_FORM, status, sprintId: selectedSprint || '' });
    setShowModal(true);
  };

  const openEdit = (task) => {
    setEditingTask(task);
    setForm({
      title:          task.title,
      description:    task.description || '',
      priority:       task.priority,
      status:         task.status,
      assigneeId:     task.assignee_id    ? String(task.assignee_id)    : '',
      sprintId:       task.sprint_id      ? String(task.sprint_id)      : '',
      startDate:       task.start_date      || '',
      endDate:         task.end_date        || '',
      plannedHours:    task.planned_hours   != null ? String(task.planned_hours)   : '',
      completedHours:  task.completed_hours != null ? String(task.completed_hours) : '',
      requirementId:   task.requirement_id  ? String(task.requirement_id) : '',
    });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingTask(null); setForm(BLANK_FORM); };

  const openView = async (task) => {
    setViewingTask(task);
    setViewTab('details');
    setTaskComments([]);
    setTaskHistory([]);
    setCommentText('');
    setShowViewModal(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'x-auth-token': token } : {};
      const [commentsRes, historyRes] = await Promise.all([
        fetch(`${API_URL}/tasks/${task.id}/comments`, { headers }),
        fetch(`${API_URL}/tasks/${task.id}/history`, { headers }),
      ]);
      if (commentsRes.ok) setTaskComments(await commentsRes.json());
      if (historyRes.ok) setTaskHistory(await historyRes.json());
    } catch { /* ignore */ }
  };
  const closeView = () => { setShowViewModal(false); setViewingTask(null); setTaskComments([]); setTaskHistory([]); };
  const viewToEdit = () => { const t = viewingTask; closeView(); openEdit(t); };

  const handleAddComment = async () => {
    if (!commentText.trim() || !viewingTask) return;
    setSubmittingComment(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/tasks/${viewingTask.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'x-auth-token': token } : {}) },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setTaskComments(prev => [...prev, newComment]);
        setCommentText('');
      }
    } finally { setSubmittingComment(false); }
  };

  const handleQuickAssign = async (assigneeId) => {
    if (!viewingTask) return;
    const token = localStorage.getItem('auth_token');
    const t = viewingTask;
    try {
      const res = await fetch(`${API_URL}/tasks/${t.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'x-auth-token': token } : {}) },
        body: JSON.stringify({
          title: t.title, description: t.description, priority: t.priority, status: t.status,
          sprintId: t.sprint_id, assigneeId: assigneeId ? parseInt(assigneeId) : null,
          startDate: t.start_date || null, endDate: t.end_date || null,
          plannedHours: t.planned_hours ?? 0, completedHours: t.completed_hours ?? 0,
          requirementId: t.requirement_id || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setViewingTask(updated);
        const histRes = await fetch(`${API_URL}/tasks/${t.id}/history`, { headers: token ? { 'x-auth-token': token } : {} });
        if (histRes.ok) setTaskHistory(await histRes.json());
        refresh();
      }
    } catch { /* ignore */ }
  };

  // ---------- CRUD ----------
  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const body = {
      title:          form.title.trim(),
      description:    form.description.trim() || null,
      priority:       form.priority,
      status:         form.status,
      sprintId:       form.sprintId       ? parseInt(form.sprintId)       : null,
      assigneeId:     form.assigneeId     ? parseInt(form.assigneeId)     : null,
      createdBy:      currentUser?.id     || null,
      startDate:      form.startDate      || null,
      endDate:        form.endDate        || null,
      plannedHours:   form.plannedHours   !== '' ? parseFloat(form.plannedHours)   : 0,
      completedHours: form.completedHours !== '' ? parseFloat(form.completedHours) : 0,
      requirementId:  form.requirementId  ? parseInt(form.requirementId) : null,
    };
    const token = localStorage.getItem('auth_token');
    const authHeaders = { 'Content-Type': 'application/json', ...(token ? { 'x-auth-token': token } : {}) };
    try {
      let res;
      if (editingTask) {
        res = await fetch(`${API_URL}/tasks/${editingTask.id}`, {
          method: 'PUT', headers: authHeaders, body: JSON.stringify(body)
        });
      } else {
        res = await fetch(`${API_URL}/tasks`, {
          method: 'POST', headers: authHeaders, body: JSON.stringify(body)
        });
      }
      if (res.ok) {
        closeModal();
        refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Failed to save task: ${err.error || res.statusText}`);
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    await authFetch(`${API_URL}/tasks/${id}`, { method: 'DELETE' });
    setDeleteConfirm(null);
    refresh();
  };

  // Quick status change without opening modal
  const moveTask = async (task, newStatus) => {
    // Optimistic update — move card immediately in the UI
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'x-auth-token': token } : {}) },
        body: JSON.stringify({
          title:          task.title,
          description:    task.description,
          priority:       task.priority,
          status:         newStatus,
          sprintId:       task.sprint_id,
          assigneeId:     task.assignee_id,
          startDate:      task.start_date      || null,
          endDate:        task.end_date        || null,
          plannedHours:   task.planned_hours   ?? 0,
          completedHours: task.completed_hours ?? 0,
          requirementId:  task.requirement_id  || null,
        }),
      });
      if (!res.ok) {
        // Revert optimistic update on server error
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
      } else {
        refresh(); // sync with server (picks up any server-side changes)
      }
    } catch {
      // Revert on network error
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
    }
  };

  // ---------- render ----------
  // Derive selected sprint object for header display
  const activeSprint = sprints.find(s => String(s.id) === String(selectedSprint)) || null;
  const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;
  const sprintStatusDot = activeSprint?.status === 'Active' ? 'bg-emerald-400' : activeSprint?.status === 'Completed' ? 'bg-slate-500' : 'bg-indigo-400';

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-6 gap-4">
        {/* Left: title + sprint date info */}
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-2xl font-bold text-white shrink-0">Taskboard</h1>
          {activeSprint && (fmtDate(activeSprint.start_date) || fmtDate(activeSprint.end_date)) && (
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-400 shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sprintStatusDot}`} />
              <svg className="w-3 h-3 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {fmtDate(activeSprint.start_date) && <span className="text-slate-300">{fmtDate(activeSprint.start_date)}</span>}
              {fmtDate(activeSprint.start_date) && fmtDate(activeSprint.end_date) && <span className="text-slate-600">→</span>}
              {fmtDate(activeSprint.end_date) && <span className="text-slate-300">{fmtDate(activeSprint.end_date)}</span>}
              <span className="text-slate-600">·</span>
              <span className={activeSprint.status === 'Active' ? 'text-emerald-400' : activeSprint.status === 'Completed' ? 'text-slate-500' : 'text-indigo-400'}>
                {activeSprint.status}
              </span>
            </div>
          )}
        </div>

        {/* Right: sprint selector + new task button */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400 whitespace-nowrap">User:</label>
            <select
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Users</option>
              <option value="__unassigned__">Unassigned</option>
              {users.map(u => (
                <option key={u.id} value={String(u.id)}>
                  {u.username || u.name || u.email}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400 whitespace-nowrap">Sprint:</label>
            <select
              value={selectedSprint}
              onChange={e => setSelectedSprint(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Sprints</option>
              {sprints.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.status === 'Active' ? ' ★' : ''}
                </option>
              ))}
            </select>
          </div>
          {/* New Task button */}
          <button
            onClick={() => openCreate()}
            className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Task
          </button>
        </div>
      </div>

      {/* Kanban board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-500">Loading tasks…</div>
      ) : (
        <div className="grid grid-cols-4 gap-4 flex-1 min-h-0">
          {STATUSES.map(status => {
            const col = tasksByStatus(status);
            const styles = STATUS_STYLES[status];
            return (
              <div key={status} className="flex flex-col min-h-0">
                {/* Column header */}
                <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${styles.header}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${styles.label}`}>{status}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${styles.count}`}>{col.length}</span>
                  </div>
                  <button
                    onClick={() => openCreate(status)}
                    title={`Add task to ${status}`}
                    className="text-slate-500 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 overflow-y-auto pr-0.5">
                  {col.length === 0 && (
                    <div className="text-center text-slate-600 text-xs py-8 border border-dashed border-slate-700 rounded-lg">
                      No tasks
                    </div>
                  )}
                  {col.map(task => {
                    const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Medium;
                    const assignee = userObj(task.assignee_id);
                    const statusIdx = STATUSES.indexOf(task.status);
                    return (
                      <div
                        key={task.id}
                        className={`group bg-slate-800 border border-slate-700 rounded-lg p-3 border-l-4 ${pc.border} hover:border-slate-600 transition-colors cursor-pointer`}
                        onClick={() => openView(task)}
                      >
                        {/* Priority + title */}
                        <div className="flex items-start justify-between gap-1 mb-2">
                          <p className="text-sm font-medium text-white leading-snug">{task.title}</p>
                          <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${pc.badge} ml-1`}>
                            {task.priority}
                          </span>
                        </div>

                        {/* Description preview */}
                        {task.description && (
                          <p className="text-xs text-slate-400 truncate mb-1">{task.description}</p>
                        )}

                        {/* Requirement link */}
                        {task.requirement_title && (
                          <div className="flex items-center gap-1 mb-1.5">
                            <svg className="w-3 h-3 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-xs text-indigo-300 truncate" title={task.requirement_title}>{task.requirement_title}</span>
                          </div>
                        )}

                        {/* Dates */}
                        {(task.start_date || task.end_date) && (
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {task.start_date && (
                              <span className="text-xs text-slate-500">
                                <span className="text-slate-600">Start:</span> {task.start_date}
                              </span>
                            )}
                            {task.end_date && (
                              <span className="text-xs text-slate-500">
                                <span className="text-slate-600">End:</span> {task.end_date}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Effort bar */}
                        {(task.planned_hours > 0) && (() => {
                          const planned   = task.planned_hours   || 0;
                          const completed = task.completed_hours || 0;
                          const remaining = Math.max(planned - completed, 0);
                          const pct = Math.min(Math.round((completed / planned) * 100), 100);
                          const barColor = pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 30 ? 'bg-yellow-500' : 'bg-slate-500';
                          return (
                            <div className="mb-2">
                              <div className="flex justify-between text-xs text-slate-500 mb-0.5">
                                <span>{completed}h done</span>
                                <span>{remaining}h left / {planned}h planned</span>
                              </div>
                              <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                                <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })()}

                        {/* Footer: assignee + due badge + status arrows */}
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {assignee ? (
                              <div className="flex items-center gap-1.5">
                                <Avatar username={assignee.username} />
                                <span className="text-xs text-slate-400">{assignee.username}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-600">Unassigned</span>
                            )}
                            <DueBadge endDate={task.end_date} />
                          </div>
                          {/* Move arrows + view/edit icons */}
                          <div
                            className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={e => e.stopPropagation()}
                          >
                            {/* View icon */}
                            <button
                              title="View task"
                              onClick={() => openView(task)}
                              className="p-0.5 text-slate-500 hover:text-sky-400 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            {/* Edit icon */}
                            <button
                              title="Edit task"
                              onClick={() => openEdit(task)}
                              className="p-0.5 text-slate-500 hover:text-indigo-400 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <div className="w-px h-3 bg-slate-700 mx-0.5" />
                            {statusIdx > 0 && (
                              <button
                                title={`Move to ${STATUSES[statusIdx - 1]}`}
                                onClick={() => moveTask(task, STATUSES[statusIdx - 1])}
                                className="p-0.5 text-slate-500 hover:text-white transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                              </button>
                            )}
                            {statusIdx < STATUSES.length - 1 && (
                              <button
                                title={`Move to ${STATUSES[statusIdx + 1]}`}
                                onClick={() => moveTask(task, STATUSES[statusIdx + 1])}
                                className="p-0.5 text-slate-500 hover:text-white transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── View Modal ── */}
      {showViewModal && viewingTask && (() => {
        const t = viewingTask;
        const pc = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.Medium;
        const sprintObj = sprints.find(s => s.id === t.sprint_id);
        const planned   = t.planned_hours   || 0;
        const completed = t.completed_hours || 0;
        const remaining = Math.max(planned - completed, 0);
        const pct = planned > 0 ? Math.min(Math.round((completed / planned) * 100), 100) : 0;
        const barColor = pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 30 ? 'bg-yellow-500' : 'bg-slate-500';
        const STATUS_DOT = { 'New': 'bg-slate-400', 'In Progress': 'bg-indigo-400', 'Completed': 'bg-emerald-400', 'Done': 'bg-purple-400' };
        return (
          <RightPanel open={true} onClose={closeView}>
              {/* Header */}
              <div className="flex items-start justify-between px-5 py-4 border-b border-slate-700 gap-3 shrink-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT[t.status] || 'bg-slate-400'} shrink-0`} />
                    <span className="text-xs text-slate-400">{t.status}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${pc.badge}`}>{t.priority}</span>
                  </div>
                  <h2 className="text-base font-semibold text-white leading-snug">{t.title}</h2>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={viewToEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
                    title="Edit this task"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                  <button onClick={closeView} className="p-1 text-slate-500 hover:text-white transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-700 px-5 shrink-0">
                {[
                  ['details', 'Details'],
                  ['comments', `Comments${taskComments.length ? ` (${taskComments.length})` : ''}`],
                  ['history', 'History'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setViewTab(key)}
                    className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
                      viewTab === key
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Body */}
              <div className="overflow-y-auto px-5 py-4 flex-1">

                {/* ── DETAILS TAB ── */}
                {viewTab === 'details' && (
                  <div className="space-y-4">
                    {/* Description */}
                    {t.description ? (
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Description</p>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{t.description}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600 italic">No description provided.</p>
                    )}

                    {/* Linked requirement */}
                    {t.requirement_title && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-indigo-950/40 border border-indigo-900/50 rounded-lg">
                        <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                          <p className="text-xs text-slate-500">Linked Requirement</p>
                          <p className="text-sm text-indigo-300 font-medium">{t.requirement_title}</p>
                        </div>
                      </div>
                    )}

                    {/* Meta grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-900/60 rounded-lg px-3 py-2">
                        <p className="text-xs text-slate-500 mb-0.5">Sprint</p>
                        <p className="text-sm text-slate-300">{sprintObj ? sprintObj.name : <span className="text-slate-600">—</span>}</p>
                      </div>
                      <div className="bg-slate-900/60 rounded-lg px-3 py-2">
                        <p className="text-xs text-slate-500 mb-1">Assignee</p>
                        <select
                          value={t.assignee_id || ''}
                          onChange={e => handleQuickAssign(e.target.value ? Number(e.target.value) : null)}
                          className="w-full text-sm bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="">Unassigned</option>
                          {users.map(u => (
                            <option key={u.id} value={u.id}>{u.username}</option>
                          ))}
                        </select>
                      </div>
                      {t.start_date && (
                        <div className="bg-slate-900/60 rounded-lg px-3 py-2">
                          <p className="text-xs text-slate-500 mb-0.5">Start Date</p>
                          <p className="text-sm text-slate-300">{t.start_date}</p>
                        </div>
                      )}
                      {t.end_date && (
                        <div className="bg-slate-900/60 rounded-lg px-3 py-2">
                          <p className="text-xs text-slate-500 mb-0.5">End Date</p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-slate-300">{t.end_date}</p>
                            <DueBadge endDate={t.end_date} />
                          </div>
                        </div>
                      )}
                      {t.created_by && (
                        <div className="bg-slate-900/60 rounded-lg px-3 py-2">
                          <p className="text-xs text-slate-500 mb-0.5">Created By</p>
                          <p className="text-sm text-slate-300">{t.created_by}</p>
                        </div>
                      )}
                    </div>

                    {/* Effort */}
                    {planned > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Effort</p>
                        <div className="bg-slate-900/60 rounded-lg px-3 py-3 space-y-2">
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>{completed}h completed</span>
                            <span>{remaining}h remaining</span>
                            <span>{planned}h planned</span>
                          </div>
                          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs text-slate-500 text-right">{pct}% complete</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── COMMENTS TAB ── */}
                {viewTab === 'comments' && (
                  <div className="space-y-4">
                    {/* Comment list */}
                    {taskComments.length === 0 ? (
                      <p className="text-xs text-slate-600 italic">No comments yet. Be the first to comment.</p>
                    ) : (
                      <div className="space-y-3">
                        {taskComments.map(c => (
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

                    {/* Add comment */}
                    <div className="pt-2 border-t border-slate-700">
                      <textarea
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddComment(); }}
                        placeholder="Add a comment… (Ctrl+Enter to submit)"
                        rows={3}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={handleAddComment}
                          disabled={!commentText.trim() || submittingComment}
                          className="px-4 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition-colors"
                        >
                          {submittingComment ? 'Posting…' : 'Post Comment'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── HISTORY TAB ── */}
                {viewTab === 'history' && (
                  <div>
                    {taskHistory.length === 0 ? (
                      <p className="text-xs text-slate-600 italic">No changes recorded yet.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {taskHistory.map(h => (
                          <div key={h.id} className="flex gap-2.5 items-start">
                            <Avatar username={h.changed_by_username || '?'} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-300">
                                <span className="font-medium">{h.changed_by_username || 'Someone'}</span>
                                {' changed '}
                                <span className="text-indigo-400 font-medium">{h.field}</span>
                                {h.old_value ? (
                                  <> from <span className="text-slate-400">"{h.old_value}"</span></>
                                ) : null}
                                {' to '}
                                <span className="text-slate-200">"{h.new_value}"</span>
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
          </RightPanel>
        );
      })()}

      {/* ── Create / Edit Panel ── */}
      {showModal && (
        <RightPanel open={true} onClose={closeModal}>
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
              <h2 className="text-base font-semibold text-white">
                {editingTask ? 'Edit Task' : 'New Task'}
              </h2>
              <div className="flex items-center gap-2">
                {editingTask && (
                  <button
                    onClick={() => setDeleteConfirm(editingTask.id)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                    title="Delete task"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
                <button onClick={closeModal} className="p-1 text-slate-500 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal body */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Title <span className="text-red-400">*</span></label>
                <input
                  autoFocus
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="What needs to be done?"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder="Optional details…"
                />
              </div>

              {/* Row: Priority + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Priority</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm({ ...form, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Row: Sprint + Assignee */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Sprint</label>
                  <select
                    value={form.sprintId}
                    onChange={e => setForm({ ...form, sprintId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">No Sprint</option>
                    {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Assignee</label>
                  <select
                    value={form.assigneeId}
                    onChange={e => setForm({ ...form, assigneeId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Unassigned</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                  </select>
                </div>
              </div>

              {/* Requirement */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Linked Requirement</label>
                <select
                  value={form.requirementId}
                  onChange={e => setForm({ ...form, requirementId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="">— None —</option>
                  {requirements.map(r => (
                    <option key={r.id} value={r.id}>{r.title}</option>
                  ))}
                </select>
              </div>

              {/* Row: Start date + End date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={e => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">End Date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={e => setForm({ ...form, endDate: e.target.value })}
                    min={form.startDate || undefined}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* Row: Planned hours + Completed hours */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Planned Hours</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.plannedHours}
                    onChange={e => setForm({ ...form, plannedHours: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Completed Hours</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.completedHours}
                    onChange={e => setForm({ ...form, completedHours: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Remaining hours — computed */}
              {(parseFloat(form.plannedHours) > 0 || parseFloat(form.completedHours) > 0) && (
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg">
                  <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs text-slate-400">
                    Remaining: <span className="font-semibold text-white">
                      {Math.max((parseFloat(form.plannedHours) || 0) - (parseFloat(form.completedHours) || 0), 0)}h
                    </span>
                    {' '}of <span className="text-slate-300">{parseFloat(form.plannedHours) || 0}h planned</span>
                  </span>
                </div>
              )}

              {/* Footer buttons */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={closeModal}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving || !form.title.trim()}
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors">
                  {saving ? 'Saving…' : editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
        </RightPanel>
      )}

      {/* ── Delete confirm ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-white font-semibold mb-2">Delete Task?</h3>
            <p className="text-slate-400 text-sm mb-5">This action cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 text-sm font-medium bg-red-700 hover:bg-red-600 text-white rounded-lg">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
