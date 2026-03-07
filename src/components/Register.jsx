import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API_URL from '../apiUrl';

function Register() {
  const navigate = useNavigate();

  const [orgName, setOrgName]           = useState('');
  const [orgSlug, setOrgSlug]           = useState('');
  const [slugEdited, setSlugEdited]     = useState(false);
  const [slugStatus, setSlugStatus]     = useState('idle'); // idle | checking | available | taken
  const [adminUsername, setAdminUser]   = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirm]   = useState('');
  const [showPass, setShowPass]         = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState(false);

  // Auto-generate slug from org name
  useEffect(() => {
    if (!slugEdited) {
      setOrgSlug(orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  }, [orgName, slugEdited]);

  // Debounced slug availability check
  const checkSlug = useCallback(
    (() => {
      let t;
      return (slug) => {
        clearTimeout(t);
        if (!slug) { setSlugStatus('idle'); return; }
        setSlugStatus('checking');
        t = setTimeout(async () => {
          try {
            const res = await fetch(`${API_URL}/public/org/${slug}`);
            setSlugStatus(res.ok ? 'taken' : 'available');
          } catch {
            setSlugStatus('idle');
          }
        }, 500);
      };
    })(),
    []
  );

  useEffect(() => { checkSlug(orgSlug); }, [orgSlug]);

  const handleOrgSlugChange = (val) => {
    setSlugEdited(true);
    setOrgSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!orgName.trim() || !orgSlug.trim() || !adminUsername.trim() || !password) {
      return setError('All fields are required.');
    }
    if (password !== confirmPassword) {
      return setError('Passwords do not match.');
    }
    if (password.length < 6) {
      return setError('Password must be at least 6 characters.');
    }
    if (slugStatus === 'taken') {
      return setError('That organization URL is already taken. Please choose another.');
    }
    if (slugStatus === 'checking') {
      return setError('Please wait while we check slug availability.');
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/auth/register-org`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName: orgName.trim(),
          orgSlug: orgSlug.trim(),
          adminUsername: adminUsername.trim(),
          adminPassword: password,
        }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || 'Registration failed. Please try again.');
      setSuccess(true);
      setTimeout(() => navigate(`/org/${data.org.slug}`), 1800);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const slugIndicator = () => {
    if (!orgSlug) return null;
    if (slugStatus === 'checking') return (
      <span className="text-slate-400 text-xs flex items-center gap-1">
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Checking…
      </span>
    );
    if (slugStatus === 'available') return (
      <span className="text-emerald-400 text-xs flex items-center gap-1">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
        URL available
      </span>
    );
    if (slugStatus === 'taken') return (
      <span className="text-red-400 text-xs flex items-center gap-1">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
        URL already taken
      </span>
    );
    return null;
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at top, #0f172a 0%, #020617 100%)' }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4 ring-2 ring-emerald-500/40">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">You're all set!</h2>
          <p className="text-slate-400">Taking you to your workspace…</p>
          <div className="mt-4">
            <svg className="w-6 h-6 animate-spin text-indigo-500 mx-auto" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'radial-gradient(ellipse at top, #0f172a 0%, #020617 100%)' }}
    >
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-white font-semibold text-sm">QA Platform</span>
        </Link>
        <span className="text-slate-400 text-sm">
          Already have an account?{' '}
          <Link to="/" className="text-indigo-400 hover:text-indigo-300 font-medium">Sign in</Link>
        </span>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Create your free workspace</h1>
            <p className="text-slate-400 text-sm">No credit card required. Start testing in minutes.</p>
          </div>

          {/* Free plan callout */}
          <div className="mb-6 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3.5">
            <p className="text-indigo-300 text-sm font-semibold mb-1.5">Free plan includes:</p>
            <ul className="space-y-1">
              {[
                'Up to 5 team members',
                'Unlimited test modules & test files',
                'Full execution history & reports',
                'Requirements, test cases & sprints',
              ].map(item => (
                <li key={item} className="flex items-center gap-2 text-slate-300 text-xs">
                  <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
              <li className="flex items-center gap-2 text-slate-500 text-xs">
                <svg className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                AI features (available on Premium)
              </li>
            </ul>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Org Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Organization / Team name</label>
              <input
                type="text"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                placeholder="Acme QA Team"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                required
              />
            </div>

            {/* Org Slug */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-300">Workspace URL</label>
                {slugIndicator()}
              </div>
              <div className="flex items-center rounded-xl bg-slate-800 border border-slate-700 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/50 overflow-hidden">
                <span className="pl-3.5 text-slate-500 text-sm select-none whitespace-nowrap">app.example.com/org/</span>
                <input
                  type="text"
                  value={orgSlug}
                  onChange={e => handleOrgSlugChange(e.target.value)}
                  placeholder="acme-qa"
                  className="flex-1 pl-0.5 pr-3.5 py-2.5 bg-transparent text-white placeholder-slate-500 text-sm focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-800 pt-2">
              <p className="text-slate-500 text-xs mb-4">Admin account — you can invite team members after setup</p>

              {/* Admin username */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Admin username</label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={e => setAdminUser(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                  required
                />
              </div>

              {/* Password */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    autoComplete="new-password"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    tabIndex={-1}
                  >
                    {showPass ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm password</label>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 ${
                    confirmPassword && confirmPassword !== password
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50'
                      : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/50'
                  }`}
                  required
                />
                {confirmPassword && confirmPassword !== password && (
                  <p className="mt-1 text-red-400 text-xs">Passwords don't match</p>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || slugStatus === 'taken' || slugStatus === 'checking'}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating workspace…
                </>
              ) : 'Create free workspace'}
            </button>

            <p className="text-center text-slate-500 text-xs">
              By signing up you agree to our{' '}
              <a href="/docs" className="text-indigo-400 hover:text-indigo-300">terms of service</a>.
              {' '}Need more than 5 seats or AI features?{' '}
              <Link to="/" className="text-indigo-400 hover:text-indigo-300">Contact us</Link>.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Register;
