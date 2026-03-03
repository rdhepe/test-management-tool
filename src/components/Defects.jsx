import React, { useState, useEffect } from 'react';
import API_URL from '../apiUrl';

function Defects() {
  const [defects, setDefects] = useState([]);
  const [testCases, setTestCases] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDefect, setEditingDefect] = useState(null);
  const [viewingDefect, setViewingDefect] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterSprint, setFilterSprint] = useState('All');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    severity: 'Medium',
    status: 'Open',
    linkedTestCaseId: '',
    sprintId: '',
    screenshot: null
  });

  useEffect(() => {
    fetchDefects();
    fetchTestCases();
    fetchSprints();
  }, []);

  // Listen for navigation from other components
  useEffect(() => {
    const handleDefectNavigation = (event) => {
      const { defectId } = event.detail || {};
      if (defectId) {
        const defect = defects.find(d => d.id === defectId);
        if (defect) {
          handleViewDetails(defect);
        }
      }
    };

    window.addEventListener('navigateToDefect', handleDefectNavigation);
    return () => window.removeEventListener('navigateToDefect', handleDefectNavigation);
  }, [defects]);

  const fetchDefects = async () => {
    try {
      const response = await fetch(`${API_URL}/defects`);
      const data = await response.json();
      setDefects(data);
    } catch (error) {
      console.error('Error fetching defects:', error);
    }
  };

  const fetchTestCases = async () => {
    try {
      const response = await fetch(`${API_URL}/test-cases`);
      const data = await response.json();
      setTestCases(data);
    } catch (error) {
      console.error('Error fetching test cases:', error);
    }
  };

  const fetchSprints = async () => {
    try {
      const response = await fetch(`${API_URL}/sprints`);
      const data = await response.json();
      setSprints(data);
    } catch (error) {
      console.error('Error fetching sprints:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
      title: formData.title,
      description: formData.description,
      severity: formData.severity,
      status: formData.status,
      linkedTestCaseId: formData.linkedTestCaseId ? parseInt(formData.linkedTestCaseId) : null,
      sprintId: formData.sprintId ? parseInt(formData.sprintId) : null,
      screenshot: formData.screenshot || null
    };

    try {
      if (editingDefect) {
        await fetch(`${API_URL}/defects/${editingDefect.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        await fetch(`${API_URL}/defects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      
      fetchDefects();
      closeModal();
    } catch (error) {
      console.error('Error saving defect:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this defect?')) {
      try {
        await fetch(`${API_URL}/defects/${id}`, {
          method: 'DELETE'
        });
        fetchDefects();
      } catch (error) {
        console.error('Error deleting defect:', error);
      }
    }
  };

  const openModal = (defect = null) => {
    if (defect) {
      setEditingDefect(defect);
      setFormData({
        title: defect.title,
        description: defect.description || '',
        severity: defect.severity,
        status: defect.status,
        linkedTestCaseId: defect.linked_test_case_id || '',
        sprintId: defect.sprint_id || '',
        screenshot: defect.screenshot || null
      });
    } else {
      setEditingDefect(null);
      setFormData({
        title: '',
        description: '',
        severity: 'Medium',
        status: 'Open',
        linkedTestCaseId: '',
        sprintId: '',
        screenshot: null
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDefect(null);
    setFormData({
      title: '',
      description: '',
      severity: 'Medium',
      status: 'Open',
      linkedTestCaseId: '',
      sprintId: '',
      screenshot: null
    });
  };

  const captureDefectScreenshot = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { mediaSource: 'screen' } });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      await new Promise(r => { video.onloadedmetadata = r; });
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      stream.getTracks().forEach(t => t.stop());
      canvas.toBlob(blob => {
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = () => setFormData(f => ({ ...f, screenshot: reader.result }));
          reader.readAsDataURL(blob);
        }
      }, 'image/png');
    } catch (err) {
      if (err.name !== 'NotAllowedError') alert('Failed to capture screenshot.');
    }
  };

  const handleViewDetails = (defect) => {
    setViewingDefect(defect);
  };

  const closeDetailView = () => {
    setViewingDefect(null);
  };

  const getSeverityBadgeColor = (severity) => {
    const colors = {
      'Low': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'Medium': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'High': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'Critical': 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return colors[severity] || colors['Medium'];
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      'Open': 'bg-red-500/20 text-red-400 border-red-500/30',
      'In Progress': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'Resolved': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Closed': 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return colors[status] || colors['Open'];
  };

  const filteredDefects = defects.filter(defect => {
    const matchesSearch = defect.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (defect.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = filterSeverity === 'All' || defect.severity === filterSeverity;
    const matchesStatus = filterStatus === 'All' || defect.status === filterStatus;
    const matchesSprint = filterSprint === 'All' || 
                          (filterSprint === 'Unassigned' && !defect.sprint_id) ||
                          (defect.sprint_id && defect.sprint_id.toString() === filterSprint);
    return matchesSearch && matchesSeverity && matchesStatus && matchesSprint;
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Defects</h1>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          + New Defect
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4 flex-wrap">
        <input
          type="text"
          placeholder="Search defects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-4 py-2 bg-gray-800 text-white border border-gray-700 rounded focus:outline-none focus:border-blue-500 flex-1 min-w-[200px]"
        />
        
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="px-4 py-2 bg-gray-800 text-white border border-gray-700 rounded focus:outline-none focus:border-blue-500"
        >
          <option value="All">All Severities</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Critical">Critical</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 bg-gray-800 text-white border border-gray-700 rounded focus:outline-none focus:border-blue-500"
        >
          <option value="All">All Statuses</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
          <option value="Closed">Closed</option>
        </select>

        <select
          value={filterSprint}
          onChange={(e) => setFilterSprint(e.target.value)}
          className="px-4 py-2 bg-gray-800 text-white border border-gray-700 rounded focus:outline-none focus:border-blue-500"
        >
          <option value="All">All Sprints</option>
          <option value="Unassigned">Unassigned</option>
          {sprints.map(sprint => (
            <option key={sprint.id} value={sprint.id.toString()}>
              {sprint.name}
            </option>
          ))}
        </select>
      </div>
      {/* Result count */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-400">
        <span>
          Showing{' '}
          <span className="font-semibold text-white">{filteredDefects.length}</span>
          {' '}of{' '}
          <span className="font-semibold text-white">{defects.length}</span>
          {' '}defect{defects.length !== 1 ? 's' : ''}
        </span>
        {(searchTerm || filterSeverity !== 'All' || filterStatus !== 'All' || filterSprint !== 'All') && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">Filtered</span>
        )}
      </div>
      {/* Defects Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
        <table className="w-full">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Severity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Linked Test Case</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredDefects.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-gray-400">
                  No defects found
                </td>
              </tr>
            ) : (
              filteredDefects.map((defect) => (
                <tr key={defect.id} className="hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-300">#{defect.id}</td>
                  <td className="px-4 py-3 text-sm text-white font-medium">{defect.title}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-semibold rounded border ${getSeverityBadgeColor(defect.severity)}`}>
                      {defect.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-semibold rounded border ${getStatusBadgeColor(defect.status)}`}>
                      {defect.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {defect.test_case_title || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {new Date(defect.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewDetails(defect)}
                        className="text-indigo-400 hover:text-indigo-300 transition-colors"
                        title="View Details"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openModal(defect)}
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                        title="Edit"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(defect.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">
              {editingDefect ? 'Edit Defect' : 'New Defect'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                    placeholder="Enter defect title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                    placeholder="Enter defect description"
                    rows="4"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Severity <span className="text-red-400">*</span>
                    </label>
                    <select
                      required
                      value={formData.severity}
                      onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Status <span className="text-red-400">*</span>
                    </label>
                    <select
                      required
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Link Test Case (Optional)
                  </label>
                  <select
                    value={formData.linkedTestCaseId}
                    onChange={(e) => setFormData({ ...formData, linkedTestCaseId: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- None --</option>
                    {testCases.map((tc) => (
                      <option key={tc.id} value={tc.id}>
                        {tc.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Assign to Sprint (Optional)
                  </label>
                  <select
                    value={formData.sprintId}
                    onChange={(e) => setFormData({ ...formData, sprintId: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- No Sprint --</option>
                    {sprints.map((sprint) => (
                      <option key={sprint.id} value={sprint.id}>
                        {sprint.name} ({sprint.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Screenshot */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Screenshot</label>
                {!formData.screenshot ? (
                  <button
                    type="button"
                    onClick={captureDefectScreenshot}
                    className="w-full px-4 py-2 bg-gray-700 text-white text-sm rounded hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 border border-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Capture Screenshot
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="relative inline-block">
                      <img
                        src={formData.screenshot}
                        alt="Defect screenshot"
                        className="max-w-full rounded border border-gray-600 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                        style={{ maxHeight: '200px' }}
                        onClick={() => {
                          const w = window.open();
                          w.document.write(`<!DOCTYPE html><html><head><title>Screenshot</title><style>body{margin:0;padding:20px;background:#1e293b;display:flex;justify-content:center;align-items:center;min-height:100vh;}img{max-width:100%;height:auto;border:2px solid #475569;border-radius:8px;box-shadow:0 10px 25px rgba(0,0,0,.5);}</style></head><body><img src="${formData.screenshot}"/></body></html>`);
                          w.document.close();
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(f => ({ ...f, screenshot: null }))}
                        className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-lg"
                        title="Remove screenshot"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={captureDefectScreenshot}
                      className="px-3 py-1 bg-gray-700 text-gray-300 text-sm rounded hover:bg-gray-600 transition-colors"
                    >
                      Recapture
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  {editingDefect ? 'Update Defect' : 'Create Defect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {viewingDefect && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-slate-700 shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">{viewingDefect.title}</h2>
                <p className="text-slate-400 text-sm mt-1">Defect #{viewingDefect.id}</p>
              </div>
              <button
                onClick={closeDetailView}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <span className={`px-3 py-1 text-sm font-semibold rounded-full border ${getSeverityBadgeColor(viewingDefect.severity)}`}>
                  {viewingDefect.severity}
                </span>
                <span className={`px-3 py-1 text-sm font-semibold rounded-full border ${getStatusBadgeColor(viewingDefect.status)}`}>
                  {viewingDefect.status}
                </span>
              </div>

              {/* Description */}
              {viewingDefect.description && (
                <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Description</h3>
                  <p className="text-white whitespace-pre-wrap">{viewingDefect.description}</p>
                </div>
              )}

              {/* Screenshot */}
              {viewingDefect.screenshot && (
                <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Screenshot</h3>
                  <img
                    src={viewingDefect.screenshot}
                    alt="Defect screenshot"
                    className="max-w-full rounded border border-slate-600 cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ maxHeight: '300px', objectFit: 'contain' }}
                    onClick={() => {
                      const w = window.open();
                      w.document.write(`<!DOCTYPE html><html><head><title>Screenshot</title><style>body{margin:0;padding:20px;background:#1e293b;display:flex;justify-content:center;align-items:center;min-height:100vh;}img{max-width:100%;height:auto;border:2px solid #475569;border-radius:8px;box-shadow:0 10px 25px rgba(0,0,0,.5);}</style></head><body><img src="${viewingDefect.screenshot}"/></body></html>`);
                      w.document.close();
                    }}
                  />
                </div>
              )}

              {/* Linked Test Case */}
              {viewingDefect.test_case_title && (
                <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Linked Test Case</h3>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span className="text-white font-medium">{viewingDefect.test_case_title}</span>
                  </div>
                </div>
              )}

              {/* Sprint */}
              {viewingDefect.sprint_name && (
                <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Sprint</h3>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-white font-medium">{viewingDefect.sprint_name}</span>
                    <span className="text-slate-400 text-sm">({viewingDefect.sprint_status})</span>
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Created</h3>
                  <p className="text-white">{new Date(viewingDefect.created_at).toLocaleString()}</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Last Updated</h3>
                  <p className="text-white">{new Date(viewingDefect.updated_at).toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-slate-800 px-6 py-4 border-t border-slate-700 flex justify-between">
              <button
                onClick={() => {
                  closeDetailView();
                  openModal(viewingDefect);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Edit Defect
              </button>
              <button
                onClick={closeDetailView}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Defects;
