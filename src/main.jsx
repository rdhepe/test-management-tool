import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import SprintDetailPage from './components/SprintDetailPage.jsx'
import './index.css'

const params = new URLSearchParams(window.location.search)
const view = params.get('view')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {view === 'sprint' ? <SprintDetailPage /> : <App />}
  </React.StrictMode>,
)
