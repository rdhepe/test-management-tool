import { useState, useEffect, useMemo } from 'react';
import API_URL from '../apiUrl';
import * as XLSX from 'xlsx';

function TestCases({ currentUser }) {
  const [testCases, setTestCases] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [allTestFiles, setAllTestFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sprintFilter, setSprintFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState(null);
  const [viewingTestCase, setViewingTestCase] = useState(null);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [stepExecutions, setStepExecutions] = useState([]);
  const [viewingExecutionDetails, setViewingExecutionDetails] = useState(null);
  const [executionHistoryPage, setExecutionHistoryPage] = useState(1);
  const [executionHistoryPerPage] = useState(5);
  const [expandedRequirements, setExpandedRequirements] = useState({});
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' | 'flat'
  const [pageTab, setPageTab] = useState('testcases'); // 'testcases' | 'executions'
  const [allRuns, setAllRuns] = useState([]);
  const [execStatusFilter, setExecStatusFilter] = useState('');
  const [execSprintFilter, setExecSprintFilter] = useState('');
  const [selectedRequirementForCreate, setSelectedRequirementForCreate] = useState(null);
  const [executionFormData, setExecutionFormData] = useState({
    executedBy: ''
  });
  const [allDefects, setAllDefects] = useState([]);
  const [linkedDefectIds, setLinkedDefectIds] = useState([]);
  const [showNewDefectForm, setShowNewDefectForm] = useState(false);
  const [newDefectForm, setNewDefectForm] = useState({ title: '', description: '', severity: 'Medium', status: 'Open', linkedTestCaseId: '', sprintId: '', screenshotPreview: null, screenshotFile: null });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    preconditions: '',
    testSteps: [{ action: '', expected: '' }],
    type: 'Manual',
    priority: 'Medium',
    status: 'Draft',
    requirementId: ''
  });

  useEffect(() => {
    fetchTestCases();
    fetchRequirements();
    fetchSprints();
    fetchAllTestFiles();
    fetchAllDefects();
    fetchAllRuns();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [testCases, searchQuery]);

  // Listen for navigation from other components
  useEffect(() => {
    const handleTestCaseNavigation = async (event) => {
      const { testCaseId } = event.detail || {};
      if (testCaseId) {
        const testCase = testCases.find(tc => tc.id === testCaseId);
        if (testCase) {
          await handleViewDetails(testCase);
        }
      }
    };

    window.addEventListener('navigateToTestCase', handleTestCaseNavigation);
    return () => window.removeEventListener('navigateToTestCase', handleTestCaseNavigation);
  }, [testCases]);

  const fetchTestCases = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/test-cases`);
      if (!response.ok) throw new Error('Failed to fetch test cases');
      const data = await response.json();
      setTestCases(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequirements = async () => {
    try {
      const response = await fetch(`${API_URL}/requirements`);
      if (!response.ok) throw new Error('Failed to fetch requirements');
      const data = await response.json();
      setRequirements(data);
      // Collapse all requirements by default
      const expanded = {};
      data.forEach(req => {
        expanded[req.id] = false;
      });
      setExpandedRequirements(expanded);
    } catch (err) {
      console.error('Error fetching requirements:', err);
    }
  };

  const fetchSprints = async () => {
    try {
      const response = await fetch(`${API_URL}/sprints`);
      if (!response.ok) throw new Error('Failed to fetch sprints');
      const data = await response.json();
      setSprints(data);
    } catch (err) {
      console.error('Error fetching sprints:', err);
    }
  };

  const fetchAllDefects = async () => {
    try {
      const response = await fetch(`${API_URL}/defects`);
      if (!response.ok) return;
      const data = await response.json();
      setAllDefects(data);
    } catch (err) {
      console.error('Error fetching defects:', err);
    }
  };

  const fetchAllRuns = async () => {
    try {
      const response = await fetch(`${API_URL}/manual-test-runs`);
      if (!response.ok) return;
      const data = await response.json();
      setAllRuns(data);
    } catch (err) {
      console.error('Error fetching runs:', err);
    }
  };

  const fetchAllTestFiles = async () => {
    try {
      const response = await fetch(`${API_URL}/test-files`);
      if (!response.ok) return;
      const data = await response.json();
      setAllTestFiles(data);
    } catch (err) {
      console.error('Error fetching test files:', err);
    }
  };

  const applyFilters = () => {
    // Filters are now applied within the grouped rendering
  };

  const handleCreateNew = (requirementId = null) => {
    setEditingTestCase(null);
    setSelectedRequirementForCreate(requirementId);
    setFormData({
      title: '',
      description: '',
      preconditions: '',
      testSteps: [{ action: '', expected: '' }],
      type: 'Manual',
      priority: 'Medium',
      status: 'Draft',
      requirementId: requirementId || '',
      testFileId: ''
    });
    setShowModal(true);
  };

  const expandAll = () => {
    const expanded = {};
    requirements.forEach(r => { expanded[r.id] = true; });
    setExpandedRequirements(expanded);
  };

  const collapseAll = () => {
    const collapsed = {};
    requirements.forEach(r => { collapsed[r.id] = false; });
    setExpandedRequirements(collapsed);
  };

  const toggleRequirement = (requirementId) => {
    setExpandedRequirements(prev => ({
      ...prev,
      [requirementId]: !prev[requirementId]
    }));
  };

  const handleEdit = (testCase) => {
    setEditingTestCase(testCase);
    
    // Parse test steps from JSON string
    let parsedSteps = [{ action: '', expected: '' }];
    if (testCase.test_steps) {
      try {
        parsedSteps = JSON.parse(testCase.test_steps);
        // Ensure it's an array with proper structure
        if (!Array.isArray(parsedSteps) || parsedSteps.length === 0) {
          parsedSteps = [{ action: testCase.test_steps || '', expected: testCase.expected_result || '' }];
        }
      } catch (e) {
        // If parsing fails, treat as old format (plain text)
        parsedSteps = [{ action: testCase.test_steps || '', expected: testCase.expected_result || '' }];
      }
    }
    
    setFormData({
      title: testCase.title,
      description: testCase.description || '',
      preconditions: testCase.preconditions || '',
      testSteps: parsedSteps,
      type: testCase.type,
      priority: testCase.priority,
      status: testCase.status,
      requirementId: testCase.requirement_id || '',
      testFileId: testCase.test_file_id || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this test case?')) return;

    try {
      const response = await fetch(`${API_URL}/test-cases/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete test case');
      fetchTestCases();
    } catch (err) {
      alert('Error deleting test case: ' + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('Title is required');
      return;
    }

    // Serialize test steps to JSON
    const serializedSteps = JSON.stringify(formData.testSteps);

    const payload = {
      title: formData.title,
      description: formData.description,
      preconditions: formData.preconditions,
      testSteps: serializedSteps,
      expectedResult: '', // Keep for backward compatibility but not used
      type: formData.type,
      priority: formData.priority,
      status: formData.status,
      requirementId: formData.requirementId ? parseInt(formData.requirementId) : null,
      testFileId: formData.testFileId ? parseInt(formData.testFileId) : null
    };

    try {
      const url = editingTestCase
        ? `${API_URL}/test-cases/${editingTestCase.id}`
        : `${API_URL}/test-cases`;
      
      const response = await fetch(url, {
        method: editingTestCase ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to save test case');
      
      setShowModal(false);
      fetchTestCases();
    } catch (err) {
      alert('Error saving test case: ' + err.message);
    }
  };

  const addStep = () => {
    setFormData({
      ...formData,
      testSteps: [...formData.testSteps, { action: '', expected: '' }]
    });
  };

  const removeStep = (index) => {
    if (formData.testSteps.length <= 1) {
      alert('At least one step is required');
      return;
    }
    const newSteps = formData.testSteps.filter((_, i) => i !== index);
    setFormData({ ...formData, testSteps: newSteps });
  };

  const updateStep = (index, field, value) => {
    const newSteps = [...formData.testSteps];
    newSteps[index][field] = value;
    setFormData({ ...formData, testSteps: newSteps });
  };

  const getTypeBadgeColor = (type) => {
    return type === 'Manual' ? 'bg-blue-900 text-blue-200' : 'bg-purple-900 text-purple-200';
  };

  const getPriorityBadgeColor = (priority) => {
    const colors = {
      'Low': 'bg-slate-700 text-slate-200',
      'Medium': 'bg-yellow-900 text-yellow-200',
      'High': 'bg-red-900 text-red-200'
    };
    return colors[priority] || 'bg-slate-700 text-slate-200';
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      'Draft': 'bg-slate-700 text-slate-200',
      'Ready': 'bg-green-900 text-green-200',
      'Deprecated': 'bg-gray-700 text-gray-400'
    };
    return colors[status] || 'bg-slate-700 text-slate-200';
  };

  const getStepCount = (testSteps) => {
    if (!testSteps) return 0;
    try {
      const parsed = JSON.parse(testSteps);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch (e) {
      // If it's old format (plain text), count lines
      return testSteps.split('\n').filter(line => line.trim()).length;
    }
  };

  const handleViewDetails = async (testCase) => {
    setViewingTestCase(testCase);
    setExecutionHistoryPage(1); // Reset pagination when viewing test case
    await fetchExecutionHistory(testCase.id);
  };

  const handleCloseDetails = () => {
    setViewingTestCase(null);
    setExecutionHistory([]);
  };

  const fetchExecutionHistory = async (testCaseId) => {
    try {
      const response = await fetch(`${API_URL}/test-cases/${testCaseId}/manual-test-runs`);
      if (!response.ok) throw new Error('Failed to fetch execution history');
      const data = await response.json();
      setExecutionHistory(data);
    } catch (err) {
      console.error('Error fetching execution history:', err);
    }
  };

  const handleExecuteTest = () => {
    // Parse test steps and initialize execution state for each step
    try {
      const steps = JSON.parse(viewingTestCase.test_steps || '[]');
      const initialStepExecutions = steps.map((step, index) => ({
        stepNumber: index + 1,
        action: step.action,
        expected: step.expected,
        status: 'Passed',
        comments: '',
        screenshot: null,
        screenshotPreview: null
      }));
      setStepExecutions(initialStepExecutions);
    } catch (e) {
      // If parsing fails, create single step
      setStepExecutions([{
        stepNumber: 1,
        action: viewingTestCase.test_steps || '',
        expected: viewingTestCase.expected_result || '',
        status: 'Passed',
        comments: '',
        screenshot: null,
        screenshotPreview: null
      }]);
    }
    
    setExecutionFormData({
      executedBy: currentUser?.display_name || currentUser?.username || ''
    });
    setLinkedDefectIds([]);
    setShowNewDefectForm(false);
    setNewDefectForm({ title: '', description: '', severity: 'Medium', status: 'Open', linkedTestCaseId: '', sprintId: '', screenshotPreview: null, screenshotFile: null });
    setShowExecutionModal(true);
  };

  const handleStepStatusChange = (index, status) => {
    const updated = [...stepExecutions];
    updated[index].status = status;
    setStepExecutions(updated);
  };

  const handleStepCommentChange = (index, comments) => {
    const updated = [...stepExecutions];
    updated[index].comments = comments;
    setStepExecutions(updated);
  };

  const handleStepScreenshotChange = (index, file) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const updated = [...stepExecutions];
        updated[index].screenshot = file;
        updated[index].screenshotPreview = reader.result;
        setStepExecutions(updated);
      };
      reader.readAsDataURL(file);
    }
  };

  const captureStepScreenshot = async (index) => {
    try {
      // Request screen capture
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: 'screen' }
      });

      // Create video element to capture frame
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      // Wait for video to load
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });

      // Create canvas and capture frame
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      // Stop the stream
      stream.getTracks().forEach(track => track.stop());

      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          // Create file from blob
          const file = new File([blob], `screenshot-step-${index + 1}.png`, { type: 'image/png' });
          const reader = new FileReader();
          reader.onloadend = () => {
            const updated = [...stepExecutions];
            updated[index].screenshot = file;
            updated[index].screenshotPreview = reader.result;
            setStepExecutions(updated);
          };
          reader.readAsDataURL(file);
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      if (error.name !== 'NotAllowedError') {
        alert('Failed to capture screenshot. Please make sure you grant permission.');
      }
    }
  };

  const handleRemoveStepScreenshot = (index) => {
    const updated = [...stepExecutions];
    updated[index].screenshot = null;
    updated[index].screenshotPreview = null;
    setStepExecutions(updated);
  };

  const handleViewExecutionDetails = (execution) => {
    setViewingExecutionDetails(execution);
  };

  const openScreenshotInNewWindow = (screenshotUrl) => {
    const newWindow = window.open();
    newWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Screenshot</title>
          <style>
            body { margin: 0; padding: 20px; background: #1e293b; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            img { max-width: 100%; height: auto; border: 2px solid #475569; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          </style>
        </head>
        <body>
          <img src="${screenshotUrl}" alt="Screenshot" />
        </body>
      </html>
    `);
    newWindow.document.close();
  };

  const calculateOverallStatus = () => {
    // If any step failed, overall is Failed
    if (stepExecutions.some(step => step.status === 'Failed')) {
      return 'Failed';
    }
    // If any step blocked, overall is Blocked
    if (stepExecutions.some(step => step.status === 'Blocked')) {
      return 'Blocked';
    }
    // If all steps passed, overall is Passed
    if (stepExecutions.every(step => step.status === 'Passed')) {
      return 'Passed';
    }
    // Default to Blocked
    return 'Blocked';
  };

  const handleSubmitExecution = async (e) => {
    e.preventDefault();

    try {
      const overallStatus = calculateOverallStatus();
      
      // Prepare step results data with screenshot base64 data
      const stepResults = stepExecutions.map(step => ({
        stepNumber: step.stepNumber,
        action: step.action,
        expected: step.expected,
        status: step.status,
        comments: step.comments,
        hasScreenshot: !!step.screenshot,
        screenshotPreview: step.screenshotPreview || null
      }));

      const response = await fetch(`${API_URL}/manual-test-runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testCaseId: viewingTestCase.id,
          status: overallStatus,
          executedBy: executionFormData.executedBy,
          executionNotes: JSON.stringify(stepResults)
        })
      });

      if (!response.ok) throw new Error('Failed to save execution');
      const savedExecution = await response.json();

      // Link existing defects to this execution
      for (const defectId of linkedDefectIds) {
        const defect = allDefects.find(d => d.id === defectId);
        if (defect) {
          await fetch(`${API_URL}/defects/${defectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...defect,
              linkedTestCaseId: viewingTestCase.id,
              linkedExecutionId: savedExecution.id
            })
          });
        }
      }

      // Create new defect if form has a title
      if (showNewDefectForm && newDefectForm.title.trim()) {
        await fetch(`${API_URL}/defects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newDefectForm.title.trim(),
            description: newDefectForm.description,
            severity: newDefectForm.severity,
            status: newDefectForm.status || 'Open',
            linkedTestCaseId: newDefectForm.linkedTestCaseId ? parseInt(newDefectForm.linkedTestCaseId) : viewingTestCase.id,
            linkedExecutionId: savedExecution.id,
            sprintId: newDefectForm.sprintId ? parseInt(newDefectForm.sprintId) : null,
            screenshot: newDefectForm.screenshotPreview || null
          })
        });
        await fetchAllDefects();
      }

      setShowExecutionModal(false);
      await fetchExecutionHistory(viewingTestCase.id);
      const defectCount = linkedDefectIds.length + (showNewDefectForm && newDefectForm.title.trim() ? 1 : 0);
      alert(`Test execution completed with status: ${overallStatus}${defectCount > 0 ? `\n${defectCount} defect(s) linked.` : ''}`);
    } catch (err) {
      alert('Error saving execution: ' + err.message);
    }
  };

  const getExecutionStatusBadge = (status) => {
    const colors = {
      'Passed': 'bg-green-900 text-green-200',
      'Failed': 'bg-red-900 text-red-200',
      'Blocked': 'bg-orange-900 text-orange-200'
    };
    return colors[status] || 'bg-slate-700 text-slate-200';
  };

  // Group test cases by requirement
  const testCasesByRequirement = useMemo(() => {
    const grouped = {};
    requirements.forEach(req => {
      grouped[req.id] = testCases.filter(tc => tc.requirement_id === req.id);
    });
    return grouped;
  }, [testCases, requirements]);

  // Test cases not linked to any requirement
  const unassignedTestCases = useMemo(() => {
    const assignedIds = new Set(requirements.map(r => r.id));
    return testCases.filter(tc => !tc.requirement_id || !assignedIds.has(tc.requirement_id));
  }, [testCases, requirements]);

  const totalFilteredTestCases = useMemo(() => {
    const reqCount = requirements.reduce((total, req) => {
      const reqTCs = testCasesByRequirement[req.id] || [];
      return total + reqTCs.filter(tc => {
        const matchesSearch = !searchQuery ||
          tc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tc.description?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSprint = !sprintFilter || req.sprint_id === parseInt(sprintFilter);
        const matchesPriority = !priorityFilter || tc.priority === priorityFilter;
        const matchesStatus = !statusFilter || tc.status === statusFilter;
        return matchesSearch && matchesSprint && matchesPriority && matchesStatus;
      }).length;
    }, 0);
    const unassignedCount = unassignedTestCases.filter(tc => {
      const matchesSearch = !searchQuery ||
        tc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tc.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPriority = !priorityFilter || tc.priority === priorityFilter;
      const matchesStatus = !statusFilter || tc.status === statusFilter;
      return matchesSearch && matchesPriority && matchesStatus;
    }).length;
    return reqCount + unassignedCount;
  }, [requirements, testCasesByRequirement, unassignedTestCases, searchQuery, sprintFilter, priorityFilter, statusFilter]);

  // Latest run per test case (for Execution Status tab)
  const latestRunByTestCase = useMemo(() => {
    const map = new Map();
    // allRuns is already sorted by created_at DESC from the server
    [...allRuns].reverse().forEach(run => {
      map.set(run.test_case_id, run);
    });
    return map;
  }, [allRuns]);

  // Flat view: all test cases with filters applied (no requirement grouping)
  const filteredFlatTestCases = useMemo(() => {
    return testCases.filter(tc => {
      const req = requirements.find(r => r.id === tc.requirement_id);
      const matchesSearch = !searchQuery ||
        tc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tc.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSprint = !sprintFilter || (req && req.sprint_id === parseInt(sprintFilter));
      const matchesPriority = !priorityFilter || tc.priority === priorityFilter;
      const matchesStatus = !statusFilter || tc.status === statusFilter;
      return matchesSearch && matchesSprint && matchesPriority && matchesStatus;
    });
  }, [testCases, requirements, searchQuery, sprintFilter, priorityFilter, statusFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading test cases...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Page-level tab switcher */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">Test Cases</h1>
          <div className="flex items-center rounded-lg border border-slate-600 overflow-hidden">
            <button
              onClick={() => setPageTab('testcases')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                pageTab === 'testcases' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >Test Cases</button>
            <button
              onClick={() => { setPageTab('executions'); fetchAllRuns(); }}
              className={`px-4 py-2 text-sm font-medium transition-colors border-l border-slate-600 ${
                pageTab === 'executions' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >Execution Status</button>
          </div>
        </div>
      </div>

      {/* ── Execution Status Tab ── */}
      {pageTab === 'executions' && (() => {
        const statusOrder = ['Passed', 'Failed', 'Blocked'];
        const statusColors = {
          'Passed': 'bg-green-900 text-green-200',
          'Failed': 'bg-red-900 text-red-200',
          'Blocked': 'bg-orange-900 text-orange-200',
          'Never Run': 'bg-slate-700 text-slate-300',
        };
        const getExecStatus = (tc) => latestRunByTestCase.get(tc.id)?.status || 'Never Run';
        const matchesSprint = (tc) => {
          if (!execSprintFilter) return true;
          const req = requirements.find(r => r.id === tc.requirement_id);
          return req?.sprint_id === parseInt(execSprintFilter);
        };
        const displayed = testCases.filter(tc =>
          matchesSprint(tc) &&
          (!execStatusFilter ||
          (execStatusFilter === 'Never Run' ? !latestRunByTestCase.has(tc.id) : latestRunByTestCase.get(tc.id)?.status === execStatusFilter))
        );
        const sprintFiltered = testCases.filter(matchesSprint);
        const counts = {
          Passed: sprintFiltered.filter(tc => latestRunByTestCase.get(tc.id)?.status === 'Passed').length,
          Failed: sprintFiltered.filter(tc => latestRunByTestCase.get(tc.id)?.status === 'Failed').length,
          Blocked: sprintFiltered.filter(tc => latestRunByTestCase.get(tc.id)?.status === 'Blocked').length,
          'Never Run': sprintFiltered.filter(tc => !latestRunByTestCase.has(tc.id)).length,
        };
        const exportToExcel = () => {
          const sprintLabel = execSprintFilter
            ? sprints.find(s => s.id === parseInt(execSprintFilter))?.name || 'Sprint'
            : 'All Sprints';
          const rows = displayed.map(tc => {
            const run = latestRunByTestCase.get(tc.id);
            const req = requirements.find(r => r.id === tc.requirement_id);
            const sprint = req ? sprints.find(s => s.id === req.sprint_id) : null;
            return {
              'ID': tc.id,
              'Title': tc.title,
              'Description': tc.description || '',
              'Requirement': req?.title || '',
              'Sprint': sprint?.name || '',
              'Priority': tc.priority || '',
              'Latest Status': run?.status || 'Never Run',
              'Executed By': run?.executed_by || '',
              'Run Date': run?.created_at ? new Date(run.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '',
            };
          });
          const ws = XLSX.utils.json_to_sheet(rows);
          ws['!cols'] = [8, 40, 50, 30, 20, 12, 16, 20, 16].map(w => ({ wch: w }));
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Execution Status');
          const filename = `execution-status_${sprintLabel.replace(/\s+/g, '-')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
          XLSX.writeFile(wb, filename);
        };
        return (
          <div className="space-y-4">
            {/* Sprint + status filter bar */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-400 whitespace-nowrap">Sprint:</label>
                <select
                  value={execSprintFilter}
                  onChange={e => setExecSprintFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">All Sprints</option>
                  {sprints.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              {(execSprintFilter || execStatusFilter) && (
                <button
                  onClick={() => { setExecSprintFilter(''); setExecStatusFilter(''); }}
                  className="text-xs text-slate-500 hover:text-white transition-colors"
                >✕ Clear all filters</button>
              )}
              <div className="ml-auto">
                <button
                  onClick={exportToExcel}
                  disabled={displayed.length === 0}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export to Excel
                </button>
              </div>
            </div>
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-4">
              {[...statusOrder, 'Never Run'].map(s => (
                <button
                  key={s}
                  onClick={() => setExecStatusFilter(execStatusFilter === s ? '' : s)}
                  className={`rounded-lg p-4 border text-left transition-all ${
                    execStatusFilter === s ? 'ring-2 ring-indigo-500' : ''
                  } ${
                    s === 'Passed' ? 'bg-green-900/20 border-green-700/30' :
                    s === 'Failed' ? 'bg-red-900/20 border-red-700/30' :
                    s === 'Blocked' ? 'bg-orange-900/20 border-orange-700/30' :
                    'bg-slate-800 border-slate-700'
                  }`}
                >
                  <p className="text-sm text-slate-400">{s}</p>
                  <p className={`text-3xl font-bold mt-1 ${
                    s === 'Passed' ? 'text-green-400' :
                    s === 'Failed' ? 'text-red-400' :
                    s === 'Blocked' ? 'text-orange-400' :
                    'text-slate-300'
                  }`}>{counts[s]}</p>
                </button>
              ))}
            </div>

            {/* Filter indicator */}
            {(execStatusFilter || execSprintFilter) && (
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="text-slate-400">Showing:</span>
                {execSprintFilter && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-900/40 border border-indigo-700/40 text-indigo-300">
                    {sprints.find(s => s.id === parseInt(execSprintFilter))?.name || 'Sprint'}
                    <button onClick={() => setExecSprintFilter('')} className="ml-1 text-indigo-400 hover:text-white"> ✕</button>
                  </span>
                )}
                {execStatusFilter && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[execStatusFilter]}`}>
                    {execStatusFilter}
                    <button onClick={() => setExecStatusFilter('')} className="ml-1 opacity-70 hover:opacity-100"> ✕</button>
                  </span>
                )}
                <span className="text-slate-500 text-xs">({displayed.length} test case{displayed.length !== 1 ? 's' : ''})</span>
              </div>
            )}

            {/* Table */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              {displayed.length === 0 ? (
                <div className="p-12 text-center text-slate-500">No test cases match the selected filter.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-900 border-b border-slate-700">
                      <tr>
                        {['ID', 'Title', 'Requirement', 'Priority', 'Latest Status', 'Executed By', 'Run Date'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {displayed.map(tc => {
                        const run = latestRunByTestCase.get(tc.id);
                        const req = requirements.find(r => r.id === tc.requirement_id);
                        const status = run?.status || 'Never Run';
                        return (
                          <tr key={tc.id} className="hover:bg-slate-700/40 transition-colors cursor-pointer" onClick={() => handleViewDetails(tc)}>
                            <td className="px-4 py-3">
                              <span className="text-xs font-mono px-2 py-1 rounded bg-slate-900 text-slate-400">#{tc.id}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-white">{tc.title}</div>
                              {tc.description && <div className="text-xs text-slate-400 truncate max-w-xs mt-0.5">{tc.description}</div>}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-300">
                              {req?.title || <span className="text-slate-500">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getPriorityBadgeColor(tc.priority)}`}>{tc.priority}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${statusColors[status]}`}>{status}</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-300">{run?.executed_by || <span className="text-slate-500">—</span>}</td>
                            <td className="px-4 py-3 text-sm text-slate-400">
                              {run?.created_at ? new Date(run.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : <span className="text-slate-600">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Test Cases Tab ── */}
      <div className={pageTab !== 'testcases' ? 'hidden' : ''}>
      <div className="flex justify-between items-center mb-6">
        <div /> {/* spacer — title already in top bar */}
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center rounded-lg border border-slate-600 overflow-hidden">
            <button
              onClick={() => setViewMode('grouped')}
              title="Grouped view — test cases nested under requirements"
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                viewMode === 'grouped'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h8M4 18h8" />
              </svg>
              Grouped
            </button>
            <button
              onClick={() => setViewMode('flat')}
              title="Flat view — all test cases in a single table"
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l border-slate-600 ${
                viewMode === 'flat'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 6h18M3 18h18" />
              </svg>
              Flat
            </button>
          </div>
          {viewMode === 'grouped' && (
            <>
              <button
                onClick={expandAll}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg font-medium transition-colors border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700"
                title="Expand all requirements"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg font-medium transition-colors border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700"
                title="Collapse all requirements"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
                </svg>
                Collapse All
              </button>
            </>
          )}
          <button
            onClick={() => handleCreateNew()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            + New Test Case
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title or description..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Sprint</label>
            <select
              value={sprintFilter}
              onChange={(e) => setSprintFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Sprints</option>
              {sprints.map(sprint => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Ready">Ready</option>
              <option value="Deprecated">Deprecated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Result count */}
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-400">
        <span>
          Showing{' '}
          <span className="font-semibold text-white">
            {viewMode === 'flat' ? filteredFlatTestCases.length : totalFilteredTestCases}
          </span>
          {' '}of{' '}
          <span className="font-semibold text-white">{testCases.length}</span>
          {' '}test case{testCases.length !== 1 ? 's' : ''}
        </span>
        {(searchQuery || sprintFilter || priorityFilter || statusFilter) && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Filtered</span>
        )}
      </div>

      {viewMode === 'flat' ? (
        /* ── Flat View ── */
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          {filteredFlatTestCases.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-lg font-medium text-slate-300">No test cases match the current filters</p>
              <p className="text-sm mt-1">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900 border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Priority</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Steps</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Created By</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredFlatTestCases.map(tc => (
                    <tr key={tc.id} className="hover:bg-slate-700/40 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono px-2 py-1 rounded bg-slate-900 text-slate-400">#{tc.id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-white">{tc.title}</div>
                        {tc.description && (
                          <div className="text-xs text-slate-400 truncate max-w-xs mt-0.5">{tc.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getTypeBadgeColor(tc.type)}`}>{tc.type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getPriorityBadgeColor(tc.priority)}`}>{tc.priority}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(tc.status)}`}>{tc.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-indigo-400">{getStepCount(tc.test_steps)} steps</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {tc.created_by || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleViewDetails(tc)}
                            className="p-2 rounded-lg hover:bg-blue-500/10 text-blue-400 transition-colors"
                            title="View"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleEdit(tc)}
                            className="p-2 rounded-lg hover:bg-indigo-500/10 text-indigo-400 transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(tc.id)}
                            className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
      /* ── Grouped View (existing) ── */
      <div className="space-y-4">
        {requirements.length === 0 ? (
          <div className="bg-slate-800 rounded-lg p-12 text-center">
            <div className="flex flex-col items-center gap-2">
              <svg className="w-12 h-12 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium text-slate-300">No requirements found</p>
              <p className="text-sm text-slate-400">
                Create requirements first to organize your test cases
              </p>
            </div>
          </div>
        ) : totalFilteredTestCases === 0 && (searchQuery || sprintFilter || priorityFilter || statusFilter) ? (
          <div className="bg-slate-800 rounded-lg p-12 text-center">
            <div className="flex flex-col items-center gap-2">
              <svg className="w-12 h-12 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-lg font-medium text-slate-300">No test cases match the current filters</p>
              <p className="text-sm text-slate-400">Try adjusting your search or filter criteria</p>
            </div>
          </div>
        ) : (
          requirements.map(requirement => {
            const requirementTestCases = testCasesByRequirement[requirement.id] || [];
            const filteredTestCases = requirementTestCases.filter(tc => {
              const matchesSearch = !searchQuery || 
                tc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                tc.description?.toLowerCase().includes(searchQuery.toLowerCase());
              const matchesSprint = !sprintFilter || requirement.sprint_id === parseInt(sprintFilter);
              const matchesPriority = !priorityFilter || tc.priority === priorityFilter;
              const matchesStatus = !statusFilter || tc.status === statusFilter;
              return matchesSearch && matchesSprint && matchesPriority && matchesStatus;
            });

            // Hide requirement group entirely when filters are active and nothing matches
            const isFiltering = !!(searchQuery || sprintFilter || priorityFilter || statusFilter);
            if (isFiltering && filteredTestCases.length === 0) return null;

            const isExpanded = expandedRequirements[requirement.id];

            return (
              <div key={requirement.id} className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
                {/* Requirement Header */}
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-750 transition-colors bg-slate-850"
                  onClick={() => toggleRequirement(requirement.id)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <button 
                      className="p-1 rounded transition-transform duration-200 text-slate-400" 
                      style={{ 
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                      }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-white">
                          {requirement.title}
                        </h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getPriorityBadgeColor(requirement.priority)}`}>
                          {requirement.priority}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-900 text-blue-200">
                          {requirementTestCases.length} {requirementTestCases.length === 1 ? 'Test Case' : 'Test Cases'}
                        </span>
                      </div>
                      {requirement.description && (
                        <p className="text-sm mt-1 text-slate-400">
                          {requirement.description.length > 120 ? requirement.description.slice(0, 120) + '…' : requirement.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateNew(requirement.id);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Test Case
                  </button>
                </div>

                {/* Test Cases List */}
                {isExpanded && (
                  <div className="border-t border-slate-700">
                    {filteredTestCases.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">
                        <p className="text-sm">
                          {requirementTestCases.length === 0 
                            ? 'No test cases yet. Click "Add Test Case" to create one.'
                            : 'No test cases match the current filters.'}
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-700/50 ml-8 border-l-2 border-slate-600/40">
                        {filteredTestCases.map((testCase, index) => (
                          <div
                            key={testCase.id}
                            className="p-4 pl-6 hover:bg-slate-750 transition-colors"
                            style={{
                              backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(var(--slate-850), 0.3)'
                            }}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-mono px-2 py-1 rounded bg-slate-900 text-slate-400">
                                    #{testCase.id}
                                  </span>
                                  <h4 className="font-medium text-white">
                                    {testCase.title}
                                  </h4>
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getTypeBadgeColor(testCase.type)}`}>
                                    {testCase.type}
                                  </span>
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getPriorityBadgeColor(testCase.priority)}`}>
                                    {testCase.priority}
                                  </span>
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(testCase.status)}`}>
                                    {testCase.status}
                                  </span>
                                  <span className="text-indigo-400 text-xs">
                                    {getStepCount(testCase.test_steps)} steps
                                  </span>
                                </div>
                                {testCase.description && (
                                  <p className="text-sm mt-2 text-slate-400">
                                    {testCase.description.length > 120 ? testCase.description.slice(0, 120) + '…' : testCase.description}
                                  </p>
                                )}
                                {testCase.sprint_name && (
                                  <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span>Sprint: <span className="text-indigo-400">{testCase.sprint_name}</span> ({testCase.sprint_status})</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleViewDetails(testCase)}
                                  className="p-2 rounded-lg transition-colors duration-200 hover:bg-blue-500/10 text-blue-400"
                                  title="View test case"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleEdit(testCase)}
                                  className="p-2 rounded-lg transition-colors duration-200 hover:bg-indigo-500/10 text-indigo-400"
                                  title="Edit test case"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDelete(testCase.id)}
                                  className="p-2 rounded-lg transition-colors duration-200 hover:bg-red-500/10 text-red-400"
                                  title="Delete test case"
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
        {/* ── Unassigned Test Cases Group ── */}
        {(() => {
          const filteredUnassigned = unassignedTestCases.filter(tc => {
            const matchesSearch = !searchQuery ||
              tc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              tc.description?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesPriority = !priorityFilter || tc.priority === priorityFilter;
            const matchesStatus = !statusFilter || tc.status === statusFilter;
            return matchesSearch && matchesPriority && matchesStatus;
          });
          const isFiltering = !!(searchQuery || priorityFilter || statusFilter);
          if (filteredUnassigned.length === 0 && (isFiltering || unassignedTestCases.length === 0)) return null;
          const isExpanded = expandedRequirements['__unassigned__'] !== false;
          return (
            <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-600 border-dashed">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-750 transition-colors"
                onClick={() => setExpandedRequirements(prev => ({ ...prev, '__unassigned__': !isExpanded }))}
              >
                <div className="flex items-center gap-4 flex-1">
                  <button className="p-1 rounded transition-transform duration-200 text-slate-400" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-400">Unassigned</h3>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">
                        {unassignedTestCases.length} {unassignedTestCases.length === 1 ? 'Test Case' : 'Test Cases'}
                      </span>
                    </div>
                    <p className="text-sm mt-1 text-slate-500">Test cases not linked to any requirement</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCreateNew(); }}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add
                </button>
              </div>
              {isExpanded && (
                <div className="border-t border-slate-700">
                  {filteredUnassigned.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">No test cases match the current filters</div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-slate-900 border-b border-slate-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">ID</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Title</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Priority</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Steps</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Created By</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {filteredUnassigned.map(tc => (
                          <tr key={tc.id} className="hover:bg-slate-700/40 transition-colors">
                            <td className="px-4 py-3"><span className="text-xs font-mono px-2 py-1 rounded bg-slate-900 text-slate-400">#{tc.id}</span></td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-white">{tc.title}</div>
                              {tc.description && <div className="text-xs text-slate-400 truncate max-w-xs mt-0.5">{tc.description}</div>}
                            </td>
                            <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getTypeBadgeColor(tc.type)}`}>{tc.type}</span></td>
                            <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getPriorityBadgeColor(tc.priority)}`}>{tc.priority}</span></td>
                            <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(tc.status)}`}>{tc.status}</span></td>
                            <td className="px-4 py-3"><span className="text-xs text-indigo-400">{getStepCount(tc.test_steps)} steps</span></td>
                            <td className="px-4 py-3 text-sm text-slate-400">{tc.created_by || '—'}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleViewDetails(tc)} className="p-2 rounded-lg hover:bg-blue-500/10 text-blue-400 transition-colors" title="View">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                </button>
                                <button onClick={() => handleEdit(tc)} className="p-2 rounded-lg hover:bg-indigo-500/10 text-indigo-400 transition-colors" title="Edit">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button onClick={() => handleDelete(tc.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors" title="Delete">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>
      )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                {editingTestCase ? 'Edit Test Case' : 'Create Test Case'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    rows="3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Preconditions</label>
                  <textarea
                    value={formData.preconditions}
                    onChange={(e) => setFormData({ ...formData, preconditions: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    rows="2"
                  />
                </div>

                {/* Test Steps Section - Azure DevOps Style */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm font-medium text-slate-300">
                      Test Steps
                    </label>
                    <button
                      type="button"
                      onClick={addStep}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded transition-colors"
                    >
                      + Add Step
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {/* Header Row */}
                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-400 uppercase px-2">
                      <div className="col-span-1">#</div>
                      <div className="col-span-5">Action</div>
                      <div className="col-span-5">Expected Result</div>
                      <div className="col-span-1"></div>
                    </div>
                    
                    {/* Steps */}
                    {formData.testSteps.map((step, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-start">
                        <div className="col-span-1 pt-2">
                          <span className="text-slate-400 font-medium">{index + 1}</span>
                        </div>
                        <div className="col-span-5">
                          <textarea
                            value={step.action}
                            onChange={(e) => updateStep(index, 'action', e.target.value)}
                            placeholder="Describe the action to perform..."
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
                            rows="2"
                          />
                        </div>
                        <div className="col-span-5">
                          <textarea
                            value={step.expected}
                            onChange={(e) => updateStep(index, 'expected', e.target.value)}
                            placeholder="Expected outcome of this step..."
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
                            rows="2"
                          />
                        </div>
                        <div className="col-span-1 pt-2">
                          <button
                            type="button"
                            onClick={() => removeStep(index)}
                            className="text-red-400 hover:text-red-300 text-sm"
                            title="Remove step"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Manual">Manual</option>
                      <option value="Automated">Automated</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Ready">Ready</option>
                      <option value="Deprecated">Deprecated</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Requirement (Optional)
                    </label>
                    <select
                      value={formData.requirementId}
                      onChange={(e) => setFormData({ ...formData, requirementId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">No Requirement</option>
                      {requirements.map(req => (
                        <option key={req.id} value={req.id}>{req.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {formData.type === 'Manual' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Linked Test File <span className="text-slate-500 font-normal">(Optional)</span>
                    </label>
                    <select
                      value={formData.testFileId}
                      onChange={(e) => setFormData({ ...formData, testFileId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">No Test File</option>
                      {allTestFiles.map(tf => (
                        <option key={tf.id} value={tf.id}>[{tf.module_name}] {tf.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">Associate this manual test with an automation test file for cross-reference.</p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                  >
                    {editingTestCase ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Test Case Detail View Modal */}
      {viewingTestCase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">{viewingTestCase.title}</h2>
                  <div className="flex gap-2 mt-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeBadgeColor(viewingTestCase.type)}`}>
                      {viewingTestCase.type}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityBadgeColor(viewingTestCase.priority)}`}>
                      {viewingTestCase.priority}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(viewingTestCase.status)}`}>
                      {viewingTestCase.status}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleCloseDetails}
                  className="text-slate-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Test Case Details */}
              <div className="space-y-4 mb-6">
                {viewingTestCase.description && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-300 mb-2">Description</h3>
                    <p className="text-white">{viewingTestCase.description}</p>
                  </div>
                )}

                {viewingTestCase.preconditions && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-300 mb-2">Preconditions</h3>
                    <p className="text-white">{viewingTestCase.preconditions}</p>
                  </div>
                )}

                {viewingTestCase.requirement_title && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-300 mb-2">Requirement</h3>
                    <p className="text-white">{viewingTestCase.requirement_title}</p>
                  </div>
                )}

                {viewingTestCase.test_file_name && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-300 mb-2">Linked Test File</h3>
                    <div
                      className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('navigateToTestFile', {
                          detail: { moduleId: viewingTestCase.test_file_module_id, testFileId: viewingTestCase.test_file_id }
                        }));
                      }}
                    >
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm">{viewingTestCase.test_file_name}</span>
                      {viewingTestCase.test_file_module_name && (
                        <span className="text-xs text-slate-400">({viewingTestCase.test_file_module_name})</span>
                      )}
                    </div>
                  </div>
                )}

                {viewingTestCase.sprint_name && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-300 mb-2">Sprint (via Requirement)</h3>
                    <div 
                      className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors"
                      onClick={() => {
                        const event = new CustomEvent('navigateToSprint', { 
                          detail: { sprintId: viewingTestCase.sprint_id } 
                        });
                        window.dispatchEvent(event);
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{viewingTestCase.sprint_name}</span>
                      <span className="text-xs text-slate-400">({viewingTestCase.sprint_status})</span>
                    </div>
                  </div>
                )}

                {/* Test Steps */}
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Test Steps</h3>
                  {(() => {
                    try {
                      const steps = JSON.parse(viewingTestCase.test_steps || '[]');
                      return (
                        <div className="space-y-3">
                          {steps.map((step, index) => (
                            <div key={index} className="bg-slate-900 rounded-lg p-4">
                              <div className="flex gap-4">
                                <div className="flex-shrink-0">
                                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white font-medium">
                                    {index + 1}
                                  </span>
                                </div>
                                <div className="flex-1 grid grid-cols-2 gap-4">
                                  <div>
                                    <div className="text-xs text-slate-400 uppercase mb-1">Action</div>
                                    <div className="text-white">{step.action}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-slate-400 uppercase mb-1">Expected Result</div>
                                    <div className="text-white">{step.expected}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    } catch (e) {
                      return <p className="text-white whitespace-pre-wrap">{viewingTestCase.test_steps}</p>;
                    }
                  })()}
                </div>
              </div>

              {/* Execute Test Button (Manual only) */}
              {viewingTestCase.type === 'Manual' && (
                <div className="mb-6">
                  <button
                    onClick={handleExecuteTest}
                    className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Execute Test
                  </button>
                </div>
              )}

              {/* Execution History */}
              {viewingTestCase.type === 'Manual' && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Execution History</h3>
                  {executionHistory.length === 0 ? (
                    <div className="text-center py-8 bg-slate-900 rounded-lg">
                      <p className="text-slate-400">No execution history yet</p>
                    </div>
                  ) : (
                    <div>
                      <div className="space-y-3 mb-4">
                        {(() => {
                          const startIndex = (executionHistoryPage - 1) * executionHistoryPerPage;
                          const endIndex = startIndex + executionHistoryPerPage;
                          const paginatedExecutions = executionHistory.slice(startIndex, endIndex);
                          
                          return paginatedExecutions.map((execution) => (
                            <div key={execution.id} className="bg-slate-900 rounded-lg p-4 flex items-center justify-between hover:bg-slate-850 transition-colors">
                              <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 text-xs font-medium rounded-full ${getExecutionStatusBadge(execution.status)}`}>
                                  {execution.status}
                                </span>
                                <span className="text-sm text-slate-300">
                                  {new Date(execution.created_at).toLocaleString()}
                                </span>
                                {execution.executed_by && (
                                  <span className="text-sm text-slate-400">
                                    by {execution.executed_by}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleViewExecutionDetails(execution)}
                                className="p-2 rounded-lg transition-colors duration-200 hover:bg-indigo-500/10 text-indigo-400"
                                title="View execution details"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                            </div>
                          ));
                        })()}
                      </div>
                      
                      {/* Pagination */}
                      {executionHistory.length > executionHistoryPerPage && (
                        <div className="flex items-center justify-between bg-slate-900 rounded-lg p-3">
                          <div className="text-sm text-slate-400">
                            Showing {((executionHistoryPage - 1) * executionHistoryPerPage) + 1} to {Math.min(executionHistoryPage * executionHistoryPerPage, executionHistory.length)} of {executionHistory.length} executions
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setExecutionHistoryPage(prev => Math.max(1, prev - 1))}
                              disabled={executionHistoryPage === 1}
                              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm rounded transition-colors disabled:cursor-not-allowed"
                            >
                              Previous
                            </button>
                            <div className="flex items-center gap-1">
                              {(() => {
                                const totalPages = Math.ceil(executionHistory.length / executionHistoryPerPage);
                                const pages = [];
                                for (let i = 1; i <= totalPages; i++) {
                                  pages.push(
                                    <button
                                      key={i}
                                      onClick={() => setExecutionHistoryPage(i)}
                                      className={`px-3 py-1 text-sm rounded transition-colors ${
                                        executionHistoryPage === i
                                          ? 'bg-indigo-600 text-white'
                                          : 'bg-slate-700 hover:bg-slate-600 text-white'
                                      }`}
                                    >
                                      {i}
                                    </button>
                                  );
                                }
                                return pages;
                              })()}
                            </div>
                            <button
                              onClick={() => setExecutionHistoryPage(prev => Math.min(Math.ceil(executionHistory.length / executionHistoryPerPage), prev + 1))}
                              disabled={executionHistoryPage >= Math.ceil(executionHistory.length / executionHistoryPerPage)}
                              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm rounded transition-colors disabled:cursor-not-allowed"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Execute Test Modal */}
      {showExecutionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Execute Test: {viewingTestCase?.title}</h2>
              <button
                type="button"
                onClick={() => setShowExecutionModal(false)}
                className="text-slate-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 p-4">
              <form id="execution-form" onSubmit={handleSubmitExecution} className="space-y-4">
                {/* Executed By Field */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Executed By
                  </label>
                  <input
                    type="text"
                    value={executionFormData.executedBy}
                    readOnly
                    className="w-full px-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-slate-300 text-sm cursor-not-allowed select-none"
                    placeholder="Your name"
                  />
                </div>

                {/* Step-by-Step Execution */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">Test Steps</h3>
                  <div className="space-y-2">
                    {stepExecutions.map((step, index) => (
                      <div key={index} className="border border-slate-700 rounded-lg p-3 bg-slate-900">
                        <div className="grid grid-cols-12 gap-3 mb-2">
                          <div className="col-span-1 flex items-start justify-center pt-1">
                            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
                              {step.stepNumber}
                            </div>
                          </div>
                          <div className="col-span-5">
                            <div className="text-xs font-medium text-slate-400 mb-0.5">ACTION</div>
                            <div className="text-white text-xs">{step.action}</div>
                          </div>
                          <div className="col-span-6">
                            <div className="text-xs font-medium text-slate-400 mb-0.5">EXPECTED RESULT</div>
                            <div className="text-white text-xs">{step.expected}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-12 gap-2 mt-2 pt-2 border-t border-slate-700">
                          <div className="col-span-1"></div>
                          <div className="col-span-11 grid grid-cols-12 gap-2">
                            {/* Status */}
                            <div className="col-span-3">
                              <label className="block text-xs font-medium text-slate-400 mb-1">
                                Status <span className="text-red-400">*</span>
                              </label>
                              <select
                                value={step.status}
                                onChange={(e) => handleStepStatusChange(index, e.target.value)}
                                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-indigo-500"
                                required
                              >
                                <option value="Passed">✓ Passed</option>
                                <option value="Failed">✗ Failed</option>
                                <option value="Blocked">⊘ Blocked</option>
                              </select>
                            </div>

                            {/* Comments */}
                            <div className="col-span-5">
                              <label className="block text-xs font-medium text-slate-400 mb-1">
                                Comments
                              </label>
                              <input
                                type="text"
                                value={step.comments}
                                onChange={(e) => handleStepCommentChange(index, e.target.value)}
                                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-indigo-500"
                                placeholder="Add comments..."
                              />
                            </div>

                            {/* Screenshot Capture */}
                            <div className="col-span-4">
                              <label className="block text-xs font-medium text-slate-400 mb-1">
                                Screenshot
                              </label>
                              {!step.screenshotPreview ? (
                                <button
                                  type="button"
                                  onClick={() => captureStepScreenshot(index)}
                                  className="w-full px-3 py-2 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
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
                                      src={step.screenshotPreview} 
                                      alt={`Step ${step.stepNumber}`}
                                      className="max-w-[200px] max-h-[120px] rounded border border-slate-600 object-cover"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveStepScreenshot(index)}
                                      className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-lg"
                                      title="Remove screenshot"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => captureStepScreenshot(index)}
                                    className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded hover:bg-slate-600 transition-colors"
                                  >
                                    Recapture
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Linked Defects */}
                <div className="border border-slate-700 rounded-lg p-4 bg-slate-900">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Linked Defects
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowNewDefectForm(v => !v)}
                      className="text-xs px-3 py-1 rounded-lg bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30 transition-colors"
                    >
                      {showNewDefectForm ? 'Cancel New Defect' : '+ Create New Defect'}
                    </button>
                  </div>

                  {/* Select existing defects */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-slate-400 mb-1">Link Existing Defects</label>
                    <select
                      multiple
                      value={linkedDefectIds.map(String)}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, o => parseInt(o.value));
                        setLinkedDefectIds(selected);
                      }}
                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-indigo-500 min-h-[72px]"
                    >
                      {allDefects.length === 0
                        ? null
                        : allDefects.map(d => (
                            <option key={d.id} value={d.id}>
                              #{d.id} [{d.severity}] {d.title}
                            </option>
                          ))}
                    </select>
                    {allDefects.length === 0 && (
                      <p className="text-xs text-slate-500 mt-1">No existing defects found.</p>
                    )}
                    {linkedDefectIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {linkedDefectIds.map(id => {
                          const d = allDefects.find(x => x.id === id);
                          return d ? (
                            <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-600/20 border border-red-600/30 text-red-300 text-xs rounded-full">
                              #{d.id} {d.title}
                              <button type="button" onClick={() => setLinkedDefectIds(ids => ids.filter(i => i !== id))} className="hover:text-white">✕</button>
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>

                  {/* New defect inline form */}
                  {showNewDefectForm && (
                    <div className="border border-red-600/30 rounded-lg p-4 bg-red-600/5 space-y-3">
                      <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">New Defect</p>

                      {/* Title */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Title <span className="text-red-400">*</span></label>
                        <input
                          type="text"
                          value={newDefectForm.title}
                          onChange={(e) => setNewDefectForm(f => ({ ...f, title: e.target.value }))}
                          placeholder="Defect title"
                          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-red-500"
                        />
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                        <textarea
                          value={newDefectForm.description}
                          onChange={(e) => setNewDefectForm(f => ({ ...f, description: e.target.value }))}
                          placeholder="Enter defect description"
                          rows={2}
                          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-red-500 resize-none"
                        />
                      </div>

                      {/* Severity + Status */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Severity <span className="text-red-400">*</span></label>
                          <select
                            value={newDefectForm.severity}
                            onChange={(e) => setNewDefectForm(f => ({ ...f, severity: e.target.value }))}
                            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-red-500"
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Critical">Critical</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Status <span className="text-red-400">*</span></label>
                          <select
                            value={newDefectForm.status}
                            onChange={(e) => setNewDefectForm(f => ({ ...f, status: e.target.value }))}
                            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-red-500"
                          >
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Resolved">Resolved</option>
                            <option value="Closed">Closed</option>
                          </select>
                        </div>
                      </div>

                      {/* Link Test Case */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Link Test Case (Optional)</label>
                        <select
                          value={newDefectForm.linkedTestCaseId || (viewingTestCase?.id ? String(viewingTestCase.id) : '')}
                          onChange={(e) => setNewDefectForm(f => ({ ...f, linkedTestCaseId: e.target.value }))}
                          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-red-500"
                        >
                          <option value="">-- None --</option>
                          {testCases.map(tc => (
                            <option key={tc.id} value={tc.id}>{tc.title}</option>
                          ))}
                        </select>
                      </div>

                      {/* Assign to Sprint */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Assign to Sprint (Optional)</label>
                        <select
                          value={newDefectForm.sprintId}
                          onChange={(e) => setNewDefectForm(f => ({ ...f, sprintId: e.target.value }))}
                          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-red-500"
                        >
                          <option value="">-- No Sprint --</option>
                          {sprints.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                          ))}
                        </select>
                      </div>

                      {/* Screenshot */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Screenshot</label>
                        {!newDefectForm.screenshotPreview ? (
                          <button
                            type="button"
                            onClick={async () => {
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
                                    reader.onloadend = () => setNewDefectForm(f => ({ ...f, screenshotPreview: reader.result }));
                                    reader.readAsDataURL(blob);
                                  }
                                }, 'image/png');
                              } catch (err) {
                                if (err.name !== 'NotAllowedError') alert('Failed to capture screenshot.');
                              }
                            }}
                            className="w-full px-3 py-2 bg-slate-700 text-white text-xs rounded hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
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
                                src={newDefectForm.screenshotPreview}
                                alt="Defect screenshot"
                                className="max-w-[200px] max-h-[120px] rounded border border-slate-600 object-cover cursor-pointer"
                                onClick={() => openScreenshotInNewWindow(newDefectForm.screenshotPreview)}
                              />
                              <button
                                type="button"
                                onClick={() => setNewDefectForm(f => ({ ...f, screenshotPreview: null }))}
                                className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-lg"
                                title="Remove screenshot"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </div>

            {/* Action Buttons - Fixed Footer */}
            <div className="p-4 border-t border-slate-700 bg-slate-800 flex justify-between items-center">
              <div className="text-xs text-slate-400">
                Overall Status: <span className={`font-semibold ${
                  calculateOverallStatus() === 'Passed' ? 'text-green-400' :
                  calculateOverallStatus() === 'Failed' ? 'text-red-400' :
                  'text-yellow-400'
                }`}>
                  {calculateOverallStatus()}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowExecutionModal(false)}
                  className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="execution-form"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm transition-colors"
                >
                  Save Execution
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Execution Details Modal */}
      {viewingExecutionDetails && (() => {
        let stepResults = [];
        try {
          stepResults = JSON.parse(viewingExecutionDetails.execution_notes || '[]');
        } catch (e) {
          // If not JSON, treat as plain text
        }
        const hasStepDetails = Array.isArray(stepResults) && stepResults.length > 0;

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col">
              <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                <h2 className="text-lg font-bold text-white">Execution Details</h2>
                <button
                  onClick={() => setViewingExecutionDetails(null)}
                  className="text-slate-400 hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                {/* Execution Summary */}
                <div className="bg-slate-900 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Status</div>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full inline-block ${getExecutionStatusBadge(viewingExecutionDetails.status)}`}>
                        {viewingExecutionDetails.status}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Executed On</div>
                      <div className="text-sm text-white">
                        {new Date(viewingExecutionDetails.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Executed By</div>
                      <div className="text-sm text-white">
                        {viewingExecutionDetails.executed_by || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step Details */}
                {hasStepDetails ? (
                  <div>
                    <h3 className="text-md font-semibold text-white mb-4">Step Results</h3>
                    <div className="space-y-4">
                      {stepResults.map((step, idx) => (
                        <div key={idx} className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-bold">
                                {step.stepNumber}
                              </div>
                              <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                                step.status === 'Passed' ? 'bg-green-600/20 text-green-400 border border-green-600/30' :
                                step.status === 'Failed' ? 'bg-red-600/20 text-red-400 border border-red-600/30' :
                                'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30'
                              }`}>
                                {step.status}
                              </span>
                            </div>
                          </div>
                          
                          <div className="space-y-2 mb-3">
                            <div>
                              <div className="text-xs text-slate-400 mb-1">Action</div>
                              <div className="text-sm text-white">{step.action}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-400 mb-1">Expected Result</div>
                              <div className="text-sm text-white">{step.expected}</div>
                            </div>
                          </div>

                          {step.comments && (
                            <div className="mb-3 p-3 bg-slate-800 rounded border-l-2 border-blue-500">
                              <div className="text-xs text-slate-400 mb-1">Comments</div>
                              <div className="text-sm text-slate-200">{step.comments}</div>
                            </div>
                          )}

                          {step.hasScreenshot && step.screenshotPreview && (
                            <div>
                              <div className="text-xs text-slate-400 mb-2">Screenshot</div>
                              <div 
                                onClick={() => openScreenshotInNewWindow(step.screenshotPreview)}
                                className="inline-block cursor-pointer hover:opacity-80 transition-opacity group relative"
                                title="Click to view full size"
                              >
                                <img 
                                  src={step.screenshotPreview} 
                                  alt={`Step ${step.stepNumber} screenshot`}
                                  className="max-w-md rounded-lg border border-slate-600 shadow-lg"
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center">
                                  <svg className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : viewingExecutionDetails.execution_notes ? (
                  <div className="bg-slate-900 rounded-lg p-4">
                    <h3 className="text-md font-semibold text-white mb-3">Execution Notes</h3>
                    <p className="text-slate-300">{viewingExecutionDetails.execution_notes}</p>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    No detailed information available for this execution
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-700 flex justify-end">
                <button
                  onClick={() => setViewingExecutionDetails(null)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default TestCases;
