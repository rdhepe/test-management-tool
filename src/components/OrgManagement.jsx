import React, { useState, useEffect } from 'react';

import API_URL from '../apiUrl';

const PLAN_BADGE = {
  free:       'bg-slate-500/20 text-slate-400 border-slate-500/30',
  starter:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
  pro:        'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  enterprise: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const ROLE_BADGE = {
  admin:       'bg-purple-500/20 text-purple-400 border-purple-500/30',
  contributor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  _default:    'bg-teal-500/20 text-teal-300 border-teal-500/30',
};

const PLANS = ['free', 'starter', 'pro', 'enterprise'];

const PERMISSION_GROUPS = [
  { section: 'Overview',        items: [{ view: 'dashboard', label: 'Dashboard' }] },
  { section: 'Test Management', items: [
    { view: 'features', label: 'Features' }, { view: 'requirements', label: 'Requirements' },
    { view: 'testcases', label: 'Test Cases' }, { view: 'taskboard', label: 'Taskboard' },
    { view: 'sprints', label: 'Sprints' },
  ]},
  { section: 'Automation', items: [
    { view: 'summary', label: 'Summary' }, { view: 'modules', label: 'Modules' },
    { view: 'testSuites', label: 'Test Suites' }, { view: 'globalVariables', label: 'Variables' },
    { view: 'playwrightConfig', label: 'Config' },
  ]},
  { section: 'Execution', items: [
    { view: 'executions', label: 'Single Runs' },
  ]},
  { section: 'Quality',   items: [{ view: 'defects', label: 'Defects' }] },
  { section: 'Insights',  items: [{ view: 'reports', label: 'Reports' }] },
  { section: 'Learn',     items: [{ view: 'tutorial', label: 'Guide' }] },
];

function OrgManagement({ currentUser }) {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Org drill-down ──
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [orgUsers, setOrgUsers] = useState([]);
  const [orgUsersLoading, setOrgUsersLoading] = useState(false);

  // ── Create org modal ──
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ orgName: '', orgSlug: '', adminUsername: '', adminPassword: '', plan: 'free', maxUsers: '', pocName: '', pocEmail: '', aiHealingEnabled: false, openaiApiKey: '' });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // ── Edit org modal ──
  const [editingOrg, setEditingOrg] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', plan: 'free', is_active: 1, maxUsers: '', pocName: '', pocEmail: '', aiHealingEnabled: false, openaiApiKey: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // ── Add user modal (inside org detail) ──
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserForm, setAddUserForm] = useState({ username: '', password: '', role: 'contributor', customRole: '', permissions: [] });
  const [addUserError, setAddUserError] = useState('');
  const [addUserLoading, setAddUserLoading] = useState(false);

  // ── Edit user modal (inside org detail) ──
  const [editingUser, setEditingUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({ username: '', password: '', role: 'contributor', customRole: '', is_active: true, permissions: [] });
  const [editUserError, setEditUserError] = useState('');
  const [editUserLoading, setEditUserLoading] = useState(false);

  // ── Delete user confirm ──
  const [deleteUserConfirm, setDeleteUserConfirm] = useState(null);

  const token = localStorage.getItem('auth_token');
  const headers = { 'Content-Type': 'application/json', 'x-auth-token': token };

  // ─── Fetch orgs ────────────────────────────────────────────────
  const fetchOrgs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/orgs`, { headers });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load organizations');
      const data = await res.json();
      setOrgs(data);
      // Keep selectedOrg in sync if it was updated
      if (selectedOrg) {
        const updated = data.find(o => o.id === selectedOrg.id);
        if (updated) setSelectedOrg(updated);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrgs(); }, []);

  // ─── Fetch users for selected org ──────────────────────────────
  const fetchOrgUsers = async (orgId) => {
    setOrgUsersLoading(true);
    try {
      const res = await fetch(`${API_URL}/orgs/${orgId}/users`, { headers });
      const data = await res.json();
      setOrgUsers(Array.isArray(data) ? data : []);
    } catch { setOrgUsers([]); } finally { setOrgUsersLoading(false); }
  };

  const openOrgDetail = (org) => {
    setSelectedOrg(org);
    fetchOrgUsers(org.id);
    setShowAddUser(false);
    setEditingUser(null);
  };

  const backToOrgs = () => {
    setSelectedOrg(null);
    setOrgUsers([]);
    setShowAddUser(false);
    setEditingUser(null);
    fetchOrgs();
  };

  // ─── Org name → slug ───────────────────────────────────────────
  const handleNameChange = (val) => {
    setForm(f => ({
      ...f,
      orgName: val,
      orgSlug: val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    }));
  };

  // ─── Create org ────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.orgName.trim() || !form.orgSlug.trim() || !form.adminUsername.trim() || !form.adminPassword.trim()) {
      return setFormError('All fields are required.');
    }
    setFormLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register-org`, {
        method: 'POST', headers,
        body: JSON.stringify({ orgName: form.orgName.trim(), orgSlug: form.orgSlug.trim(), adminUsername: form.adminUsername.trim(), adminPassword: form.adminPassword, plan: form.plan, maxUsers: form.maxUsers ? parseInt(form.maxUsers) : null, pocName: form.pocName.trim() || null, pocEmail: form.pocEmail.trim() || null, aiHealingEnabled: form.aiHealingEnabled, openaiApiKey: form.openaiApiKey || null })
      });
      const data = await res.json();
      if (!res.ok) return setFormError(data.error || 'Failed to create organization');
      setSuccessMsg(`Organization "${data.org.name}" created successfully with admin user "${data.user.username}".`);
      setShowCreate(false);
      setForm({ orgName: '', orgSlug: '', adminUsername: '', adminPassword: '', plan: 'free', maxUsers: '', pocName: '', pocEmail: '', aiHealingEnabled: false, openaiApiKey: '' });
      fetchOrgs();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (e) { setFormError(e.message); }
    finally { setFormLoading(false); }
  };

  // ─── Edit org ──────────────────────────────────────────────────
  const openEdit = (org, e) => {
    e?.stopPropagation();
    setEditingOrg(org);
    setEditForm({ name: org.name, plan: org.plan, is_active: org.is_active, maxUsers: org.max_users ?? '', pocName: org.poc_name ?? '', pocEmail: org.poc_email ?? '', aiHealingEnabled: !!org.ai_healing_enabled, openaiApiKey: '' });
    setEditError('');
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim()) return setEditError('Organization name is required.');
    setEditLoading(true); setEditError('');
    try {
      const res = await fetch(`${API_URL}/orgs/${editingOrg.id}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ name: editForm.name.trim(), plan: editForm.plan, is_active: editForm.is_active, maxUsers: editForm.maxUsers ? parseInt(editForm.maxUsers) : null, pocName: editForm.pocName.trim() || null, pocEmail: editForm.pocEmail.trim() || null, aiHealingEnabled: editForm.aiHealingEnabled, openaiApiKey: editForm.openaiApiKey || null })
      });
      const data = await res.json();
      if (!res.ok) return setEditError(data.error || 'Failed to update organization');
      setEditingOrg(null);
      fetchOrgs();
    } catch (e) { setEditError(e.message); }
    finally { setEditLoading(false); }
  };

  const toggleActive = async (org, e) => {
    e?.stopPropagation();
    try {
      await fetch(`${API_URL}/orgs/${org.id}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ name: org.name, plan: org.plan, is_active: org.is_active ? 0 : 1, maxUsers: org.max_users, pocName: org.poc_name, pocEmail: org.poc_email, aiHealingEnabled: !!org.ai_healing_enabled })
      });
      fetchOrgs();
    } catch (_) {}
  };

  // ─── Add user to org ───────────────────────────────────────────
  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddUserError('');
    if (!addUserForm.username.trim() || !addUserForm.password.trim()) {
      return setAddUserError('Username and password are required.');
    }
    setAddUserLoading(true);
    try {
      const res = await fetch(`${API_URL}/orgs/${selectedOrg.id}/users`, {
        method: 'POST', headers,
        body: JSON.stringify({
          username: addUserForm.username.trim(),
          password: addUserForm.password,
          role: addUserForm.role === 'custom' ? addUserForm.customRole.trim() : addUserForm.role,
          permissions: addUserForm.role === 'custom' ? addUserForm.permissions : null,
        })
      });
      const data = await res.json();
      if (!res.ok) return setAddUserError(data.error || 'Failed to create user');
      setShowAddUser(false);
      setAddUserForm({ username: '', password: '', role: 'contributor', customRole: '', permissions: [] });
      fetchOrgUsers(selectedOrg.id);
      fetchOrgs(); // update user_count
    } catch (e) { setAddUserError(e.message); }
    finally { setAddUserLoading(false); }
  };

  // ─── Edit user ─────────────────────────────────────────────────
  const openEditUser = (user) => {
    setEditingUser(user);
    const isCustom = !['admin', 'contributor'].includes(user.role);
    setEditUserForm({
      username: user.username, password: '',
      role: isCustom ? 'custom' : user.role,
      customRole: isCustom ? user.role : '',
      is_active: user.is_active !== false,
      permissions: (() => { try { return user.permissions ? JSON.parse(user.permissions) : []; } catch { return []; } })(),
    });
    setEditUserError('');
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    setEditUserError('');
    setEditUserLoading(true);
    try {
      const body = {
        username: editUserForm.username,
        role: editUserForm.role === 'custom' ? editUserForm.customRole.trim() : editUserForm.role,
        is_active: editUserForm.is_active,
        permissions: editUserForm.role === 'custom' ? editUserForm.permissions : null,
      };
      if (editUserForm.password) body.password = editUserForm.password;
      const res = await fetch(`${API_URL}/orgs/${selectedOrg.id}/users/${editingUser.id}`, {
        method: 'PUT', headers,
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) return setEditUserError(data.error || 'Failed to update user');
      setEditingUser(null);
      fetchOrgUsers(selectedOrg.id);
    } catch (e) { setEditUserError(e.message); }
    finally { setEditUserLoading(false); }
  };

  // ─── Delete user ───────────────────────────────────────────────
  const handleDeleteUser = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/orgs/${selectedOrg.id}/users/${userId}`, { method: 'DELETE', headers });
      if (!res.ok) { const d = await res.json(); alert(d.error || 'Delete failed'); return; }
      setDeleteUserConfirm(null);
      fetchOrgUsers(selectedOrg.id);
      fetchOrgs();
    } catch { /* no-op */ }
  };

  // ═══════════════════════════════════════════════════════════════
  // ─── ORG DETAIL VIEW ───────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════
  if (selectedOrg) {
    const admins = orgUsers.filter(u => u.role === 'admin');
    const contributors = orgUsers.filter(u => u.role === 'contributor');
    const customs = orgUsers.filter(u => !['admin', 'contributor'].includes(u.role));

    return (
      <div className="p-6 space-y-6">
        {/* Breadcrumb + back */}
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <button onClick={backToOrgs} className="flex items-center gap-1.5 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Organizations
          </button>
          <span className="text-slate-600">/</span>
          <span className="text-white font-medium">{selectedOrg.name}</span>
        </div>

        {/* Org header */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0 ${selectedOrg.is_active ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-slate-600 to-slate-700'}`}>
                {selectedOrg.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-white">{selectedOrg.name}</h2>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${PLAN_BADGE[selectedOrg.plan] || PLAN_BADGE.free}`}>{selectedOrg.plan}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${selectedOrg.is_active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                    {selectedOrg.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-slate-400 text-sm mt-0.5">
                  <span className="font-mono">org/{selectedOrg.slug}</span>
                  <span className="mx-2 text-slate-600">·</span>
                  <span>ID: {selectedOrg.id}</span>
                  {selectedOrg.created_at && (
                    <><span className="mx-2 text-slate-600">·</span><span>Created {new Date(selectedOrg.created_at).toLocaleDateString()}</span></>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedOrg.id !== 1 && (
                <button
                  onClick={(e) => toggleActive(selectedOrg, e)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border text-slate-400 border-slate-600 hover:border-slate-400 hover:text-white transition-colors"
                >
                  {selectedOrg.is_active ? 'Deactivate' : 'Activate'}
                </button>
              )}
              <button
                onClick={(e) => openEdit(selectedOrg, e)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Org
              </button>
            </div>
          </div>
        </div>

        {/* User stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Users', value: orgUsers.length, color: 'text-white', bg: 'bg-slate-700/30 border-slate-600/20' },
            { label: 'Admins', value: admins.length, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
            { label: 'Contributors', value: contributors.length, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
            { label: 'Custom Roles', value: customs.length, color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border rounded-xl p-4`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-slate-400 text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Users section header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">Users</h3>
            {selectedOrg?.max_users ? (
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                orgUsers.length >= selectedOrg.max_users
                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                  : 'bg-slate-700/50 text-slate-400 border-slate-600/50'
              }`}>
                {orgUsers.length} / {selectedOrg.max_users} users
              </span>
            ) : null}
          </div>
          <button
            onClick={() => { setShowAddUser(true); setAddUserError(''); setAddUserForm({ username: '', password: '', role: 'contributor', customRole: '', permissions: [] }); }}
            disabled={!!(selectedOrg?.max_users && orgUsers.length >= selectedOrg.max_users)}
            title={selectedOrg?.max_users && orgUsers.length >= selectedOrg.max_users ? `User limit of ${selectedOrg.max_users} reached` : undefined}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add User
          </button>
        </div>

        {/* Users table */}
        {orgUsersLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <svg className="w-5 h-5 animate-spin mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Loading users...
          </div>
        ) : orgUsers.length === 0 ? (
          <div className="text-center py-12 bg-slate-800/30 border border-dashed border-slate-700/50 rounded-xl">
            <svg className="w-10 h-10 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-slate-400 font-medium">No users found</p>
            <p className="text-slate-500 text-sm mt-1">Add the first user for this organization</p>
          </div>
        ) : (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/80">
                  <th className="text-left px-5 py-3 text-slate-400 font-medium">Username</th>
                  <th className="text-left px-5 py-3 text-slate-400 font-medium">Role</th>
                  <th className="text-left px-5 py-3 text-slate-400 font-medium">Status</th>
                  <th className="text-left px-5 py-3 text-slate-400 font-medium">Created</th>
                  <th className="text-right px-5 py-3 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgUsers.map((user, i) => (
                  <tr key={user.id} className={`border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-800/20'}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${user.role === 'admin' ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : user.role === 'contributor' ? 'bg-gradient-to-br from-blue-500 to-cyan-600' : 'bg-gradient-to-br from-teal-500 to-emerald-600'}`}>
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-white font-medium">{user.username}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${ROLE_BADGE[user.role] || ROLE_BADGE._default}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${user.is_active !== false ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                        {user.is_active !== false ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEditUser(user)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                          title="Edit user"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteUserConfirm(user.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete user"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Add User Modal ── */}
        {showAddUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddUser(false)} />
            <div className={`relative bg-slate-900 border border-slate-700 rounded-2xl w-full shadow-2xl flex flex-col transition-all duration-200 ${addUserForm.role === 'custom' ? 'max-w-3xl' : 'max-w-md'}`}>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
                <div>
                  <h2 className="text-lg font-semibold text-white">Add User</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Create a new user for <span className="text-white">{selectedOrg.name}</span></p>
                </div>
                <button onClick={() => setShowAddUser(false)} className="text-slate-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Body — splits into two columns when custom role */}
              <form onSubmit={handleAddUser} className="flex min-h-0">
                {/* Left: core fields */}
                <div className="flex-1 p-6 space-y-4 min-w-0">
                  {addUserError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{addUserError}</div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Username *</label>
                    <input
                      type="text" required value={addUserForm.username}
                      onChange={e => setAddUserForm(f => ({ ...f, username: e.target.value }))}
                      placeholder="e.g. john_doe"
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Password *</label>
                    <input
                      type="password" required value={addUserForm.password}
                      onChange={e => setAddUserForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'admin', label: 'Admin', desc: 'Full access + user mgmt' },
                        { value: 'contributor', label: 'Contributor', desc: 'All features, no mgmt' },
                        { value: 'custom', label: 'Custom', desc: 'Define permissions' },
                      ].map(r => (
                        <button key={r.value} type="button"
                          onClick={() => setAddUserForm(f => ({ ...f, role: r.value }))}
                          className={`p-3 rounded-lg border text-left transition-colors ${addUserForm.role === r.value ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}
                        >
                          <div className="font-medium text-sm">{r.label}</div>
                          <div className="text-xs mt-0.5 opacity-70">{r.desc}</div>
                        </button>
                      ))}
                    </div>
                    {addUserForm.role === 'custom' && (
                      <div className="mt-3">
                        <input
                          type="text" required value={addUserForm.customRole}
                          onChange={e => setAddUserForm(f => ({ ...f, customRole: e.target.value }))}
                          placeholder="Role name, e.g. viewer, tester, qa_lead"
                          className="w-full bg-slate-800 border border-teal-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 placeholder-slate-500"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setShowAddUser(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
                    <button type="submit" disabled={addUserLoading}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors flex items-center gap-2"
                    >
                      {addUserLoading ? (
                        <><svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v8z" /></svg>Creating...</>
                      ) : 'Create User'}
                    </button>
                  </div>
                </div>
                {/* Right: permissions panel (only when custom) */}
                {addUserForm.role === 'custom' && (
                  <div className="w-64 shrink-0 border-l border-slate-700 flex flex-col">
                    <div className="px-4 py-3 border-b border-slate-700/60 shrink-0">
                      <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Allowed Views</div>
                      <div className="text-xs text-slate-500 mt-0.5">Toggle what this role can access</div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: '380px' }}>
                      {PERMISSION_GROUPS.map(group => (
                        <div key={group.section}>
                          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{group.section}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {group.items.map(item => {
                              const perms = addUserForm.permissions || [];
                              const checked = perms.includes(item.view);
                              return (
                                <button key={item.view} type="button"
                                  onClick={() => setAddUserForm(f => ({
                                    ...f,
                                    permissions: checked
                                      ? (f.permissions || []).filter(v => v !== item.view)
                                      : [...(f.permissions || []), item.view],
                                  }))}
                                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                                    checked ? 'bg-teal-600/25 border-teal-500 text-teal-300' : 'bg-slate-800/80 border-slate-600 text-slate-400 hover:border-slate-500'
                                  }`}
                                >{item.label}</button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-2 border-t border-slate-700/60 shrink-0">
                      <div className="text-xs text-slate-500">{(addUserForm.permissions || []).length} view{(addUserForm.permissions || []).length !== 1 ? 's' : ''} selected</div>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

        {/* ── Edit User Modal ── */}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingUser(null)} />
            <div className={`relative bg-slate-900 border border-slate-700 rounded-2xl w-full shadow-2xl flex flex-col transition-all duration-200 ${editUserForm.role === 'custom' ? 'max-w-3xl' : 'max-w-md'}`}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
                <h2 className="text-lg font-semibold text-white">Edit User</h2>
                <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleEditUser} className="flex min-h-0">
                {/* Left: core fields */}
                <div className="flex-1 p-6 space-y-4 min-w-0">
                  {editUserError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{editUserError}</div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Username *</label>
                    <input type="text" required value={editUserForm.username}
                      onChange={e => setEditUserForm(f => ({ ...f, username: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Password <span className="text-slate-500 font-normal">(leave blank to keep current)</span>
                    </label>
                    <input type="password" value={editUserForm.password}
                      onChange={e => setEditUserForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['admin', 'contributor', 'custom'].map(r => (
                        <button key={r} type="button"
                          onClick={() => setEditUserForm(f => ({ ...f, role: r }))}
                          className={`py-2 rounded-lg border text-sm font-medium capitalize transition-colors ${editUserForm.role === r ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}
                        >{r}</button>
                      ))}
                    </div>
                    {editUserForm.role === 'custom' && (
                      <div className="mt-3">
                        <input
                          type="text" required value={editUserForm.customRole}
                          onChange={e => setEditUserForm(f => ({ ...f, customRole: e.target.value }))}
                          placeholder="Role name, e.g. viewer, tester, qa_lead"
                          className="w-full bg-slate-800 border border-teal-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 placeholder-slate-500"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                    <div>
                      <div className="text-sm text-white font-medium">Account Status</div>
                      <div className="text-xs text-slate-400 mt-0.5">Disabled accounts cannot log in</div>
                    </div>
                    <button type="button"
                      onClick={() => setEditUserForm(f => ({ ...f, is_active: !f.is_active }))}
                      className={`relative w-11 h-6 rounded-full transition-colors ${editUserForm.is_active ? 'bg-emerald-500' : 'bg-slate-600'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editUserForm.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
                    <button type="submit" disabled={editUserLoading}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
                    >
                      {editUserLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
                {/* Right: permissions panel (only when custom) */}
                {editUserForm.role === 'custom' && (
                  <div className="w-64 shrink-0 border-l border-slate-700 flex flex-col">
                    <div className="px-4 py-3 border-b border-slate-700/60 shrink-0">
                      <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Allowed Views</div>
                      <div className="text-xs text-slate-500 mt-0.5">Toggle what this role can access</div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: '380px' }}>
                      {PERMISSION_GROUPS.map(group => (
                        <div key={group.section}>
                          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{group.section}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {group.items.map(item => {
                              const perms = editUserForm.permissions || [];
                              const checked = perms.includes(item.view);
                              return (
                                <button key={item.view} type="button"
                                  onClick={() => setEditUserForm(f => ({
                                    ...f,
                                    permissions: checked
                                      ? (f.permissions || []).filter(v => v !== item.view)
                                      : [...(f.permissions || []), item.view],
                                  }))}
                                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                                    checked ? 'bg-teal-600/25 border-teal-500 text-teal-300' : 'bg-slate-800/80 border-slate-600 text-slate-400 hover:border-slate-500'
                                  }`}
                                >{item.label}</button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-2 border-t border-slate-700/60 shrink-0">
                      <div className="text-xs text-slate-500">{(editUserForm.permissions || []).length} view{(editUserForm.permissions || []).length !== 1 ? 's' : ''} selected</div>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

        {/* ── Delete User Confirm ── */}
        {deleteUserConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteUserConfirm(null)} />
            <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white">Delete User</h3>
                  <p className="text-sm text-slate-400 mt-0.5">This action cannot be undone.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteUserConfirm(null)} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-600 text-slate-400 text-sm font-medium">Cancel</button>
                <button onClick={() => handleDeleteUser(deleteUserConfirm)} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit Org Modal (reused from list view) ── */}
        {editingOrg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingOrg(null)} />
            <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-white">Edit Organization</h2>
                <button onClick={() => setEditingOrg(null)} className="text-slate-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleEdit} className="p-6 space-y-4">
                {editError && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{editError}</div>}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Organization Name *</label>
                  <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Plan</label>
                  <div className="grid grid-cols-4 gap-2">
                    {PLANS.map(p => (
                      <button key={p} type="button" onClick={() => setEditForm(f => ({ ...f, plan: p }))}
                        className={`py-2 rounded-lg border text-sm font-medium capitalize transition-colors ${editForm.plan === p ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}
                      >{p}</button>
                    ))}
                  </div>
                </div>
                {editingOrg.id !== 1 && (
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                    <div>
                      <div className="text-sm text-white font-medium">Active Status</div>
                      <div className="text-xs text-slate-400 mt-0.5">Inactive orgs cannot log in</div>
                    </div>
                    <button type="button" onClick={() => setEditForm(f => ({ ...f, is_active: f.is_active ? 0 : 1 }))}
                      className={`relative w-11 h-6 rounded-full transition-colors ${editForm.is_active ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editForm.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setEditingOrg(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
                  <button type="submit" disabled={editLoading}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
                  >{editLoading ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // ─── ORG LIST VIEW ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Organization Management
          </h1>
          <p className="text-slate-400 text-sm mt-1">Create and manage tenant organizations. <span className="text-indigo-400">Click any row</span> to manage its users.</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setFormError(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Organization
        </button>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {successMsg}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Orgs', value: orgs.length, color: 'text-white', bg: 'bg-slate-700/30 border-slate-600/20' },
          { label: 'Active', value: orgs.filter(o => o.is_active).length, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Total Users', value: orgs.reduce((s, o) => s + (o.user_count || 0), 0), color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border rounded-xl p-4`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-slate-400 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <svg className="w-5 h-5 animate-spin mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Loading organizations...
        </div>
      ) : orgs.length === 0 ? (
        <div className="text-center py-16 text-slate-500">No organizations found.</div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800/80">
                <th className="text-left px-5 py-3 text-slate-400 font-medium">Organization</th>
                <th className="text-left px-5 py-3 text-slate-400 font-medium">Slug</th>
                <th className="text-left px-5 py-3 text-slate-400 font-medium">Plan</th>
                <th className="text-left px-5 py-3 text-slate-400 font-medium">Users</th>
                <th className="text-left px-5 py-3 text-slate-400 font-medium">Status</th>
                <th className="text-left px-5 py-3 text-slate-400 font-medium">Created</th>
                <th className="text-right px-5 py-3 text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org, i) => (
                <tr
                  key={org.id}
                  onClick={() => openOrgDetail(org)}
                  className={`border-b border-slate-700/30 cursor-pointer hover:bg-slate-700/30 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-800/20'}`}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${org.is_active ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-slate-600 to-slate-700'}`}>
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-white font-medium">{org.name}</div>
                        <div className="text-slate-500 text-xs">ID: {org.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-300 font-mono text-xs">{org.slug}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${PLAN_BADGE[org.plan] || PLAN_BADGE.free}`}>{org.plan}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {org.user_count ?? 0}
                      {org.max_users ? (
                        <span className={`text-xs ${(org.user_count ?? 0) >= org.max_users ? 'text-red-400 font-medium' : 'text-slate-500'}`}>
                          / {org.max_users}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {org.id === 1 ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-slate-500/20 text-slate-400 border-slate-500/30">Default</span>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleActive(org, e); }}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${org.is_active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'}`}
                      >
                        {org.is_active ? 'Active' : 'Inactive'}
                      </button>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-400 text-xs">
                    {org.created_at ? new Date(org.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); openOrgDetail(org); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 transition-colors"
                        title="Manage users for this org"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Users
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(org, e); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                        title="Edit organization"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create Org Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div>
                <h2 className="text-lg font-semibold text-white">Create New Organization</h2>
                <p className="text-slate-400 text-xs mt-0.5">Provision a new tenant with an admin user</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {formError && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{formError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Organization Name *</label>
                  <input type="text" value={form.orgName} onChange={e => handleNameChange(e.target.value)} placeholder="Acme Corp"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-slate-500" required />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">URL Slug *</label>
                  <div className="flex items-center gap-0">
                    <span className="bg-slate-700 border border-r-0 border-slate-600 rounded-l-lg px-3 py-2 text-slate-400 text-sm select-none">org/</span>
                    <input type="text" value={form.orgSlug}
                      onChange={e => setForm(f => ({ ...f, orgSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                      placeholder="acme-corp"
                      className="flex-1 bg-slate-800 border border-slate-600 rounded-r-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-slate-500" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Admin Username *</label>
                  <input type="text" value={form.adminUsername} onChange={e => setForm(f => ({ ...f, adminUsername: e.target.value }))} placeholder="admin"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-slate-500" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Admin Password *</label>
                  <input type="password" value={form.adminPassword} onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))} placeholder="••••••••"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-slate-500" required />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Plan</label>
                  <div className="grid grid-cols-4 gap-2">
                    {PLANS.map(p => (
                      <button key={p} type="button" onClick={() => setForm(f => ({ ...f, plan: p }))}
                        className={`py-2 rounded-lg border text-sm font-medium capitalize transition-colors ${form.plan === p ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}
                      >{p}</button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    User Limit <span className="text-slate-500 font-normal">(leave blank for unlimited)</span>
                  </label>
                  <input type="number" min="1" value={form.maxUsers}
                    onChange={e => setForm(f => ({ ...f, maxUsers: e.target.value }))}
                    placeholder="e.g. 10"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Point of Contact</label>
                  <input type="text" value={form.pocName}
                    onChange={e => setForm(f => ({ ...f, pocName: e.target.value }))}
                    placeholder="Jane Smith"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">POC Email</label>
                  <input type="email" value={form.pocEmail}
                    onChange={e => setForm(f => ({ ...f, pocEmail: e.target.value }))}
                    placeholder="jane@example.com"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-slate-500"
                  />
                </div>
              </div>
              {/* AI Healing */}
              <div className="border border-slate-700/50 rounded-xl p-4 space-y-3 bg-slate-800/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">AI Test Healing</div>
                    <div className="text-xs text-slate-500 mt-0.5">Auto-fix failing tests via GPT-4o</div>
                  </div>
                  <button type="button" onClick={() => setForm(f => ({ ...f, aiHealingEnabled: !f.aiHealingEnabled }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${form.aiHealingEnabled ? 'bg-purple-600' : 'bg-slate-600'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.aiHealingEnabled ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
                {form.aiHealingEnabled && (
                  <input type="password" placeholder="OpenAI API key (sk-...)" value={form.openaiApiKey}
                    onChange={e => setForm(f => ({ ...f, openaiApiKey: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 placeholder-slate-500"
                  />
                )}
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={formLoading}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  {formLoading ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v8z" /></svg>Creating...</>
                  ) : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Org Modal ── */}
      {editingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingOrg(null)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Edit Organization</h2>
              <button onClick={() => setEditingOrg(null)} className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              {editError && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{editError}</div>}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Organization Name *</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Plan</label>
                <div className="grid grid-cols-4 gap-2">
                  {PLANS.map(p => (
                    <button key={p} type="button" onClick={() => setEditForm(f => ({ ...f, plan: p }))}
                      className={`py-2 rounded-lg border text-sm font-medium capitalize transition-colors ${editForm.plan === p ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}
                    >{p}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  User Limit <span className="text-slate-500 font-normal">(leave blank for unlimited)</span>
                </label>
                <input type="number" min="1" value={editForm.maxUsers}
                  onChange={e => setEditForm(f => ({ ...f, maxUsers: e.target.value }))}
                  placeholder="e.g. 10"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-slate-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Point of Contact</label>
                  <input type="text" value={editForm.pocName}
                    onChange={e => setEditForm(f => ({ ...f, pocName: e.target.value }))}
                    placeholder="Jane Smith"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">POC Email</label>
                  <input type="email" value={editForm.pocEmail}
                    onChange={e => setEditForm(f => ({ ...f, pocEmail: e.target.value }))}
                    placeholder="jane@example.com"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-slate-500"
                  />
                </div>
              </div>
              {/* AI Healing */}
              <div className="border border-slate-700/50 rounded-xl p-4 space-y-3 bg-slate-800/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">AI Test Healing</div>
                    <div className="text-xs text-slate-500 mt-0.5">Auto-fix failing tests via GPT-4o</div>
                  </div>
                  <button type="button" onClick={() => setEditForm(f => ({ ...f, aiHealingEnabled: !f.aiHealingEnabled }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${editForm.aiHealingEnabled ? 'bg-purple-600' : 'bg-slate-600'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editForm.aiHealingEnabled ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
                {editForm.aiHealingEnabled && (
                  <input type="password" placeholder="New OpenAI API key (leave blank to keep existing)" value={editForm.openaiApiKey}
                    onChange={e => setEditForm(f => ({ ...f, openaiApiKey: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 placeholder-slate-500"
                  />
                )}
              </div>
              {editingOrg.id !== 1 && (
                <div className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                  <div>
                    <div className="text-sm text-white font-medium">Active Status</div>
                    <div className="text-xs text-slate-400 mt-0.5">Inactive orgs cannot log in</div>
                  </div>
                  <button type="button" onClick={() => setEditForm(f => ({ ...f, is_active: f.is_active ? 0 : 1 }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${editForm.is_active ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editForm.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditingOrg(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={editLoading}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
                >{editLoading ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrgManagement;
