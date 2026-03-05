import { useState, useEffect } from 'react';
import API_URL from '../apiUrl';

function TestDependencies({ testFile, moduleId, onClose, onUpdate }) {
  const [dependencies, setDependencies] = useState({ before: [], after: [] });
  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState(moduleId?.toString() || '');
  const [availableTests, setAvailableTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState('');
  const [dependencyType, setDependencyType] = useState('before');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (testFile) {
      loadDependencies();
      loadModules();
    }
  }, [testFile]);

  useEffect(() => {
    if (selectedModule) {
      loadAvailableTests(selectedModule);
    } else {
      setAvailableTests([]);
      setSelectedTest('');
    }
  }, [selectedModule]);

  const loadDependencies = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/test-files/${testFile.id}/dependencies`, {
        headers: token ? { 'x-auth-token': token } : {},
      });
      const data = await response.json();
      
      const before = data.filter(d => d.dependency_type === 'before');
      const after = data.filter(d => d.dependency_type === 'after');
      
      setDependencies({ before, after });
    } catch (error) {
      console.error('Failed to load dependencies:', error);
    }
  };

  const loadModules = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/modules`, {
        headers: token ? { 'x-auth-token': token } : {},
      });
      const data = await response.json();
      setModules(data);
      // Set default module to current module
      if (moduleId) {
        setSelectedModule(moduleId.toString());
      }
    } catch (error) {
      console.error('Failed to load modules:', error);
    }
  };

  const loadAvailableTests = async (modId) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/modules/${modId}/test-files`, {
        headers: token ? { 'x-auth-token': token } : {},
      });
      const data = await response.json();
      // Filter out the current test file only if it's from the same module
      const tests = modId === moduleId?.toString() 
        ? data.filter(t => t.id !== testFile.id)
        : data;
      setAvailableTests(tests);
      // Reset selected test when module changes
      setSelectedTest('');
    } catch (error) {
      console.error('Failed to load available tests:', error);
    }
  };

  const handleAddDependency = async () => {
    if (!selectedTest) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/test-files/${testFile.id}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(localStorage.getItem('auth_token') ? { 'x-auth-token': localStorage.getItem('auth_token') } : {}) },
        body: JSON.stringify({
          dependencyFileId: parseInt(selectedTest),
          dependencyType: dependencyType,
          executionOrder: 0
        })
      });

      if (response.ok) {
        await loadDependencies();
        setSelectedTest('');
        if (onUpdate) onUpdate();
      } else {
        const error = await response.json();
        alert(`Failed to add dependency: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to add dependency:', error);
      alert('Failed to add dependency');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDependency = async (dependencyFileId, type) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/test-files/${testFile.id}/dependencies`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(localStorage.getItem('auth_token') ? { 'x-auth-token': localStorage.getItem('auth_token') } : {}) },
        body: JSON.stringify({
          dependencyFileId: dependencyFileId,
          dependencyType: type
        })
      });

      if (response.ok) {
        await loadDependencies();
        if (onUpdate) onUpdate();
      } else {
        const error = await response.json();
        alert(`Failed to remove dependency: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to remove dependency:', error);
      alert('Failed to remove dependency');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-950">
          <div>
            <h2 className="text-xl font-semibold text-white">Test Dependencies</h2>
            <p className="text-sm text-slate-400 mt-1">{testFile.name}</p>
          </div>
          <button 
            className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg" 
            onClick={onClose}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Add Dependency Section */}
          <div className="mb-6 p-4 bg-slate-900 border border-slate-800 rounded-xl">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <span>➕</span>
              Add Dependency
            </h3>
            
            {/* Module Selection */}
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-2">1. Select Module</label>
              <select 
                value={selectedModule} 
                onChange={(e) => setSelectedModule(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value="">Choose a module...</option>
                {modules.map(module => (
                  <option key={module.id} value={module.id}>
                    {module.name}
                    {module.id === moduleId && ' (Current)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Test File Selection */}
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-2">2. Select Test File</label>
              <select 
                value={selectedTest} 
                onChange={(e) => setSelectedTest(e.target.value)}
                disabled={loading || !selectedModule}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value="">
                  {selectedModule ? 'Choose a test file...' : 'Select a module first...'}
                </option>
                {availableTests.map(test => (
                  <option key={test.id} value={test.id}>{test.name}</option>
                ))}
              </select>
            </div>

            {/* Dependency Type & Add Button */}
            <div className="flex gap-3">
              <select 
                value={dependencyType} 
                onChange={(e) => setDependencyType(e.target.value)}
                disabled={loading}
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value="before">⬆️ Run Before</option>
                <option value="after">⬇️ Run After</option>
              </select>

              <button 
                onClick={handleAddDependency} 
                disabled={!selectedTest || loading}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20"
              >
                {loading ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>

          {/* Dependencies List */}
          <div className="space-y-4">
            {/* Before Dependencies */}
            <div>
              <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <span className="text-blue-400">⬆️</span>
                Run Before (Prerequisites)
              </h3>
              {dependencies.before.length === 0 ? (
                <div className="text-slate-500 text-sm italic py-4 px-4 bg-slate-900/50 border border-slate-800 rounded-lg text-center">
                  No prerequisites
                </div>
              ) : (
                <div className="space-y-2">
                  {dependencies.before.map((dep) => {
                    const depModule = modules.find(m => m.id === dep.dependency_module_id);
                    return (
                      <div key={dep.id} className="flex items-center justify-between p-3 bg-blue-600/10 border border-blue-600/30 rounded-lg hover:bg-blue-600/20 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-2xl flex-shrink-0">📄</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium truncate">{dep.dependency_name}</div>
                            {depModule && (
                              <div className="text-xs text-slate-400 truncate">
                                from {depModule.name}
                              </div>
                            )}
                          </div>
                        </div>
                        <button 
                          className="px-3 py-1 bg-red-600/20 text-red-400 rounded-lg text-sm hover:bg-red-600/30 transition-colors disabled:opacity-50 flex-shrink-0"
                          onClick={() => handleRemoveDependency(dep.dependency_file_id, 'before')}
                          disabled={loading}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Main Test */}
            <div className="flex justify-center my-4">
              <div className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl flex items-center gap-3 shadow-lg shadow-indigo-600/30">
                <span className="text-xl">▶️</span>
                <span className="text-white font-semibold">{testFile.name}</span>
                <span className="text-sm text-indigo-200">(Main Test)</span>
              </div>
            </div>

            {/* After Dependencies */}
            <div>
              <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <span className="text-orange-400">⬇️</span>
                Run After (Cleanup)
              </h3>
              {dependencies.after.length === 0 ? (
                <div className="text-slate-500 text-sm italic py-4 px-4 bg-slate-900/50 border border-slate-800 rounded-lg text-center">
                  No cleanup tests
                </div>
              ) : (
                <div className="space-y-2">
                  {dependencies.after.map((dep) => {
                    const depModule = modules.find(m => m.id === dep.dependency_module_id);
                    return (
                      <div key={dep.id} className="flex items-center justify-between p-3 bg-orange-600/10 border border-orange-600/30 rounded-lg hover:bg-orange-600/20 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-2xl flex-shrink-0">📄</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium truncate">{dep.dependency_name}</div>
                            {depModule && (
                              <div className="text-xs text-slate-400 truncate">
                                from {depModule.name}
                              </div>
                            )}
                          </div>
                        </div>
                        <button 
                          className="px-3 py-1 bg-red-600/20 text-red-400 rounded-lg text-sm hover:bg-red-600/30 transition-colors disabled:opacity-50 flex-shrink-0"
                          onClick={() => handleRemoveDependency(dep.dependency_file_id, 'after')}
                          disabled={loading}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Execution Summary */}
          {(dependencies.before.length > 0 || dependencies.after.length > 0) && (
            <div className="mt-6 p-4 bg-slate-900 border-2 border-dashed border-slate-700 rounded-xl">
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <span>📋</span>
                Execution Order Summary
              </h4>
              <ol className="space-y-2">
                {dependencies.before.map((dep, idx) => {
                  const depModule = modules.find(m => m.id === dep.dependency_module_id);
                  return (
                    <li key={`before-${idx}`} className="flex items-start gap-2 text-sm">
                      <span className="text-blue-400 font-mono flex-shrink-0">{idx + 1}.</span>
                      <div>
                        <span className="text-blue-300">{dep.dependency_name}</span>
                        {depModule && (
                          <span className="text-slate-500 text-xs ml-1">({depModule.name})</span>
                        )}
                      </div>
                    </li>
                  );
                })}
                <li className="flex items-center gap-2 text-sm">
                  <span className="text-indigo-400 font-mono">{dependencies.before.length + 1}.</span>
                  <span className="text-white font-semibold">{testFile.name}</span>
                </li>
                {dependencies.after.map((dep, idx) => {
                  const depModule = modules.find(m => m.id === dep.dependency_module_id);
                  return (
                    <li key={`after-${idx}`} className="flex items-start gap-2 text-sm">
                      <span className="text-orange-400 font-mono flex-shrink-0">{dependencies.before.length + idx + 2}.</span>
                      <div>
                        <span className="text-orange-300">{dep.dependency_name}</span>
                        {depModule && (
                          <span className="text-slate-500 text-xs ml-1">({depModule.name})</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50 flex justify-end">
          <button 
            className="px-6 py-2 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-colors"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default TestDependencies;
