import React, { useState, useEffect, useCallback } from 'react';

import API_URL from '../apiUrl';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const useReportData = (endpoints) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const results = await Promise.all(
        endpoints.map(e => fetch(`${API_URL}${e}`).then(r => r.json()))
      );
      setData(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);
  return { data, loading, error, reload: load };
};

const LoadingState = () => (
  <div className="flex items-center justify-center py-24 text-slate-400">
    <svg className="w-5 h-5 animate-spin mr-3" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
    Loading report data…
  </div>
);

const ErrorState = ({ msg }) => (
  <div className="flex items-center justify-center py-24 text-red-400">{msg}</div>
);

const StatCard = ({ label, value, sub, color = 'text-white', border = 'border-slate-700' }) => (
  <div className={`bg-slate-800 rounded-xl p-4 border ${border}`}>
    <p className="text-xs text-slate-400 uppercase font-semibold mb-1">{label}</p>
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
    {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
  </div>
);

const ProgressBar = ({ value, max, colorClass = 'bg-indigo-500' }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-700 rounded-full h-2">
        <div className={`${colorClass} h-2 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
    </div>
  );
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const fmtDur = (ms) => {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
};

const badge = (label, cls) => (
  <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${cls}`}>{label}</span>
);

const tcStatusCls = (s) =>
  s === 'Pass' || s === 'Passed' ? 'bg-green-500/15 text-green-400 border-green-500/30'
  : s === 'Fail' || s === 'Failed' ? 'bg-red-500/15 text-red-400 border-red-500/30'
  : s === 'Blocked' ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
  : 'bg-slate-500/15 text-slate-400 border-slate-500/30';

const priorityCls = (p) =>
  p === 'High' ? 'bg-red-500/10 text-red-400 border-red-500/30'
  : p === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
  : 'bg-blue-500/10 text-blue-400 border-blue-500/30';

const sevCls = (s) =>
  s === 'Critical' ? 'bg-red-500/10 text-red-400 border-red-500/30'
  : s === 'High' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
  : s === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
  : 'bg-blue-500/10 text-blue-400 border-blue-500/30';

// ─── 1. Traceability Report ───────────────────────────────────────────────────

function TraceabilityReport({ sprintId = '' }) {
  const { data, loading, error } = useReportData(['/features', '/requirements', '/test-cases', '/defects']);
  const [expandedFeatures, setExpandedFeatures] = useState({});
  const [expandedReqs, setExpandedReqs] = useState({});
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  if (loading) return <LoadingState />;
  if (error) return <ErrorState msg={error} />;

  const [features, allRequirements, testCases, defects] = data;
  const requirements = sprintId
    ? allRequirements.filter(r => String(r.sprint_id) === String(sprintId))
    : allRequirements;
  const activeFeatures = sprintId
    ? features.filter(f => requirements.some(r => r.feature_id === f.id))
    : features;

  const reqsWithTC = requirements.filter(r => testCases.some(tc => tc.requirement_id === r.id)).length;
  const coverage = requirements.length > 0 ? Math.round((reqsWithTC / requirements.length) * 100) : 0;

  const expandAll = () => {
    setExpandedFeatures(Object.fromEntries(activeFeatures.map(f => [f.id, true])));
    setExpandedReqs(Object.fromEntries(requirements.map(r => [r.id, true])));
  };

  const filteredFeatures = activeFeatures.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getReqsForFeature = (fid) => {
    let reqs = requirements.filter(r => r.feature_id === fid);
    if (filterStatus === 'Covered') reqs = reqs.filter(r => testCases.some(tc => tc.requirement_id === r.id));
    if (filterStatus === 'Uncovered') reqs = reqs.filter(r => !testCases.some(tc => tc.requirement_id === r.id));
    return reqs;
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="Features" value={activeFeatures.length} color="text-indigo-400" border="border-indigo-500/30" />
        <StatCard label="Requirements" value={requirements.length} color="text-purple-400" border="border-purple-500/30" />
        <StatCard label="Test Cases" value={testCases.length} color="text-blue-400" border="border-blue-500/30" />
        <StatCard label="Defects" value={defects.length} color="text-red-400" border="border-red-500/30" />
        <StatCard label="TC Coverage" value={`${coverage}%`}
          color={coverage >= 80 ? 'text-green-400' : coverage >= 50 ? 'text-yellow-400' : 'text-red-400'}
          sub={`${reqsWithTC} of ${requirements.length} reqs covered`} />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
          </svg>
          <input type="text" placeholder="Search features…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-500" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="All">All Requirements</option>
          <option value="Covered">Covered Only</option>
          <option value="Uncovered">Uncovered Only</option>
        </select>
        <div className="ml-auto flex gap-2">
          <button onClick={expandAll} className="px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors">Expand All</button>
          <button onClick={() => { setExpandedFeatures({}); setExpandedReqs({}); }}
            className="px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors">Collapse All</button>
        </div>
      </div>

      <div className="space-y-2">
        {filteredFeatures.map(feature => {
          const freqs = getReqsForFeature(feature.id);
          const ftcs = testCases.filter(tc => freqs.some(r => r.id === tc.requirement_id));
          const fdefs = defects.filter(d => ftcs.some(tc => tc.id === d.linked_test_case_id));
          const fExp = !!expandedFeatures[feature.id];
          return (
            <div key={feature.id} className="rounded-xl border border-slate-700 overflow-hidden">
              <button onClick={() => setExpandedFeatures(p => ({ ...p, [feature.id]: !p[feature.id] }))}
                className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700/80 transition-colors text-left">
                <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${fExp ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 flex-shrink-0" />
                <span className="font-semibold text-white text-sm flex-1 truncate">{feature.name}</span>
                <div className="flex items-center gap-3 text-xs text-slate-400 flex-shrink-0">
                  <span>{freqs.length} req{freqs.length !== 1 ? 's' : ''}</span>
                  <span className="text-blue-400">{ftcs.length} TCs</span>
                  {fdefs.length > 0 && <span className="text-red-400">{fdefs.length} defect{fdefs.length > 1 ? 's' : ''}</span>}
                </div>
              </button>
              {fExp && (
                <div className="bg-slate-900 border-t border-slate-700">
                  {freqs.length === 0
                    ? <p className="text-slate-500 text-xs px-10 py-3">No requirements match current filter.</p>
                    : freqs.map(req => {
                      const rtcs = testCases.filter(tc => tc.requirement_id === req.id);
                      const rExp = !!expandedReqs[req.id];
                      return (
                        <div key={req.id} className="border-b border-slate-800 last:border-b-0">
                          <button onClick={() => setExpandedReqs(p => ({ ...p, [req.id]: !p[req.id] }))}
                            className="w-full flex items-center gap-3 px-10 py-2.5 hover:bg-slate-800/60 transition-colors text-left">
                            <svg className={`w-3.5 h-3.5 text-slate-500 flex-shrink-0 transition-transform ${rExp ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                            <span className="text-slate-200 text-sm flex-1 truncate">{req.title}</span>
                            {req.priority && badge(req.priority, priorityCls(req.priority))}
                            {rtcs.length === 0
                              ? <span className="text-orange-400 text-xs font-medium flex-shrink-0">⚠ Not covered</span>
                              : <span className="text-blue-400 text-xs flex-shrink-0">{rtcs.length} TC{rtcs.length > 1 ? 's' : ''}</span>}
                          </button>
                          {rExp && (
                            <div className="pl-16 pr-4 pb-3 space-y-1.5">
                              {rtcs.length === 0
                                ? <p className="text-slate-600 text-xs py-2">No test cases linked.</p>
                                : rtcs.map(tc => {
                                  const tcdefs = defects.filter(d => d.linked_test_case_id === tc.id);
                                  return (
                                    <div key={tc.id} className="bg-slate-800 rounded-lg border border-slate-700 px-3 py-2">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                                        <span className="text-slate-300 text-xs flex-1 truncate">{tc.title}</span>
                                        {tc.type && badge(tc.type, tc.type === 'Manual' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' : 'bg-green-500/10 text-green-400 border-green-500/30')}
                                        {badge(tc.status || 'Not Run', tcStatusCls(tc.status))}
                                        {tcdefs.length > 0 && <span className="text-xs text-red-400">{tcdefs.length} defect{tcdefs.length > 1 ? 's' : ''}</span>}
                                      </div>
                                      {tcdefs.length > 0 && (
                                        <div className="mt-2 pl-3 space-y-1 border-l-2 border-red-500/30">
                                          {tcdefs.map(d => (
                                            <div key={d.id} className="flex items-center gap-2 text-xs">
                                              <span className="text-slate-500">#{d.id}</span>
                                              <span className="text-slate-300 truncate flex-1">{d.title}</span>
                                              {badge(d.severity, sevCls(d.severity))}
                                              <span className={d.status === 'Open' ? 'text-red-400' : d.status === 'In Progress' ? 'text-yellow-400' : d.status === 'Resolved' ? 'text-green-400' : 'text-slate-400'}>{d.status}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              }
                            </div>
                          )}
                        </div>
                      );
                    })
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 2. Test Coverage Report ──────────────────────────────────────────────────

function TestCoverageReport({ sprintId = '' }) {
  const { data, loading, error } = useReportData(['/features', '/requirements', '/test-cases']);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState msg={error} />;
  const [features, allRequirements, testCases] = data;
  const requirements = sprintId
    ? allRequirements.filter(r => String(r.sprint_id) === String(sprintId))
    : allRequirements;

  const reqsWithTC = requirements.filter(r => testCases.some(tc => tc.requirement_id === r.id)).length;
  const globalCoverage = requirements.length > 0 ? Math.round((reqsWithTC / requirements.length) * 100) : 0;
  const passed = testCases.filter(tc => tc.status === 'Pass' || tc.status === 'Passed').length;
  const failed = testCases.filter(tc => tc.status === 'Fail' || tc.status === 'Failed').length;
  const blocked = testCases.filter(tc => tc.status === 'Blocked').length;
  const notRun = testCases.length - passed - failed - blocked;

  const featureRows = features.map(f => {
    const reqs = requirements.filter(r => r.feature_id === f.id);
    const tcs = testCases.filter(tc => reqs.some(r => r.id === tc.requirement_id));
    const covReqs = reqs.filter(r => testCases.some(tc => tc.requirement_id === r.id));
    const p = tcs.filter(tc => tc.status === 'Pass' || tc.status === 'Passed').length;
    const fa = tcs.filter(tc => tc.status === 'Fail' || tc.status === 'Failed').length;
    const bl = tcs.filter(tc => tc.status === 'Blocked').length;
    return { ...f, reqs, tcs, covReqs, p, fa, bl, nr: tcs.length - p - fa - bl };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="Req Coverage" value={`${globalCoverage}%`} sub={`${reqsWithTC}/${requirements.length} reqs`}
          color={globalCoverage >= 80 ? 'text-green-400' : globalCoverage >= 50 ? 'text-yellow-400' : 'text-red-400'}
          border={globalCoverage >= 80 ? 'border-green-500/30' : globalCoverage >= 50 ? 'border-yellow-500/30' : 'border-red-500/30'} />
        <StatCard label="Passed" value={passed} sub={`${testCases.length > 0 ? Math.round((passed/testCases.length)*100) : 0}%`} color="text-green-400" border="border-green-500/30" />
        <StatCard label="Failed" value={failed} sub={`${testCases.length > 0 ? Math.round((failed/testCases.length)*100) : 0}%`} color="text-red-400" border="border-red-500/30" />
        <StatCard label="Blocked" value={blocked} color="text-orange-400" border="border-orange-500/30" />
        <StatCard label="Not Run" value={notRun} color="text-slate-400" />
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-white">Coverage by Feature</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/80">
              <tr>
                {['Feature', 'Reqs', 'Req Coverage', 'Test Cases', 'Passed', 'Failed', 'Blocked', 'Not Run', 'Pass Rate'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {featureRows.map(f => {
                const passRate = f.tcs.length > 0 ? Math.round((f.p / f.tcs.length) * 100) : null;
                const reqCov = f.reqs.length > 0 ? Math.round((f.covReqs.length / f.reqs.length) * 100) : null;
                return (
                  <tr key={f.id} className="hover:bg-slate-700/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{f.name}</td>
                    <td className="px-4 py-3 text-slate-300">{f.reqs.length}</td>
                    <td className="px-4 py-3 w-36">{reqCov === null ? <span className="text-slate-500 text-xs">—</span> : <ProgressBar value={f.covReqs.length} max={f.reqs.length} colorClass={reqCov >= 80 ? 'bg-green-500' : reqCov >= 50 ? 'bg-yellow-500' : 'bg-red-500'} />}</td>
                    <td className="px-4 py-3 text-slate-300">{f.tcs.length}</td>
                    <td className="px-4 py-3 text-green-400 font-medium">{f.p}</td>
                    <td className="px-4 py-3 text-red-400 font-medium">{f.fa}</td>
                    <td className="px-4 py-3 text-orange-400">{f.bl}</td>
                    <td className="px-4 py-3 text-slate-400">{f.nr}</td>
                    <td className="px-4 py-3">
                      {passRate === null
                        ? <span className="text-slate-500 text-xs">No TCs</span>
                        : <span className={`font-semibold ${passRate === 100 ? 'text-green-400' : passRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{passRate}%</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {(() => {
        const uncovered = requirements.filter(r => !testCases.some(tc => tc.requirement_id === r.id));
        return (
          <div className="bg-slate-800 rounded-xl border border-orange-500/30 overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-sm font-semibold text-orange-300">Uncovered Requirements ({uncovered.length})</h3>
            </div>
            {uncovered.length === 0
              ? <p className="p-4 text-green-400 text-sm">✓ All requirements have at least one test case.</p>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-700">
                      <tr>{['ID', 'Title', 'Feature', 'Priority', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {uncovered.map(r => {
                        const feat = features.find(f => f.id === r.feature_id);
                        return (
                          <tr key={r.id} className="hover:bg-slate-700/40">
                            <td className="px-4 py-3 text-slate-400 font-mono text-xs">#{r.id}</td>
                            <td className="px-4 py-3 text-white">{r.title}</td>
                            <td className="px-4 py-3 text-slate-300">{feat?.name || '—'}</td>
                            <td className="px-4 py-3">{r.priority ? badge(r.priority, priorityCls(r.priority)) : '—'}</td>
                            <td className="px-4 py-3 text-slate-400 text-xs">{r.status || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        );
      })()}
    </div>
  );
}

// ─── 3. Defect Analysis ───────────────────────────────────────────────────────

function DefectAnalysisReport({ sprintId = '' }) {
  const { data, loading, error } = useReportData(['/defects', '/features', '/requirements', '/test-cases', '/sprints']);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState msg={error} />;
  const [allDefects, features, allRequirements, testCases, sprints] = data;
  const defects = sprintId
    ? allDefects.filter(d => String(d.sprint_id) === String(sprintId))
    : allDefects;
  const requirements = sprintId
    ? allRequirements.filter(r => String(r.sprint_id) === String(sprintId))
    : allRequirements;

  const count = (arr, key) => arr.reduce((acc, d) => { acc[d[key]] = (acc[d[key]] || 0) + 1; return acc; }, {});
  const bySev = count(defects, 'severity');
  const byStat = count(defects, 'status');

  const featureRows = features.map(f => {
    const reqs = requirements.filter(r => r.feature_id === f.id);
    const tcs = testCases.filter(tc => reqs.some(r => r.id === tc.requirement_id));
    const fDef = defects.filter(d => tcs.some(tc => tc.id === d.linked_test_case_id));
    return { ...f, total: fDef.length, open: fDef.filter(d => d.status === 'Open').length, critical: fDef.filter(d => d.severity === 'Critical').length };
  }).sort((a, b) => b.total - a.total).filter(f => f.total > 0);

  const sprintRows = sprints.map(s => {
    const sd = defects.filter(d => d.sprint_id === s.id);
    return { ...s, total: sd.length, open: sd.filter(d => d.status === 'Open').length, resolved: sd.filter(d => ['Resolved', 'Closed'].includes(d.status)).length, critical: sd.filter(d => d.severity === 'Critical').length };
  }).filter(s => s.total > 0);

  const sevs = ['Critical', 'High', 'Medium', 'Low'];
  const stats = ['Open', 'In Progress', 'Resolved', 'Closed'];
  const sevBar = { Critical: 'bg-red-500', High: 'bg-orange-500', Medium: 'bg-yellow-500', Low: 'bg-blue-500' };
  const statBar = { Open: 'bg-red-500', 'In Progress': 'bg-yellow-500', Resolved: 'bg-green-500', Closed: 'bg-slate-500' };
  const statText = { Open: 'text-red-400', 'In Progress': 'text-yellow-400', Resolved: 'text-green-400', Closed: 'text-slate-400' };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="Total Defects" value={defects.length} />
        {stats.map(s => (
          <StatCard key={s} label={s} value={byStat[s] || 0}
            color={statText[s]}
            sub={`${defects.length > 0 ? Math.round(((byStat[s] || 0) / defects.length) * 100) : 0}% of total`} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">By Severity</h3>
          <div className="space-y-3">
            {sevs.map(s => (
              <div key={s}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">{s}</span>
                  <span className="text-slate-400 font-mono">{bySev[s] || 0}</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2.5">
                  <div className={`${sevBar[s]} h-2.5 rounded-full`} style={{ width: `${defects.length > 0 ? ((bySev[s] || 0) / defects.length) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">By Status</h3>
          <div className="space-y-3">
            {stats.map(s => (
              <div key={s}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">{s}</span>
                  <span className={`font-mono font-semibold ${statText[s]}`}>{byStat[s] || 0}</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2.5">
                  <div className={`${statBar[s]} h-2.5 rounded-full`} style={{ width: `${defects.length > 0 ? ((byStat[s] || 0) / defects.length) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {featureRows.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700"><h3 className="text-sm font-semibold text-white">Defects by Feature</h3></div>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700"><tr>
              {['Feature', 'Total', 'Open', 'Critical'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-700">
              {featureRows.map(f => (
                <tr key={f.id} className="hover:bg-slate-700/40">
                  <td className="px-4 py-3 text-white font-medium">{f.name}</td>
                  <td className="px-4 py-3 text-white font-bold">{f.total}</td>
                  <td className="px-4 py-3"><span className={f.open > 0 ? 'text-red-400 font-semibold' : 'text-slate-400'}>{f.open}</span></td>
                  <td className="px-4 py-3"><span className={f.critical > 0 ? 'text-red-400 font-semibold' : 'text-slate-400'}>{f.critical}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sprintRows.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700"><h3 className="text-sm font-semibold text-white">Defects by Sprint</h3></div>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700"><tr>
              {['Sprint', 'Status', 'Total', 'Open', 'Resolved/Closed', 'Critical'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-700">
              {sprintRows.map(s => (
                <tr key={s.id} className="hover:bg-slate-700/40">
                  <td className="px-4 py-3 text-white font-medium">{s.name}</td>
                  <td className="px-4 py-3">{badge(s.status, s.status === 'Active' ? 'bg-green-500/10 text-green-400 border-green-500/30' : s.status === 'Completed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30')}</td>
                  <td className="px-4 py-3 text-white font-bold">{s.total}</td>
                  <td className="px-4 py-3"><span className={s.open > 0 ? 'text-red-400 font-semibold' : 'text-slate-400'}>{s.open}</span></td>
                  <td className="px-4 py-3 text-green-400">{s.resolved}</td>
                  <td className="px-4 py-3"><span className={s.critical > 0 ? 'text-red-400 font-semibold' : 'text-slate-400'}>{s.critical}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700"><h3 className="text-sm font-semibold text-white">All Defects</h3></div>
        {defects.length === 0
          ? <p className="p-4 text-slate-500 text-sm">No defects recorded.</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-700"><tr>
                  {['ID', 'Title', 'Severity', 'Status', 'Linked TC', 'Sprint'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-slate-700">
                  {defects.map(d => {
                    const tc = testCases.find(t => t.id === d.linked_test_case_id);
                    const sprint = sprints.find(s => s.id === d.sprint_id);
                    return (
                      <tr key={d.id} className="hover:bg-slate-700/40">
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">#{d.id}</td>
                        <td className="px-4 py-3 text-white max-w-xs truncate">{d.title}</td>
                        <td className="px-4 py-3">{badge(d.severity, sevCls(d.severity))}</td>
                        <td className="px-4 py-3"><span className={statText[d.status] || 'text-slate-400'}>{d.status}</span></td>
                        <td className="px-4 py-3 text-slate-300 text-xs truncate max-w-xs">{tc ? tc.title : '—'}</td>
                        <td className="px-4 py-3 text-slate-300 text-xs">{sprint ? sprint.name : '—'}</td>
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
}

// ─── 4. Sprint Progress ───────────────────────────────────────────────────────

function SprintProgressReport({ sprintId = '' }) {
  const { data, loading, error } = useReportData(['/sprints', '/requirements', '/test-cases', '/defects']);
  const [expanded, setExpanded] = useState(null);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState msg={error} />;
  const [sprints, requirements, testCases, defects] = data;

  const sprintRows = sprints.map(s => {
    const reqs = requirements.filter(r => r.sprint_id === s.id);
    const tcs = testCases.filter(tc => reqs.some(r => r.id === tc.requirement_id));
    const passed = tcs.filter(tc => tc.status === 'Pass' || tc.status === 'Passed').length;
    const failed = tcs.filter(tc => tc.status === 'Fail' || tc.status === 'Failed').length;
    const blocked = tcs.filter(tc => tc.status === 'Blocked').length;
    const notRun = tcs.length - passed - failed - blocked;
    const sd = defects.filter(d => d.sprint_id === s.id);
    const manual = tcs.filter(tc => tc.type === 'Manual').length;
    const auto = tcs.filter(tc => tc.type === 'Automated').length;
    const passRate = tcs.length > 0 ? Math.round((passed / tcs.length) * 100) : null;
    const reqCov = reqs.length > 0 ? Math.round((reqs.filter(r => testCases.some(tc => tc.requirement_id === r.id)).length / reqs.length) * 100) : null;
    return { ...s, reqs, tcs, passed, failed, blocked, notRun, sd, manual, auto, passRate, reqCov };
  });

  const filteredSprintRows = sprintId
    ? sprintRows.filter(s => String(s.id) === String(sprintId))
    : sprintRows;

  const groups = [
    { label: 'Active Sprints', color: 'text-green-400', rows: filteredSprintRows.filter(s => s.status === 'Active') },
    { label: 'Planned Sprints', color: 'text-yellow-400', rows: filteredSprintRows.filter(s => s.status === 'Planned') },
    { label: 'Completed Sprints', color: 'text-blue-400', rows: filteredSprintRows.filter(s => s.status === 'Completed') },
  ].filter(g => g.rows.length > 0);

  const SprintRow = ({ s }) => (
    <div className="rounded-xl border border-slate-700 overflow-hidden mb-3">
      <button onClick={() => setExpanded(expanded === s.id ? null : s.id)}
        className="w-full flex items-center gap-4 px-5 py-4 bg-slate-800 hover:bg-slate-700/80 transition-colors text-left">
        <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${expanded === s.id ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-white">{s.name}</span>
            {badge(s.status, s.status === 'Active' ? 'bg-green-500/10 text-green-400 border-green-500/30' : s.status === 'Completed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30')}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{fmtDate(s.start_date)} → {fmtDate(s.end_date)}</p>
        </div>
        <div className="grid grid-cols-5 gap-6 flex-shrink-0 text-center">
          {[['Reqs', s.reqs.length, 'text-white'], ['TCs', s.tcs.length, 'text-white'],
            ['Pass Rate', s.passRate !== null ? `${s.passRate}%` : '—', s.passRate === null ? 'text-slate-500' : s.passRate >= 80 ? 'text-green-400' : s.passRate >= 50 ? 'text-yellow-400' : 'text-red-400'],
            ['Defects', s.sd.length, s.sd.length > 0 ? 'text-red-400' : 'text-slate-400'],
            ['Req Cov.', s.reqCov !== null ? `${s.reqCov}%` : '—', s.reqCov === null ? 'text-slate-500' : s.reqCov >= 80 ? 'text-green-400' : s.reqCov >= 50 ? 'text-yellow-400' : 'text-red-400']
          ].map(([l, v, c]) => (
            <div key={l}><div className={`text-lg font-bold ${c}`}>{v}</div><div className="text-xs text-slate-500">{l}</div></div>
          ))}
        </div>
      </button>
      {expanded === s.id && (
        <div className="bg-slate-900 border-t border-slate-700 p-5 grid grid-cols-3 gap-5">
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">Test Execution</h4>
            <div className="space-y-2">
              {[['Passed', s.passed, 'bg-green-500'], ['Failed', s.failed, 'bg-red-500'], ['Blocked', s.blocked, 'bg-orange-500'], ['Not Run', s.notRun, 'bg-slate-500']].map(([l, v, c]) => (
                <div key={l}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-slate-300">{l}</span><span className="text-slate-400">{v}</span></div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5"><div className={`${c} h-1.5 rounded-full`} style={{ width: `${s.tcs.length > 0 ? (v / s.tcs.length) * 100 : 0}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">Automation Mix</h4>
            <div className="space-y-2">
              <div><div className="flex justify-between text-xs mb-1"><span className="text-slate-300">Automated</span><span className="text-green-400">{s.auto}</span></div><div className="w-full bg-slate-700 rounded-full h-1.5"><div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${s.tcs.length > 0 ? (s.auto / s.tcs.length) * 100 : 0}%` }} /></div></div>
              <div><div className="flex justify-between text-xs mb-1"><span className="text-slate-300">Manual</span><span className="text-yellow-400">{s.manual}</span></div><div className="w-full bg-slate-700 rounded-full h-1.5"><div className="bg-yellow-500 h-1.5 rounded-full" style={{ width: `${s.tcs.length > 0 ? (s.manual / s.tcs.length) * 100 : 0}%` }} /></div></div>
              <p className="text-lg font-bold text-white pt-2">{s.tcs.length > 0 ? Math.round((s.auto / s.tcs.length) * 100) : 0}%<span className="text-xs text-slate-400 font-normal ml-1">automation</span></p>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">Defects ({s.sd.length})</h4>
            {s.sd.length === 0
              ? <p className="text-slate-500 text-xs">No defects in this sprint.</p>
              : <div className="space-y-1.5">
                {s.sd.slice(0, 6).map(d => (
                  <div key={d.id} className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 font-mono flex-shrink-0">#{d.id}</span>
                    <span className="text-slate-300 truncate flex-1">{d.title}</span>
                    <span className={d.severity === 'Critical' ? 'text-red-400 flex-shrink-0' : d.severity === 'High' ? 'text-orange-400 flex-shrink-0' : 'text-yellow-400 flex-shrink-0'}>{d.severity}</span>
                  </div>
                ))}
                {s.sd.length > 6 && <p className="text-slate-500 text-xs">+ {s.sd.length - 6} more</p>}
              </div>}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Sprints" value={filteredSprintRows.length} />
        <StatCard label="Active" value={filteredSprintRows.filter(s => s.status === 'Active').length} color="text-green-400" border="border-green-500/30" />
        <StatCard label="Completed" value={filteredSprintRows.filter(s => s.status === 'Completed').length} color="text-blue-400" border="border-blue-500/30" />
        <StatCard label="Planned" value={filteredSprintRows.filter(s => s.status === 'Planned').length} color="text-yellow-400" border="border-yellow-500/30" />
      </div>
      {groups.map(g => (
        <div key={g.label}>
          <h3 className={`text-xs font-semibold ${g.color} uppercase tracking-wider mb-3`}>{g.label}</h3>
          {g.rows.map(s => <SprintRow key={s.id} s={s} />)}
        </div>
      ))}
    </div>
  );
}

// ─── 5. Automation Coverage ───────────────────────────────────────────────────

function AutomationCoverageReport({ sprintId = '' }) {
  const { data, loading, error } = useReportData(['/features', '/requirements', '/test-cases']);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState msg={error} />;
  const [features, allRequirements, testCases] = data;
  const requirements = sprintId
    ? allRequirements.filter(r => String(r.sprint_id) === String(sprintId))
    : allRequirements;

  const sprintTcIds = new Set(testCases.filter(tc => requirements.some(r => r.id === tc.requirement_id)).map(tc => tc.id));
  const filteredTCs = sprintId ? testCases.filter(tc => sprintTcIds.has(tc.id)) : testCases;

  // A manual TC mapped to a test file is counted as automation-covered
  const pureAutomated = filteredTCs.filter(tc => tc.type === 'Automated').length;
  const manualMapped  = filteredTCs.filter(tc => tc.type === 'Manual' && tc.test_file_id).length;
  const manualOnly    = filteredTCs.filter(tc => tc.type === 'Manual' && !tc.test_file_id).length;
  const totalCovered  = pureAutomated + manualMapped;
  const globalCov     = filteredTCs.length > 0 ? Math.round((totalCovered / filteredTCs.length) * 100) : 0;
  const pureAutoPct   = filteredTCs.length > 0 ? Math.round((pureAutomated / filteredTCs.length) * 100) : 0;
  const mappedPct     = filteredTCs.length > 0 ? Math.round((manualMapped / filteredTCs.length) * 100) : 0;

  const activeFeatures = sprintId ? features.filter(f => requirements.some(r => r.feature_id === f.id)) : features;

  const featureRows = activeFeatures.map(f => {
    const reqs = requirements.filter(r => r.feature_id === f.id);
    const tcs  = testCases.filter(tc => reqs.some(r => r.id === tc.requirement_id));
    const a    = tcs.filter(tc => tc.type === 'Automated').length;
    const mm   = tcs.filter(tc => tc.type === 'Manual' && tc.test_file_id).length;
    const mo   = tcs.filter(tc => tc.type === 'Manual' && !tc.test_file_id).length;
    const covered = a + mm;
    return { ...f, tcs, automated: a, manualMapped: mm, manualOnly: mo, covered, cov: tcs.length > 0 ? Math.round((covered / tcs.length) * 100) : null };
  }).sort((a, b) => (b.cov ?? -1) - (a.cov ?? -1));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Test Cases" value={filteredTCs.length} />
        <StatCard label="Automated" value={pureAutomated} sub={`${pureAutoPct}%`} color="text-green-400" border="border-green-500/30" />
        <StatCard label="Manual + Mapped" value={manualMapped} sub={`${mappedPct}% linked to test file`} color="text-indigo-400" border="border-indigo-500/30" />
        <StatCard label="Automation Coverage" value={`${globalCov}%`}
          color={globalCov >= 70 ? 'text-green-400' : globalCov >= 40 ? 'text-yellow-400' : 'text-red-400'}
          border={globalCov >= 70 ? 'border-green-500/30' : globalCov >= 40 ? 'border-yellow-500/30' : 'border-red-500/30'} />
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Overall Distribution</h3>
        <div className="flex h-8 rounded-lg overflow-hidden mb-3">
          {filteredTCs.length > 0 && <>
            <div className="bg-green-500 flex items-center justify-center text-xs text-white font-bold" style={{ width: `${pureAutoPct}%` }}>
              {pureAutoPct >= 8 && `${pureAutoPct}%`}
            </div>
            <div className="bg-indigo-500 flex items-center justify-center text-xs text-white font-bold" style={{ width: `${mappedPct}%` }}>
              {mappedPct >= 8 && `${mappedPct}%`}
            </div>
            <div className="bg-yellow-500 flex items-center justify-center text-xs text-white font-bold flex-1">
              {(100 - pureAutoPct - mappedPct) >= 8 && `${100 - pureAutoPct - mappedPct}%`}
            </div>
          </>}
        </div>
        <div className="flex gap-6 text-xs">
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-green-500 flex-shrink-0" />Automated ({pureAutomated})</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-indigo-500 flex-shrink-0" />Manual + Linked Test File ({manualMapped})</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-yellow-500 flex-shrink-0" />Manual only ({manualOnly})</span>
        </div>
        {manualMapped > 0 && (
          <p className="text-xs text-slate-400 mt-3 border-t border-slate-700 pt-3">
            <span className="text-indigo-400 font-medium">{manualMapped} manual test {manualMapped === 1 ? 'case is' : 'cases are'} linked to an automation test file</span> — counted as covered.
            Total coverage includes both automated test cases and manual test cases with a mapped test file.
          </p>
        )}
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700"><h3 className="text-sm font-semibold text-white">By Feature</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700"><tr>
              {['Feature', 'Total TCs', 'Automated', 'Manual + Mapped', 'Manual Only', 'Coverage', 'Visual'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-700">
              {featureRows.map(f => (
                <tr key={f.id} className="hover:bg-slate-700/40">
                  <td className="px-4 py-3 text-white font-medium">{f.name}</td>
                  <td className="px-4 py-3 text-slate-300">{f.tcs.length}</td>
                  <td className="px-4 py-3 text-green-400 font-semibold">{f.automated}</td>
                  <td className="px-4 py-3">
                    {f.manualMapped > 0
                      ? <span className="inline-flex items-center gap-1 text-indigo-400 font-semibold">{f.manualMapped} <span className="px-1.5 py-0.5 bg-indigo-500/15 border border-indigo-500/30 rounded text-xs">mapped</span></span>
                      : <span className="text-slate-600">0</span>}
                  </td>
                  <td className="px-4 py-3 text-yellow-400">{f.manualOnly}</td>
                  <td className="px-4 py-3">
                    {f.cov === null ? <span className="text-slate-500 text-xs">No TCs</span>
                      : <span className={`font-bold ${f.cov >= 70 ? 'text-green-400' : f.cov >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>{f.cov}%</span>}
                  </td>
                  <td className="px-4 py-3 w-36">
                    {f.cov !== null && (
                      <div className="flex h-2 rounded-full overflow-hidden bg-slate-700">
                        <div className="bg-green-500" style={{ width: `${f.tcs.length > 0 ? (f.automated / f.tcs.length) * 100 : 0}%` }} />
                        <div className="bg-indigo-500" style={{ width: `${f.tcs.length > 0 ? (f.manualMapped / f.tcs.length) * 100 : 0}%` }} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {featureRows.filter(f => f.cov !== null && f.cov < 40).length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-red-500/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-sm font-semibold text-red-300">Features with Low Automation (&lt;40%)</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {featureRows.filter(f => f.cov !== null && f.cov < 40).map(f => (
              <span key={f.id} className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300">
                {f.name} — {f.cov}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 6. Test Execution Summary ────────────────────────────────────────────────

function TestExecutionSummaryReport({ sprintId = '' }) {
  const [allData, setAllData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [execRes, manualRes, suitesRes, tcRes, reqsRes] = await Promise.all([
          fetch(`${API_URL}/executions`).then(r => r.json()),
          fetch(`${API_URL}/manual-test-runs`).then(r => r.json()),
          fetch(`${API_URL}/test-suites`).then(r => r.json()),
          fetch(`${API_URL}/test-cases`).then(r => r.json()),
          fetch(`${API_URL}/requirements`).then(r => r.json()),
        ]);
        const suiteExecs = [];
        for (const suite of suitesRes) {
          try {
            const ex = await fetch(`${API_URL}/test-suites/${suite.id}/executions`).then(r => r.json());
            ex.forEach(e => suiteExecs.push({ ...e, suiteName: suite.name }));
          } catch (_) { /* suite may have no executions */ }
        }
        setAllData({ executions: execRes, allManualRuns: manualRes, suiteExecutions: suiteExecs, testCases: tcRes, requirements: reqsRes });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState msg={error} />;

  const { executions, allManualRuns, suiteExecutions, testCases, requirements } = allData;
  const sprintTcIds = sprintId
    ? new Set(requirements
        .filter(r => String(r.sprint_id) === String(sprintId))
        .flatMap(r => testCases.filter(tc => tc.requirement_id === r.id).map(tc => tc.id)))
    : null;
  const manualRuns = sprintTcIds ? allManualRuns.filter(r => sprintTcIds.has(r.test_case_id)) : allManualRuns;

  const mPassed = manualRuns.filter(r => r.status === 'Passed').length;
  const mFailed = manualRuns.filter(r => r.status === 'Failed').length;
  const mBlocked = manualRuns.filter(r => r.status === 'Blocked').length;
  const mPassRate = manualRuns.length > 0 ? Math.round((mPassed / manualRuns.length) * 100) : 0;

  const sPassed = suiteExecutions.filter(e => e.status === 'Success' || e.status === 'Passed').length;
  const sPassRate = suiteExecutions.length > 0 ? Math.round((sPassed / suiteExecutions.length) * 100) : 0;
  const totalTests = suiteExecutions.reduce((s, e) => s + (e.total_tests || 0), 0);
  const totalPassed = suiteExecutions.reduce((s, e) => s + (e.passed || 0), 0);

  const recentManual = [...manualRuns].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);
  const recentSuite = [...suiteExecutions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Manual Test Runs" value={manualRuns.length} sub={`${mPassRate}% pass rate`}
          color={mPassRate >= 80 ? 'text-green-400' : mPassRate >= 50 ? 'text-yellow-400' : 'text-red-400'} />
        <StatCard label="Suite Executions" value={suiteExecutions.length} sub={`${sPassRate}% suite pass rate`}
          color={sPassRate >= 80 ? 'text-green-400' : 'text-yellow-400'} />
        <StatCard label="Single Executions" value={executions.length} color="text-blue-400" border="border-blue-500/30" />
        <StatCard label="Total Auto Tests Run" value={totalTests} sub={`${totalPassed} passed`}
          color={totalTests > 0 && Math.round((totalPassed / totalTests) * 100) >= 80 ? 'text-green-400' : 'text-yellow-400'} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Manual Test Run Results</h3>
          {manualRuns.length === 0
            ? <p className="text-slate-500 text-sm">No manual test runs yet.</p>
            : (
              <div className="space-y-3">
                {[['Passed', mPassed, 'bg-green-500', 'text-green-400'],
                  ['Failed', mFailed, 'bg-red-500', 'text-red-400'],
                  ['Blocked', mBlocked, 'bg-orange-500', 'text-orange-400'],
                  ['Other', manualRuns.length - mPassed - mFailed - mBlocked, 'bg-slate-500', 'text-slate-400']
                ].map(([l, v, bar, txt]) => (
                  <div key={l}>
                    <div className="flex justify-between text-xs mb-1"><span className="text-slate-300">{l}</span><span className={`font-semibold ${txt}`}>{v}</span></div>
                    <div className="w-full bg-slate-700 rounded-full h-2"><div className={`${bar} h-2 rounded-full`} style={{ width: `${manualRuns.length > 0 ? (v / manualRuns.length) * 100 : 0}%` }} /></div>
                  </div>
                ))}
                <div className="pt-3 border-t border-slate-700 flex justify-between text-xs">
                  <span className="text-slate-400">Pass Rate</span>
                  <span className={`font-bold ${mPassRate >= 80 ? 'text-green-400' : mPassRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{mPassRate}%</span>
                </div>
              </div>
            )}
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Suite Execution Results</h3>
          {suiteExecutions.length === 0
            ? <p className="text-slate-500 text-sm">No suite executions yet.</p>
            : (
              <div className="space-y-3">
                {[
                  ['Success/Passed', sPassed, 'bg-green-500', 'text-green-400'],
                  ['Failed', suiteExecutions.filter(e => e.status === 'Failed').length, 'bg-red-500', 'text-red-400'],
                  ['Other', suiteExecutions.filter(e => !['Success', 'Passed', 'Failed'].includes(e.status)).length, 'bg-slate-500', 'text-slate-400'],
                ].map(([l, v, bar, txt]) => (
                  <div key={l}>
                    <div className="flex justify-between text-xs mb-1"><span className="text-slate-300">{l}</span><span className={`font-semibold ${txt}`}>{v}</span></div>
                    <div className="w-full bg-slate-700 rounded-full h-2"><div className={`${bar} h-2 rounded-full`} style={{ width: `${suiteExecutions.length > 0 ? (v / suiteExecutions.length) * 100 : 0}%` }} /></div>
                  </div>
                ))}
                <div className="pt-3 border-t border-slate-700 grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">Total Tests Run</span><span className="text-white font-bold">{totalTests}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Avg Pass Rate</span><span className="text-white font-bold">{totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0}%</span></div>
                </div>
              </div>
            )}
        </div>
      </div>

      {recentManual.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700"><h3 className="text-sm font-semibold text-white">Recent Manual Runs (last 10)</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700"><tr>
                {['ID', 'Test Case', 'Status', 'Executed By', 'Date', 'Notes'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-700">
                {recentManual.map(r => {
                  const tc = testCases.find(t => t.id === r.test_case_id);
                  return (
                    <tr key={r.id} className="hover:bg-slate-700/40">
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs">#{r.id}</td>
                      <td className="px-4 py-3 text-slate-200 text-xs truncate max-w-xs">{tc ? tc.title : `TC #${r.test_case_id}`}</td>
                      <td className="px-4 py-3">{badge(r.status, r.status === 'Passed' ? 'bg-green-500/10 text-green-400 border-green-500/30' : r.status === 'Failed' ? 'bg-red-500/10 text-red-400 border-red-500/30' : r.status === 'Blocked' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : 'bg-slate-500/10 text-slate-400 border-slate-500/30')}</td>
                      <td className="px-4 py-3 text-slate-300 text-xs">{r.executed_by || '—'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(r.created_at)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-xs">{r.execution_notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recentSuite.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700"><h3 className="text-sm font-semibold text-white">Recent Suite Executions (last 10)</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700"><tr>
                {['ID', 'Suite', 'Status', 'Passed', 'Failed', 'Total', 'Duration', 'Date'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-700">
                {recentSuite.map(e => (
                  <tr key={e.id} className="hover:bg-slate-700/40">
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">#{e.id}</td>
                    <td className="px-4 py-3 text-slate-200 text-xs">{e.suiteName || '—'}</td>
                    <td className="px-4 py-3">{badge(e.status, e.status === 'Success' || e.status === 'Passed' ? 'bg-green-500/10 text-green-400 border-green-500/30' : e.status === 'Failed' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-slate-500/10 text-slate-400 border-slate-500/30')}</td>
                    <td className="px-4 py-3 text-green-400 font-semibold">{e.passed ?? '—'}</td>
                    <td className="px-4 py-3 text-red-400">{e.failed ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{e.total_tests ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDur(e.duration_ms)}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(e.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reports Shell ────────────────────────────────────────────────────────────

const REPORTS = [
  {
    id: 'traceability',
    label: 'Traceability',
    description: 'End-to-end: Features → Requirements → Test Cases → Defects',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    component: TraceabilityReport,
  },
  {
    id: 'coverage',
    label: 'Test Coverage',
    description: 'Requirement coverage, pass/fail rates and uncovered gaps by feature',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    component: TestCoverageReport,
  },
  {
    id: 'defects',
    label: 'Defect Analysis',
    description: 'Defect breakdown by severity, status, feature and sprint',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    component: DefectAnalysisReport,
  },
  {
    id: 'sprints',
    label: 'Sprint Progress',
    description: 'Per-sprint KPIs: requirements, execution, defects and automation mix',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    component: SprintProgressReport,
  },
  {
    id: 'automation',
    label: 'Automation Coverage',
    description: 'Manual vs automated ratio and automation coverage targets by feature',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
    component: AutomationCoverageReport,
  },
  {
    id: 'execution-summary',
    label: 'Execution Summary',
    description: 'Manual run history, suite execution stats and overall pass rates',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    component: TestExecutionSummaryReport,
  },
];

function Reports() {
  const [selectedReport, setSelectedReport] = useState('');
  const [selectedSprint, setSelectedSprint] = useState('');
  const [sprints, setSprints] = useState([]);
  const report = REPORTS.find(r => r.id === selectedReport);
  const ReportComp = report?.component;

  useEffect(() => {
    fetch(`${API_URL}/sprints`).then(r => r.json()).then(setSprints).catch(() => {});
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Reports</h1>
        <p className="text-slate-400 mt-1 text-sm">Select a report type to generate insights from your test data.</p>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <label className="text-sm font-medium text-slate-300 whitespace-nowrap">Report Type:</label>
        <div className="relative w-56">
          <select
            value={selectedReport}
            onChange={e => setSelectedReport(e.target.value)}
            className="w-full pl-4 pr-10 py-2.5 bg-slate-800 border border-slate-600 text-white text-sm rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:border-slate-500 transition-colors"
          >
            <option value="">-- Select a report --</option>
            {REPORTS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div className="relative w-52">
            <select
              value={selectedSprint}
              onChange={e => setSelectedSprint(e.target.value)}
              className="w-full pl-3 pr-10 py-2.5 bg-slate-800 border border-slate-600 text-white text-sm rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer hover:border-slate-500 transition-colors"
            >
              <option value="">All Sprints</option>
              {sprints.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
          {selectedSprint && (
            <button
              onClick={() => setSelectedSprint('')}
              className="flex items-center gap-1 px-2.5 py-2 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs rounded-lg transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              Clear
            </button>
          )}
        </div>

        {selectedSprint && (
          <span className="px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-lg text-xs text-purple-300 font-medium">
            {sprints.find(s => String(s.id) === selectedSprint)?.name}
          </span>
        )}

        {report && (
          <div className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-300 text-sm ml-auto">
            {report.icon}
            <span>{report.description}</span>
          </div>
        )}
      </div>

      {!selectedReport ? (
        <div className="flex-1">
          <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-4">Available Reports</p>
          <div className="grid grid-cols-3 gap-4">
            {REPORTS.map(r => (
              <button key={r.id} onClick={() => setSelectedReport(r.id)}
                className="bg-slate-800 border border-slate-700 hover:border-indigo-500 rounded-xl p-5 text-left transition-all group flex flex-col min-h-[120px]">
                <div className="flex items-center gap-3 mb-3 flex-shrink-0">
                  <div className="w-9 h-9 flex-shrink-0 bg-indigo-600/20 text-indigo-400 rounded-lg flex items-center justify-center group-hover:bg-indigo-600/40 transition-colors">
                    {r.icon}
                  </div>
                  <span className="font-semibold text-white text-sm leading-tight">{r.label}</span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed flex-1">{r.description}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {ReportComp && <ReportComp sprintId={selectedSprint} />}
        </div>
      )}
    </div>
  );
}

export default Reports;
