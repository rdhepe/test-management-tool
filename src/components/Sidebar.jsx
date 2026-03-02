import React, { useState } from 'react';

function Sidebar({ selectedModule, modules, selectedTestFile, onTestFileSelect, onViewChange, isCollapsed, onToggleCollapse, currentUser }) {
  const [activeItem, setActiveItem] = useState('Dashboard');

  const canAccess = (view) => {
    if (!currentUser) return false;
    if (view === 'tutorial') return true;
    if (['super_admin', 'admin', 'contributor'].includes(currentUser.role)) return true;
    if (currentUser.role === 'custom') {
      return Array.isArray(currentUser.permissions) && currentUser.permissions.includes(view);
    }
    return false;
  };

  const isAdminOrAbove = ['admin', 'super_admin'].includes(currentUser?.role);
  const menuSections = [
    {
      title: 'Overview',
      items: [
        { 
          name: 'Dashboard', 
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 13a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
            </svg>
          ),
          view: 'dashboard'
        },
      ]
    },
    {
      title: 'Test Management',
      items: [
        { 
          name: 'Features', 
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          ),
          view: 'features'
        },
        { 
          name: 'Requirements', 
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          view: 'requirements'
        },
        { 
          name: 'Test Cases', 
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          ),
          view: 'testcases'
        },
        { 
          name: 'Taskboard', 
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          ),
          view: 'taskboard'
        },
        { 
          name: 'Sprints', 
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
          view: 'sprints'
        },
      ]
    },
    {
      title: 'Automation',
      items: [
        { 
          name: 'Modules', 
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          ),
          view: 'modules'
        },
        { 
          name: 'Test Suites', 
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          ),
          view: 'testSuites'
        },
        {
          name: 'Summary',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
          view: 'summary'
        },
        {
          name: 'Config',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
          view: 'playwrightConfig'
        },
        {
          name: 'Global Variables',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          ),
          view: 'globalVariables'
        },
      ]
    },
    {
      title: 'Execution',
      items: [
        { 
          name: 'Single Runs', 
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          view: 'executions'
        },
        { 
          name: 'Suite Runs', 
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ),
          view: 'testSuites'
        },
      ]
    },
    {
      title: 'Quality',
      items: [
        { 
          name: 'Defects', 
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          view: 'defects'
        },
      ]
    },
    {
      title: 'Insights',
      items: [
        { 
          name: 'Reports', 
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
          view: 'reports'
        },
      ]
    },
    ...(isAdminOrAbove ? [{
      title: 'Admin',
      items: [
        {
          name: 'Users',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
          view: 'userManagement'
        },
      ]
    }] : []),
    {
      title: 'Learn',
      items: [
        {
          name: 'Guide',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          ),
          view: 'tutorial'
        },
      ]
    }
  ];

  const filteredSections = menuSections.map(section => ({
    ...section,
    items: section.items.filter(item => canAccess(item.view))
  })).filter(section => section.items.length > 0);

  const handleMenuClick = (item) => {
    if (item.disabled) return;
    setActiveItem(item.name);
    onViewChange(item.view);
  };

  return (
    <aside 
      className={`${
        isCollapsed ? 'w-[72px]' : 'w-[280px]'
      } border-r flex flex-col transition-all duration-300 fixed left-0 top-[60px] bottom-0 z-40`}
      style={{ backgroundColor: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-primary))' }}
    >
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6">
        {filteredSections.map((section, sectionIndex) => (
          <div key={section.title}>
            {!isCollapsed && (
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 px-2" style={{ color: 'rgb(var(--text-tertiary))' }}>
                {section.title}
              </h3>
            )}
            {isCollapsed && sectionIndex > 0 && (
              <div className="border-t mb-3" style={{ borderColor: 'rgb(var(--border-primary))' }}></div>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.name} className="relative group">
                  <button
                    onClick={() => handleMenuClick(item)}
                    disabled={item.disabled}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                      activeItem === item.name
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/50'
                        : item.disabled
                        ? 'text-slate-600 cursor-not-allowed'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                    } ${isCollapsed ? 'justify-center' : ''}`}
                    title={isCollapsed ? item.name : ''}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {!isCollapsed && (
                      <span className="font-medium text-sm truncate">{item.name}</span>
                    )}
                    {!isCollapsed && item.disabled && (
                      <span className="ml-auto text-xs text-slate-600">Soon</span>
                    )}
                  </button>
                  
                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div 
                      className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap border shadow-lg z-50"
                      style={{ 
                        backgroundColor: 'rgb(var(--bg-tertiary))', 
                        color: 'rgb(var(--text-primary))', 
                        borderColor: 'rgb(var(--border-secondary))' 
                      }}
                    >
                      {item.name}
                      {item.disabled && <span className="ml-2" style={{ color: 'rgb(var(--text-tertiary))' }}>(Coming soon)</span>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <div className={`p-4 border-t ${isCollapsed ? 'px-2' : ''}`} style={{ borderColor: 'rgb(var(--border-primary))' }}>
        <button
          onClick={onToggleCollapse}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-slate-400 hover:bg-slate-900 hover:text-slate-200 ${
            isCollapsed ? 'justify-center' : ''
          }`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg 
            className={`w-5 h-5 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          {!isCollapsed && (
            <span className="font-medium text-sm">Collapse</span>
          )}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
