import React, { useState, useEffect } from 'react';
import API_URL from '../apiUrl';
import { authFetch } from '../utils/api';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

function Sprints() {
  const [sprints, setSprints] = useState([]);
  const [defects, setDefects] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [testCases, setTestCases] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [suiteExecutions, setSuiteExecutions] = useState([]);
  const [manualTestRuns, setManualTestRuns] = useState([]);
  const [modules, setModules] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingSprint, setViewingSprint] = useState(null);
  const [editingSprint, setEditingSprint] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [formData, setFormData] = useState({
    name: '',
    goal: '',
    startDate: '',
    endDate: '',
    status: 'Planned'
  });

  useEffect(() => {
    fetchSprints();
    fetchDefects();
    fetchRequirements();
    fetchTestCases();
    fetchExecutions();
    fetchSuiteExecutions();
    fetchManualTestRuns();
    fetchModules();
    fetchAllTasks();
  }, []);

  const fetchSprints = async () => {
    try {
      const response = await authFetch(`${API_URL}/sprints`);
      const data = await response.json();
      setSprints(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching sprints:', error);
    }
  };

  const fetchAllTasks = async () => {
    try {
      const response = await authFetch(`${API_URL}/tasks`);
      const data = await response.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchDefects = async () => {
    try {
      const response = await fetch(`${API_URL}/defects`);
      const data = await response.json();
      setDefects(data);
    } catch (error) {
      console.error('Error fetching defects:', error);
    }
  };

  const fetchRequirements = async () => {
    try {
      const response = await fetch(`${API_URL}/requirements`);
      const data = await response.json();
      setRequirements(data);
    } catch (error) {
      console.error('Error fetching requirements:', error);
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

  const fetchExecutions = async () => {
    try {
      const response = await fetch(`${API_URL}/executions`);
      const data = await response.json();
      setExecutions(data);
    } catch (error) {
      console.error('Error fetching executions:', error);
    }
  };

  const fetchSuiteExecutions = async () => {
    try {
      const response = await fetch(`${API_URL}/test-suites`);
      const suites = await response.json();
      
      // Fetch executions for each suite
      const allSuiteExecutions = [];
      for (const suite of suites) {
        try {
          const execResponse = await fetch(`${API_URL}/test-suites/${suite.id}/executions`);
          const execData = await execResponse.json();
          // Add suite info to each execution
          const executionsWithSuite = execData.map(exec => ({
            ...exec,
            suite_id: suite.id,
            suite_name: suite.name
          }));
          allSuiteExecutions.push(...executionsWithSuite);
        } catch (error) {
          console.error(`Error fetching executions for suite ${suite.id}:`, error);
        }
      }
      setSuiteExecutions(allSuiteExecutions);
    } catch (error) {
      console.error('Error fetching suite executions:', error);
    }
  };

  const fetchManualTestRuns = async () => {
    try {
      const response = await fetch(`${API_URL}/manual-test-runs`);
      const data = await response.json();
      setManualTestRuns(data);
    } catch (error) {
      console.error('Error fetching manual test runs:', error);
    }
  };

  const fetchModules = async () => {
    try {
      const response = await fetch(`${API_URL}/modules`);
      const modulesData = await response.json();
      
      // Load test files for each module
      const modulesWithTestFiles = await Promise.all(
        modulesData.map(async (module) => {
          try {
            const testFilesResponse = await fetch(`${API_URL}/modules/${module.id}/test-files`);
            const testFiles = await testFilesResponse.json();
            return {
              ...module,
              testFiles: testFiles.map(tf => ({
                id: tf.id,
                name: tf.name,
                content: tf.content,
                requirementId: tf.requirement_id,
                requirementTitle: tf.requirement_title,
                createdAt: tf.created_at,
                updatedAt: tf.updated_at
              }))
            };
          } catch (error) {
            console.error(`Error fetching test files for module ${module.id}:`, error);
            return { ...module, testFiles: [] };
          }
        })
      );
      
      setModules(modulesWithTestFiles);
    } catch (error) {
      console.error('Error fetching modules:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
      name: formData.name,
      goal: formData.goal,
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
      status: formData.status
    };

    try {
      if (editingSprint) {
        await authFetch(`${API_URL}/sprints/${editingSprint.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        await authFetch(`${API_URL}/sprints`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      
      fetchSprints();
      closeModal();
    } catch (error) {
      console.error('Error saving sprint:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this sprint?')) {
      try {
        await authFetch(`${API_URL}/sprints/${id}`, {
          method: 'DELETE'
        });
        fetchSprints();
      } catch (error) {
        console.error('Error deleting sprint:', error);
      }
    }
  };

  const openModal = (sprint = null) => {
    if (sprint) {
      setEditingSprint(sprint);
      setFormData({
        name: sprint.name,
        goal: sprint.goal || '',
        startDate: sprint.start_date || '',
        endDate: sprint.end_date || '',
        status: sprint.status
      });
    } else {
      setEditingSprint(null);
      setFormData({
        name: '',
        goal: '',
        startDate: '',
        endDate: '',
        status: 'Planned'
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSprint(null);
    setFormData({
      name: '',
      goal: '',
      startDate: '',
      endDate: '',
      status: 'Planned'
    });
  };

  const handleViewDetails = (sprint) => {
    window.open(`${window.location.origin}${window.location.pathname}?view=sprint&sprintId=${sprint.id}`, '_blank');
  };

  const closeDetailView = () => {
    setViewingSprint(null);
  };

  const exportSprintToPDF = () => {
    if (!viewingSprint) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Calculate sprint data
    const sprintRequirements = requirements.filter(r => r.sprint_id === viewingSprint.id);
    const sprintTestCases = testCases.filter(tc => {
      const req = requirements.find(r => r.id === tc.requirement_id);
      return req && req.sprint_id === viewingSprint.id;
    });
    const sprintDefects = defects.filter(d => d.sprint_id === viewingSprint.id);

    const sprintRequirementIds = sprintRequirements.map(req => req.id);
    const manualTestCases = sprintTestCases.filter(tc => tc.type === 'Manual');
    const automationTestCases = [];
    modules.forEach(module => {
      if (module.testFiles) {
        module.testFiles.forEach(testFile => {
          if (testFile.requirementId && sprintRequirementIds.includes(testFile.requirementId)) {
            automationTestCases.push({
              ...testFile,
              moduleName: module.name,
              moduleId: module.id
            });
          }
        });
      }
    });

    const sprintTestCaseIds = sprintTestCases.map(tc => tc.id);
    const sprintManualRuns = manualTestRuns
      .filter(run => sprintTestCaseIds.includes(run.test_case_id))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Header
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text(viewingSprint.name, 14, 20);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`${formatDate(viewingSprint.start_date)} - ${formatDate(viewingSprint.end_date)}`, 14, 28);
    doc.text(`Status: ${viewingSprint.status}`, 14, 35);

    yPos = 50;

    // Sprint Goal
    if (viewingSprint.goal) {
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Sprint Goal:', 14, yPos);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
      const goalLines = doc.splitTextToSize(viewingSprint.goal, pageWidth - 28);
      doc.text(goalLines, 14, yPos + 6);
      yPos += 6 + (goalLines.length * 5) + 5;
    }

    // KPIs Summary
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Key Performance Indicators', 14, yPos);
    yPos += 8;

    const kpis = [
      ['Requirements', sprintRequirements.length.toString()],
      ['Test Cases', sprintTestCases.length.toString()],
      ['Manual Tests', manualTestCases.length.toString()],
      ['Automated Tests', automationTestCases.length.toString()],
      ['Defects', sprintDefects.length.toString()],
      ['Automation Coverage', `${sprintTestCases.length > 0 ? Math.round((automationTestCases.length / sprintTestCases.length) * 100) : 0}%`]
    ];

    doc.autoTable({
      startY: yPos,
      head: [['Metric', 'Value']],
      body: kpis,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      margin: { left: 14, right: 14 }
    });

    yPos = doc.lastAutoTable.finalY + 10;

    // Requirements
    if (sprintRequirements.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Requirements', 14, yPos);
      yPos += 6;

      const reqData = sprintRequirements.map(req => [
        `#${req.id}`,
        req.title,
        req.priority || 'Medium',
        req.status || 'Not Started'
      ]);

      doc.autoTable({
        startY: yPos,
        head: [['ID', 'Title', 'Priority', 'Status']],
        body: reqData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 25 },
          3: { cellWidth: 30 }
        }
      });

      yPos = doc.lastAutoTable.finalY + 10;
    }

    // Manual Test Cases
    if (manualTestCases.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Manual Test Cases', 14, yPos);
      yPos += 6;

      const manualData = manualTestCases.map(tc => {
        const req = requirements.find(r => r.id === tc.requirement_id);
        return [
          `#${tc.id}`,
          tc.title,
          req ? req.title : '-',
          tc.priority || 'Medium',
          tc.status || 'Not Run'
        ];
      });

      doc.autoTable({
        startY: yPos,
        head: [['ID', 'Title', 'Requirement', 'Priority', 'Status']],
        body: manualData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 40 },
          3: { cellWidth: 25 },
          4: { cellWidth: 25 }
        }
      });

      yPos = doc.lastAutoTable.finalY + 10;
    }

    // Automation Test Cases
    if (automationTestCases.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Automation Test Cases', 14, yPos);
      yPos += 6;

      const autoData = automationTestCases.map(tc => [
        `#${tc.id}`,
        tc.moduleName,
        tc.name,
        tc.requirementTitle || '-'
      ]);

      doc.autoTable({
        startY: yPos,
        head: [['ID', 'Module', 'Test File', 'Requirement']],
        body: autoData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 35 },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 45 }
        }
      });

      yPos = doc.lastAutoTable.finalY + 10;
    }

    // Manual Test Runs
    if (sprintManualRuns.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Manual Test Runs', 14, yPos);
      yPos += 6;

      const runData = sprintManualRuns.map(run => {
        const tc = testCases.find(t => t.id === run.test_case_id);
        return [
          `#${run.id}`,
          tc ? tc.title : `Test Case #${run.test_case_id}`,
          run.status || 'Not Run',
          run.executed_by || '-',
          run.execution_date ? new Date(run.execution_date).toLocaleDateString() : '-'
        ];
      });

      doc.autoTable({
        startY: yPos,
        head: [['Run ID', 'Test Case', 'Status', 'Executed By', 'Date']],
        body: runData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 25 },
          3: { cellWidth: 30 },
          4: { cellWidth: 30 }
        }
      });

      yPos = doc.lastAutoTable.finalY + 10;
    }

    // Defects
    if (sprintDefects.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Defects', 14, yPos);
      yPos += 6;

      const defectData = sprintDefects.map(defect => [
        `#${defect.id}`,
        defect.title,
        defect.severity || 'Medium',
        defect.status || 'Open',
        defect.assigned_to || 'Unassigned'
      ]);

      doc.autoTable({
        startY: yPos,
        head: [['ID', 'Title', 'Severity', 'Status', 'Assigned To']],
        body: defectData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 25 },
          3: { cellWidth: 30 },
          4: { cellWidth: 35 }
        }
      });
    }

    // Footer on each page
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Generated on ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    // Save the PDF
    doc.save(`${viewingSprint.name.replace(/\s+/g, '_')}_Sprint_Report.pdf`);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Active':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Completed':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Planned':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getSeverityBadgeClass = (severity) => {
    switch (severity) {
      case 'Critical':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'High':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'Medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Low':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getDefectStatusBadgeClass = (status) => {
    switch (status) {
      case 'Open':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'In Progress':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Resolved':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Closed':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const filteredSprints = sprints.filter(sprint => {
    const matchesSearch = sprint.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (sprint.goal && sprint.goal.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'All' || sprint.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Sprints</h1>
        <p className="text-slate-400 mt-2">Manage sprint planning and tracking</p>
      </div>

      {/* Actions Bar */}
      <div className="mb-6 flex gap-4 items-center">
        <button
          onClick={() => openModal()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Sprint
        </button>

        {/* Search */}
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search sprints..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="All">All Status</option>
          <option value="Planned">Planned</option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
        </select>
      </div>

      {/* Sprints Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-lg overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full">
            <thead className="bg-slate-800 border-b border-slate-700 sticky top-0">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Sprint Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Goal
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Start Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  End Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredSprints.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                    {searchTerm || filterStatus !== 'All' ? 'No sprints match your filters' : 'No sprints yet. Create your first sprint to get started.'}
                  </td>
                </tr>
              ) : (
                filteredSprints.map((sprint) => (
                  <tr key={sprint.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-white font-medium">{sprint.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-300 text-sm max-w-md truncate">
                        {sprint.goal || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-300 text-sm">{formatDate(sprint.start_date)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-300 text-sm">{formatDate(sprint.end_date)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadgeClass(sprint.status)}`}>
                        {sprint.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewDetails(sprint)}
                          className="p-2 text-blue-400 hover:bg-blue-600/10 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openModal(sprint)}
                          className="p-2 text-indigo-400 hover:bg-indigo-600/10 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(sprint.id)}
                          className="p-2 text-red-400 hover:bg-red-600/10 rounded-lg transition-colors"
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
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-2xl font-bold text-white">
                {editingSprint ? 'Edit Sprint' : 'Create New Sprint'}
              </h2>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Sprint Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Sprint Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., Sprint 1, Q1 2024 Sprint"
                />
              </div>

              {/* Goal */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Sprint Goal
                </label>
                <textarea
                  value={formData.goal}
                  onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Describe the sprint goal and objectives..."
                />
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Status <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Planned">Planned</option>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              {/* Modal Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  {editingSprint ? 'Update Sprint' : 'Create Sprint'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sprint Detail View Modal */}
      {viewingSprint && (() => {
        // Calculate KPIs for the current sprint
        const sprintRequirements = requirements.filter(r => r.sprint_id === viewingSprint.id);
        const sprintTestCases = testCases.filter(tc => {
          const req = requirements.find(r => r.id === tc.requirement_id);
          return req && req.sprint_id === viewingSprint.id;
        });
        const sprintDefects = defects.filter(d => d.sprint_id === viewingSprint.id);

        const totalRequirements = sprintRequirements.length;
        const totalTestCases = sprintTestCases.length;
        const manualTestCases = sprintTestCases.filter(tc => tc.type === 'Manual').length;
        const automatedTestCases = sprintTestCases.filter(tc => tc.type === 'Automated').length;
        const totalDefects = sprintDefects.length;
        const openDefects = sprintDefects.filter(d => d.status === 'Open').length;
        const automationCoverage = totalTestCases > 0 ? Math.round((automatedTestCases / totalTestCases) * 100) : 0;

        // Test execution metrics
        const passedTests = sprintTestCases.filter(tc => tc.status === 'Passed').length;
        const failedTests = sprintTestCases.filter(tc => tc.status === 'Failed').length;
        const notExecuted = totalTestCases - passedTests - failedTests;

        // Defect status breakdown
        const openDefectsCount = sprintDefects.filter(d => d.status === 'Open').length;
        const inProgressDefects = sprintDefects.filter(d => d.status === 'In Progress').length;
        const resolvedDefects = sprintDefects.filter(d => d.status === 'Resolved').length;
        const closedDefects = sprintDefects.filter(d => d.status === 'Closed').length;

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-white mb-2">{viewingSprint.name}</h1>
                    <p className="text-indigo-100 text-sm mb-3">
                      {formatDate(viewingSprint.start_date)} - {formatDate(viewingSprint.end_date)}
                    </p>
                    {viewingSprint.goal && (
                      <p className="text-white/90 text-sm">{viewingSprint.goal}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-4 py-2 rounded-full text-sm font-medium border-2 ${getStatusBadgeClass(viewingSprint.status)}`}>
                      {viewingSprint.status}
                    </span>
                    <button
                      onClick={exportSprintToPDF}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200 flex items-center gap-2 font-medium border border-white/30"
                      title="Export to PDF"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export PDF
                    </button>
                    <button
                      onClick={closeDetailView}
                      className="text-white/80 hover:text-white transition-colors p-1"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="p-6">
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {/* Total Requirements */}
                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-indigo-500 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-400 text-xs uppercase font-semibold">Requirements</span>
                      <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="text-3xl font-bold text-white">{totalRequirements}</div>
                  </div>

                  {/* Total Test Cases */}
                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-blue-500 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-400 text-xs uppercase font-semibold">Test Cases</span>
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div className="text-3xl font-bold text-white">{totalTestCases}</div>
                  </div>

                  {/* Manual Tests */}
                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-yellow-500 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-400 text-xs uppercase font-semibold">Manual</span>
                      <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </div>
                    <div className="text-3xl font-bold text-white">{manualTestCases}</div>
                  </div>

                  {/* Automated Tests */}
                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-green-500 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-400 text-xs uppercase font-semibold">Automated</span>
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    </div>
                    <div className="text-3xl font-bold text-white">{automatedTestCases}</div>
                  </div>

                  {/* Total Defects */}
                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-red-500 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-400 text-xs uppercase font-semibold">Total Defects</span>
                      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-3xl font-bold text-white">{totalDefects}</div>
                  </div>

                  {/* Open Defects */}
                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-orange-500 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-400 text-xs uppercase font-semibold">Open Defects</span>
                      <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="text-3xl font-bold text-white">{openDefects}</div>
                  </div>

                  {/* Automation Coverage */}
                  <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg p-4 border border-indigo-500 col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white text-xs uppercase font-semibold">Automation Coverage</span>
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="text-4xl font-bold text-white">{automationCoverage}%</div>
                      <div className="text-white/80 text-sm mb-1">{automatedTestCases} of {totalTestCases}</div>
                    </div>
                  </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  {/* Test Execution Progress */}
                  <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Test Execution Progress</h3>
                    <div className="space-y-4">
                      {/* Passed */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-slate-300 text-sm font-medium">Passed</span>
                          <span className="text-green-400 font-bold">{passedTests}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-3">
                          <div
                            className="bg-green-500 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${totalTestCases > 0 ? (passedTests / totalTestCases) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Failed */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-slate-300 text-sm font-medium">Failed</span>
                          <span className="text-red-400 font-bold">{failedTests}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-3">
                          <div
                            className="bg-red-500 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${totalTestCases > 0 ? (failedTests / totalTestCases) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Not Executed */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-slate-300 text-sm font-medium">Not Executed</span>
                          <span className="text-gray-400 font-bold">{notExecuted}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-3">
                          <div
                            className="bg-gray-500 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${totalTestCases > 0 ? (notExecuted / totalTestCases) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="pt-4 border-t border-slate-700">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Total Tests</span>
                          <span className="text-white font-semibold">{totalTestCases}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-slate-400">Execution Rate</span>
                          <span className="text-white font-semibold">
                            {totalTestCases > 0 ? Math.round(((passedTests + failedTests) / totalTestCases) * 100) : 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Defect Status Breakdown */}
                  <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Defect Status Breakdown</h3>
                    <div className="space-y-4">
                      {/* Open */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-slate-300 text-sm font-medium">Open</span>
                          <span className="text-red-400 font-bold">{openDefectsCount}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-3">
                          <div
                            className="bg-red-500 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${totalDefects > 0 ? (openDefectsCount / totalDefects) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* In Progress */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-slate-300 text-sm font-medium">In Progress</span>
                          <span className="text-yellow-400 font-bold">{inProgressDefects}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-3">
                          <div
                            className="bg-yellow-500 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${totalDefects > 0 ? (inProgressDefects / totalDefects) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Resolved */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-slate-300 text-sm font-medium">Resolved</span>
                          <span className="text-green-400 font-bold">{resolvedDefects}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-3">
                          <div
                            className="bg-green-500 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${totalDefects > 0 ? (resolvedDefects / totalDefects) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Closed */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-slate-300 text-sm font-medium">Closed</span>
                          <span className="text-gray-400 font-bold">{closedDefects}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-3">
                          <div
                            className="bg-gray-500 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${totalDefects > 0 ? (closedDefects / totalDefects) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="pt-4 border-t border-slate-700">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Total Defects</span>
                          <span className="text-white font-semibold">{totalDefects}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-slate-400">Resolution Rate</span>
                          <span className="text-white font-semibold">
                            {totalDefects > 0 ? Math.round(((resolvedDefects + closedDefects) / totalDefects) * 100) : 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Manual Test Cases in this Sprint */}
                <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                  <div className="p-4 border-b border-slate-700">
                    <h3 className="text-lg font-semibold text-white">Manual Test Cases in this Sprint</h3>
                    <p className="text-sm text-slate-400 mt-1">Planned manual test cases</p>
                  </div>
                  {(() => {
                    // Get test cases for this sprint (via requirements)
                    const sprintRequirements = requirements.filter(req => req.sprint_id === viewingSprint.id);
                    const sprintRequirementIds = sprintRequirements.map(req => req.id);
                    const manualTestCases = testCases
                      .filter(tc => sprintRequirementIds.includes(tc.requirement_id) && tc.type === 'Manual')
                      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                    return manualTestCases.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">
                        <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <p>No manual test cases planned for this sprint.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-800 border-b border-slate-700">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">ID</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Title</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Requirement</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Priority</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700">
                            {manualTestCases.map((tc) => {
                              const requirement = requirements.find(req => req.id === tc.requirement_id);
                              
                              return (
                                <tr 
                                  key={tc.id} 
                                  className="hover:bg-slate-700/50 transition-colors cursor-pointer"
                                  onClick={() => {
                                    window.dispatchEvent(new CustomEvent('navigateToTestCase', { detail: { testCaseId: tc.id } }));
                                  }}
                                  title="Click to view test case"
                                >
                                  <td className="px-4 py-3">
                                    <span className="text-slate-400 font-mono text-sm">#{tc.id}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-white font-medium">{tc.title}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-slate-300 text-sm">
                                      {requirement ? requirement.title : '-'}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      tc.priority === 'High' 
                                        ? 'bg-red-500/10 text-red-400 border border-red-500/30' 
                                        : tc.priority === 'Medium'
                                        ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                    }`}>
                                      {tc.priority}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      tc.status === 'Pass' 
                                        ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
                                        : tc.status === 'Fail'
                                        ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                                        : tc.status === 'Blocked'
                                        ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                                        : 'bg-slate-500/10 text-slate-400 border border-slate-500/30'
                                    }`}>
                                      {tc.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>

                {/* Automation Test Cases in this Sprint */}
                <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                  <div className="p-4 border-b border-slate-700">
                    <h3 className="text-lg font-semibold text-white">Automation Test Cases in this Sprint</h3>
                    <p className="text-sm text-slate-400 mt-1">Automation scripts linked to sprint requirements</p>
                  </div>
                  {(() => {
                    // Get test cases for this sprint (via requirements)
                    const sprintRequirements = requirements.filter(req => req.sprint_id === viewingSprint.id);
                    const sprintRequirementIds = sprintRequirements.map(req => req.id);
                    
                    // Get all test files linked to sprint requirements
                    const automationTestCases = [];
                    modules.forEach(module => {
                      if (module.testFiles) {
                        module.testFiles.forEach(testFile => {
                          if (testFile.requirementId && sprintRequirementIds.includes(testFile.requirementId)) {
                            automationTestCases.push({
                              ...testFile,
                              moduleName: module.name,
                              moduleId: module.id
                            });
                          }
                        });
                      }
                    });

                    automationTestCases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                    return automationTestCases.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">
                        <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        <p>No automation test cases planned for this sprint.</p>
                        <p className="text-xs mt-2">Link test files to requirements in this sprint to see them here.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-800 border-b border-slate-700">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">ID</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Module</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Test File</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Requirement</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Created At</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700">
                            {automationTestCases.map((testFile) => {
                              const requirement = requirements.find(req => req.id === testFile.requirementId);
                              
                              return (
                                <tr 
                                  key={testFile.id} 
                                  className="hover:bg-slate-700/50 transition-colors cursor-pointer"
                                  onClick={() => {
                                    window.dispatchEvent(new CustomEvent('navigateToTestFile', { 
                                      detail: { moduleId: testFile.moduleId, testFileId: testFile.id } 
                                    }));
                                  }}
                                  title="Click to view test file"
                                >
                                  <td className="px-4 py-3">
                                    <span className="text-slate-400 font-mono text-sm">#{testFile.id}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                      </svg>
                                      <span className="text-slate-300 text-sm">{testFile.moduleName}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                      </svg>
                                      <span className="text-white font-medium">{testFile.name}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-slate-300 text-sm">
                                      {testFile.requirementTitle || (requirement ? requirement.title : '-')}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-slate-400 text-sm">
                                      {new Date(testFile.createdAt).toLocaleDateString()}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>

                {/* Manual Test Runs in this Sprint */}
                <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                  <div className="p-4 border-b border-slate-700">
                    <h3 className="text-lg font-semibold text-white">Manual Test Runs in this Sprint</h3>
                  </div>
                  {(() => {
                    // Get test cases for this sprint (via requirements)
                    const sprintRequirements = requirements.filter(req => req.sprint_id === viewingSprint.id);
                    const sprintRequirementIds = sprintRequirements.map(req => req.id);
                    const sprintTestCaseIds = testCases
                      .filter(tc => sprintRequirementIds.includes(tc.requirement_id))
                      .map(tc => tc.id);

                    // Filter manual test runs for sprint test cases
                    const sprintManualRuns = manualTestRuns
                      .filter(run => sprintTestCaseIds.includes(run.test_case_id))
                      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                    return sprintManualRuns.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">
                        <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <p>No manual test runs in this sprint yet.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-800 border-b border-slate-700">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Run ID</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Test Case</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Executed By</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Execution Date</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700">
                            {sprintManualRuns.map((run) => {
                              const testCase = testCases.find(tc => tc.id === run.test_case_id);
                              
                              return (
                                <tr 
                                  key={run.id} 
                                  className="hover:bg-slate-700/50 transition-colors cursor-pointer"
                                  onClick={() => {
                                    window.dispatchEvent(new CustomEvent('navigateToTestCase', { detail: { testCaseId: run.test_case_id } }));
                                  }}
                                  title="Click to view test case"
                                >
                                  <td className="px-4 py-3">
                                    <span className="text-slate-400 font-mono text-sm">#{run.id}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-white font-medium">
                                      {testCase ? testCase.title : `Test Case #${run.test_case_id}`}
                                    </div>
                                    {testCase && testCase.type && (
                                      <div className="text-xs text-slate-400 mt-1">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                                          testCase.type === 'Manual' 
                                            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' 
                                            : 'bg-green-500/10 border-green-500/30 text-green-400'
                                        }`}>
                                          {testCase.type}
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                                      run.status === 'Passed'
                                        ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                        : run.status === 'Failed'
                                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                        : run.status === 'Blocked'
                                        ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                                        : 'bg-slate-500/10 border-slate-500/30 text-slate-400'
                                    }`}>
                                      {run.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-slate-300 text-sm">
                                      {run.executed_by || 'N/A'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-slate-300 text-sm">
                                      {new Date(run.created_at).toLocaleDateString('en-US', { 
                                        month: 'short', 
                                        day: 'numeric', 
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    {run.execution_notes ? (
                                      <span className="text-slate-400 text-sm truncate max-w-xs block" title={run.execution_notes}>
                                        {run.execution_notes}
                                      </span>
                                    ) : (
                                      <span className="text-slate-500 text-sm">No notes</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>

                {/* Automation Executions in this Sprint */}
                <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                  <div className="p-4 border-b border-slate-700">
                    <h3 className="text-lg font-semibold text-white">Automation Executions in this Sprint</h3>
                  </div>
                  {(() => {
                    // Filter executions for this sprint (based on sprint date range or linked test cases)
                    const sprintStart = viewingSprint.start_date ? new Date(viewingSprint.start_date) : null;
                    const sprintEnd = viewingSprint.end_date ? new Date(viewingSprint.end_date) : null;
                    
                    // Filter single executions
                    let filteredExecutions = executions.filter(exec => {
                      if (!sprintStart || !sprintEnd) return true;
                      const execDate = new Date(exec.created_at);
                      return execDate >= sprintStart && execDate <= sprintEnd;
                    });

                    // Filter suite executions
                    let filteredSuiteExecutions = suiteExecutions.filter(exec => {
                      if (!sprintStart || !sprintEnd) return true;
                      const execDate = new Date(exec.created_at);
                      return execDate >= sprintStart && execDate <= sprintEnd;
                    });

                    // Combine both types with type identifier
                    const allExecutions = [
                      ...filteredExecutions.map(e => ({ ...e, type: 'Single' })),
                      ...filteredSuiteExecutions.map(e => ({ ...e, type: 'Suite' }))
                    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                    return allExecutions.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">
                        <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p>No automation executions in this sprint yet.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-800 border-b border-slate-700">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Execution ID</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Type</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Duration</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Date</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">View Report</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700">
                            {allExecutions.map((exec) => (
                              <tr 
                                key={`${exec.type}-${exec.id}`} 
                                className="hover:bg-slate-700/50 transition-colors cursor-pointer"
                                onClick={() => {
                                  if (!exec.report_path) {
                                    window.dispatchEvent(new CustomEvent('navigateToExecution', {
                                      detail: { executionId: exec.id, type: exec.type.toLowerCase() }
                                    }));
                                  }
                                }}
                                title={exec.report_path ? "Click 'Report' button to view" : "Click to view execution details"}
                              >
                                <td className="px-4 py-3">
                                  <span className="text-slate-400 font-mono text-sm">#{exec.id}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                                    exec.type === 'Suite' 
                                      ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' 
                                      : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                                  }`}>
                                    {exec.type}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                                    exec.status === 'Success' || exec.status === 'Passed'
                                      ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                      : exec.status === 'Failed'
                                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                      : exec.status === 'Running'
                                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                                      : 'bg-slate-500/10 border-slate-500/30 text-slate-400'
                                  }`}>
                                    {exec.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-slate-300 text-sm">
                                    {exec.duration_ms ? `${(exec.duration_ms / 1000).toFixed(2)}s` : 'N/A'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-slate-300 text-sm">
                                    {new Date(exec.created_at).toLocaleDateString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric', 
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {exec.report_path ? (
                                    <a
                                      href={`${API_URL}${exec.report_path}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center px-3 py-1 bg-indigo-600 text-white text-xs rounded-md hover:bg-indigo-700 transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                      Report
                                    </a>
                                  ) : (
                                    <span className="text-slate-500 text-xs">No Report</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>

                {/* Sprint Tasks */}
                {(() => {
                  const sprintTasks = tasks.filter(t => String(t.sprint_id) === String(viewingSprint.id));
                  return (
                    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                      <div className="p-4 border-b border-slate-700 flex items-center justify-between gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold text-white">Tasks in this Sprint</h3>
                        {sprintTasks.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {[{s:'New',bg:'bg-slate-700',tx:'text-slate-300'},{s:'In Progress',bg:'bg-indigo-900/50',tx:'text-indigo-300'},{s:'Completed',bg:'bg-emerald-900/50',tx:'text-emerald-300'},{s:'Done',bg:'bg-purple-900/50',tx:'text-purple-300'}].map(({s,bg,tx}) => {
                              const c = sprintTasks.filter(t => t.status === s).length;
                              return c > 0 ? <span key={s} className={`px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${tx}`}>{c} {s}</span> : null;
                            })}
                          </div>
                        )}
                      </div>
                      {sprintTasks.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                          <svg className="w-10 h-10 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                          <p>No tasks assigned to this sprint yet.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-slate-800 border-b border-slate-700">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Title</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Priority</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Assignee</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Due Date</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Requirement</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                              {sprintTasks.map(task => (
                                <tr key={task.id} className="hover:bg-slate-700/50 transition-colors">
                                  <td className="px-4 py-3">
                                    <div className="text-white font-medium text-sm">{task.title}</div>
                                    {task.description && <div className="text-slate-400 text-xs mt-0.5 truncate max-w-xs">{task.description}</div>}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                                      task.status === 'New'         ? 'bg-slate-500/10 border-slate-500/30 text-slate-400'
                                    : task.status === 'In Progress' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                                    : task.status === 'Completed'   ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                    :                                 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                                    }`}>{task.status}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                                      task.priority === 'Low'      ? 'bg-slate-500/10 border-slate-500/30 text-slate-400'
                                    : task.priority === 'Medium'   ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                                    : task.priority === 'High'     ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                                    :                               'bg-red-500/10 border-red-500/30 text-red-400'
                                    }`}>{task.priority}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-slate-300 text-sm">{task.assignee_username || <span className="text-slate-500">—</span>}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-slate-300 text-sm">{task.end_date ? new Date(task.end_date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : <span className="text-slate-500">—</span>}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    {task.requirement_title
                                      ? <span className="text-indigo-300 text-xs">{task.requirement_title}</span>
                                      : <span className="text-slate-500 text-xs">—</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Defects Table */}
                <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                  <div className="p-4 border-b border-slate-700">
                    <h3 className="text-lg font-semibold text-white">Defects</h3>
                  </div>
                  {sprintDefects.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p>No defects assigned to this sprint yet.</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-slate-800 border-b border-slate-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">ID</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Title</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Severity</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {sprintDefects.map((defect) => (
                          <tr 
                            key={defect.id} 
                            className="hover:bg-slate-700/50 transition-colors cursor-pointer"
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('navigateToDefect', { detail: { defectId: defect.id } }));
                            }}
                            title="Click to view defect details"
                          >
                            <td className="px-4 py-3">
                              <span className="text-slate-400 font-mono text-sm">#{defect.id}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-white font-medium">{defect.title}</div>
                              {defect.description && (
                                <div className="text-slate-400 text-sm mt-1 truncate max-w-md">{defect.description}</div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSeverityBadgeClass(defect.severity)}`}>
                                {defect.severity}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getDefectStatusBadgeClass(defect.status)}`}>
                                {defect.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-800 bg-slate-800/50">
                <button
                  onClick={closeDetailView}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
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

export default Sprints;
