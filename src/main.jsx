import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom'
import App from './App.jsx'
import Landing from './components/Landing.jsx'
import SprintDetailPage from './components/SprintDetailPage.jsx'
import './index.css'

// Renders either SprintDetailPage (for ?view=sprint) or the main App for a given org slug
function OrgEntry() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const lowerSlug = slug?.toLowerCase();
  if (searchParams.get('view') === 'sprint') return <SprintDetailPage />;
  return <App orgSlug={lowerSlug} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Root → Landing page */}
        <Route path="/" element={<Landing />} />
        {/* Per-org app (login + full app) */}
        <Route path="/org/:slug" element={<OrgEntry />} />
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
