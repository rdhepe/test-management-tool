import React, { useState, useEffect } from 'react';

function ModuleDetailView({ module, onCreateTestFile, onTestFileClick, selectedTestFile, onManageDependencies, onDeleteModule, onDeleteTestFile }) {
  const [testFilesDeps, setTestFilesDeps] = useState({});
  const [editingModule, setEditingModule] = useState(false);
  const [editingTestFile, setEditingTestFile] = useState(null);
  const [moduleFormData, setModuleFormData] = useState({
    name: '',
    description: '',
    baseUrl: '',
    language: 'TypeScript'
  });
  const [testFileFormData, setTestFileFormData] = useState({
    name: ''
  });

  // Load dependency indicators for all test files
  useEffect(() => {
    const loadDependencies = async () => {
      if (!module.testFiles) return;
      
      const depsMap = {};
      for (const testFile of module.testFiles) {
        try {
          const response = await fetch(`http://localhost:3001/test-files/${testFile.id}/dependencies`);
          const deps = await response.json();
          depsMap[testFile.id] = {
            hasBefore: deps.some(d => d.dependency_type === 'before'),
            hasAfter: deps.some(d => d.dependency_type === 'after'),
            count: deps.length
          };
        } catch (error) {
          console.error(`Failed to load dependencies for test ${testFile.id}:`, error);
        }
      }
      setTestFilesDeps(depsMap);
    };

    loadDependencies();
  }, [module.testFiles]);

  const handleEditModule = () => {
    setModuleFormData({
      name: module.name,
      description: module.description || '',
      baseUrl: module.baseUrl || '',
      language: module.language || 'TypeScript'
    });
    setEditingModule(true);
  };

  const handleSaveModule = async () => {
    try {
      const response = await fetch(`http://localhost:3001/modules/${module.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(moduleFormData)
      });
      
      if (!response.ok) throw new Error('Failed to update module');
      
      setEditingModule(false);
      window.location.reload(); // Reload to show updated data
    } catch (error) {
      alert('Error updating module: ' + error.message);
    }
  };

  const handleEditTestFile = (testFile) => {
    setTestFileFormData({ name: testFile.name });
    setEditingTestFile(testFile);
  };

  const handleSaveTestFile = async () => {
    try {
      const response = await fetch(`http://localhost:3001/test-files/${editingTestFile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testFileFormData)
      });
      
      if (!response.ok) throw new Error('Failed to update test file');
      
      setEditingTestFile(null);
      window.location.reload(); // Reload to show updated data
    } catch (error) {
      alert('Error updating test file: ' + error.message);
    }
  };

  return (
    <div>
      {/* Module Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-white mb-2">{module.name}</h1>
            {module.description && (
              <p className="text-slate-400 text-sm mb-3">{module.description}</p>
            )}
            <div className="flex items-center gap-4 text-sm">
              {module.baseUrl && (
                <div className="flex items-center gap-2">
                  <span className="text-indigo-400">{module.baseUrl}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Language:</span>
                <span className="text-indigo-400">{module.language}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleEditModule}
              className="px-4 py-2 bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 rounded-xl hover:bg-indigo-600/30 transition-all duration-200 flex items-center gap-2 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Module
            </button>
            <button
              onClick={() => onDeleteModule(module.id)}
              className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/30 rounded-xl hover:bg-red-600/30 transition-all duration-200 flex items-center gap-2 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Module
            </button>
            <button
              onClick={onCreateTestFile}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 flex items-center gap-2 font-medium shadow-lg shadow-indigo-600/50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Test File
            </button>
          </div>
        </div>
      </div>

      {/* Test Files Section */}
      <div>
        <h2 className="text-lg font-medium text-white mb-4">Test Files</h2>
        {module.testFiles && module.testFiles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {module.testFiles.map((testFile) => {
              const deps = testFilesDeps[testFile.id] || {};
              const hasDependencies = deps.count > 0;
              
              return (
                <div
                  key={testFile.id}
                  className={`bg-slate-900 border rounded-xl p-4 transition-all duration-200 shadow-lg ${
                    selectedTestFile?.id === testFile.id
                      ? 'border-indigo-600 ring-2 ring-indigo-600 ring-opacity-50 shadow-indigo-600/20'
                      : 'border-slate-800 hover:border-indigo-600'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3" onClick={() => onTestFileClick(testFile)} style={{ cursor: 'pointer' }}>
                    <span className="text-2xl">📄</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium mb-1 truncate">{testFile.name}</h3>
                      <p className="text-xs text-slate-500">
                        Created: {new Date(testFile.createdAt).toLocaleDateString()}
                      </p>
                      {hasDependencies && (
                        <div className="flex gap-1 mt-1">
                          {deps.hasBefore && (
                            <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded" title="Has prerequisites">
                              ⬆️ Before
                            </span>
                          )}
                          {deps.hasAfter && (
                            <span className="text-xs bg-orange-600/20 text-orange-400 px-2 py-0.5 rounded" title="Has cleanup">
                              ⬇️ After
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onManageDependencies(testFile);
                      }}
                      className="flex-1 px-3 py-1.5 text-sm bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <span>🔗</span>
                      {hasDependencies ? `Dependencies (${deps.count})` : 'Dependencies'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTestFile(testFile);
                      }}
                      className="px-3 py-1.5 text-sm bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 rounded-lg hover:bg-indigo-600/30 transition-all duration-200 flex items-center justify-center gap-1"
                      title="Edit test file"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTestFile(testFile.id);
                      }}
                      className="px-3 py-1.5 text-sm bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg hover:bg-red-600/30 transition-all duration-200 flex items-center justify-center gap-1"
                      title="Delete test file"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-slate-900 rounded-xl border border-slate-800 shadow-lg">
            <div className="text-5xl mb-3">📝</div>
            <h3 className="text-lg font-semibold text-slate-300 mb-2">No Test Files Yet</h3>
            <p className="text-slate-500 text-sm mb-4">Create your first test file to get started</p>
            <button
              onClick={onCreateTestFile}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 inline-flex items-center gap-2 shadow-lg shadow-indigo-600/50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Test File
            </button>
          </div>
        )}
      </div>

      {/* Edit Module Modal */}
      {editingModule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-2xl w-full p-6">
            <h2 className="text-xl font-bold text-white mb-4">Edit Module</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Module Name</label>
                <input
                  type="text"
                  value={moduleFormData.name}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={moduleFormData.description}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Language</label>
                <select
                  value={moduleFormData.language}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, language: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="TypeScript">TypeScript</option>
                  <option value="JavaScript">JavaScript</option>
                  <option value="Python">Python</option>
                  <option value="Java">Java</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingModule(false)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveModule}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Test File Modal */}
      {editingTestFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-white mb-4">Edit Test File</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">File Name</label>
                <input
                  type="text"
                  value={testFileFormData.name}
                  onChange={(e) => setTestFileFormData({ ...testFileFormData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                  placeholder="e.g., login.spec.ts"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingTestFile(null)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTestFile}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ModuleDetailView;
