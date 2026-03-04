import React, { useState, useEffect, useMemo, useRef } from 'react';
import { authFetch } from '../utils/api';
import API_URL from '../apiUrl';

function Avatar({ username }) {
  if (!username) return null;
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-700 text-white text-xs font-bold shrink-0">
      {username.charAt(0).toUpperCase()}
    </span>
  );
}

function AIBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30 shrink-0">
      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1H6.5a2.5 2.5 0 010-5H8V9h4v1h1.5a2.5 2.5 0 010 5H12v1H8z" />
      </svg>
      AI
    </span>
  );
}

function SparkIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function Requirements({ currentUser, orgInfo }) {
  const aiEnabled = orgInfo?.aiHealingEnabled === true || orgInfo?.aiHealingEnabled === 1;
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
  // Comments / history
  const [reqComments, setReqComments] = useState([]);
  const [reqHistory, setReqHistory] = useState([]);
  const [viewTab, setViewTab] = useState('details');
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // AI generation panel
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiFeatureId, setAiFeatureId] = useState('');
  const [aiForm, setAiForm] = useState({ focus: '', count: '5' });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const aiDescRef = useRef(null);

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
      const response = await authFetch(`${API_URL}/features`);
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
      const response = await authFetch(`${API_URL}/sprints`);
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
      const response = await authFetch(`${API_URL}/requirements`);
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
      
      const response = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('auth_token') },
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
      const response = await authFetch(`${API_URL}/requirements/${id}`, {
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

  // ---------- AI generation ----------
  const openAiPanel = (featureId = '') => {
    setAiFeatureId(featureId ? String(featureId) : '');
    setAiForm({ focus: '', count: '5' });
    setAiError('');
    setAiResult(null);
    setIsAiOpen(true);
    setTimeout(() => aiDescRef.current?.focus(), 60);
  };
  const closeAiPanel = () => { setIsAiOpen(false); setAiResult(null); setAiError(''); };

  const handleAiGenerate = async (e) => {
    e.preventDefault();
    if (!aiFeatureId) { setAiError('Please select a feature.'); return; }
    setAiLoading(true);
    setAiError('');
    setAiResult(null);
    try {
      const res = await authFetch(`${API_URL}/requirements/generate-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureId: aiFeatureId, focus: aiForm.focus.trim(), count: parseInt(aiForm.count) || 5 }),
      });
      const data = await res.json();
      if (!res.ok) { setAiError(data.error || 'Generation failed.'); return; }
      setAiResult(data);
      await loadRequirements();
      // Auto-expand the target feature so generated requirements are visible
      if (aiFeatureId) {
        setExpandedFeatures(prev => ({ ...prev, [aiFeatureId]: true }));
      }
    } catch { setAiError('Network error. Please try again.'); }
    finally { setAiLoading(false); }
  };

  // --------- helpers -----------

  const handleViewRequirement = async (requirement) => {
    setViewingRequirement(requirement);
    setViewTab('details');
    setLoadingTestCases(true);
    setLoadingTestFiles(true);
    setReqComments([]);
    setReqHistory([]);
    setCommentText('');

    // Fetch test cases
    try {
      const response = await authFetch(`${API_URL}/test-cases`);
      if (response.ok) {
        const allTestCases = await response.json();
        setRequirementTestCases(allTestCases.filter(tc => tc.requirement_id === requirement.id));
      }
    } catch { setRequirementTestCases([]); } finally { setLoadingTestCases(false); }

    // Fetch automation test files
    try {
      const response = await authFetch(`${API_URL}/requirements/${requirement.id}/test-files`);
      if (response.ok) setRequirementTestFiles(await response.json());
    } catch { setRequirementTestFiles([]); } finally { setLoadingTestFiles(false); }

    // Fetch comments + history
    try {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'x-auth-token': token } : {};
      const [commRes, histRes] = await Promise.all([
        fetch(`${API_URL}/requirements/${requirement.id}/comments`, { headers }),
        fetch(`${API_URL}/requirements/${requirement.id}/history`, { headers }),
      ]);
      if (commRes.ok) setReqComments(await commRes.json());
      if (histRes.ok) setReqHistory(await histRes.json());
    } catch { /* ignore */ }
  };

  const handleAddReqComment = async () => {
    if (!commentText.trim() || !viewingRequirement) return;
    setSubmittingComment(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/requirements/${viewingRequirement.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'x-auth-token': token } : {}) },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (res.ok) { const newComment = await res.json(); setReqComments(prev => [...prev, newComment]); setCommentText(''); }
    } finally { setSubmittingComment(false); }
  };

  const handleBackFromDetail = () => {
    setViewingRequirement(null);
    setRequirementTestCases([]);
    setRequirementTestFiles([]);
    setReqComments([]);
    setReqHistory([]);
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
            {aiEnabled && (
              <button
                onClick={() => openAiPanel()}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-500 transition-all duration-200 font-medium"
              >
                <SparkIcon className="w-4 h-4" />
                Generate via AI
              </button>
            )}
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
                  {aiEnabled && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openAiPanel(feature.id);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition-all duration-200 bg-violet-600 hover:bg-violet-500 text-white text-sm"
                    >
                      <SparkIcon className="w-4 h-4" />
                      Generate via AI
                    </button>
                  )}
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
                                  {req.title?.startsWith('AI: ') && <AIBadge />}
                                  <h4 className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                                    {req.title?.startsWith('AI: ') ? req.title.slice(4) : req.title}
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
                                  Created: {formatDate(req.created_at)}{req.created_by ? ` · By: ${req.created_by}` : ''}
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


      {/* ── View Requirement Panel ── */}
      {viewingRequirement && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={handleBackFromDetail} />
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-700 h-full flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-700 gap-3 shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs text-slate-500">#{viewingRequirement.id}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${getPriorityBadgeClass(viewingRequirement.priority)}`}>{viewingRequirement.priority}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${getStatusBadgeClass(viewingRequirement.status)}`}>{viewingRequirement.status}</span>
                </div>
                <h2 className="text-base font-semibold text-white leading-snug">{viewingRequirement.title}</h2>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => { handleBackFromDetail(); handleEditRequirement(viewingRequirement); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Edit
                </button>
                <button onClick={handleBackFromDetail} className="p-1 text-slate-500 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-700 px-5 shrink-0">
              {[['details','Details'], ['comments',`Comments${reqComments.length ? ` (${reqComments.length})` : ''}`], ['history','History']].map(([key, label]) => (
                <button key={key} onClick={() => setViewTab(key)}
                  className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px ${viewTab === key ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {viewTab === 'details' && (
                <div className="space-y-4">
                  {viewingRequirement.description && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Description</p>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap">{viewingRequirement.description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800 rounded-lg px-3 py-2">
                      <p className="text-xs text-slate-500 mb-0.5">Created</p>
                      <p className="text-sm text-slate-300">{new Date(viewingRequirement.created_at).toLocaleDateString()}</p>
                    </div>
                    {viewingRequirement.created_by && (
                      <div className="bg-slate-800 rounded-lg px-3 py-2">
                        <p className="text-xs text-slate-500 mb-0.5">Created By</p>
                        <p className="text-sm text-slate-300">{viewingRequirement.created_by}</p>
                      </div>
                    )}
                    {viewingRequirement.sprint_id && (
                      <div className="bg-slate-800 rounded-lg px-3 py-2">
                        <p className="text-xs text-slate-500 mb-0.5">Sprint</p>
                        <p className="text-sm text-indigo-400">{sprints.find(s => s.id === viewingRequirement.sprint_id)?.name || `Sprint #${viewingRequirement.sprint_id}`}</p>
                      </div>
                    )}
                  </div>

                  {/* Test Case Metrics */}
                  <div className="grid grid-cols-3 gap-2">
                    {[['Total', testCaseMetrics.total, 'text-white'], ['Manual', testCaseMetrics.manual, 'text-blue-400'], ['Automated', testCaseMetrics.automated, 'text-green-400']].map(([label, val, cls]) => (
                      <div key={label} className="bg-slate-800 rounded-lg px-3 py-2 text-center">
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className={`text-2xl font-bold ${cls}`}>{val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Mapped Test Cases */}
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Mapped Test Cases</p>
                    {loadingTestCases ? (
                      <p className="text-xs text-slate-500 italic">Loading…</p>
                    ) : requirementTestCases.length === 0 ? (
                      <p className="text-xs text-slate-600 italic">No test cases mapped yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {requirementTestCases.map(tc => (
                          <div key={tc.id} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 flex items-center justify-between">
                            <span className="text-sm text-white">{tc.title}</span>
                            <div className="flex gap-1.5">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full border ${tc.type === 'Automated' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>{tc.type}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full border ${tc.status === 'Active' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>{tc.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Automation Test Files */}
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Automation Test Files</p>
                    {loadingTestFiles ? (
                      <p className="text-xs text-slate-500 italic">Loading…</p>
                    ) : requirementTestFiles.length === 0 ? (
                      <p className="text-xs text-slate-600 italic">No automation test files linked.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {requirementTestFiles.map(f => (
                          <div key={f.id} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 flex items-center gap-2 cursor-pointer hover:border-indigo-500/50 transition-colors"
                            onClick={() => window.dispatchEvent(new CustomEvent('navigateToTestFile', { detail: { moduleId: f.module_id, testFileId: f.id } }))}>
                            <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                            <span className="text-sm font-mono text-white truncate">{f.name}</span>
                            <span className="text-xs text-slate-500 ml-auto shrink-0">{f.module_name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {viewTab === 'comments' && (
                <div className="space-y-4">
                  {reqComments.length === 0 ? (
                    <p className="text-xs text-slate-600 italic">No comments yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {reqComments.map(c => (
                        <div key={c.id} className="flex gap-2.5">
                          <Avatar username={c.author_name || '?'} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-0.5">
                              <span className="text-xs font-medium text-slate-300">{c.author_name || 'Unknown'}</span>
                              <span className="text-xs text-slate-600">{new Date(c.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-sm text-slate-300 whitespace-pre-wrap">{c.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-700">
                    <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddReqComment(); }}
                      placeholder="Add a comment… (Ctrl+Enter to submit)" rows={3}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 resize-none" />
                    <div className="flex justify-end mt-2">
                      <button onClick={handleAddReqComment} disabled={!commentText.trim() || submittingComment}
                        className="px-4 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition-colors">
                        {submittingComment ? 'Posting…' : 'Post Comment'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {viewTab === 'history' && (
                <div>
                  {reqHistory.length === 0 ? (
                    <p className="text-xs text-slate-600 italic">No changes recorded yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {reqHistory.map(h => (
                        <div key={h.id} className="flex gap-2.5 items-start">
                          <Avatar username={h.changed_by_username || '?'} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-300">
                              <span className="font-medium">{h.changed_by_username || 'Someone'}</span>
                              {' changed '}<span className="text-indigo-400 font-medium">{h.field}</span>
                              {h.old_value ? <> from <span className="text-slate-400">"{h.old_value}"</span></> : null}
                              {' to '}<span className="text-slate-200">"{h.new_value}"</span>
                            </p>
                            <p className="text-xs text-slate-600 mt-0.5">{new Date(h.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── AI Generation Panel ── */}
      {isAiOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={closeAiPanel} />
          <div className="w-full max-w-xl bg-slate-900 border-l border-slate-700 h-full flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                  <SparkIcon className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white leading-tight">Generate Requirements via AI</h2>
                  <p className="text-xs text-slate-500">Powered by GPT-4o</p>
                </div>
              </div>
              <button onClick={closeAiPanel} className="p-1 text-slate-500 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {!aiResult ? (
                <form onSubmit={handleAiGenerate} className="px-5 py-5 space-y-5">
                  <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 px-4 py-3 text-xs text-violet-300 leading-relaxed">
                    AI will generate structured, testable requirements for the selected feature. Each will be saved with an <strong>AI</strong> badge.
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Feature <span className="text-red-400">*</span></label>
                    <select value={aiFeatureId} onChange={e => setAiFeatureId(e.target.value)} required
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500">
                      <option value="">Select a feature…</option>
                      {features.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.name?.startsWith('AI: ') ? `◆ ${f.name.slice(4)}` : f.name} — {f.priority}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Focus area
                      <span className="ml-1 text-slate-500 font-normal">(optional — narrow what aspects to cover)</span>
                    </label>
                    <textarea ref={aiDescRef} value={aiForm.focus}
                      onChange={e => setAiForm({ ...aiForm, focus: e.target.value })}
                      rows={4}
                      placeholder="e.g. Focus on authentication edge cases, error handling, and accessibility requirements…"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500 resize-none placeholder-slate-600" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Number of requirements to generate</label>
                    <div className="flex gap-2">
                      {[3, 5, 7, 10].map(n => (
                        <button key={n} type="button"
                          onClick={() => setAiForm({ ...aiForm, count: String(n) })}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            aiForm.count === String(n)
                              ? 'bg-violet-600 border-violet-500 text-white'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
                          }`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {aiError && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-sm text-red-300">{aiError}</div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={closeAiPanel}
                      className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors">
                      Cancel
                    </button>
                    <button type="submit" disabled={aiLoading || !aiFeatureId}
                      className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg transition-colors">
                      {aiLoading ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                          Generating…
                        </>
                      ) : (
                        <><SparkIcon className="w-4 h-4" />Generate Requirements</>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="px-5 py-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-emerald-300">
                      {aiResult.created.length} requirement{aiResult.created.length !== 1 ? 's' : ''} created successfully
                    </p>
                  </div>

                  {/* Feature context */}
                  {aiFeatureId && (
                    <div className="mb-4 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-400">
                      Feature: <span className="text-slate-200 font-medium">
                        {(() => { const f = features.find(f => String(f.id) === String(aiFeatureId)); return f ? (f.name?.startsWith('AI: ') ? f.name.slice(4) : f.name) : ''; })()}
                      </span>
                    </div>
                  )}

                  <div className="space-y-3 mb-6">
                    {aiResult.created.map((r, i) => (
                      <div key={r.id || i} className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <AIBadge />
                            <span className="text-sm font-semibold text-white leading-snug">
                              {r.title?.startsWith('AI: ') ? r.title.slice(4) : r.title}
                            </span>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                            r.priority === 'High' ? 'bg-red-900/60 text-red-300' :
                            r.priority === 'Low' ? 'bg-green-900/60 text-green-300' :
                            'bg-yellow-900/60 text-yellow-300'
                          }`}>{r.priority}</span>
                        </div>
                        {r.description && (
                          <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{r.description}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => { setAiResult(null); setAiForm({ focus: '', count: '5' }); setAiError(''); }}
                      className="flex-1 py-2 text-sm font-medium border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 rounded-lg transition-colors">
                      Generate More
                    </button>
                    <button onClick={closeAiPanel}
                      className="flex-1 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors">
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create/Edit Panel ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={handleCloseModal} />
          <div className="w-full max-w-xl bg-slate-900 border-l border-slate-700 h-full flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-white">{editingRequirement ? 'Edit Requirement' : 'Create New Requirement'}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{editingRequirement ? 'Update requirement details' : 'Add a new requirement to your project'}</p>
              </div>
              <button onClick={handleCloseModal} className="p-1 text-slate-500 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-white mb-1">Feature <span className="text-red-400">*</span></label>
                <select value={formData.featureId} onChange={e => setFormData({ ...formData, featureId: e.target.value })} required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select a feature…</option>
                  {features.map(f => <option key={f.id} value={f.id}>{f.name} ({f.priority} priority)</option>)}
                </select>
                {features.length === 0 && <p className="mt-1 text-xs text-yellow-400">No features available. Please create a feature first.</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-white mb-1">Title <span className="text-red-400">*</span></label>
                <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter requirement title…" required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-white mb-1">Description</label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter detailed description…" rows={5}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white mb-1">Priority <span className="text-red-400">*</span></label>
                  <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })} required
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white mb-1">Status <span className="text-red-400">*</span></label>
                  <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} required
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="Draft">Draft</option>
                    <option value="Approved">Approved</option>
                    <option value="Implemented">Implemented</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-white mb-1">Assign to Sprint</label>
                <select value={formData.sprintId} onChange={e => setFormData({ ...formData, sprintId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">No Sprint</option>
                  {sprints.map(s => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
                </select>
              </div>
            </form>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex justify-end gap-2">
              <button type="button" onClick={handleCloseModal}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleSubmit}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
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
