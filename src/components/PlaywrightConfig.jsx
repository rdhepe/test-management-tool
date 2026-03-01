import React, { useState } from 'react';

const STORAGE_KEY = 'playwright_config';

const DEFAULTS = {
  browser: 'chromium',
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

  return (
    <div className="space-y-6 animate-page-transition">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Playwright Config</h1>
          <p className="text-slate-400 mt-1">Configure your Playwright test runner settings</p>
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
            className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium shadow-lg shadow-indigo-600/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save
          </button>
        </div>
      </div>

      {/* Browser & Launch */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Browser &amp; Launch</h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Browser</label>
          <select value={cfg.browser} onChange={set('browser')} className={selectCls}>
            <option value="chromium">Chromium (Chrome)</option>
            <option value="firefox">Firefox</option>
            <option value="webkit">WebKit (Safari)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
