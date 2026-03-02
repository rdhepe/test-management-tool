import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const API_URL = 'http://localhost:3001';

const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'Active':    return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'Completed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'Planned':   return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    default:          return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

const getSeverityBadgeClass = (severity) => {
  switch (severity) {
    case 'Critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'High':     return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'Medium':   return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'Low':      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    default:         return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

const getDefectStatusBadgeClass = (status) => {
  switch (status) {
    case 'Open':        return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'In Progress': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'Resolved':    return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'Closed':      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    default:            return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const SprintPieChart = ({ segments, centerLabel, centerValue }) => {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-500">
        <div className="text-4xl mb-2">—</div>
        <div className="text-sm">No data</div>
      </div>
    );
  }
  const r = 70;
  const C = 2 * Math.PI * r;
  let cumulative = 0;
  return (
    <div className="flex items-center gap-6">
      <div className="relative flex-shrink-0">
        <svg width="160" height="160" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="70" fill="none" stroke="#1e293b" strokeWidth="38" />
          {segments.map((seg, i) => {
            const dash = (seg.value / total) * C;
            const gap = C - dash;
            const offset = C / 4 - cumulative;
            cumulative += dash;
            return (
              <circle
                key={i}
                cx="100" cy="100" r="70"
                fill="none"
                stroke={seg.stroke}
                strokeWidth="38"
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={offset}
                className="transition-all duration-500"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold text-white">{centerValue}</div>
          <div className="text-xs text-slate-400">{centerLabel}</div>
        </div>
      </div>
      <div className="space-y-2 flex-1">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: seg.stroke }}></div>
              <span className="text-slate-300 text-sm">{seg.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-bold text-sm ${seg.textColor}`}>{seg.value}</span>
              <span className="text-slate-500 text-xs">({Math.round((seg.value / total) * 100)}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function SprintDetailPage() {
  const params = new URLSearchParams(window.location.search);
  const sprintId = parseInt(params.get('sprintId'), 10);

  const [sprint, setSprint] = useState(null);
  const [defects, setDefects] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [testCases, setTestCases] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [suiteExecutions, setSuiteExecutions] = useState([]);
  const [manualTestRuns, setManualTestRuns] = useState([]);
  const [modules, setModules] = useState([]);
  const [sprintTasks, setSprintTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sprintId) {
      setError('No sprint ID provided.');
      setLoading(false);
      return;
    }
    Promise.all([
      fetch(`${API_URL}/sprints/${sprintId}`).then(r => r.json()),
      fetch(`${API_URL}/requirements`).then(r => r.json()),
      fetch(`${API_URL}/test-cases`).then(r => r.json()),
      fetch(`${API_URL}/defects`).then(r => r.json()),
      fetch(`${API_URL}/executions`).then(r => r.json()),
      fetch(`${API_URL}/manual-test-runs`).then(r => r.json()),
      fetch(`${API_URL}/tasks?sprintId=${sprintId}`).then(r => r.json()),
      fetchSuiteExecutions(),
      fetchModules(),
    ]).then(([sprintData, reqs, tcs, defs, execs, manualRuns, taskData]) => {
      setSprint(sprintData);
      setRequirements(reqs);
      setTestCases(tcs);
      setDefects(defs);
      setExecutions(execs);
      setManualTestRuns(manualRuns);
      setSprintTasks(Array.isArray(taskData) ? taskData : []);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setError('Failed to load sprint data.');
      setLoading(false);
    });
  }, [sprintId]);

  const fetchSuiteExecutions = async () => {
    try {
      const suites = await fetch(`${API_URL}/test-suites`).then(r => r.json());
      const allSuiteExecutions = [];
      for (const suite of suites) {
        try {
          const execData = await fetch(`${API_URL}/test-suites/${suite.id}/executions`).then(r => r.json());
          execData.forEach(exec => allSuiteExecutions.push({ ...exec, suiteName: suite.name }));
        } catch (_) {}
      }
      setSuiteExecutions(allSuiteExecutions);
    } catch (err) {
      console.error('Error fetching suite executions:', err);
    }
  };

  const fetchModules = async () => {
    try {
      const modulesData = await fetch(`${API_URL}/modules`).then(r => r.json());
      const modulesWithTestFiles = await Promise.all(
        modulesData.map(async (module) => {
          try {
            const testFiles = await fetch(`${API_URL}/modules/${module.id}/test-files`).then(r => r.json());
            return { ...module, testFiles };
          } catch (_) {
            return { ...module, testFiles: [] };
          }
        })
      );
      setModules(modulesWithTestFiles);
    } catch (err) {
      console.error('Error fetching modules:', err);
    }
  };

  const exportSprintToPDF = () => {
    if (!sprint) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(20);
    doc.text(sprint.name, 14, 20);
    doc.setFontSize(12);
    doc.text(`${formatDate(sprint.start_date)} - ${formatDate(sprint.end_date)}`, 14, 28);
    doc.text(`Status: ${sprint.status}`, 14, 35);

    let yPos = 45;
    if (sprint.goal) {
      doc.setFontSize(11);
      doc.text('Goal:', 14, yPos);
      yPos += 7;
      const goalLines = doc.splitTextToSize(sprint.goal, pageWidth - 28);
      doc.text(goalLines, 14, yPos);
      yPos += goalLines.length * 6 + 10;
    }

    const sprintRequirements = requirements.filter(r => r.sprint_id === sprint.id);
    const sprintTestCases = testCases.filter(tc => {
      const req = requirements.find(r => r.id === tc.requirement_id);
      return req && req.sprint_id === sprint.id;
    });
    const sprintDefects = defects.filter(d => d.sprint_id === sprint.id);

    // Requirements table
    if (sprintRequirements.length > 0) {
      doc.setFontSize(14);
      doc.text('Requirements', 14, yPos);
      yPos += 8;
      doc.autoTable({
        startY: yPos,
        head: [['ID', 'Title', 'Priority', 'Status']],
        body: sprintRequirements.map(r => [r.id, r.title, r.priority || '-', r.status || '-']),
        theme: 'striped',
      });
      yPos = doc.lastAutoTable.finalY + 10;
    }

    // Test Cases table
    if (sprintTestCases.length > 0) {
      doc.setFontSize(14);
      doc.text('Test Cases', 14, yPos);
      yPos += 8;
      doc.autoTable({
        startY: yPos,
        head: [['ID', 'Title', 'Type', 'Priority', 'Status']],
        body: sprintTestCases.map(tc => [tc.id, tc.title, tc.type || '-', tc.priority || '-', tc.status || '-']),
        theme: 'striped',
      });
      yPos = doc.lastAutoTable.finalY + 10;
    }

    // Defects table
    if (sprintDefects.length > 0) {
      doc.setFontSize(14);
      doc.text('Defects', 14, yPos);
      yPos += 8;
      doc.autoTable({
        startY: yPos,
        head: [['ID', 'Title', 'Severity', 'Status']],
        body: sprintDefects.map(d => [d.id, d.title, d.severity || '-', d.status || '-']),
        theme: 'striped',
      });
    }

    doc.save(`${sprint.name.replace(/\s+/g, '_')}_Sprint_Report.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading sprint details...</div>
      </div>
    );
  }

  if (error || !sprint) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-red-400 text-xl">{error || 'Sprint not found.'}</div>
      </div>
    );
  }

  // KPI calculations
  const sprintRequirements = requirements.filter(r => r.sprint_id === sprint.id);
  const sprintTestCases = testCases.filter(tc => {
    const req = requirements.find(r => r.id === tc.requirement_id);
    return req && req.sprint_id === sprint.id;
  });
  const sprintDefects = defects.filter(d => d.sprint_id === sprint.id);

  const totalRequirements = sprintRequirements.length;
  const totalTestCases = sprintTestCases.length;
  const manualTestCasesCount = sprintTestCases.filter(tc => tc.type === 'Manual').length;
  const automatedTestCases = sprintTestCases.filter(tc => tc.type === 'Automated').length;
  const totalDefects = sprintDefects.length;
  const openDefects = sprintDefects.filter(d => d.status === 'Open').length;
  const automationCoverage = totalTestCases > 0 ? Math.round((automatedTestCases / totalTestCases) * 100) : 0;

  const passedTests = sprintTestCases.filter(tc => tc.status === 'Passed').length;
  const failedTests = sprintTestCases.filter(tc => tc.status === 'Failed').length;
  const notExecuted = totalTestCases - passedTests - failedTests;

  const openDefectsCount = sprintDefects.filter(d => d.status === 'Open').length;
  const inProgressDefects = sprintDefects.filter(d => d.status === 'In Progress').length;
  const resolvedDefects = sprintDefects.filter(d => d.status === 'Resolved').length;
  const closedDefects = sprintDefects.filter(d => d.status === 'Closed').length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white mb-2">{sprint.name}</h1>
            <p className="text-indigo-100 text-sm mb-3">
              {formatDate(sprint.start_date)} - {formatDate(sprint.end_date)}
            </p>
            {sprint.goal && (
              <p className="text-white/90 text-sm">{sprint.goal}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-4 py-2 rounded-full text-sm font-medium border-2 ${getStatusBadgeClass(sprint.status)}`}>
              {sprint.status}
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
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-indigo-500 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-xs uppercase font-semibold">Requirements</span>
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-3xl font-bold text-white">{totalRequirements}</div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-blue-500 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-xs uppercase font-semibold">Test Cases</span>
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="text-3xl font-bold text-white">{totalTestCases}</div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-yellow-500 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-xs uppercase font-semibold">Manual</span>
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div className="text-3xl font-bold text-white">{manualTestCasesCount}</div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-green-500 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-xs uppercase font-semibold">Automated</span>
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <div className="text-3xl font-bold text-white">{automatedTestCases}</div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-red-500 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-xs uppercase font-semibold">Total Defects</span>
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-3xl font-bold text-white">{totalDefects}</div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-orange-500 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-xs uppercase font-semibold">Open Defects</span>
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="text-3xl font-bold text-white">{openDefects}</div>
          </div>

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
        <div className="grid grid-cols-2 gap-6">
          {/* Test Execution Progress */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Test Execution Progress</h3>
            <SprintPieChart
              segments={[
                { label: 'Passed', value: passedTests, stroke: '#22c55e', textColor: 'text-green-400' },
                { label: 'Failed', value: failedTests, stroke: '#ef4444', textColor: 'text-red-400' },
                { label: 'Not Executed', value: notExecuted, stroke: '#6b7280', textColor: 'text-gray-400' },
              ]}
              centerLabel="Total"
              centerValue={totalTestCases}
            />
            <div className="pt-4 border-t border-slate-700 mt-4 flex justify-between text-sm">
              <span className="text-slate-400">Execution Rate</span>
              <span className="text-white font-semibold">
                {totalTestCases > 0 ? Math.round(((passedTests + failedTests) / totalTestCases) * 100) : 0}%
              </span>
            </div>
          </div>

          {/* Defect Status Breakdown */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Defect Status Breakdown</h3>
            <SprintPieChart
              segments={[
                { label: 'Open', value: openDefectsCount, stroke: '#ef4444', textColor: 'text-red-400' },
                { label: 'In Progress', value: inProgressDefects, stroke: '#eab308', textColor: 'text-yellow-400' },
                { label: 'Resolved', value: resolvedDefects, stroke: '#22c55e', textColor: 'text-green-400' },
                { label: 'Closed', value: closedDefects, stroke: '#6b7280', textColor: 'text-gray-400' },
              ]}
              centerLabel="Total"
              centerValue={totalDefects}
            />
            <div className="pt-4 border-t border-slate-700 mt-4 flex justify-between text-sm">
              <span className="text-slate-400">Resolution Rate</span>
              <span className="text-white font-semibold">
                {totalDefects > 0 ? Math.round(((resolvedDefects + closedDefects) / totalDefects) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Manual Test Cases */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white">Manual Test Cases in this Sprint</h3>
            <p className="text-sm text-slate-400 mt-1">Planned manual test cases</p>
          </div>
          {(() => {
            const sprintRequirementIds = sprintRequirements.map(req => req.id);
            const manualTCs = testCases
              .filter(tc => sprintRequirementIds.includes(tc.requirement_id) && tc.type === 'Manual')
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            return manualTCs.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
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
                    {manualTCs.map((tc) => {
                      const requirement = requirements.find(req => req.id === tc.requirement_id);
                      return (
                        <tr key={tc.id} className="hover:bg-slate-700/50 transition-colors">
                          <td className="px-4 py-3"><span className="text-slate-400 font-mono text-sm">#{tc.id}</span></td>
                          <td className="px-4 py-3"><div className="text-white font-medium">{tc.title}</div></td>
                          <td className="px-4 py-3"><div className="text-slate-300 text-sm">{requirement ? requirement.title : '-'}</div></td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              tc.priority === 'High' ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                              : tc.priority === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            }`}>{tc.priority}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              tc.status === 'Pass' ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                              : tc.status === 'Fail' ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                              : tc.status === 'Blocked' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                              : 'bg-slate-500/10 text-slate-400 border border-slate-500/30'
                            }`}>{tc.status}</span>
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

        {/* Automation Test Cases */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white">Automation Test Cases in this Sprint</h3>
            <p className="text-sm text-slate-400 mt-1">Automation scripts linked to sprint requirements</p>
          </div>
          {(() => {
            const sprintRequirementIds = sprintRequirements.map(req => req.id);
            const automationTCs = [];
            modules.forEach(module => {
              if (module.testFiles) {
                module.testFiles.forEach(testFile => {
                  if (testFile.requirementId && sprintRequirementIds.includes(testFile.requirementId)) {
                    automationTCs.push({ ...testFile, moduleName: module.name, moduleId: module.id });
                  }
                });
              }
            });
            automationTCs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            return automationTCs.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <p>No automation test cases planned for this sprint.</p>
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
                    {automationTCs.map((testFile) => {
                      const requirement = requirements.find(req => req.id === testFile.requirementId);
                      return (
                        <tr key={testFile.id} className="hover:bg-slate-700/50 transition-colors">
                          <td className="px-4 py-3"><span className="text-slate-400 font-mono text-sm">#{testFile.id}</span></td>
                          <td className="px-4 py-3"><span className="text-slate-300 text-sm">{testFile.moduleName}</span></td>
                          <td className="px-4 py-3"><span className="text-white font-medium">{testFile.name}</span></td>
                          <td className="px-4 py-3"><div className="text-slate-300 text-sm">{testFile.requirementTitle || (requirement ? requirement.title : '-')}</div></td>
                          <td className="px-4 py-3"><span className="text-slate-400 text-sm">{new Date(testFile.createdAt).toLocaleDateString()}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>

        {/* Manual Test Runs */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white">Manual Test Runs in this Sprint</h3>
          </div>
          {(() => {
            const sprintRequirementIds = sprintRequirements.map(req => req.id);
            const sprintTestCaseIds = testCases
              .filter(tc => sprintRequirementIds.includes(tc.requirement_id))
              .map(tc => tc.id);
            const allSprintManualRuns = manualTestRuns
              .filter(run => sprintTestCaseIds.includes(run.test_case_id))
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            // Keep only the latest run per test case
            const sprintManualRuns = Object.values(
              allSprintManualRuns.reduce((acc, run) => {
                if (!acc[run.test_case_id]) acc[run.test_case_id] = run;
                return acc;
              }, {})
            );
            return sprintManualRuns.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
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
                        <tr key={run.id} className="hover:bg-slate-700/50 transition-colors">
                          <td className="px-4 py-3"><span className="text-slate-400 font-mono text-sm">#{run.id}</span></td>
                          <td className="px-4 py-3">
                            <div className="text-white font-medium">{testCase ? testCase.title : `Test Case #${run.test_case_id}`}</div>
                            {testCase?.type && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border mt-1 inline-block ${
                                testCase.type === 'Manual' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' : 'bg-green-500/10 border-green-500/30 text-green-400'
                              }`}>{testCase.type}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                              run.status === 'Passed' ? 'bg-green-500/10 border-green-500/30 text-green-400'
                              : run.status === 'Failed' ? 'bg-red-500/10 border-red-500/30 text-red-400'
                              : run.status === 'Blocked' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                              : 'bg-slate-500/10 border-slate-500/30 text-slate-400'
                            }`}>{run.status}</span>
                          </td>
                          <td className="px-4 py-3"><span className="text-slate-300 text-sm">{run.executed_by || 'N/A'}</span></td>
                          <td className="px-4 py-3">
                            <span className="text-slate-300 text-sm">
                              {new Date(run.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {run.execution_notes
                              ? <span className="text-slate-400 text-sm truncate max-w-xs block" title={run.execution_notes}>{run.execution_notes}</span>
                              : <span className="text-slate-500 text-sm">No notes</span>
                            }
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

        {/* Automation Executions */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white">Automation Executions in this Sprint</h3>
          </div>
          {(() => {
            const sprintStart = sprint.start_date ? new Date(sprint.start_date) : null;
            const sprintEnd = sprint.end_date ? new Date(sprint.end_date) : null;
            const filteredExecutions = executions.filter(exec => {
              if (!sprintStart || !sprintEnd) return true;
              const d = new Date(exec.created_at);
              return d >= sprintStart && d <= sprintEnd;
            });
            const filteredSuiteExecutions = suiteExecutions.filter(exec => {
              if (!sprintStart || !sprintEnd) return true;
              const d = new Date(exec.created_at);
              return d >= sprintStart && d <= sprintEnd;
            });
            const allExecutionsSorted = [
              ...filteredExecutions.map(e => ({ ...e, type: 'Single' })),
              ...filteredSuiteExecutions.map(e => ({ ...e, type: 'Suite' }))
            ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            // Keep only the latest execution per test file (Single) or suite (Suite)
            const allExecutions = Object.values(
              allExecutionsSorted.reduce((acc, exec) => {
                const key = exec.type === 'Suite' ? `suite-${exec.suiteName}` : `single-${exec.test_file_id}`;
                if (!acc[key]) acc[key] = exec;
                return acc;
              }, {})
            ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            return allExecutions.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
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
                      <tr key={`${exec.type}-${exec.id}`} className="hover:bg-slate-700/50 transition-colors">
                        <td className="px-4 py-3"><span className="text-slate-400 font-mono text-sm">#{exec.id}</span></td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                            exec.type === 'Suite' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                          }`}>{exec.type}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                            exec.status === 'Success' || exec.status === 'Passed' ? 'bg-green-500/10 border-green-500/30 text-green-400'
                            : exec.status === 'Failed' ? 'bg-red-500/10 border-red-500/30 text-red-400'
                            : exec.status === 'Running' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                            : 'bg-slate-500/10 border-slate-500/30 text-slate-400'
                          }`}>{exec.status}</span>
                        </td>
                        <td className="px-4 py-3"><span className="text-slate-300 text-sm">{exec.duration_ms ? `${(exec.duration_ms / 1000).toFixed(2)}s` : 'N/A'}</span></td>
                        <td className="px-4 py-3">
                          <span className="text-slate-300 text-sm">
                            {new Date(exec.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {exec.report_path ? (
                            <a
                              href={`${API_URL}${exec.report_path}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-3 py-1 bg-indigo-600 text-white text-xs rounded-md hover:bg-indigo-700 transition-colors"
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
                        <span className="text-slate-300 text-sm">{task.end_date ? formatDate(task.end_date) : <span className="text-slate-500">—</span>}</span>
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

        {/* Defects Table */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white">Defects</h3>
          </div>
          {sprintDefects.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
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
                  <tr key={defect.id} className="hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3"><span className="text-slate-400 font-mono text-sm">#{defect.id}</span></td>
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{defect.title}</div>
                      {defect.description && <div className="text-slate-400 text-sm mt-1 truncate max-w-md">{defect.description}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSeverityBadgeClass(defect.severity)}`}>{defect.severity}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getDefectStatusBadgeClass(defect.status)}`}>{defect.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default SprintDetailPage;
