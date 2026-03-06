import React, { useState, useRef, useEffect, useCallback } from 'react';
import API_URL from '../apiUrl';
import FeedbackModal from './FeedbackModal';
import BugReportModal from './BugReportModal';

const TYPE_VIEW = {
  feature: 'features',
  requirement: 'requirements',
  testcase: 'testcases',
  defect: 'defects',
};
const TYPE_LABEL = {
  feature: 'Features',
  requirement: 'Requirements',
  testcase: 'Test Cases',
  defect: 'Defects',
};

function Navbar({ theme, onToggleTheme, currentUser, onLogout, onNavigate }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);

  // Global search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (q.trim().length < 2) { setSearchResults(null); setSearchLoading(false); return; }
    setSearchLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(q.trim())}`, {
        headers: { 'x-auth-token': token }
      });
      const data = await res.json();
      setSearchResults(data);
    } catch { setSearchResults(null); }
    setSearchLoading(false);
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setSearchOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setSearchResults(null); return; }
    setSearchLoading(true);
    debounceRef.current = setTimeout(() => doSearch(val), 280);
  };

  const handleResultClick = (type) => {
    onNavigate(TYPE_VIEW[type]);
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults(null);
  };

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasResults = searchResults && (
    searchResults.features?.length || searchResults.requirements?.length ||
    searchResults.testCases?.length || searchResults.defects?.length
  );

  const resultGroups = searchResults ? [
    { key: 'features',     type: 'feature',      items: searchResults.features || [] },
    { key: 'requirements', type: 'requirement',   items: searchResults.requirements || [] },
    { key: 'testCases',    type: 'testcase',      items: searchResults.testCases || [] },
    { key: 'defects',      type: 'defect',        items: searchResults.defects || [] },
  ].filter(g => g.items.length > 0) : [];

  const handleLogout = async () => {
    const token = localStorage.getItem('auth_token');
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'x-auth-token': token }
      });
    } catch { /* no-op */ }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setDropdownOpen(false);
    onLogout();
  };

  const roleBadge = currentUser?.role === 'admin'
    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30';

  return (
    <>
    <nav className="h-[60px] border-b flex items-center justify-between px-6 relative z-50" style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}>
      {/* App Name */}
      <div className="flex items-center">
        <h1 className="text-xl font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>TestStudio.Cloud</h1>
      </div>

      {/* Global Search — center */}
      {currentUser && (
        <div className="absolute left-1/2 -translate-x-1/2 w-full max-w-md px-4" ref={searchRef}>
          <div className="relative">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-primary))' }}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'rgb(var(--text-tertiary))' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => { if (searchQuery.trim().length >= 2) setSearchOpen(true); }}
                onKeyDown={(e) => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); setSearchResults(null); } }}
                placeholder="Search by ID or text…"
                className="flex-1 bg-transparent text-sm outline-none min-w-0"
                style={{ color: 'rgb(var(--text-primary))' }}
              />
              {searchLoading && (
                <svg className="w-4 h-4 animate-spin flex-shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              )}
              {searchQuery && !searchLoading && (
                <button onClick={() => { setSearchQuery(''); setSearchResults(null); setSearchOpen(false); }} className="flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'rgb(var(--text-tertiary))' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Results dropdown */}
            {searchOpen && searchQuery.trim().length >= 2 && (
              <div
                className="absolute top-full mt-2 w-full rounded-xl border shadow-2xl overflow-hidden z-50"
                style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}
              >
                {!searchLoading && !hasResults && searchResults !== null && (
                  <div className="px-4 py-3 text-sm" style={{ color: 'rgb(var(--text-tertiary))' }}>No results found.</div>
                )}
                {resultGroups.map((group) => (
                  <div key={group.key}>
                    <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border-b" style={{ color: 'rgb(var(--text-tertiary))', borderColor: 'rgb(var(--border-primary))' }}>
                      {TYPE_LABEL[group.type]}
                    </div>
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleResultClick(group.type)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-indigo-500/10"
                        style={{ color: 'rgb(var(--text-secondary))' }}
                      >
                        {item.uid && (
                          <span className="text-xs font-mono flex-shrink-0 px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgb(var(--bg-secondary))', color: 'rgb(var(--text-tertiary))' }}>
                            {item.uid}
                          </span>
                        )}
                        <span className="truncate" style={{ color: 'rgb(var(--text-primary))' }}>{item.title}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Right Section */}
      <div className="flex items-center gap-3">
        {/* Feature Request Button */}
        {currentUser && (
          <button
            onClick={() => setShowFeedback(true)}
            className="p-2 rounded-lg transition-all duration-200 button-scale hover:ring-2 hover:ring-indigo-500"
            style={{ backgroundColor: 'rgb(var(--bg-secondary))' }}
            title="Request a Feature"
          >
            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m1.636 6.364l.707-.707M12 21v-1M12 7a5 5 0 00-5 5 5 5 0 0010 0 5 5 0 00-5-5z" />
            </svg>
          </button>
        )}

        {/* Report a Bug Button */}
        {currentUser && (
          <button
            onClick={() => setShowBugReport(true)}
            className="p-2 rounded-lg transition-all duration-200 button-scale hover:ring-2 hover:ring-rose-500"
            style={{ backgroundColor: 'rgb(var(--bg-secondary))' }}
            title="Report a Bug"
          >
            <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-lg transition-all duration-200 button-scale hover:ring-2 hover:ring-indigo-500"
          style={{ backgroundColor: 'rgb(var(--bg-secondary))' }}
          aria-label="Toggle theme"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        {/* User Menu */}
        {currentUser && (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(v => !v)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all hover:ring-2 hover:ring-indigo-500"
              style={{ backgroundColor: 'rgb(var(--bg-secondary))' }}
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {currentUser.username.charAt(0).toUpperCase()}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium leading-none" style={{ color: 'rgb(var(--text-primary))' }}>{currentUser.username}</p>
                <p className={`text-xs mt-0.5 px-1.5 py-0.5 rounded-full capitalize inline-block ${roleBadge}`}>{currentUser.role}</p>
              </div>
              <svg className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'rgb(var(--text-tertiary))' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dropdownOpen && (
              <>
                {/* Backdrop */}
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                {/* Dropdown */}
                <div
                  className="absolute right-0 mt-2 w-52 rounded-xl border shadow-xl z-50 py-1 overflow-hidden"
                  style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}
                >
                  <div className="px-4 py-3 border-b" style={{ borderColor: 'rgb(var(--border-primary))' }}>
                    <p className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{currentUser.username}</p>
                    <p className={`text-xs mt-1 px-2 py-0.5 rounded-full capitalize inline-block ${roleBadge}`}>{currentUser.role}</p>
                  </div>
                  {currentUser.role === 'admin' && (
                    <button
                      onClick={() => { setDropdownOpen(false); onNavigate('userManagement'); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left hover:bg-indigo-500/10"
                      style={{ color: 'rgb(var(--text-secondary))' }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      User Management
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </nav>

    {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} currentUser={currentUser} />}
    {showBugReport && <BugReportModal onClose={() => setShowBugReport(false)} currentUser={currentUser} />}
    </>
  );
}

export default Navbar;
