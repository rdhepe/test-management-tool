import React, { useState } from 'react';

const STORAGE_KEY = 'playwright_config';

const DEFAULTS = {
  browser: 'chromium',
  executionMode: 'serial',
  workers: 2,
  screenshotMode: 'only-on-failure',
  traceMode: 'off',
  videoMode: 'off',
};

const selectCls = 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm';

export default function PlaywrightConfig() {
  const [cfg, setCfg] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s ? { ...DEFAULTS, ...JSON.parse(s) } : { ...DEFAULTS };
    } catch { return { ...DEFAULTS }; }
  });
  const [saved, setSaved] = useState(false);

  const set = (key) => (e) => setCfg(c => ({ ...c, [key]: e.target.value }));

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const Row = ({ label, hint, children }) => (
    <div className="flex items-center gap-4 py-3 border-b border-slate-800 last:border-0">
      <div className="w-36 shrink-0">
        <div className="text-sm font-medium text-slate-300">{label}</div>
        {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );

  return (
    <div className="space-y-4 animate-page-transition">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Playwright Config</h1>
          <p className="text-slate-400 text-sm mt-0.5">Test runner settings for all execution modes</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-400 font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save
          </button>
        </div>
      </div>

      {/* Settings card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-1 max-w-2xl">

        <Row label="Browser">
          <select value={cfg.browser} onChange={set('browser')} className={selectCls}>
            <option value="chromium">Chromium (Chrome)</option>
            <option value="firefox">Firefox</option>
            <option value="webkit">WebKit (Safari)</option>
          </select>
        </Row>

        <Row label="Execution Mode" hint="Individual & CI runs">
          <div className="flex gap-2">
            {[
              { value: 'serial',   label: 'Serial' },
              { value: 'parallel', label: 'Parallel' },
            ].map(m => (
              <button
                key={m.value}
                onClick={() => setCfg(c => ({ ...c, executionMode: m.value }))}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                  cfg.executionMode === m.value
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </Row>

        {cfg.executionMode === 'parallel' && (
          <Row label="Workers" hint="2 – 8 threads">
            <input
              type="number"
              min={2}
              max={8}
              value={cfg.workers}
              onChange={e => setCfg(c => ({ ...c, workers: Math.min(8, Math.max(2, parseInt(e.target.value) || 2)) }))}
              className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 text-sm"
            />
          </Row>
        )}

        <Row label="Screenshots" hint="When to capture">
          <div className="flex gap-2 flex-wrap">
            {[
              { value: 'only-on-failure', label: 'On Failure' },
              { value: 'on',             label: 'Always' },
              { value: 'off',            label: 'Disabled' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setCfg(c => ({ ...c, screenshotMode: opt.value }))}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                  cfg.screenshotMode === opt.value
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Trace" hint="DOM snapshots + network">
          <div className="flex gap-2 flex-wrap">
            {[
              { value: 'off',              label: 'Off' },
              { value: 'on-first-retry',   label: 'On Retry' },
              { value: 'retain-on-failure',label: 'On Failure' },
              { value: 'on',               label: 'Always' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setCfg(c => ({ ...c, traceMode: opt.value }))}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                  cfg.traceMode === opt.value
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Video" hint="Records browser video">
          <div className="flex gap-2 flex-wrap">
            {[
              { value: 'off',              label: 'Off' },
              { value: 'on-first-retry',   label: 'On Retry' },
              { value: 'retain-on-failure',label: 'On Failure' },
              { value: 'on',               label: 'Always' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setCfg(c => ({ ...c, videoMode: opt.value }))}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                  cfg.videoMode === opt.value
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Row>

      </div>
    </div>
  );
}
