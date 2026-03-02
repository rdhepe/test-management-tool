import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:3001';

function Summary() {
  const [stats, setStats] = useState({
    totalSuites: 0,
    totalTests: 0,
    last24hRuns: 0,
    successRate: 0
  });
  const [recentExecutions, setRecentExecutions] = useState([]);
  const [chartData, setChartData] = useState({ passed: 0, failed: 0 });
  const [testHealth, setTestHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const handleResetAllData = async () => {
    try {
      setResetting(true);
      setResetError(null);
      const res = await fetch(`${API_URL}/executions/all`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned ${res.status}`);
      }
      setShowResetConfirm(false);
      await loadData();
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetting(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const suitesResponse = await fetch(`${API_URL}/test-suites`);
      if (!suitesResponse.ok) throw new Error('Failed to fetch test suites');
      const suites = await suitesResponse.json();

      const executionsData = [];
      let totalTests = 0;
      let totalPassed = 0;
      let totalFailed = 0;
      let last24hCount = 0;

      for (const suite of suites) {
        const execResponse = await fetch(`${API_URL}/test-suites/${suite.id}/executions`);
        const execs = await execResponse.json();

        execs.forEach(exec => {
          executionsData.push({ ...exec, suite_name: suite.name });
          totalTests += exec.total_tests;
          totalPassed += exec.passed;
          totalFailed += exec.failed;
          const execTime = new Date(exec.created_at);
          const hoursDiff = (new Date() - execTime) / (1000 * 60 * 60);
          if (hoursDiff <= 24) last24hCount++;
        });
      }

      const sortedExecutions = executionsData
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10);

      setRecentExecutions(sortedExecutions);
      setStats({
        totalSuites: suites.length,
        totalTests,
        last24hRuns: last24hCount,
        successRate: totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0
      });
      setChartData({ passed: totalPassed, failed: totalFailed });

      // Fetch test health analytics
      try {
        const healthRes = await fetch(`${API_URL}/analytics/test-health`);
        if (healthRes.ok) setTestHealth(await healthRes.json());
      } catch (_) {}

      setLoading(false);
    } catch (err) {
      console.error('Failed to load summary data:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getProjectHealth = (successRate) => {
    if (successRate >= 80) return {
      status: 'Healthy', bgColor: 'bg-green-600/10', hoverBg: 'group-hover:bg-green-600/20',
      shadowColor: 'hover:shadow-green-600/20', textColor: 'text-green-400',
      icon: <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    };
    if (successRate >= 50) return {
      status: 'Warning', bgColor: 'bg-yellow-600/10', hoverBg: 'group-hover:bg-yellow-600/20',
      shadowColor: 'hover:shadow-yellow-600/20', textColor: 'text-yellow-400',
      icon: <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
    };
    return {
      status: 'Critical', bgColor: 'bg-red-600/10', hoverBg: 'group-hover:bg-red-600/20',
      shadowColor: 'hover:shadow-red-600/20', textColor: 'text-red-400',
      icon: <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    };
  };

  const projectHealth = getProjectHealth(parseFloat(stats.successRate));

  const DoughnutChart = ({ passed, failed }) => {
    const total = passed + failed;
    if (total === 0) return <div className="text-slate-500 text-center">No data</div>;
    const circumference = 2 * Math.PI * 80; // ≈ 502.65
    const passedArc = (passed / total) * circumference;
    const failedArc = circumference - passedArc;
    const passedPct = ((passed / total) * 100).toFixed(0);
    return (
      <div className="flex items-center justify-center gap-8">
        <div className="relative">
          <svg width="200" height="200" viewBox="0 0 200 200">
            {/* Track */}
            <circle cx="100" cy="100" r="80" fill="none" stroke="#1e293b" strokeWidth="40" />
            {/* Red (failed) full ring — drawn first as background colour */}
            <circle cx="100" cy="100" r="80" fill="none" stroke="#ef4444" strokeWidth="40"
              strokeDasharray={`${failedArc} ${passedArc}`}
              strokeDashoffset={failedArc}
              transform="rotate(-90 100 100)" className="transition-all duration-500" />
            {/* Green (passed) arc on top */}
            <circle cx="100" cy="100" r="80" fill="none" stroke="#22c55e" strokeWidth="40"
              strokeDasharray={`${passedArc} ${failedArc}`}
              strokeDashoffset={0}
              transform="rotate(-90 100 100)" className="transition-all duration-500" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <div className="text-3xl font-bold text-white">{passedPct}%</div>
            <div className="text-sm text-slate-400">Success</div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded bg-green-500"></div>
            <div><div className="text-sm text-slate-400">Passed</div><div className="text-lg font-semibold text-white">{passed}</div></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded bg-red-500"></div>
            <div><div className="text-sm text-slate-400">Failed</div><div className="text-lg font-semibold text-white">{failed}</div></div>
          </div>
        </div>
      </div>
    );
  };

  const TrendChart = ({ executions }) => {
    if (executions.length === 0)
      return <div className="text-slate-500 text-center h-48 flex items-center justify-center">No execution data</div>;
    const last7 = executions.slice(0, 7).reverse();
    const maxTests = Math.max(...last7.map(e => e.total_tests), 1);
    const width = 600, height = 200, padding = 40;
    const points = last7.map((exec, i) => ({
      x: padding + (i * (width - 2 * padding) / (last7.length - 1 || 1)),
      y: height - padding - ((exec.passed / maxTests) * (height - 2 * padding)),
      exec
    }));
    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <svg width={width} height={height} className="overflow-visible">
          {[0,1,2,3,4].map(i => (
            <line key={i} x1={padding} y1={padding + (i*(height-2*padding)/4)} x2={width-padding} y2={padding+(i*(height-2*padding)/4)} stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
          ))}
          <path d={pathData} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point, i) => (
            <g key={i}>
              <circle cx={point.x} cy={point.y} r="5" fill="#6366f1" />
              <title>{`${point.exec.passed}/${point.exec.total_tests} passed`}</title>
            </g>
          ))}
          {points.map((point, i) => (
            <text key={`label-${i}`} x={point.x} y={height-10} textAnchor="middle" fill="#94a3b8" fontSize="12">#{last7.length - i}</text>
          ))}
        </svg>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="mb-8"><div className="h-8 bg-slate-800 rounded w-32"></div></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="h-4 bg-slate-800 rounded w-24 mb-4"></div>
              <div className="h-8 bg-slate-800 rounded w-16"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 max-w-md text-center">
          <h3 className="text-xl font-semibold text-red-400 mb-2">Failed to Load Summary</h3>
          <p className="text-slate-400 mb-6">{error}</p>
          <button onClick={loadData} className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors mx-auto flex items-center gap-2">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-page-transition">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Automation Summary</h1>
          <p className="text-slate-400 mt-2">Monitor your test automation performance</p>
        </div>
        <button
          onClick={() => { setShowResetConfirm(true); setResetError(null); }}
          className="flex items-center gap-2 bg-slate-800 hover:bg-red-900/40 border border-slate-700 hover:border-red-700/50 text-slate-400 hover:text-red-400 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Reset Execution Data
        </button>
      </div>

      {/* Reset confirmation modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowResetConfirm(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white">Reset All Execution Data?</h2>
            </div>
            <p className="text-slate-400 text-sm mb-6">
              This will permanently delete all single-run and suite execution history, including logs, results, and screenshots. Your test files, modules, and suites will not be affected.
            </p>
            {resetError && (
              <div className="mb-4 px-3 py-2 bg-red-950/50 border border-red-700/40 rounded-lg text-red-400 text-xs">
                {resetError}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetAllData}
                disabled={resetting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {resetting ? 'Clearing...' : 'Yes, Reset Everything'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 hover:shadow-xl hover:shadow-indigo-600/20 transition-all duration-200 cursor-pointer group card-hover">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-indigo-600/10 rounded-xl group-hover:bg-indigo-600/20 transition-colors">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
          </div>
          <div className="text-4xl font-bold text-white mb-2">{stats.totalSuites}</div>
          <div className="text-sm text-slate-400">Total Test Suites</div>
        </div>

        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 hover:shadow-xl hover:shadow-blue-600/20 transition-all duration-200 cursor-pointer group card-hover">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-blue-600/10 rounded-xl group-hover:bg-blue-600/20 transition-colors">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
          </div>
          <div className="text-4xl font-bold text-white mb-2">{stats.totalTests}</div>
          <div className="text-sm text-slate-400">Total Tests Executed</div>
        </div>

        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 hover:shadow-xl hover:shadow-purple-600/20 transition-all duration-200 cursor-pointer group card-hover">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-purple-600/10 rounded-xl group-hover:bg-purple-600/20 transition-colors">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
          </div>
          <div className="text-4xl font-bold text-white mb-2">{stats.last24hRuns}</div>
          <div className="text-sm text-slate-400">Last 24h Runs</div>
        </div>

        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 hover:shadow-xl hover:shadow-green-600/20 transition-all duration-200 cursor-pointer group card-hover">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-green-600/10 rounded-xl group-hover:bg-green-600/20 transition-colors">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
          <div className="text-4xl font-bold text-white mb-2">{stats.successRate}%</div>
          <div className="text-sm text-slate-400">Success Rate</div>
        </div>

        <div className={`bg-slate-900 rounded-xl p-6 border border-slate-800 hover:shadow-xl ${projectHealth.shadowColor} transition-all duration-200 cursor-pointer group card-hover`}>
          <div className="flex items-start justify-between mb-4">
            <div className={`p-3 ${projectHealth.bgColor} rounded-xl ${projectHealth.hoverBg} transition-colors`}>
              {projectHealth.icon}
            </div>
          </div>
          <div className={`text-4xl font-bold mb-2 ${projectHealth.textColor}`}>{projectHealth.status}</div>
          <div className="text-sm text-slate-400">Project Health</div>
          <div className="text-xs text-slate-500 mt-2">
            {stats.successRate >= 80 ? '≥80% pass rate' : stats.successRate >= 50 ? '50–79% pass rate' : '<50% pass rate'}
          </div>
        </div>
      </div>

      {/* Recent Suite Executions */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-lg overflow-hidden">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-white">Recent Suite Executions</h2>
          <p className="text-sm text-slate-400 mt-1">Latest test suite runs</p>
        </div>
        {recentExecutions.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No executions found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800">
                <tr>
                  {['Suite Name','Status','Duration','Success %','Date'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {recentExecutions.map(exec => {
                  const pct = exec.total_tests > 0 ? ((exec.passed / exec.total_tests) * 100).toFixed(0) : 0;
                  return (
                    <tr key={exec.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-white">{exec.suite_name}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-xl text-xs font-medium ${exec.status === 'PASS' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>{exec.status}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">{formatDuration(exec.duration_ms)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-700 rounded-full h-2 max-w-[100px]">
                            <div className={`h-2 rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }}></div>
                          </div>
                          <span className="text-sm text-slate-300 min-w-[40px]">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">{formatDate(exec.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Pass vs Fail Distribution</h2>
          <DoughnutChart passed={chartData.passed} failed={chartData.failed} />
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Last 7 Executions Trend</h2>
          <TrendChart executions={recentExecutions} />
        </div>
      </div>

      {/* Test Health Insights */}
      {testHealth && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-3">Test Health Insights</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Consistently Failing */}
            <div className="bg-slate-900 rounded-xl border border-red-900/40 shadow-lg overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-red-900/30 bg-red-950/20">
                <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-sm font-semibold text-red-400">Consistently Failing</span>
                <span className="ml-auto text-xs text-slate-500">Failed in last 5 runs</span>
                {testHealth.consistentlyFailing.length > 0 && (
                  <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-0.5 rounded-full border border-red-500/30">{testHealth.consistentlyFailing.length}</span>
                )}
              </div>
              {testHealth.consistentlyFailing.length === 0 ? (
                <div className="px-5 py-8 text-center text-slate-500 text-sm">No consistently failing tests</div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {testHealth.consistentlyFailing.map((t, i) => (
                    <div key={i} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{t.test_name}</div>
                        <div className="text-xs text-slate-500">{t.suite_name} &bull; {t.fail_count} total failures</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {t.last5_statuses.map((s, j) => (
                          <span key={j} title={s} className={`w-3 h-3 rounded-sm ${s === 'PASS' ? 'bg-green-500' : s === 'TIMEOUT' ? 'bg-amber-500' : 'bg-red-500'}`} />
                        ))}
                      </div>
                      {t.failing_streak > 0 && (
                        <span className="text-xs text-red-400 font-mono shrink-0">{t.failing_streak} streak</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Flaky Tests */}
            <div className="bg-slate-900 rounded-xl border border-amber-900/40 shadow-lg overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-amber-900/30 bg-amber-950/20">
                <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <span className="text-sm font-semibold text-amber-400">Flaky Tests</span>
                <span className="ml-auto text-xs text-slate-500">Mixed pass/fail results</span>
                {testHealth.flaky.length > 0 && (
                  <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full border border-amber-500/30">{testHealth.flaky.length}</span>
                )}
              </div>
              {testHealth.flaky.length === 0 ? (
                <div className="px-5 py-8 text-center text-slate-500 text-sm">No flaky tests detected</div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {testHealth.flaky.map((t, i) => (
                    <div key={i} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{t.test_name}</div>
                        <div className="text-xs text-slate-500">{t.suite_name} &bull; {t.pass_rate}% pass rate over {t.total_runs} runs</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {t.last5_statuses.map((s, j) => (
                          <span key={j} title={s} className={`w-3 h-3 rounded-sm ${s === 'PASS' ? 'bg-green-500' : s === 'TIMEOUT' ? 'bg-amber-500' : 'bg-red-500'}`} />
                        ))}
                      </div>
                      <div className="shrink-0 w-16">
                        <div className="h-1.5 bg-slate-700 rounded-full">
                          <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${t.pass_rate}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Slowest Tests */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-lg overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-800">
                <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-sm font-semibold text-slate-300">Slowest Tests</span>
                <span className="ml-auto text-xs text-slate-500">By avg duration</span>
              </div>
              {testHealth.slowest.length === 0 ? (
                <div className="px-5 py-8 text-center text-slate-500 text-sm">No data yet</div>
              ) : (() => {
                const maxMs = testHealth.slowest[0].avg_duration_ms || 1;
                return (
                  <div className="divide-y divide-slate-800">
                    {testHealth.slowest.map((t, i) => (
                      <div key={i} className="px-5 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-white truncate max-w-[60%]">{t.test_name}</span>
                          <span className="text-xs text-slate-400 font-mono shrink-0">
                            {t.avg_duration_ms >= 1000 ? `${(t.avg_duration_ms / 1000).toFixed(1)}s` : `${t.avg_duration_ms}ms`}
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full">
                          <div className="h-1.5 rounded-full bg-blue-500/70" style={{ width: `${(t.avg_duration_ms / maxMs) * 100}%` }} />
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">{t.suite_name}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Most Failed */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-lg overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-800">
                <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                <span className="text-sm font-semibold text-slate-300">Most Failed</span>
                <span className="ml-auto text-xs text-slate-500">All-time failure count</span>
              </div>
              {testHealth.mostFailed.length === 0 ? (
                <div className="px-5 py-8 text-center text-slate-500 text-sm">No failures recorded</div>
              ) : (() => {
                const maxFails = testHealth.mostFailed[0].fail_count || 1;
                return (
                  <div className="divide-y divide-slate-800">
                    {testHealth.mostFailed.map((t, i) => (
                      <div key={i} className="px-5 py-3 flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-600 w-4 shrink-0">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{t.test_name}</div>
                          <div className="flex gap-3 mt-0.5">
                            <div className="h-1.5 flex-1 bg-slate-800 rounded-full mt-1">
                              <div className="h-1.5 rounded-full bg-rose-500/70" style={{ width: `${(t.fail_count / maxFails) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-bold text-rose-400">{t.fail_count}</div>
                          <div className="text-xs text-slate-500">{t.pass_rate}% pass</div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default Summary;
