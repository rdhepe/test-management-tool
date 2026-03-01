import React from 'react';

function ModuleList({ modules, onModuleSelect, selectedModule, loading = false }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-6 animate-pulse">
            <div className="flex items-start justify-between mb-4">
              <div className="h-6 bg-slate-800 rounded w-32"></div>
              <div className="h-6 bg-slate-800 rounded w-16"></div>
            </div>
            <div className="space-y-2 mb-4">
              <div className="h-4 bg-slate-800 rounded w-full"></div>
              <div className="h-4 bg-slate-800 rounded w-2/3"></div>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-slate-800 rounded w-3/4"></div>
              <div className="h-3 bg-slate-800 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <svg className="mx-auto h-24 w-24 text-slate-700" fill="none" viewBox="0 0 24 24\" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h3 className="text-2xl font-semibold text-slate-300 mb-3">No Modules Yet</h3>
          <p className="text-slate-500 mb-6">Create your first module to start building and managing your test files.</p>
          <p className="text-sm text-slate-600">Click the "Create Module" button above to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-page-transition">
      {modules.map((module) => (
        <div
          key={module.id}
          onClick={() => onModuleSelect(module)}
          className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-indigo-600 hover:shadow-lg hover:shadow-indigo-600/20 cursor-pointer card-hover"
        >
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-lg font-medium text-white">{module.name}</h3>
            <span className="text-xs bg-indigo-600 text-white px-2 py-1 rounded-xl shadow-lg">
              {module.language}
            </span>
          </div>
          
          {module.description && (
            <p className="text-slate-400 text-sm mb-4 line-clamp-2">{module.description}</p>
          )}
          
          {module.tags && module.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {module.tags.map((tag, idx) => (
                <span key={idx} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded-lg border border-slate-700">
                  {tag}
                </span>
              ))}
            </div>
          )}
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Created:</span>
              <span>{module.createdAt ? new Date(module.createdAt).toLocaleDateString() : 'N/A'}</span>
            </div>
            {module.testFiles && module.testFiles.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-400 pt-2">
                <span>📝 {module.testFiles.length} test file{module.testFiles.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ModuleList;
