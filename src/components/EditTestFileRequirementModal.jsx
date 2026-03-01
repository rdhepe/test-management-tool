import React, { useState, useEffect } from 'react';

function EditTestFileRequirementModal({ isOpen, onClose, onSubmit, currentRequirementId, requirements = [] }) {
  const [selectedRequirement, setSelectedRequirement] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedRequirement(currentRequirementId || '');
    }
  }, [isOpen, currentRequirementId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(selectedRequirement || null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div className="relative bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md p-6 z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Edit Requirement Link
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="requirement" className="block text-sm font-medium text-slate-300 mb-2">
                Link to Requirement
              </label>
              <select
                id="requirement"
                value={selectedRequirement}
                onChange={(e) => setSelectedRequirement(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              >
                <option value="">No requirement</option>
                {requirements.map(req => (
                  <option key={req.id} value={req.id}>
                    {req.title}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500">
                Link this automation script to a requirement for traceability
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 font-medium shadow-lg shadow-indigo-600/30"
              >
                Update Link
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default EditTestFileRequirementModal;
