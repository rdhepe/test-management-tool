import React, { useState, useEffect } from 'react';
import Wiki from './Wiki';

const API_URL = 'http://localhost:3001';
const STORAGE_KEY = 'tcs_project_info';

const DEFAULT_INFO = {
  name: '',
  description: '',
  version: '',
  status: 'Active',
  startDate: '',
  repoUrl: '',
  docsUrl: '',
  techStack: '',
  teamMembers: '',
  notes: ''
};

const STATUS_OPTIONS = ['Active', 'On Hold', 'Completed', 'Archived'];

const STATUS_COLORS = {
  Active: 'bg-green-500/20 text-green-400 border-green-500/30',
  'On Hold': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Archived: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
};

function Dashboard() {
  const [info, setInfo] = useState(DEFAULT_INFO);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_INFO);
  const [saved, setSaved] = useState(false);
  const [appUsers, setAppUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setInfo({ ...DEFAULT_INFO, ...parsed });
      }
    } catch {}
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    fetch(`${API_URL}/auth/team`, { headers: { 'x-auth-token': token } })
      .then(r => r.ok ? r.json() : [])
      .then(users => setAppUsers(Array.isArray(users) ? users : []))
      .catch(() => {});
  }, []);

  const handleEdit = () => {
    setDraft({ ...info });
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  const handleSave = () => {
    setInfo({ ...draft });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const Field = ({ label, value }) => (
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-slate-200 break-words">{value || <span className="italic text-slate-500">Not set</span>}</p>
    </div>
  );

  const isBlank = !info.name && !info.description;

  return (
    <div className="space-y-6 animate-page-transition">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold text-white">Project Dashboard</h1>
          <p className="text-slate-400 mt-1">General project information and details</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && activeTab === 'overview' && (
            <span className="flex items-center gap-1.5 text-sm text-green-400 font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
          {!editing && activeTab === 'overview' && (
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors font-medium shadow-lg shadow-indigo-600/20"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {isBlank ? 'Set Up Project' : 'Edit'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 -mt-2 mb-2">
        {[{ id: 'overview', label: 'Overview', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }, { id: 'documentation', label: 'Documentation', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' }].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Documentation tab */}
      {activeTab === 'documentation' && (
        <Wiki />
      )}

      {/* Overview tab */}
      {activeTab === 'overview' && (<>

      {/* Empty state */}
      {isBlank && !editing && (
        <div className="bg-slate-900 border border-dashed border-slate-700 rounded-xl p-12 text-center">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">No project info yet</h3>
          <p className="text-slate-500 mb-6">Add your project name, description, team and links to get started.</p>
          <button
            onClick={handleEdit}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors font-medium inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Set Up Project
          </button>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Edit Project Information</h2>
            <div className="flex items-center gap-3">
              <button onClick={handleCancel} className="px-4 py-2 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors font-medium flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save
              </button>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Project Name</label>
              <input
                type="text"
                value={draft.name}
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                placeholder="e.g. E-Commerce Platform QA"
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
              <textarea
                value={draft.description}
                onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                placeholder="What is this project about?"
                rows={4}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Version</label>
              <input
                type="text"
                value={draft.version}
                onChange={e => setDraft(d => ({ ...d, version: e.target.value }))}
                placeholder="e.g. 2.4.1"
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Status</label>
              <select
                value={draft.status}
                onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Start Date</label>
              <input
                type="date"
                value={draft.startDate}
                onChange={e => setDraft(d => ({ ...d, startDate: e.target.value }))}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Tech Stack</label>
              <input
                type="text"
                value={draft.techStack}
                onChange={e => setDraft(d => ({ ...d, techStack: e.target.value }))}
                placeholder="e.g. React, Node.js, Playwright"
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Team Members</label>
              <p className="text-xs text-slate-500 mb-2">Team members are managed automatically from app users. Manage users via the Users section.</p>
              <div className="flex flex-wrap gap-2 px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg min-h-[42px]">
                {appUsers.length === 0 && <span className="text-slate-500 text-sm">No users yet</span>}
                {appUsers.map(u => (
                  <span key={u.id} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${
                    u.role === 'admin' ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                  } ${!u.is_active ? 'opacity-40' : ''}`}>
                    <span className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[9px] font-bold">{u.username.charAt(0).toUpperCase()}</span>
                    {u.username}
                    <span className="opacity-60">· {u.role}</span>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Repository URL</label>
              <input
                type="url"
                value={draft.repoUrl}
                onChange={e => setDraft(d => ({ ...d, repoUrl: e.target.value }))}
                placeholder="https://github.com/..."
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Documentation URL</label>
              <input
                type="url"
                value={draft.docsUrl}
                onChange={e => setDraft(d => ({ ...d, docsUrl: e.target.value }))}
                placeholder="https://docs.example.com"
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
              <textarea
                value={draft.notes}
                onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                placeholder="Any additional notes, context, or important information..."
                rows={3}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y"
              />
            </div>
          </div>
        </div>
      )}

      {/* View mode */}
      {!editing && !isBlank && (
        <div className="space-y-6">
          {/* Project identity card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-lg shadow-indigo-600/30">
                {info.name ? info.name.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h2 className="text-2xl font-bold text-white">{info.name || 'Unnamed Project'}</h2>
                  {info.version && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full">v{info.version}</span>
                  )}
                  <span className={`px-2 py-0.5 text-xs font-medium border rounded-full ${STATUS_COLORS[info.status] || STATUS_COLORS['Active']}`}>
                    {info.status}
                  </span>
                </div>
                {info.description && (
                  <p className="text-slate-400 mt-1 leading-relaxed">{info.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* General info */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                General
              </h3>
              <Field label="Version" value={info.version} />
              <Field label="Status" value={info.status} />
              <Field label="Start Date" value={info.startDate ? new Date(info.startDate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''} />
            </div>

            {/* Tech Stack */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Tech Stack
              </h3>
              {info.techStack ? (
                <div className="flex flex-wrap gap-2">
                  {info.techStack.split(',').map(t => t.trim()).filter(Boolean).map(tech => (
                    <span key={tech} className="px-2.5 py-1 text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 rounded-lg">{tech}</span>
                  ))}
                </div>
              ) : (
                <p className="text-sm italic text-slate-500">Not set</p>
              )}
            </div>

            {/* Links */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Links
              </h3>
              {info.repoUrl ? (
                <a href={info.repoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors break-all">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  Repository
                </a>
              ) : <p className="text-sm italic text-slate-500">No repo URL</p>}
              {info.docsUrl ? (
                <a href={info.docsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors break-all">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Documentation
                </a>
              ) : <p className="text-sm italic text-slate-500">No docs URL</p>}
            </div>
          </div>

          {/* Team Members — live from app users */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Team Members
              <span className="ml-auto text-xs font-normal text-slate-500 normal-case tracking-normal">{appUsers.filter(u => u.is_active).length} active</span>
            </h3>
            {appUsers.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No users registered yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {appUsers.map(u => (
                  <div key={u.id} className={`flex items-center gap-2 px-3 py-1.5 bg-slate-800 border rounded-lg transition-opacity ${
                    u.is_active ? 'border-slate-700 opacity-100' : 'border-slate-800 opacity-40'
                  }`}>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-slate-300">{u.username}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      u.role === 'admin' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'
                    }`}>{u.role}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          {info.notes && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Notes
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">{info.notes}</p>
            </div>
          )}
        </div>
      )}
      </>)}
    </div>
  );
}

export default Dashboard;
