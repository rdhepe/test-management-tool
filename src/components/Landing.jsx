import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import EnquiryModal from './EnquiryModal';

// ─────────────────────────────────────────────────────────────
//  Inline UI MOCKUPS — dark-themed app screenshots built in JSX
// ─────────────────────────────────────────────────────────────

function MockAIScriptPanel() {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden text-xs font-mono select-none">
      {/* toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-950">
        <div className="w-3 h-3 rounded-full bg-rose-500/70" />
        <div className="w-3 h-3 rounded-full bg-amber-500/70" />
        <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
        <span className="ml-3 text-slate-500 text-[10px]">login.spec.ts — TestStudio.cloud</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-md bg-violet-600 text-white text-[10px] font-sans font-medium flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            AI Script
          </div>
        </div>
      </div>
      <div className="flex">
        {/* editor */}
        <div className="flex-1 p-4 bg-slate-950 text-[11px] leading-5" style={{minWidth:0}}>
          <div className="text-slate-600">1</div>
          <div><span className="text-slate-600">2  </span><span className="text-violet-400">// Navigate to login page</span></div>
          <div><span className="text-slate-600">3  </span><span className="text-sky-400">await </span><span className="text-white">page</span><span className="text-slate-400">.</span><span className="text-yellow-300">goto</span><span className="text-slate-400">(</span><span className="text-emerald-400">&apos;https://app.example.com/login&apos;</span><span className="text-slate-400">);</span></div>
          <div><span className="text-slate-600">4  </span><span className="text-sky-400">await </span><span className="text-white">page</span><span className="text-slate-400">.</span><span className="text-yellow-300">waitForLoadState</span><span className="text-slate-400">(</span><span className="text-emerald-400">&apos;load&apos;</span><span className="text-slate-400">);</span></div>
          <div className="text-slate-600">5</div>
          <div><span className="text-slate-600">6  </span><span className="text-violet-400">// Fill credentials</span></div>
          <div><span className="text-slate-600">7  </span><span className="text-sky-400">await </span><span className="text-white">page</span><span className="text-slate-400">.</span><span className="text-yellow-300">getByLabel</span><span className="text-slate-400">(</span><span className="text-emerald-400">&apos;Email&apos;</span><span className="text-slate-400">).</span><span className="text-yellow-300">fill</span><span className="text-slate-400">(</span><span className="text-emerald-400">&apos;user@test.com&apos;</span><span className="text-slate-400">);</span></div>
          <div><span className="text-slate-600">8  </span><span className="text-sky-400">await </span><span className="text-white">page</span><span className="text-slate-400">.</span><span className="text-yellow-300">getByLabel</span><span className="text-slate-400">(</span><span className="text-emerald-400">&apos;Password&apos;</span><span className="text-slate-400">).</span><span className="text-yellow-300">fill</span><span className="text-slate-400">(</span><span className="text-emerald-400">&apos;secret&apos;</span><span className="text-slate-400">);</span></div>
          <div><span className="text-slate-600">9  </span><span className="text-sky-400">await </span><span className="text-white">page</span><span className="text-slate-400">.</span><span className="text-yellow-300">getByRole</span><span className="text-slate-400">(</span><span className="text-emerald-400">&apos;button&apos;</span><span className="text-slate-400">{', { name: '}</span><span className="text-emerald-400">&apos;Sign in&apos;</span><span className="text-slate-400">{' }'}</span><span className="text-slate-400">).</span><span className="text-yellow-300">click</span><span className="text-slate-400">();</span></div>
          <div className="text-slate-600">10</div>
          <div><span className="text-slate-600">11 </span><span className="text-violet-400">// Assert dashboard loaded</span></div>
          <div><span className="text-slate-600">12 </span><span className="text-sky-400">await </span><span className="text-white">expect</span><span className="text-slate-400">(</span><span className="text-white">page</span><span className="text-slate-400">.</span><span className="text-yellow-300">getByText</span><span className="text-slate-400">(</span><span className="text-emerald-400">&apos;Dashboard&apos;</span><span className="text-slate-400">)).</span><span className="text-yellow-300">toBeVisible</span><span className="text-slate-400">();</span></div>
        </div>
        {/* AI panel */}
        <div className="w-52 border-l border-slate-800 bg-slate-900 flex flex-col">
          <div className="px-3 py-2.5 border-b border-slate-800 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <span className="text-[11px] font-sans font-semibold text-white">AI Script Generator</span>
          </div>
          <div className="p-3 flex flex-col gap-2.5 font-sans">
            <div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Instruction</div>
              <div className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-[10px] text-slate-300 leading-relaxed">
                &ldquo;Test login with valid credentials and assert dashboard loads&rdquo;
              </div>
            </div>
            <div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Mode</div>
              <div className="flex gap-1.5">
                <div className="px-2 py-0.5 rounded-md bg-violet-600/30 border border-violet-500/50 text-violet-300 text-[10px]">Replace</div>
                <div className="px-2 py-0.5 rounded-md border border-slate-700 text-slate-500 text-[10px]">Append</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-1 px-2.5 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <svg className="w-3 h-3 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
              <span className="text-[10px] text-emerald-300">Script ready — 11 steps</span>
            </div>
            <button className="w-full py-1.5 bg-violet-600 text-white text-[10px] font-semibold rounded-lg">Apply to Editor</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockTestCasesPanel() {
  const types = ['Happy Path','Negative / Error','Boundary Value','Edge Case','Integration','Regression','Smoke','Security','Accessibility'];
  const checked = [true,true,true,false,true,false,true,false,false];
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden text-xs select-none">
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          <span className="text-sm font-semibold text-white">Generate Test Cases with AI</span>
        </div>
        <span className="text-[10px] text-slate-500">for: User Login Flow</span>
      </div>
      <div className="p-4">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2.5">Select test types to generate</div>
        <div className="grid grid-cols-2 gap-1.5 mb-4">
          {types.map((t,i) => (
            <div key={t} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${checked[i] ? 'border-violet-500/50 bg-violet-500/10' : 'border-slate-700 bg-slate-800/50'}`}>
              <div className={`w-3.5 h-3.5 rounded flex items-center justify-center ${checked[i] ? 'bg-violet-600' : 'bg-slate-700 border border-slate-600'}`}>
                {checked[i] && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
              </div>
              <span className={`text-[10px] ${checked[i] ? 'text-slate-200' : 'text-slate-500'}`}>{t}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 p-2.5 bg-slate-800 border border-slate-700 rounded-lg mb-3">
          <span className="text-[10px] text-slate-400">Count per type:</span>
          <span className="text-[10px] font-mono bg-slate-700 px-2 py-0.5 rounded text-white">3</span>
          <span className="text-[10px] text-slate-500 ml-auto">= 15 test cases</span>
        </div>
        <button className="w-full py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          Generate 15 Test Cases
        </button>
      </div>
    </div>
  );
}

function MockTaskboard() {
  const cols = [
    { label: 'To Do', color: 'slate', cards: [
      { title: 'Write login test cases', tag: 'Testing', user: 'SA', color: 'violet' },
      { title: 'Verify OAuth flow', tag: 'Testing', user: 'JD', color: 'sky' },
    ]},
    { label: 'In Progress', color: 'amber', cards: [
      { title: 'Fix password reset bug', tag: 'Critical', user: 'SA', color: 'rose' },
      { title: 'API endpoint coverage', tag: 'Backend', user: 'MK', color: 'emerald' },
    ]},
    { label: 'Done', color: 'emerald', cards: [
      { title: 'Dashboard smoke tests', tag: 'Smoke', user: 'JD', color: 'emerald' },
    ]},
  ];
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden select-none">
      <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950 flex items-center gap-3 text-xs">
        <span className="font-semibold text-white">Sprint Taskboard</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-slate-500">Sprint:</span>
          <div className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-md text-slate-300 text-[10px]">Sprint 3</div>
          <span className="text-slate-500">User:</span>
          <div className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-md text-slate-300 text-[10px]">Sarah A.</div>
        </div>
      </div>
      <div className="p-3 flex gap-2">
        {cols.map(col => (
          <div key={col.label} className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-2 px-1">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${col.color === 'amber' ? 'text-amber-400' : col.color === 'emerald' ? 'text-emerald-400' : 'text-slate-500'}`}>{col.label}</span>
              <span className="text-[9px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-full">{col.cards.length}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {col.cards.map(c => (
                <div key={c.title} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5">
                  <p className="text-[10px] text-slate-200 leading-tight mb-2">{c.title}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${c.color === 'rose' ? 'bg-rose-500/15 text-rose-400' : c.color === 'violet' ? 'bg-violet-500/15 text-violet-400' : c.color === 'emerald' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-sky-500/15 text-sky-400'}`}>{c.tag}</span>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${c.color === 'rose' ? 'bg-rose-600' : c.color === 'violet' ? 'bg-violet-600' : c.color === 'emerald' ? 'bg-emerald-600' : 'bg-sky-600'}`}>{c.user}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockHealPanel() {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden text-xs select-none">
      <div className="px-4 py-3 border-b border-rose-800/40 bg-rose-950/20 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
        <span className="text-rose-300 font-semibold text-sm">Test Failed — AI Healing Active</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="bg-rose-950/30 border border-rose-800/40 rounded-xl p-3">
          <div className="text-[10px] text-rose-400 font-semibold mb-1.5">Error Detected</div>
          <code className="text-[10px] text-rose-300 font-mono leading-relaxed block">
            TimeoutError: waiting for locator<br/>
            <span className="text-slate-400">&nbsp;&nbsp;.getByRole(&apos;button&apos;, {'{ name: \'Submit\' }'})</span><br/>
            <span className="text-slate-500">&nbsp;&nbsp;Received: &apos;Save Changes&apos; instead</span>
          </code>
        </div>
        <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-3">
          <div className="text-[10px] text-indigo-400 font-semibold mb-1.5">GPT-4o Diagnosis</div>
          <p className="text-[10px] text-slate-300 leading-relaxed">Button label was renamed from &ldquo;Submit&rdquo; to &ldquo;Save Changes&rdquo; in v2.4. Updating locator to match new UI.</p>
        </div>
        <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-3">
          <div className="text-[10px] text-emerald-400 font-semibold mb-1.5">Auto-Fix Applied</div>
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="text-[9px] text-slate-500 mb-0.5">Before</div>
              <code className="text-[10px] text-rose-400 font-mono line-through">&apos;Submit&apos;</code>
            </div>
            <div className="flex-1">
              <div className="text-[9px] text-slate-500 mb-0.5">After</div>
              <code className="text-[10px] text-emerald-400 font-mono">&apos;Save Changes&apos;</code>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
          <span className="text-[10px] text-emerald-300 font-medium">Test suite re-queued — 0 manual effort</span>
        </div>
      </div>
    </div>
  );
}

function MockReadinessScore() {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden text-xs select-none">
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
        <span className="font-semibold text-white text-sm">Release Readiness — v2.5.0</span>
        <span className="text-[10px] text-slate-500">Sprint 3 · Mar 2026</span>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-6 mb-5">
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3.5"/>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="url(#scoreGrad)" strokeWidth="3.5" strokeDasharray="82,100" strokeLinecap="round"/>
              <defs><linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#6366f1"/><stop offset="100%" stopColor="#22d3ee"/></linearGradient></defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-white">82</span>
              <span className="text-[9px] text-slate-400">/100</span>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            {[['Pass Rate','94%','emerald'],['Open Blockers','2','rose'],['Sprint Coverage','88%','indigo'],['AI Confidence','High','violet']].map(([k,v,c]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">{k}</span>
                <span className={`text-[11px] font-semibold ${c==='emerald'?'text-emerald-400':c==='rose'?'text-rose-400':c==='indigo'?'text-indigo-400':'text-violet-400'}`}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-indigo-950/40 border border-indigo-800/40 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <svg className="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <span className="text-[10px] text-indigo-300 font-semibold">AI Verdict</span>
          </div>
          <p className="text-[10px] text-slate-300 leading-relaxed">Good to ship after resolving 2 P1 defects in checkout flow. All smoke tests pass. Auth coverage at 94%.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const allFeatures = [
  { icon: '🤖', color: 'violet', title: 'AI Script Generation', desc: 'Describe a test in plain English. AI writes the full Playwright step body — no boilerplate, no syntax errors.' },
  { icon: '🧪', color: 'indigo', title: 'AI Test Case Generation', desc: 'Pick from 11 test types (happy path, negative, boundary, security…) and AI generates a full test case suite in seconds.' },
  { icon: '🔧', color: 'rose', title: 'AI Self-Healing', desc: 'GPT-4o diagnoses failing tests, suggests fixes, and can auto-apply them — so your suite heals itself overnight.' },
  { icon: '🐛', color: 'amber', title: 'AI Defect Creator', desc: 'Failing runs auto-raise smart defects with AI-written titles, steps to reproduce, and severity — deduplicated.' },
  { icon: '📋', color: 'emerald', title: 'AI Requirements Generator', desc: 'Describe a feature in one sentence, get a production-ready set of requirements with priority and sprint tags.' },
  { icon: '📊', color: 'sky', title: 'Release Readiness Score', desc: 'A live 0–100 score with an AI narrative that tells you exactly what to fix before you dare hit "Deploy".' },
  { icon: '🗂️', color: 'indigo', title: 'Full Traceability', desc: 'Features → Requirements → Test Cases → Playwright Files. Every requirement covered, every gap surfaced.' },
  { icon: '🏃', color: 'violet', title: 'Sprint & Taskboard', desc: 'Kanban board with user and sprint filters, blocker highlights, and real-time task assignment.' },
  { icon: '▶️', color: 'emerald', title: 'One-Click CI Execution', desc: 'Run full Playwright suites in headless mode with live log streaming, HTML reports, and history.' },
];

const colorMap = {
  indigo:  { bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30',  text: 'text-indigo-400',  badge: 'bg-indigo-500/15 text-indigo-300' },
  violet:  { bg: 'bg-violet-500/10',  border: 'border-violet-500/30',  text: 'text-violet-400',  badge: 'bg-violet-500/15 text-violet-300' },
  rose:    { bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    text: 'text-rose-400',    badge: 'bg-rose-500/15 text-rose-300' },
  amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400',   badge: 'bg-amber-500/15 text-amber-300' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', badge: 'bg-emerald-500/15 text-emerald-300' },
  sky:     { bg: 'bg-sky-500/10',     border: 'border-sky-500/30',     text: 'text-sky-400',     badge: 'bg-sky-500/15 text-sky-300' },
};

const stats = [
  { value: '5×', label: 'Fewer manual test writing hours', sub: 'AI drafts your scripts and test cases' },
  { value: '< 60s', label: 'From failure to healed test', sub: 'GPT-4o auto-diagnoses and fixes' },
  { value: '11', label: 'AI test type templates', sub: 'Happy path to security testing' },
  { value: '100%', label: 'Requirement traceability', sub: 'Every gap surfaced automatically' },
];

const testimonials = [
  {
    quote: 'We used to spend half a sprint just writing test cases. TestStudio\'s AI generates them in 30 seconds — and they actually match our edge cases.',
    name: 'Priya Mehta', role: 'QA Lead, FinTech startup', initials: 'PM', color: 'violet',
  },
  {
    quote: 'The self-healing tests alone paid for the licence in week one. We had 40 failing tests after a UI refactor. The AI fixed 35 of them automatically.',
    name: 'James Donovan', role: 'Head of Engineering, SaaS platform', initials: 'JD', color: 'indigo',
  },
  {
    quote: 'Release Readiness Score is now part of our Definition of Done. We gate deployments on it. No more surprise regressions on Friday afternoon.',
    name: 'Sarah Andersen', role: 'CTO, E-commerce scale-up', initials: 'SA', color: 'emerald',
  },
];

const includedItems = [
  'AI Playwright Script Generator', 'AI Test Case Generator (11 types)', 'AI Self-Healing Tests',
  'AI Defect Auto-Creation', 'AI Requirements Generator', 'Release Readiness Score + AI Verdict',
  'Full Feature → Requirement → Test Case traceability', 'Sprint & Taskboard management',
  'Playwright suite execution (headless CI)', 'Live log streaming & HTML test reports',
  'Test file dependency ordering', 'Global variables & environment config',
  'Multi-sprint planning', 'Defect deduplication', 'User & role management',
  'Organisation-scoped workspaces', 'Full execution history & audit trail', 'Dark-mode UI (of course)',
];

// ─── Landing ──────────────────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate();
  const [orgSlug, setOrgSlug] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [enquiryOpen, setEnquiryOpen] = useState(false);

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

      {/* ──────────── NAV ──────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/95 backdrop-blur-md border-b border-slate-800' : ''}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight">TestStudio<span className="text-indigo-400">.cloud</span></span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#ai" className="hover:text-white transition-colors">AI Capabilities</a>
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setEnquiryOpen(true)}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition-colors">
              Contact Sales
            </button>
            <button onClick={handleLaunch}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors">
              Login →
            </button>
          </div>
        </div>
      </nav>

      {/* ──────────── HERO ──────────── */}
      <section className="relative pt-28 pb-12 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-600/8 rounded-full blur-[140px]" />
          <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-violet-600/6 rounded-full blur-[100px]" />
          <div className="absolute top-40 left-0 w-[300px] h-[300px] bg-cyan-600/5 rounded-full blur-[80px]" />
        </div>
        <div className="relative max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-medium mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                Powered by GPT-4o · Built for QA teams
              </div>
              <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.06] mb-6">
                Ship quality software<br/>
                <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">with AI on your team.</span>
              </h1>
              <p className="text-xl text-slate-400 mb-8 leading-relaxed max-w-lg">
                TestStudio.cloud combines <strong className="text-slate-200">AI-powered test management</strong>, Playwright automation, self-healing tests, and release readiness scoring — all in one platform your team will actually use.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <button onClick={() => setEnquiryOpen(true)}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/30">
                  Get a Demo
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                </button>
                <button onClick={handleLaunch}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-semibold text-sm rounded-xl transition-all">
                  Open App
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {['AI Test Generation','Self-Healing Tests','Playwright Built-in','Release Score'].map(tag => (
                  <span key={tag} className="px-3 py-1 bg-slate-800 border border-slate-700 text-slate-400 text-xs rounded-full">{tag}</span>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-indigo-600/10 to-violet-600/10 rounded-3xl blur-xl" />
              <div className="relative"><MockAIScriptPanel /></div>
              <div className="absolute -bottom-4 -left-4 flex items-center gap-2 bg-emerald-900/80 border border-emerald-700/60 backdrop-blur rounded-xl px-3 py-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-300 font-medium">11 steps generated in 1.2s</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────── STATS ──────────── */}
      <section className="border-y border-slate-800 bg-slate-900/30 py-14 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-4xl font-extrabold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent mb-1">{s.value}</p>
              <p className="text-sm font-semibold text-white mb-1">{s.label}</p>
              <p className="text-xs text-slate-500">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ──────────── AI STRIP ──────────── */}
      <section id="ai" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-medium mb-4">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              GPT-4o integrated · 5 AI superpowers
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">AI does the heavy lifting.</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">Every tedious QA task — writing scripts, creating test cases, triaging failures, raising defects — now takes seconds instead of hours.</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-start mb-20">
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-white">Write Playwright scripts in plain English</h3>
              <p className="text-slate-400 leading-relaxed">Open the AI Script panel in any test file, describe what you want to test, and get a fully-formed Playwright step body — correct syntax, modern locators, proper assertions, and inline comments. No boilerplate, no wrapper — the framework handles it automatically.</p>
              <ul className="space-y-2.5">
                {['Uses getByRole, getByLabel, getByText — modern locator APIs','Generates only step body — runtime wraps it correctly','Third-party imports flagged with install instructions','Replace whole file or append to existing steps'].map(item => (
                  <li key={item} className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                    <span className="text-sm text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <MockAIScriptPanel />
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-start mb-20">
            <div className="lg:order-2 space-y-4">
              <h3 className="text-2xl font-bold text-white">Generate complete test case suites instantly</h3>
              <p className="text-slate-400 leading-relaxed">Select which types of tests you need — happy path, negative, boundary value, security, accessibility, and 6 more — and AI generates a complete, structured test case suite for any requirement.</p>
              <ul className="space-y-2.5">
                {['11 test type templates to choose from','Configurable count per type (1–10)','Includes preconditions and expected outcomes','AI badge marks generated tests for traceability'].map(item => (
                  <li key={item} className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                    <span className="text-sm text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:order-1"><MockTestCasesPanel /></div>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-white">Tests that fix themselves while you sleep</h3>
              <p className="text-slate-400 leading-relaxed">When a Playwright test fails, GPT-4o reads the error, understands the root cause, and either auto-applies a fix or raises a smart defect with full reproduction context.</p>
              <ul className="space-y-2.5">
                {['Auto-detects selector drift, API changes, and timing issues','Applies safe fixes automatically (attribute changes, label renames)','Raises AI-authored defects for complex failures','Full audit trail of every AI action taken'].map(item => (
                  <li key={item} className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                    <span className="text-sm text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <MockHealPanel />
          </div>
        </div>
      </section>

      {/* ──────────── FEATURES GRID ──────────── */}
      <section id="features" className="py-20 px-6 bg-slate-900/30 border-y border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Everything your QA team needs</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">One platform from first requirement to final sign-off — with AI doing the heavy lifting in between.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {allFeatures.map(f => {
              const c = colorMap[f.color];
              return (
                <div key={f.title} className={`rounded-2xl border ${c.border} bg-slate-900/70 p-6 flex flex-col gap-4 hover:bg-slate-800/70 transition-colors group`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-110 transition-transform`}>{f.icon}</div>
                    <h3 className="font-semibold text-white text-sm leading-tight">{f.title}</h3>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ──────────── TASKBOARD + READINESS ──────────── */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-start mb-20">
            <div className="space-y-4">
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colorMap.violet.badge} border ${colorMap.violet.border}`}>Sprint Management</div>
              <h3 className="text-2xl font-bold text-white">Sprint board with laser-focus filters</h3>
              <p className="text-slate-400 leading-relaxed">The built-in Kanban Taskboard supports sprint and user filters so every team member sees exactly their work. Blocker defects surface automatically, and task status flows from To Do → In Progress → Done.</p>
              <ul className="space-y-2.5">
                {['Filter by sprint and by individual team member','Auto-surfaced P1/P2 blockers in red','Link tasks to requirements for full traceability','Works for both dev and QA tasks'].map(item => (
                  <li key={item} className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                    <span className="text-sm text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <MockTaskboard />
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div className="lg:order-2 space-y-4">
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colorMap.emerald.badge} border ${colorMap.emerald.border}`}>Release Confidence</div>
              <h3 className="text-2xl font-bold text-white">Know if you&apos;re ready to ship — before you ship</h3>
              <p className="text-slate-400 leading-relaxed">The Release Readiness Score combines pass rate, open blockers, sprint coverage, and requirement traceability into a single 0–100 number. AI generates a plain-English verdict listing exactly what needs to be resolved before your next release.</p>
              <ul className="space-y-2.5">
                {['Live 0-100 score updated on every test run','AI narrative: "You can ship after fixing X and Y"','Tracks blocker defects, coverage gaps, and test failures','Use as your Definition of Done gate'].map(item => (
                  <li key={item} className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                    <span className="text-sm text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:order-1"><MockReadinessScore /></div>
          </div>
        </div>
      </section>

      {/* ──────────── HOW IT WORKS ──────────── */}
      <section id="how" className="py-20 px-6 bg-slate-900/40 border-y border-slate-800">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">From code push to confident release</h2>
            <p className="text-slate-400 text-lg">A seamless loop that keeps quality high and velocity higher.</p>
          </div>
          <div className="relative flex flex-col sm:flex-row items-start sm:items-stretch gap-0">
            {[
              { step: '01', title: 'Plan', color: 'indigo', desc: 'Create features and requirements. Let AI generate the full test case suite — 11 types, structured and ready. Assign to sprints and owners on the Taskboard.' },
              { step: '02', title: 'Build', color: 'violet', desc: 'Describe your test in plain English. The AI Script Generator produces clean Playwright step code instantly. Organise into modules, set execution order, configure dependencies.' },
              { step: '03', title: 'Execute', color: 'amber', desc: 'One click runs the full suite in headless CI mode. Logs stream live. HTML reports archive automatically. AI heals failures in real-time.' },
              { step: '04', title: 'Ship', color: 'emerald', desc: 'Check your Release Readiness Score. Read the AI verdict. Resolve the two blockers it found. Deploy with confidence — not hope.' },
            ].map((item, idx, arr) => {
              const c = colorMap[item.color];
              return (
                <div key={item.step} className="flex-1 flex flex-col sm:flex-row">
                  <div className={`flex-1 rounded-2xl border ${c.border} bg-slate-900 p-6 flex flex-col gap-3`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`text-xs font-bold font-mono ${c.text}`}>{item.step}</span>
                      <div className={`w-6 h-0.5 ${c.bg} rounded`} />
                    </div>
                    <h3 className="text-lg font-bold text-white">{item.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed flex-1">{item.desc}</p>
                  </div>
                  {idx < arr.length - 1 && (
                    <div className="hidden sm:flex items-center px-3 text-slate-700">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ──────────── TESTIMONIALS ──────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Teams that ship faster</h2>
            <p className="text-slate-400 text-lg">What quality-focused teams say after switching to TestStudio.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map(t => {
              const c = colorMap[t.color];
              return (
                <div key={t.name} className={`rounded-2xl border ${c.border} bg-slate-900/60 p-6 flex flex-col gap-5`}>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_,i) => <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>)}
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed italic flex-1">&ldquo;{t.quote}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${c.bg} border ${c.border} ${c.text} flex items-center justify-center text-xs font-bold flex-shrink-0`}>{t.initials}</div>
                    <div>
                      <p className="text-sm font-semibold text-white">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.role}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ──────────── EVERYTHING INCLUDED ──────────── */}
      <section id="pricing" className="py-20 px-6 bg-slate-900/40 border-y border-slate-800">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium mb-6">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
            Everything in one licence. No add-on tiers.
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">One platform. Every feature.</h2>
          <p className="text-slate-400 text-lg mb-12 max-w-xl mx-auto">No feature gating. No &ldquo;AI add-on&rdquo; upsells. Every team member gets the full platform — AI and all.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-12 text-left">
            {includedItems.map(item => (
              <div key={item} className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                <span className="text-sm text-slate-300">{item}</span>
              </div>
            ))}
          </div>
          <div className="inline-flex flex-col sm:flex-row gap-4 items-center justify-center bg-slate-900 border border-slate-700 rounded-2xl px-8 py-6">
            <div className="text-left">
              <p className="text-white font-semibold text-lg">Ready to see the price?</p>
              <p className="text-slate-400 text-sm">Licences are per-organisation, based on team size. Talk to us and we&apos;ll scope it in 10 minutes.</p>
            </div>
            <button onClick={() => setEnquiryOpen(true)}
              className="flex-shrink-0 flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/25 whitespace-nowrap">
              Get Pricing
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
            </button>
          </div>
        </div>
      </section>

      {/* ──────────── FINAL CTA ──────────── */}
      <section className="py-28 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-indigo-600/8 rounded-full blur-[120px]" />
          <div className="absolute top-10 right-20 w-[300px] h-[300px] bg-violet-600/6 rounded-full blur-[80px]" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-5 leading-tight">
            Your next release deserves a<br/>
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">quality platform to match.</span>
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
            Stop stitching together Jira, Google Sheets, and a Playwright repo. TestStudio gives your team one place to plan, test, heal, and ship.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <button onClick={() => setEnquiryOpen(true)}
              className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-base rounded-xl transition-all shadow-xl shadow-indigo-600/30">
              Book a Demo
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
            </button>
            <div className="flex flex-col items-center sm:items-start">
              <form onSubmit={handleLaunch} className="flex items-center gap-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono select-none">org/</span>
                  <input type="text" value={orgSlug} onChange={e => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="your-org"
                    className="pl-9 pr-4 py-3.5 bg-slate-800 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 text-white text-sm rounded-xl outline-none transition-all placeholder-slate-600 w-40" />
                </div>
                <button type="submit" className="flex items-center gap-1.5 px-5 py-3.5 border border-slate-700 hover:border-indigo-500 text-slate-300 hover:text-white text-sm font-semibold rounded-xl transition-all">
                  Open App →
                </button>
              </form>
              <p className="text-slate-600 text-xs mt-1.5 pl-1">Already have a workspace? Jump straight in.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
            <div className="flex items-center gap-1.5"><svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>No credit card to try</div>
            <div className="flex items-center gap-1.5"><svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>Setup in under 5 minutes</div>
            <div className="flex items-center gap-1.5"><svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>Full AI features included</div>
          </div>
        </div>
      </section>

      {/* ──────────── FOOTER ──────────── */}
      <footer className="border-t border-slate-800 py-10 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="font-bold text-base text-white">TestStudio<span className="text-indigo-400">.cloud</span></span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <a href="#features" className="hover:text-slate-300 transition-colors">Features</a>
              <a href="#ai" className="hover:text-slate-300 transition-colors">AI</a>
              <a href="#how" className="hover:text-slate-300 transition-colors">How it works</a>
              <a href="#pricing" className="hover:text-slate-300 transition-colors">Pricing</a>
              <button onClick={() => setEnquiryOpen(true)} className="hover:text-indigo-400 transition-colors">Contact</button>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
            <span>© {new Date().getFullYear()} TestStudio.cloud · AI-powered quality engineering</span>
            <span>Powered by GPT-4o · Built with Playwright</span>
          </div>
        </div>
      </footer>

      {enquiryOpen && <EnquiryModal onClose={() => setEnquiryOpen(false)} />}
    </div>
  );
}
