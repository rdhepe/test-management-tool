import React, { useState, useEffect } from 'react';
import { authFetch } from '../utils/api';

import API_URL from '../apiUrl';

function Features() {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState(null);
  const [viewingFeature, setViewingFeature] = useState(null);
  const [featureRequirements, setFeatureRequirements] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('All');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priority: 'Medium'
  });

  // Load features
  useEffect(() => {
    loadFeatures();
  }, []);

  const loadFeatures = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await authFetch(`${API_URL}/features`);
      if (!response.ok) throw new Error('Failed to fetch features');
      const data = await response.json();
      setFeatures(data);
    } catch (err) {
      console.error('Failed to load features:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewFeature = () => {
    setEditingFeature(null);
    setFormData({
      name: '',
      description: '',
      priority: 'Medium'
    });
    setIsModalOpen(true);
  };

  const handleEditFeature = (feature) => {
    setEditingFeature(feature);
    setFormData({
      name: feature.name,
      description: feature.description || '',
      priority: feature.priority
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingFeature(null);
    setFormData({
      name: '',
      description: '',
      priority: 'Medium'
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Please enter a feature name');
      return;
    }

    try {
      const url = editingFeature 
        ? `${API_URL}/features/${editingFeature.id}`
        : `${API_URL}/features`;
      
      const method = editingFeature ? 'PUT' : 'POST';
      
      const response = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('auth_token') },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await loadFeatures();
        handleCloseModal();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Something went wrong'}`);
      }
    } catch (err) {
      alert('Failed to save feature');
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this feature? All associated requirements and test cases will also be deleted.')) {
      return;
    }

    try {
      const response = await authFetch(`${API_URL}/features/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadFeatures();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to delete feature'}`);
      }
    } catch (err) {
      alert('Failed to delete feature');
      console.error(err);
    }
  };

  const handleViewDetails = async (feature) => {
    setViewingFeature(feature);
    try {
      const response = await authFetch(`${API_URL}/features/${feature.id}/requirements`);
      if (response.ok) {
        const data = await response.json();
        setFeatureRequirements(data);
      }
    } catch (err) {
      console.error('Failed to load feature requirements:', err);
      setFeatureRequirements([]);
    }
  };

  const closeDetailView = () => {
    setViewingFeature(null);
    setFeatureRequirements([]);
  };

  // Filter features
  const filteredFeatures = features.filter(feature => {
    const matchesSearch = feature.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (feature.description && feature.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPriority = filterPriority === 'All' || feature.priority === filterPriority;
    return matchesSearch && matchesPriority;
  });

  const getPriorityBadge = (priority) => {
    const colors = {
      'High': 'bg-red-900 text-red-200',
      'Medium': 'bg-yellow-900 text-yellow-200',
      'Low': 'bg-green-900 text-green-200'
    };
    return colors[priority] || colors['Medium'];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white">Loading features...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-900 text-red-200 p-4 rounded-lg">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-white">Features</h1>
          <button
            onClick={handleCreateNewFeature}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            + New Feature
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="All">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* Result count */}
      <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
        <span>
          Showing{' '}
          <span className="font-semibold text-white">{filteredFeatures.length}</span>
          {' '}of{' '}
          <span className="font-semibold text-white">{features.length}</span>
          {' '}feature{features.length !== 1 ? 's' : ''}
        </span>
        {(searchQuery || filterPriority !== 'All') && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Filtered</span>
        )}
      </div>

      {/* Features Table */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Created By</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {filteredFeatures.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-slate-400">
                  No features found. Create your first feature to get started.
                </td>
              </tr>
            ) : (
              filteredFeatures.map((feature) => (
                <tr key={feature.id} className="hover:bg-slate-700">
                  <td className="px-6 py-4 text-white font-medium">{feature.name}</td>
                  <td className="px-6 py-4 text-slate-300 max-w-xs">
                    {feature.description
                      ? feature.description.length > 100
                        ? feature.description.slice(0, 100) + '…'
                        : feature.description
                      : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityBadge(feature.priority)}`}>
                      {feature.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-sm">
                    {new Date(feature.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-sm">
                    {feature.created_by || '—'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewDetails(feature)}
                        className="p-2 rounded-lg transition-colors duration-200 hover:bg-blue-500/10 text-blue-400"
                        title="View feature"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleEditFeature(feature)}
                        className="p-2 rounded-lg transition-colors duration-200 hover:bg-indigo-500/10 text-indigo-400"
                        title="Edit feature"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(feature.id)}
                        className="p-2 rounded-lg transition-colors duration-200 hover:bg-red-500/10 text-red-400"
                        title="Delete feature"
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

      {/* View Feature Details Modal */}
      {viewingFeature && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">{viewingFeature.name}</h2>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${getPriorityBadge(viewingFeature.priority)}`}>
                    {viewingFeature.priority}
                  </span>
                </div>
                <button
                  onClick={closeDetailView}
                  className="text-slate-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {viewingFeature.description && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-slate-300 mb-2">Description</h3>
                  <p className="text-white">{viewingFeature.description}</p>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-sm font-medium text-slate-300 mb-2">Created</h3>
                <p className="text-white">{new Date(viewingFeature.created_at).toLocaleString()}</p>
              </div>

              {/* Associated Requirements */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Associated Requirements</h3>
                {featureRequirements.length === 0 ? (
                  <div className="text-center py-8 bg-slate-900 rounded-lg">
                    <p className="text-slate-400">No requirements associated with this feature yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {featureRequirements.map((req) => (
                      <div key={req.id} className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-white font-medium">{req.title}</h4>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            req.priority === 'High' ? 'bg-red-900 text-red-200' :
                            req.priority === 'Medium' ? 'bg-yellow-900 text-yellow-200' :
                            'bg-green-900 text-green-200'
                          }`}>
                            {req.priority}
                          </span>
                        </div>
                        {req.description && (
                          <p className="text-slate-400 text-sm mb-2">{req.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>Type: {req.type}</span>
                          {req.sprint_name && <span>Sprint: {req.sprint_name}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    closeDetailView();
                    handleEditFeature(viewingFeature);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Edit Feature
                </button>
                <button
                  onClick={closeDetailView}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                {editingFeature ? 'Edit Feature' : 'Create New Feature'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    placeholder="Enter feature name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    rows="4"
                    placeholder="Enter feature description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Priority <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    required
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                  >
                    {editingFeature ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Features;
