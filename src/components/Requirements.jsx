import React, { useState, useEffect, useMemo } from 'react';

import API_URL from '../apiUrl';

function Requirements() {
  const [requirements, setRequirements] = useState([]);
  const [features, setFeatures] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedFeatures, setExpandedFeatures] = useState({});
  const [selectedFeatureForCreate, setSelectedFeatureForCreate] = useState(null);
  const [viewingRequirement, setViewingRequirement] = useState(null);
  const [requirementTestCases, setRequirementTestCases] = useState([]);
  const [requirementTestFiles, setRequirementTestFiles] = useState([]);
  const [loadingTestCases, setLoadingTestCases] = useState(false);
  const [loadingTestFiles, setLoadingTestFiles] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    featureId: '',
    title: '',
    description: '',
    priority: 'Medium',
    status: 'Draft',
    sprintId: ''
  });

  // Load requirements, features, and sprints
  useEffect(() => {
    loadRequirements();
    loadFeatures();
    loadSprints();
  }, []);

  const loadFeatures = async () => {
    try {
      const response = await fetch(`${API_URL}/features`);
      if (!response.ok) throw new Error('Failed to fetch features');
      const data = await response.json();
      setFeatures(data);
      // Expand all features by default
      const expanded = {};
      data.forEach(feature => {
        expanded[feature.id] = false;
      });
      setExpandedFeatures(expanded);
    } catch (err) {
      console.error('Failed to load features:', err);
    }
  };

  const loadSprints = async () => {
    try {
      const response = await fetch(`${API_URL}/sprints`);
      if (!response.ok) throw new Error('Failed to fetch sprints');
      const data = await response.json();
      setSprints(data);
    } catch (err) {
      console.error('Failed to load sprints:', err);
    }
  };

  const loadRequirements = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/requirements`);
      if (!response.ok) throw new Error('Failed to fetch requirements');
      const data = await response.json();
      setRequirements(data);
    } catch (err) {
      console.error('Failed to load requirements:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const expandAll = () => {
    const expanded = {};
    features.forEach(f => { expanded[f.id] = true; });
    setExpandedFeatures(expanded);
  };

  const collapseAll = () => {
    const collapsed = {};
    features.forEach(f => { collapsed[f.id] = false; });
    setExpandedFeatures(collapsed);
  };

  const toggleFeature = (featureId) => {
    setExpandedFeatures(prev => ({
      ...prev,
      [featureId]: !prev[featureId]
    }));
  };

  const handleCreateNewRequirement = (featureId = null) => {
    setEditingRequirement(null);
    setSelectedFeatureForCreate(featureId);
    setFormData({
      featureId: featureId || '',
      title: '',
      description: '',
      priority: 'Medium',
      status: 'Draft',
      sprintId: ''
    });
    setIsModalOpen(true);
  };

  const handleEditRequirement = (requirement) => {
    setEditingRequirement(requirement);
    setFormData({
      featureId: requirement.feature_id || '',
      title: requirement.title,
      description: requirement.description || '',
      priority: requirement.priority,
      status: requirement.status,
      sprintId: requirement.sprint_id || ''
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRequirement(null);
    setFormData({
      featureId: '',
      title: '',
      description: '',
      priority: 'Medium',
      status: 'Draft',
      sprintId: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      alert('Please enter a title');
      return;
    }

    try {
      const url = editingRequirement 
        ? `${API_URL}/requirements/${editingRequirement.id}`
        : `${API_URL}/requirements`;
      
      const method = editingRequirement ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await loadRequirements();
        handleCloseModal();
      } else {
        const errorData = await response.json();
        alert(`Failed to ${editingRequirement ? 'update' : 'create'} requirement: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error saving requirement:', error);
      alert(`Failed to ${editingRequirement ? 'update' : 'create'} requirement: ${error.message}`);
    }
  };

  const handleDeleteRequirement = async (id) => {
    if (!window.confirm('Are you sure you want to delete this requirement?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/requirements/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadRequirements();
      } else {
        const errorData = await response.json();
        alert(`Failed to delete requirement: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error deleting requirement:', error);
      alert(`Failed to delete requirement: ${error.message}`);
    }
  };

  const handleViewRequirement = async (requirement) => {
    setViewingRequirement(requirement);
    setLoadingTestCases(true);
    setLoadingTestFiles(true);
    
    // Fetch test cases
    try {
      const response = await fetch(`${API_URL}/test-cases`);
      if (response.ok) {
        const allTestCases = await response.json();
        // Filter test cases for this requirement
        const filteredTestCases = allTestCases.filter(tc => tc.requirement_id === requirement.id);
        setRequirementTestCases(filteredTestCases);
      }
    } catch (error) {
      console.error('Failed to load test cases:', error);
      setRequirementTestCases([]);
    } finally {
      setLoadingTestCases(false);
    }
    
    // Fetch automation test files
    try {
      const response = await fetch(`${API_URL}/requirements/${requirement.id}/test-files`);
      if (response.ok) {
        const testFiles = await response.json();
        setRequirementTestFiles(testFiles);
      }
    } catch (error) {
      console.error('Failed to load test files:', error);
      setRequirementTestFiles([]);
    } finally {
      setLoadingTestFiles(false);
    }
  };

  const handleBackFromDetail = () => {
    setViewingRequirement(null);
    setRequirementTestCases([]);
    setRequirementTestFiles([]);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Group requirements by feature
  const requirementsByFeature = useMemo(() => {
    const grouped = {};
    features.forEach(feature => {
      grouped[feature.id] = requirements.filter(req => req.feature_id === feature.id);
    });
    return grouped;
  }, [requirements, features]);

  const totalFilteredRequirements = useMemo(() => {
    return features.reduce((total, feature) => {
      const featureReqs = requirementsByFeature[feature.id] || [];
      return total + featureReqs.filter(req => {
        const matchesSearch = !searchQuery ||
          req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          req.description?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesPriority = !priorityFilter || req.priority === priorityFilter;
        const matchesStatus = !statusFilter || req.status === statusFilter;
        return matchesSearch && matchesPriority && matchesStatus;
      }).length;
    }, 0);
  }, [features, requirementsByFeature, searchQuery, priorityFilter, statusFilter]);

  const getPriorityBadgeClass = (priority) => {
    switch (priority) {
      case 'High':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'Medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Low':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Implemented':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Approved':
        return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
      case 'Draft':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  // Filter and paginate requirements
  const filteredAndPaginatedRequirements = useMemo(() => {
    let result = [...requirements];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(req => 
        req.title.toLowerCase().includes(query) ||
        (req.description && req.description.toLowerCase().includes(query))
      );
    }
    
    return result;
  }, [requirements, searchQuery]);

  // Calculate test case metrics (must be before conditional returns)
  const testCaseMetrics = useMemo(() => {
    const total = requirementTestCases.length;
    const automated = requirementTestCases.filter(tc => tc.type === 'Automated').length;
    const manual = requirementTestCases.filter(tc => tc.type === 'Manual').length;
    return { total, automated, manual };
  }, [requirementTestCases]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p style={{ color: 'rgb(var(--text-secondary))' }}>Loading requirements...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <button
            onClick={loadRequirements}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render detail view
  if (viewingRequirement) {
    return (
      <div className="h-full flex flex-col p-6">
        {/* Header with Back Button */}
        <div className="mb-6">
          <button
            onClick={handleBackFromDetail}
            className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg transition-colors duration-200 hover:bg-gray-700"
            style={{ color: 'rgb(var(--text-secondary))' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Requirements
          </button>

          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-mono px-2 py-1 rounded" style={{ 
                  backgroundColor: 'rgb(var(--bg-secondary))', 
                  color: 'rgb(var(--text-tertiary))' 
                }}>
                  #{viewingRequirement.id}
                </span>
                <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
                  {viewingRequirement.title}
                </h1>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${getPriorityBadgeClass(viewingRequirement.priority)}`}>
                  {viewingRequirement.priority}
                </span>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClass(viewingRequirement.status)}`}>
                  {viewingRequirement.status}
                </span>
              </div>
              {viewingRequirement.description && (
                <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                  {viewingRequirement.description}
                </p>
              )}
              {viewingRequirement.sprint_id && (
                <div className="mt-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Sprint:</span>
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('navigateToSprint', { detail: { sprintId: viewingRequirement.sprint_id } }))}
                    className="text-sm text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
                  >
                    {sprints.find(s => s.id === viewingRequirement.sprint_id)?.name || `Sprint #${viewingRequirement.sprint_id}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Test Case Metrics */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl p-4 border" style={{ 
            borderColor: 'rgb(var(--border-primary))', 
            backgroundColor: 'rgb(var(--bg-elevated))' 
          }}>
            <div className="text-sm mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Total Test Cases</div>
            <div className="text-3xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
              {testCaseMetrics.total}
            </div>
          </div>
          <div className="rounded-xl p-4 border" style={{ 
            borderColor: 'rgb(var(--border-primary))', 
            backgroundColor: 'rgb(var(--bg-elevated))' 
          }}>
            <div className="text-sm mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Manual</div>
            <div className="text-3xl font-bold text-blue-400">
              {testCaseMetrics.manual}
            </div>
          </div>
          <div className="rounded-xl p-4 border" style={{ 
            borderColor: 'rgb(var(--border-primary))', 
            backgroundColor: 'rgb(var(--bg-elevated))' 
          }}>
            <div className="text-sm mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Automated</div>
            <div className="text-3xl font-bold text-green-400">
              {testCaseMetrics.automated}
            </div>
          </div>
        </div>

        {/* Mapped Test Cases Section */}
        <div className="flex-1 overflow-auto">
          <h2 className="text-xl font-bold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>
            Mapped Test Cases
          </h2>

          {loadingTestCases ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Loading test cases...</p>
              </div>
            </div>
          ) : requirementTestCases.length === 0 ? (
            <div className="rounded-xl border p-8 text-center" style={{ 
              borderColor: 'rgb(var(--border-primary))', 
              backgroundColor: 'rgb(var(--bg-elevated))' 
            }}>
              <p style={{ color: 'rgb(var(--text-secondary))' }}>
                No test cases mapped to this requirement yet.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ 
              borderColor: 'rgb(var(--border-primary))', 
              backgroundColor: 'rgb(var(--bg-elevated))' 
            }}>
              <table className="w-full">
                <thead className="border-b" style={{ 
                  borderColor: 'rgb(var(--border-primary))', 
                  backgroundColor: 'rgb(var(--bg-secondary))' 
                }}>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--text-tertiary))' }}>
                      Test Case ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--text-tertiary))' }}>
                      Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--text-tertiary))' }}>
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--text-tertiary))' }}>
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--text-tertiary))' }}>
                      Linked Automation
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'rgb(var(--border-secondary))' }}>
                  {requirementTestCases.map((testCase) => (
                    <tr key={testCase.id} className="hover:bg-opacity-50 transition-colors" style={{
                      backgroundColor: 'transparent'
                    }}>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono px-2 py-1 rounded" style={{ 
                          backgroundColor: 'rgb(var(--bg-secondary))', 
                          color: 'rgb(var(--text-tertiary))' 
                        }}>
                          #{testCase.id}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                        {testCase.title}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${
                          testCase.type === 'Automated' 
                            ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                            : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                        }`}>
                          {testCase.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${
                          testCase.status === 'Active' 
                            ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                            : testCase.status === 'Draft' 
                            ? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                            : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        }`}>
                          {testCase.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                        {testCase.linked_automation_id ? (
                          <span className="inline-flex items-center gap-1 text-green-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Linked
                          </span>
                        ) : (
                          <span style={{ color: 'rgb(var(--text-tertiary))' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Automation Test Files Section */}
          <h2 className="text-xl font-bold mb-4 mt-8" style={{ color: 'rgb(var(--text-primary))' }}>
            Automation Test Files
          </h2>

          {loadingTestFiles ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Loading automation scripts...</p>
              </div>
            </div>
          ) : requirementTestFiles.length === 0 ? (
            <div className="rounded-xl border p-8 text-center" style={{ 
              borderColor: 'rgb(var(--border-primary))', 
              backgroundColor: 'rgb(var(--bg-elevated))' 
            }}>
              <svg className="w-12 h-12 mx-auto mb-3" style={{ color: 'rgb(var(--text-tertiary))' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <p style={{ color: 'rgb(var(--text-secondary))' }}>
                No automation test files linked to this requirement yet.
              </p>
              <p className="text-xs mt-2" style={{ color: 'rgb(var(--text-tertiary))' }}>
                Link test files from the Modules view to track automation coverage.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ 
              borderColor: 'rgb(var(--border-primary))', 
              backgroundColor: 'rgb(var(--bg-elevated))' 
            }}>
              <table className="w-full">
                <thead className="border-b" style={{ 
                  borderColor: 'rgb(var(--border-primary))', 
                  backgroundColor: 'rgb(var(--bg-secondary))' 
                }}>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--text-tertiary))' }}>
                      Module
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--text-tertiary))' }}>
                      Test File Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--text-tertiary))' }}>
                      Created Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'rgb(var(--border-secondary))' }}>
                  {requirementTestFiles.map((testFile) => (
                    <tr key={testFile.id} className="hover:bg-opacity-50 transition-colors cursor-pointer" style={{
                      backgroundColor: 'transparent'
                    }}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('navigateToTestFile', { 
                          detail: { moduleId: testFile.module_id, testFileId: testFile.id } 
                        }));
                      }}
                      title="Click to view test file"
                    >
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                          <span className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                            {testFile.module_name || `Module #${testFile.module_id}`}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                          <span className="font-mono text-sm" style={{ color: 'rgb(var(--text-primary))' }}>
                            {testFile.name}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                          {new Date(testFile.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
              Requirements
            </h1>
            <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
              Manage project requirements and specifications
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg font-medium transition-all duration-200 border"
              style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-secondary))', color: 'rgb(var(--text-secondary))' }}
              title="Expand all features"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg font-medium transition-all duration-200 border"
              style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border-secondary))', color: 'rgb(var(--text-secondary))' }}
              title="Collapse all features"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
              </svg>
              Collapse All
            </button>
            <button
              onClick={() => handleCreateNewRequirement()}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 shadow-lg shadow-indigo-600/20 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Requirement
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-4 flex items-center gap-4">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search requirements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 pl-10 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
            style={{
              backgroundColor: 'rgb(var(--bg-secondary))',
              borderColor: 'rgb(var(--border-secondary))',
              color: 'rgb(var(--text-primary))'
            }}
          />
          <svg
            className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'rgb(var(--text-tertiary))' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        {/* Filter by Priority */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-all duration-200"
          style={{
            backgroundColor: 'rgb(var(--bg-secondary))',
            borderColor: 'rgb(var(--border-secondary))',
            color: 'rgb(var(--text-primary))'
          }}
        >
          <option value="">All Priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        
        {/* Filter by Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-all duration-200"
          style={{
            backgroundColor: 'rgb(var(--bg-secondary))',
            borderColor: 'rgb(var(--border-secondary))',
            color: 'rgb(var(--text-primary))'
          }}
        >
          <option value="">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="On Hold">On Hold</option>
        </select>
      </div>

      {/* Result count */}
      <div className="mb-3 flex items-center gap-2 text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
        <span>
          Showing{' '}
          <span className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{totalFilteredRequirements}</span>
          {' '}of{' '}
          <span className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{requirements.length}</span>
          {' '}requirement{requirements.length !== 1 ? 's' : ''}
        </span>
        {(searchQuery || priorityFilter || statusFilter) && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Filtered</span>
        )}
      </div>

      {/* Feature Groups */}
      <div className="flex-1 overflow-auto space-y-4">
        {features.length === 0 ? (
          <div className="rounded-xl border p-12 text-center" style={{ borderColor: 'rgb(var(--border-primary))', backgroundColor: 'rgb(var(--bg-elevated))' }}>
            <div className="flex flex-col items-center gap-2">
              <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              <p className="text-lg font-medium" style={{ color: 'rgb(var(--text-primary))' }}>No features found</p>
              <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                Create features first in the Features tab to organize your requirements
              </p>
            </div>
          </div>
        ) : (
          features.map(feature => {
            const featureRequirements = requirementsByFeature[feature.id] || [];
            const filteredFeatureReqs = featureRequirements.filter(req => {
              const matchesSearch = !searchQuery || 
                req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                req.description?.toLowerCase().includes(searchQuery.toLowerCase());
              const matchesPriority = !priorityFilter || req.priority === priorityFilter;
              const matchesStatus = !statusFilter || req.status === statusFilter;
              return matchesSearch && matchesPriority && matchesStatus;
            });
            const isExpanded = expandedFeatures[feature.id];

            return (
              <div key={feature.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgb(var(--border-primary))', backgroundColor: 'rgb(var(--bg-elevated))' }}>
                {/* Feature Header */}
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-opacity-80 transition-colors"
                  style={{ backgroundColor: 'rgb(var(--bg-secondary))' }}
                  onClick={() => toggleFeature(feature.id)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <button 
                      className="p-1 rounded transition-transform duration-200" 
                      style={{ 
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        color: 'rgb(var(--text-secondary))'
                      }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
                          {feature.name}
                        </h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${getPriorityBadgeClass(feature.priority)}`}>
                          {feature.priority}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border border-blue-500/30 bg-blue-500/20 text-blue-400">
                          {featureRequirements.length} {featureRequirements.length === 1 ? 'Requirement' : 'Requirements'}
                        </span>
                      </div>
                      {feature.description && (
                        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
                          {feature.description.length > 120 ? feature.description.slice(0, 120) + '…' : feature.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateNewRequirement(feature.id);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:scale-105"
                    style={{
                      backgroundColor: 'rgb(var(--accent-primary))',
                      color: 'rgb(var(--text-primary))'
                    }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Requirement
                  </button>
                </div>

                {/* Requirements List */}
                {isExpanded && (
                  <div className="border-t" style={{ borderColor: 'rgb(var(--border-primary))' }}>
                    {filteredFeatureReqs.length === 0 ? (
                      <div className="p-8 text-center" style={{ color: 'rgb(var(--text-secondary))' }}>
                        <p className="text-sm">
                          {featureRequirements.length === 0 
                            ? 'No requirements yet. Click "Add Requirement" to create one.'
                            : 'No requirements match the current filters.'}
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-700/50 ml-8 border-l-2 border-slate-600/40">
                        {filteredFeatureReqs.map((req, index) => (
                          <div
                            key={req.id}
                            className="p-4 pl-6 hover:bg-opacity-50 transition-colors"
                            style={{
                              backgroundColor: index % 2 === 0 ? 'transparent' : 'rgb(var(--bg-secondary) / 0.3)'
                            }}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-mono px-2 py-1 rounded" style={{ 
                                    backgroundColor: 'rgb(var(--bg-secondary))', 
                                    color: 'rgb(var(--text-tertiary))' 
                                  }}>
                                    #{req.id}
                                  </span>
                                  <h4 className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                                    {req.title}
                                  </h4>
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${getPriorityBadgeClass(req.priority)}`}>
                                    {req.priority}
                                  </span>
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClass(req.status)}`}>
                                    {req.status}
                                  </span>
                                </div>
                                {req.description && (
                                  <p className="text-sm mt-2" style={{ color: 'rgb(var(--text-secondary))' }}>
                                    {req.description.length > 120 ? req.description.slice(0, 120) + '…' : req.description}
                                  </p>
                                )}
                                <p className="text-xs mt-2" style={{ color: 'rgb(var(--text-tertiary))' }}>
                                  Created: {formatDate(req.created_at)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleViewRequirement(req)}
                                  className="p-2 rounded-lg transition-colors duration-200 hover:bg-blue-500/10 text-blue-400"
                                  title="View requirement details"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleEditRequirement(req)}
                                  className="p-2 rounded-lg transition-colors duration-200 hover:bg-indigo-500/10 text-indigo-400"
                                  title="Edit requirement"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteRequirement(req.id)}
                                  className="p-2 rounded-lg transition-colors duration-200 hover:bg-red-500/10 text-red-400"
                                  title="Delete requirement"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={handleCloseModal}>
          <div
            className="bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-950">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {editingRequirement ? 'Edit Requirement' : 'Create New Requirement'}
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  {editingRequirement ? 'Update requirement details' : 'Add a new requirement to your project'}
                </p>
              </div>
              <button
                className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg"
                onClick={handleCloseModal}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
              <div className="space-y-5">
                {/* Feature */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Feature <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formData.featureId}
                    onChange={(e) => setFormData({ ...formData, featureId: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select a feature...</option>
                    {features.map(feature => (
                      <option key={feature.id} value={feature.id}>
                        {feature.name} ({feature.priority} priority)
                      </option>
                    ))}
                  </select>
                  {features.length === 0 && (
                    <p className="mt-1 text-xs text-yellow-400">
                      No features available. Please create a feature first.
                    </p>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter requirement title..."
                    required
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter detailed description..."
                    rows="6"
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                {/* Priority and Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Priority <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Status <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Approved">Approved</option>
                      <option value="Implemented">Implemented</option>
                    </select>
                  </div>
                </div>

                {/* Assign to Sprint */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Assign to Sprint
                  </label>
                  <select
                    value={formData.sprintId}
                    onChange={(e) => setFormData({ ...formData, sprintId: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">No Sprint</option>
                    {sprints.map(sprint => (
                      <option key={sprint.id} value={sprint.id}>
                        {sprint.name} ({sprint.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-6 py-2 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
              >
                {editingRequirement ? 'Update Requirement' : 'Create Requirement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Requirements;
