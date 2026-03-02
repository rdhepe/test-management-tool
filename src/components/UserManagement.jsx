import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:3001';

const ROLE_BADGE = {
  super_admin: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  contributor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  custom: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
};

const ALL_PERMISSIONS = [
  { view: 'dashboard', label: 'Dashboard' },
  { view: 'features', label: 'Features' },
  { view: 'requirements', label: 'Requirements' },
  { view: 'testcases', label: 'Test Cases' },
  { view: 'taskboard', label: 'Taskboard' },
  { view: 'sprints', label: 'Sprints' },
  { view: 'modules', label: 'Modules' },
  { view: 'testSuites', label: 'Test Suites / Suite Runs' },
  { view: 'summary', label: 'Summary' },
  { view: 'playwrightConfig', label: 'Playwright Config' },
  { view: 'executions', label: 'Single Runs' },
  { view: 'defects', label: 'Defects' },
  { view: 'reports', label: 'Reports' },
];

function UserManagement({ currentUser }) {
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isAdminOrAbove = ['admin', 'super_admin'].includes(currentUser?.role);

  const [activeTab, setActiveTab] = useState('users');

  // ── Users state ──
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'contributor', customRoleId: '', is_active: true });
  const [userFormError, setUserFormError] = useState('');
  const [userFormLoading, setUserFormLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // ── Custom Roles state ──
  const [customRoles, setCustomRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: '', permissions: [] });
  const [roleFormError, setRoleFormError] = useState('');
  const [roleFormLoading, setRoleFormLoading] = useState(false);
  const [deleteRoleConfirm, setDeleteRoleConfirm] = useState(null);

  // ── Seat limit state ──
  const [userLimit, setUserLimit] = useState(0); // 0 = unlimited
  const [limitEditing, setLimitEditing] = useState(false);
  const [limitInput, setLimitInput] = useState('');
  const [limitSaving, setLimitSaving] = useState(false);

  // super_admin accounts are excluded from the seat limit count
  const billableUsers = users.filter(u => u.role !== 'super_admin');
  const atLimit = userLimit > 0 && billableUsers.length >= userLimit;
  const nearLimit = userLimit > 0 && !atLimit && billableUsers.length >= Math.ceil(userLimit * 0.8);
  // Admins cannot edit or delete super_admin accounts
  const canManageUser = (user) => isSuperAdmin || user.role !== 'super_admin';

  const token = localStorage.getItem('auth_token');
  const headers = { 'Content-Type': 'application/json', 'x-auth-token': token };

  useEffect(() => { fetchUsers(); }, []);
  useEffect(() => { if (isSuperAdmin) fetchCustomRoles(); }, [isSuperAdmin]);
  useEffect(() => { fetchSettings(); }, []);

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/users`, { headers });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch { setUsers([]); } finally { setUsersLoading(false); }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/settings`, { headers });
      if (res.ok) {
        const data = await res.json();
        setUserLimit(parseInt(data.user_limit || '0'));
      }
    } catch { /* no-op */ }
  };

  const saveUserLimit = async () => {
    const val = parseInt(limitInput);
    if (isNaN(val) || val < 0) return;
    setLimitSaving(true);
    try {
      const res = await fetch(`${API_URL}/auth/settings`, {
        method: 'PUT', headers, body: JSON.stringify({ user_limit: val })
      });
      if (res.ok) {
        setUserLimit(val);
        setLimitEditing(false);
      }
    } catch { /* no-op */ } finally { setLimitSaving(false); }
  };

  const fetchCustomRoles = async () => {
    setRolesLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/roles`, { headers });
      const data = await res.json();
      setCustomRoles(Array.isArray(data) ? data : []);
    } catch { setCustomRoles([]); } finally { setRolesLoading(false); }
  };

  // ── User CRUD ──
  const openCreateUser = () => {
    setEditingUser(null);
    setUserForm({ username: '', password: '', role: 'contributor', customRoleId: '', is_active: true });
    setUserFormError('');
    setIsUserModalOpen(true);
  };

  const openEditUser = (user) => {
    if (!canManageUser(user)) return;
    setEditingUser(user);
    setUserForm({ username: user.username, password: '', role: user.role, customRoleId: user.custom_role_id || '', is_active: user.is_active !== false });
    setUserFormError('');
    setIsUserModalOpen(true);
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setUserFormError('');
    setUserFormLoading(true);
    try {
      if (editingUser) {
        const body = { username: userForm.username, role: userForm.role, customRoleId: userForm.role === 'custom' ? (userForm.customRoleId || null) : null, is_active: userForm.is_active };
        if (userForm.password) body.password = userForm.password;
        const res = await fetch(`${API_URL}/auth/users/${editingUser.id}`, { method: 'PUT', headers, body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) { setUserFormError(data.error); setUserFormLoading(false); return; }
      } else {
        if (!userForm.password) { setUserFormError('Password is required'); setUserFormLoading(false); return; }
        const body = { username: userForm.username, password: userForm.password, role: userForm.role, customRoleId: userForm.role === 'custom' ? (userForm.customRoleId || null) : null };
        const res = await fetch(`${API_URL}/auth/users`, { method: 'POST', headers, body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) { setUserFormError(data.error); setUserFormLoading(false); return; }
      }
      setIsUserModalOpen(false);
      fetchUsers();
    } catch { setUserFormError('Request failed'); }
    finally { setUserFormLoading(false); }
  };

  const handleDeleteUser = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/auth/users/${userId}`, { method: 'DELETE', headers });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Delete failed');
      }
      setDeleteConfirm(null);
      fetchUsers();
    } catch { /* no-op */ }
  };

  // ── Custom Role CRUD ──
  const openCreateRole = () => {
    setEditingRole(null);
    setRoleForm({ name: '', permissions: [] });
    setRoleFormError('');
    setIsRoleModalOpen(true);
  };

  const openEditRole = (role) => {
    setEditingRole(role);
    let perms = [];
    try { perms = JSON.parse(role.permissions || '[]'); } catch { perms = []; }
    setRoleForm({ name: role.name, permissions: perms });
    setRoleFormError('');
    setIsRoleModalOpen(true);
  };

  const togglePermission = (view) => {
    setRoleForm(f => ({
      ...f,
      permissions: f.permissions.includes(view) ? f.permissions.filter(p => p !== view) : [...f.permissions, view]
    }));
  };

  const handleRoleSubmit = async (e) => {
    e.preventDefault();
    setRoleFormError('');
    setRoleFormLoading(true);
    try {
      const body = { name: roleForm.name, permissions: roleForm.permissions };
      const url = editingRole ? `${API_URL}/auth/roles/${editingRole.id}` : `${API_URL}/auth/roles`;
      const method = editingRole ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setRoleFormError(data.error); setRoleFormLoading(false); return; }
      setIsRoleModalOpen(false);
      fetchCustomRoles();
    } catch { setRoleFormError('Request failed'); }
    finally { setRoleFormLoading(false); }
  };

  const handleDeleteRole = async (roleId) => {
    try {
      await fetch(`${API_URL}/auth/roles/${roleId}`, { method: 'DELETE', headers });
      setDeleteRoleConfirm(null);
      fetchCustomRoles();
    } catch { /* no-op */ }
  };

  const availableRolesForForm = isSuperAdmin
    ? [{ value: 'admin', label: 'Admin — full access incl. user management' }, { value: 'contributor', label: 'Contributor — all features, no user management' }, { value: 'custom', label: 'Custom — configurable per-feature access' }]
    : [{ value: 'contributor', label: 'Contributor — all features, no user management' }];

  return (
    <div className="space-y-6 animate-page-transition">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>User Management</h1>
          <p className="mt-1 text-sm" style={{ color: 'rgb(var(--text-tertiary))' }}>
            {isSuperAdmin ? 'Manage users, roles, and fine-grained access control' : 'Manage team access — admins control users, contributors use all features'}
          </p>
        </div>
        {activeTab === 'users' ? (
          <button
            onClick={openCreateUser}
            disabled={atLimit}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium shadow-lg shadow-indigo-600/20 transition-colors"
            title={atLimit ? `User limit of ${userLimit} reached` : ''}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New User
          </button>
        ) : (
          <button onClick={openCreateRole} className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium shadow-lg shadow-teal-600/20 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Role
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: 'rgb(var(--bg-tertiary))' }}>
        {[{ id: 'users', label: 'Users' }, ...(isSuperAdmin ? [{ id: 'roles', label: 'Custom Roles' }] : [])].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow' : ''}`}
            style={activeTab !== tab.id ? { color: 'rgb(var(--text-secondary))' } : {}}
          >{tab.label}</button>
        ))}
      </div>

      {/* ── Users Tab ── */}
      {activeTab === 'users' && (
        <>
          {/* Seat limit warning */}
          {atLimit && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              User seat limit reached ({billableUsers.length}/{userLimit}). {isSuperAdmin ? 'Increase the limit below to add more users.' : 'Contact your super admin to increase the limit.'}
            </div>
          )}
          {nearLimit && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Approaching seat limit — {billableUsers.length} of {userLimit} seats used.
            </div>
          )}
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {/* Seat limit card */}
            <div className={`rounded-xl p-4 border ${atLimit ? 'bg-red-500/10 border-red-500/30' : nearLimit ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-500/10 border-slate-500/20'}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm" style={{ color: 'rgb(var(--text-tertiary))' }}>Seat Limit</p>
                {isSuperAdmin && !limitEditing && (
                  <button onClick={() => { setLimitInput(String(userLimit)); setLimitEditing(true); }} className="p-0.5 rounded hover:bg-white/10 transition-colors" title="Edit limit">
                    <svg className="w-3.5 h-3.5" style={{ color: 'rgb(var(--text-tertiary))' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                )}
              </div>
              {limitEditing ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="number" min="0" value={limitInput}
                    onChange={e => setLimitInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveUserLimit(); if (e.key === 'Escape') setLimitEditing(false); }}
                    className="w-16 px-2 py-1 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-primary))', color: 'rgb(var(--text-primary))' }}
                    autoFocus
                  />
                  <button onClick={saveUserLimit} disabled={limitSaving} className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-xs">{limitSaving ? '…' : 'Save'}</button>
                  <button onClick={() => setLimitEditing(false)} className="px-2 py-1 rounded-lg text-xs" style={{ color: 'rgb(var(--text-tertiary))' }}>✕</button>
                </div>
              ) : (
                <>
                  <p className={`text-3xl font-bold mt-1 ${atLimit ? 'text-red-400' : nearLimit ? 'text-amber-400' : 'text-slate-400'}`}>
                    {billableUsers.length}<span className="text-base font-normal opacity-60">/{userLimit === 0 ? '∞' : userLimit}</span>
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-tertiary))' }}>{userLimit === 0 ? 'Unlimited seats' : `${userLimit - billableUsers.length} remaining`}</p>
                </>
              )}
            </div>
            {[
              { label: 'Super Admins', value: users.filter(u => u.role === 'super_admin').length, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
              { label: 'Admins', value: users.filter(u => u.role === 'admin').length, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
              { label: 'Contributors', value: users.filter(u => u.role === 'contributor').length, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
            ].map(stat => (
              <div key={stat.label} className={`rounded-xl p-4 border ${stat.bg}`}>
                <p className="text-sm" style={{ color: 'rgb(var(--text-tertiary))' }}>{stat.label}</p>
                <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgb(var(--border-primary))' }}>
            <table className="w-full">
              <thead style={{ backgroundColor: 'rgb(var(--bg-tertiary))' }}>
                <tr>
                  {['Username', 'Role', 'Status', 'Created By', 'Created', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--text-tertiary))' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center" style={{ color: 'rgb(var(--text-tertiary))' }}>Loading users…</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center" style={{ color: 'rgb(var(--text-tertiary))' }}>No users found</td></tr>
                ) : users.map(user => (
                  <tr key={user.id} className={`border-t transition-colors ${canManageUser(user) ? 'cursor-pointer hover:bg-white/[0.02]' : ''}`} style={{ borderColor: 'rgb(var(--border-primary))' }} onClick={() => canManageUser(user) && openEditUser(user)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${user.role === 'super_admin' ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                            {user.username}
                            {user.id === currentUser?.id && (
                              <span className="ml-2 text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full">You</span>
                            )}
                          </p>
                          {user.role === 'custom' && user.custom_role_name && (
                            <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-tertiary))' }}>{user.custom_role_name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border capitalize ${ROLE_BADGE[user.role] || ROLE_BADGE.contributor}`}>
                        {user.role === 'super_admin' ? 'Super Admin' : user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${user.is_active ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                        {user.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                      {user.created_by_username || <span style={{ color: 'rgb(var(--text-tertiary))' }}>—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'rgb(var(--text-tertiary))' }}>
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {canManageUser(user) && (
                          <button onClick={(e) => { e.stopPropagation(); openEditUser(user); }} className="p-1.5 rounded-lg transition-colors hover:bg-blue-500/20 text-blue-400" title="Edit user">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                        )}
                        {user.id !== currentUser?.id && user.role !== 'super_admin' && (
                          <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(user.id); }} className="p-1.5 rounded-lg transition-colors hover:bg-red-500/20 text-red-400" title="Delete user">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                        {user.role === 'super_admin' && user.id !== currentUser?.id && (
                          <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Protected</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Custom Roles Tab ── */}
      {activeTab === 'roles' && isSuperAdmin && (
        <div className="space-y-4">
          {rolesLoading ? (
            <div className="text-center py-12" style={{ color: 'rgb(var(--text-tertiary))' }}>Loading roles…</div>
          ) : customRoles.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center" style={{ borderColor: 'rgb(var(--border-primary))' }}>
              <div className="w-12 h-12 rounded-full bg-teal-500/10 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>No custom roles yet</p>
              <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-tertiary))' }}>Create a role with specific view permissions for fine-grained access control</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {customRoles.map(role => {
                let perms = [];
                try { perms = JSON.parse(role.permissions || '[]'); } catch { perms = []; }
                return (
                  <div key={role.id} className="rounded-xl border p-5" style={{ borderColor: 'rgb(var(--border-primary))', backgroundColor: 'rgb(var(--bg-elevated))' }}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{role.name}</h3>
                        <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-tertiary))' }}>
                          {perms.length} permission{perms.length !== 1 ? 's' : ''} · Created {new Date(role.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => openEditRole(role)} className="p-1.5 rounded-lg transition-colors hover:bg-blue-500/20 text-blue-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => setDeleteRoleConfirm(role.id)} className="p-1.5 rounded-lg transition-colors hover:bg-red-500/20 text-red-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_PERMISSIONS.map(p => (
                        <span key={p.view} className={`px-2 py-0.5 text-xs rounded-full border ${perms.includes(p.view) ? 'bg-teal-500/20 text-teal-400 border-teal-500/30' : 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
                          {p.label}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── User Modal ── */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl border shadow-2xl w-full max-w-md" style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
            <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'rgb(var(--border-primary))' }}>
              <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{editingUser ? 'Edit User' : 'Create New User'}</h2>
              <button onClick={() => setIsUserModalOpen(false)} style={{ color: 'rgb(var(--text-tertiary))' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleUserSubmit} className="p-6 space-y-4">
              {userFormError && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{userFormError}</div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgb(var(--text-secondary))' }}>Username <span className="text-red-400">*</span></label>
                <input type="text" required value={userForm.username} onChange={e => setUserForm(f => ({ ...f, username: e.target.value }))} placeholder="e.g. john_doe"
                  className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-primary))', color: 'rgb(var(--text-primary))' }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgb(var(--text-secondary))' }}>
                  Password {!editingUser && <span className="text-red-400">*</span>}
                  {editingUser && <span className="text-xs ml-1" style={{ color: 'rgb(var(--text-tertiary))' }}>(leave blank to keep current)</span>}
                </label>
                <input type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} placeholder={editingUser ? '••••••••' : 'Enter password'}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-primary))', color: 'rgb(var(--text-primary))' }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgb(var(--text-secondary))' }}>Role <span className="text-red-400">*</span></label>
                <select value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value, customRoleId: '' }))}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-primary))', color: 'rgb(var(--text-primary))' }}>
                  {availableRolesForForm.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {userForm.role === 'custom' && (
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgb(var(--text-secondary))' }}>Custom Role <span className="text-red-400">*</span></label>
                  <select value={userForm.customRoleId} onChange={e => setUserForm(f => ({ ...f, customRoleId: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-primary))', color: 'rgb(var(--text-primary))' }}>
                    <option value="">Select a custom role…</option>
                    {customRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              )}
              {editingUser && editingUser.id !== currentUser?.id && editingUser.role !== 'super_admin' && (
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setUserForm(f => ({ ...f, is_active: !f.is_active }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${userForm.is_active ? 'bg-indigo-600' : 'bg-slate-600'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${userForm.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Account {userForm.is_active ? 'Active' : 'Disabled'}</span>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsUserModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium"
                  style={{ borderColor: 'rgb(var(--border-primary))', color: 'rgb(var(--text-secondary))' }}>Cancel</button>
                <button type="submit" disabled={userFormLoading} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-60">
                  {userFormLoading ? 'Saving…' : editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Custom Role Modal ── */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl border shadow-2xl w-full max-w-lg" style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
            <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'rgb(var(--border-primary))' }}>
              <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{editingRole ? 'Edit Custom Role' : 'Create Custom Role'}</h2>
              <button onClick={() => setIsRoleModalOpen(false)} style={{ color: 'rgb(var(--text-tertiary))' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleRoleSubmit} className="p-6 space-y-5">
              {roleFormError && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{roleFormError}</div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgb(var(--text-secondary))' }}>Role Name <span className="text-red-400">*</span></label>
                <input type="text" required value={roleForm.name} onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. QA Engineer, Read Only"
                  className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-primary))', color: 'rgb(var(--text-primary))' }} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>Permissions</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setRoleForm(f => ({ ...f, permissions: ALL_PERMISSIONS.map(p => p.view) }))}
                      className="text-xs px-2 py-1 rounded-lg bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 transition-colors">All</button>
                    <button type="button" onClick={() => setRoleForm(f => ({ ...f, permissions: [] }))}
                      className="text-xs px-2 py-1 rounded-lg hover:bg-slate-500/20 transition-colors" style={{ color: 'rgb(var(--text-tertiary))' }}>None</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_PERMISSIONS.map(p => (
                    <label key={p.view} className="flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors hover:border-teal-500/40"
                      style={{ borderColor: roleForm.permissions.includes(p.view) ? 'rgb(20 184 166 / 0.4)' : 'rgb(var(--border-primary))', backgroundColor: roleForm.permissions.includes(p.view) ? 'rgb(20 184 166 / 0.1)' : 'transparent' }}>
                      <input type="checkbox" checked={roleForm.permissions.includes(p.view)} onChange={() => togglePermission(p.view)} className="w-4 h-4 accent-teal-500" />
                      <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setIsRoleModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium"
                  style={{ borderColor: 'rgb(var(--border-primary))', color: 'rgb(var(--text-secondary))' }}>Cancel</button>
                <button type="submit" disabled={roleFormLoading} className="flex-1 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-60">
                  {roleFormLoading ? 'Saving…' : editingRole ? 'Save Changes' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl border shadow-2xl w-full max-w-sm p-6 space-y-4" style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Delete User</h3>
                <p className="text-sm mt-0.5" style={{ color: 'rgb(var(--text-tertiary))' }}>This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium" style={{ borderColor: 'rgb(var(--border-primary))', color: 'rgb(var(--text-secondary))' }}>Cancel</button>
              <button onClick={() => handleDeleteUser(deleteConfirm)} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Role confirmation */}
      {deleteRoleConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl border shadow-2xl w-full max-w-sm p-6 space-y-4" style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Delete Custom Role</h3>
                <p className="text-sm mt-0.5" style={{ color: 'rgb(var(--text-tertiary))' }}>Users assigned this role will lose their custom access. This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteRoleConfirm(null)} className="flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium" style={{ borderColor: 'rgb(var(--border-primary))', color: 'rgb(var(--text-secondary))' }}>Cancel</button>
              <button onClick={() => handleDeleteRole(deleteRoleConfirm)} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
