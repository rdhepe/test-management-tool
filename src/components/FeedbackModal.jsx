import React, { useState } from 'react';
import API_URL from '../apiUrl';

export default function FeedbackModal({ onClose, currentUser }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/platform-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({ title: title.trim(), description: description.trim() })
      });
      if (!res.ok) throw new Error('Failed to submit');
      setSubmitted(true);
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl"
        style={{ backgroundColor: 'rgb(var(--bg-elevated))' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgb(var(--border-primary))' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Request a Feature</h2>
              <p className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>Your idea goes straight to our product team</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {submitted ? (
          <div className="px-6 py-12 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-white mb-1">Thanks for the idea!</p>
              <p className="text-sm text-slate-400">We've received your feature request and will review it shortly.</p>
            </div>
            <button onClick={onClose}
              className="mt-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(var(--text-secondary))' }}>
                Feature title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Export test results to CSV"
                maxLength={120}
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all"
                style={{
                  backgroundColor: 'rgb(var(--bg-secondary))',
                  borderColor: 'rgb(var(--border-primary))',
                  color: 'rgb(var(--text-primary))'
                }}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(var(--text-secondary))' }}>
                Description <span className="text-red-400">*</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe what you'd like to see and why it would help your team..."
                rows={5}
                maxLength={2000}
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all resize-none"
                style={{
                  backgroundColor: 'rgb(var(--bg-secondary))',
                  borderColor: 'rgb(var(--border-primary))',
                  color: 'rgb(var(--text-primary))'
                }}
                required
              />
              <p className="text-xs text-right mt-1" style={{ color: 'rgb(var(--text-tertiary))' }}>{description.length}/2000</p>
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</div>
            )}

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs" style={{ color: 'rgb(var(--text-tertiary))' }}>
                Submitting as <span className="font-medium text-indigo-400">{currentUser?.username}</span>
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={onClose}
                  className="px-4 py-2 text-sm rounded-xl border transition-colors"
                  style={{ borderColor: 'rgb(var(--border-primary))', color: 'rgb(var(--text-secondary))' }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting || !title.trim() || !description.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors">
                  {submitting && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>}
                  Submit Request
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
