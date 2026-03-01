import React, { useState } from 'react';

function CreateTestFileModal({ isOpen, onClose, onSubmit, requirements = [] }) {
  const [testName, setTestName] = useState('');
  const [selectedRequirement, setSelectedRequirement] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!testName.trim()) {
      setError('Test name is required');
      return;
    }

    const initialContent = `// Write your Playwright test steps here
await page.goto("https://example.com");
`;

    onSubmit({
      name: testName.trim(),
      content: initialContent,
      requirementId: selectedRequirement || null,
    });

    setTestName('');
    setSelectedRequirement('');
    setError('');
    onClose();
  };

  const handleCancel = () => {
    setTestName('');
    setSelectedRequirement('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-xl shadow-lg w-full max-w-md p-6 border border-slate-800">
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Create Test File</h2>
          <button
            onClick={handleCancel}
            className="text-slate-400 hover:text-white transition-colors duration-200 hover:bg-slate-800 rounded-xl p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="testName" className="block text-sm font-medium text-slate-300 mb-2">
              Test Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="testName"
              value={testName}
              onChange={(e) => {
                setTestName(e.target.value);
                if (error) setError('');
              }}
              className={`w-full px-3 py-2 bg-slate-800 border ${
                error ? 'border-red-500' : 'border-slate-700'
              } rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
              placeholder="e.g., login-test"
              autoFocus
            />
            {error && (
              <p className="mt-1 text-sm text-red-500">{error}</p>
            )}
          </div>

          {/* Requirement Selection */}
          <div className="mb-6">
            <label htmlFor="requirement" className="block text-sm font-medium text-slate-300 mb-2">
              Link to Requirement <span className="text-slate-500 text-xs">(Optional)</span>
            </label>
            <select
              id="requirement"
              value={selectedRequirement}
              onChange={(e) => setSelectedRequirement(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">No requirement</option>
              {requirements.map(req => (
                <option key={req.id} value={req.id}>
                  {req.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Link this automation script to a requirement for traceability
            </p>
          </div>

          {/* Modal Actions */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 shadow-lg shadow-indigo-600/50"
            >
              Create Test File
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateTestFileModal;
