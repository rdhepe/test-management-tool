import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── Feature cards ────────────────────────────────────────────────────────────
const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    color: 'indigo',
    title: 'AI-Powered Self-Healing Tests',
    desc: 'When a test fails, our GPT-4o engine automatically diagnoses the root cause and suggests — or applies — a fix, keeping your test suite green without manual intervention.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    color: 'violet',
    title: 'End-to-End Test Management',
    desc: 'Organise everything from Features and Requirements down to Test Cases, manual runs, and automated suites. Full traceability at every level.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    color: 'rose',
    title: 'Intelligent Defect Tracking',
    desc: 'Defects are auto-raised from failing tests with AI-generated titles, reproduction steps, and severity. Deduplicated automatically so your backlog stays clean.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    color: 'amber',
    title: 'Sprint & Release Planning',
    desc: 'Link requirements to sprints, track test completion per sprint, and see blocker defects in real-time. Integrated Taskboard keeps everyone aligned.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    color: 'emerald',
    title: 'Release Readiness Score',
    desc: 'A single 0-100 score computed from pass rates, open defects, sprint completion, and coverage — with an AI narrative that tells you exactly what to fix before ship day.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    color: 'sky',
    title: 'Playwright Automation Built In',
    desc: 'Write, run, and debug Playwright tests directly in the browser. CI headless runs, real-time log streaming, and report archiving — zero DevOps setup required.',
  },
];

const colorMap = {
  indigo:  { bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30',  text: 'text-indigo-400'  },
  violet:  { bg: 'bg-violet-500/10',  border: 'border-violet-500/30',  text: 'text-violet-400'  },
  rose:    { bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    text: 'text-rose-400'    },
  amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400'   },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  sky:     { bg: 'bg-sky-500/10',     border: 'border-sky-500/30',     text: 'text-sky-400'     },
};

const stats = [
  { value: '10×', label: 'Faster defect triage with AI' },
  { value: '100%', label: 'End-to-end traceability' },
  { value: '< 1min', label: 'From failure to auto-heal' },
  { value: '0', label: 'Extra DevOps setup needed' },
];

// ─── Landing ──────────────────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate();
  const [orgSlug, setOrgSlug] = useState('');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLaunch = (e) => {
    e.preventDefault();
    const slug = orgSlug.trim().toLowerCase() || 'default';
    navigate(`/org/${slug}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/95 backdrop-blur border-b border-slate-800' : ''}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight">TestStudio<span className="text-indigo-400">.cloud</span></span>
          </div>
          <button
            onClick={handleLaunch}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Login to App
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px]" />
          <div className="absolute top-40 left-1/4 w-[300px] h-[300px] bg-violet-600/8 rounded-full blur-[80px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            AI-powered quality engineering platform
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] mb-6">
            Ship with
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent"> confidence.</span>
            <br />Every release.
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            TestStudio.cloud combines end-to-end test management, Playwright automation, AI self-healing, and release readiness scoring into one unified platform — so your team can move fast without breaking things.
          </p>

          {/* CTA / org slug form */}
          <form onSubmit={handleLaunch} className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
            <div className="relative flex-1 w-full">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-mono select-none">
                teststudio.cloud/org/
              </span>
              <input
                type="text"
                value={orgSlug}
                onChange={e => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="your-org"
                className="w-full pl-[10.5rem] pr-4 py-3 bg-slate-800 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 text-white text-sm rounded-xl outline-none transition-all placeholder-slate-600"
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition-colors shadow-lg shadow-indigo-600/25"
            >
              Login to TestStudio
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </form>
          <p className="text-slate-600 text-xs mt-3">Leave blank to go to the default workspace</p>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="border-y border-slate-800 bg-slate-900/40 py-10 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold text-white mb-1">{s.value}</p>
              <p className="text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Everything your QA team needs</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">One platform from first test case to final sign-off — with AI doing the heavy lifting in between.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(f => {
              const c = colorMap[f.color];
              return (
                <div key={f.title} className={`rounded-2xl border ${c.border} bg-slate-900/60 p-6 flex flex-col gap-4 hover:bg-slate-800/60 transition-colors group`}>
                  <div className={`w-11 h-11 rounded-xl ${c.bg} border ${c.border} ${c.text} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                    {f.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-base mb-1.5">{f.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 px-6 bg-slate-900/40 border-y border-slate-800">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">From code push to confident release</h2>
            <p className="text-slate-400 text-lg">A seamless loop that keeps quality high and velocity higher.</p>
          </div>
          <div className="relative flex flex-col sm:flex-row items-start sm:items-stretch gap-0">
            {[
              { step: '01', title: 'Plan', desc: 'Create features, requirements, and test cases mapped to your sprint. Assign owners and set priorities on the Taskboard.', color: 'indigo' },
              { step: '02', title: 'Execute', desc: 'Run manual tests or trigger Playwright suites in headless CI mode. Logs stream live as the suite runs.', color: 'violet' },
              { step: '03', title: 'Heal', desc: 'Failed tests are diagnosed by AI. Auto-fix is applied where possible; smart defects are raised for the rest — with full context.', color: 'rose' },
              { step: '04', title: 'Ship', desc: 'Check your Release Readiness Score. Get an AI verdict and action list. Release when the shield is green.', color: 'emerald' },
            ].map((item, idx, arr) => {
              const c = colorMap[item.color];
              return (
                <div key={item.step} className="flex-1 flex flex-col sm:flex-row">
                  <div className={`flex-1 rounded-2xl border ${c.border} bg-slate-900 p-6 flex flex-col gap-3`}>
                    <span className={`text-xs font-bold font-mono ${c.text}`}>{item.step}</span>
                    <h3 className="text-lg font-bold text-white">{item.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed flex-1">{item.desc}</p>
                  </div>
                  {idx < arr.length - 1 && (
                    <div className="hidden sm:flex items-center px-3 text-slate-700">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-28 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-600/10 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-5 leading-tight">
            Ready to ship <span className="text-indigo-400">without fear?</span>
          </h2>
          <p className="text-slate-400 text-lg mb-10">
            Log in with your organisation's workspace and start managing quality the smart way.
          </p>
          <form onSubmit={handleLaunch} className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-sm mx-auto">
            <div className="relative flex-1 w-full">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono select-none">org/</span>
              <input
                type="text"
                value={orgSlug}
                onChange={e => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="your-org"
                className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 text-white text-sm rounded-xl outline-none transition-all placeholder-slate-600"
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition-colors"
            >
              Launch App
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </form>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-800 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-600 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="font-semibold text-slate-400">TestStudio<span className="text-indigo-400">.cloud</span></span>
          </div>
          <p>© {new Date().getFullYear()} TestStudio.cloud · Quality you can ship</p>
        </div>
      </footer>
    </div>
  );
}
