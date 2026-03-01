import React, { useState } from 'react';

function CreateModuleModal({ isOpen, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    moduleName: '',
    description: '',
    tags: '',
    language: 'TypeScript',
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.moduleName.trim()) {
      newErrors.moduleName = 'Module name is required';
    }
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validate();
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit({
      name: formData.moduleName,
      description: formData.description,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
      baseUrl: '',
      language: formData.language,
    });

    // Reset form
    setFormData({
      moduleName: '',
      description: '',
      tags: '',
      language: 'TypeScript',
    });
    setErrors({});
    onClose();
  };

  const handleCancel = () => {
    setFormData({
      moduleName: '',
      description: '',
      tags: '',
      language: 'TypeScript',
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-xl shadow-lg w-full max-w-md p-6 border border-slate-800">
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Create New Module</h2>
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
          {/* Module Name */}
          <div className="mb-4">
            <label htmlFor="moduleName" className="block text-sm font-medium text-slate-300 mb-2">
              Module Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="moduleName"
              name="moduleName"
              value={formData.moduleName}
              onChange={handleChange}
              className={`w-full px-3 py-2 bg-slate-800 border ${
                errors.moduleName ? 'border-red-500' : 'border-slate-700'
              } rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
              placeholder="Enter module name"
            />
            {errors.moduleName && (
              <p className="mt-1 text-sm text-red-500">{errors.moduleName}</p>
            )}
          </div>

          {/* Description */}
          <div className="mb-4">
            <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-2">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              placeholder="Enter module description (optional)"
            />
          </div>

          {/* Tags */}
          <div className="mb-4">
            <label htmlFor="tags" className="block text-sm font-medium text-slate-300 mb-2">
              Tags
            </label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="e.g., E2E, Smoke, Regression (comma separated)"
            />
            <p className="mt-1 text-xs text-slate-500">Separate multiple tags with commas</p>
          </div>

          {/* Language */}
          <div className="mb-6">
            <label htmlFor="language" className="block text-sm font-medium text-slate-300 mb-2">
              Language
            </label>
            <select
              id="language"
              name="language"
              value={formData.language}
              onChange={handleChange}
              disabled
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white opacity-60 cursor-not-allowed focus:outline-none"
            >
              <option value="TypeScript">TypeScript</option>
            </select>
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
              Create Module
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateModuleModal;
