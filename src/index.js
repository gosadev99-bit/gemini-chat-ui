import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import LeadResearch from './leads/LeadResearch';

function Router() {
  const path = window.location.pathname;
  if (path.startsWith('/leads')) return <LeadResearch />;
  return <App />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
);