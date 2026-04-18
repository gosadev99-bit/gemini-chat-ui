import { useState, useEffect } from "react";
import "./LeadResearch.css";

const BACKEND_URL = 'https://api.gosanotary.tech';

const AGENT_STEPS = [
  { id: 'research', label: '🔍 Researcher', desc: 'Searching company data...' },
  { id: 'score',    label: '📊 Scorer',     desc: 'Evaluating lead quality...' },
  { id: 'email',    label: '✍️ Writer',      desc: 'Drafting outreach email...' },
  { id: 'log',      label: '💾 Logger',      desc: 'Saving to Google Sheets...' },
];

async function runLeadPipeline(company, onStepUpdate, onComplete) {
  try {
    onStepUpdate('research', 'running');

    const res = await fetch(`${BACKEND_URL}/api/leads/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company })
    });

    onStepUpdate('research', 'done');
    onStepUpdate('score', 'running');

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    onStepUpdate('score', 'done');
    onStepUpdate('email', 'running');
    onStepUpdate('email', 'done');
    onStepUpdate('log', 'running');
    onStepUpdate('log', 'done');

    // Save to localStorage
    const report = data.report;
    const existing = JSON.parse(localStorage.getItem('lead-reports') || '[]');
    existing.unshift(report);
    if (existing.length > 20) existing.pop();
    localStorage.setItem('lead-reports', JSON.stringify(existing));

    onComplete(report, null);
  } catch (err) {
    onComplete(null, err.message);
  }
}

export default function LeadResearch() {
  const [company, setCompany]     = useState('');
  const [report, setReport]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [history, setHistory]     = useState(() =>
    JSON.parse(localStorage.getItem('lead-reports') || '[]'));
  const [activeTab, setActiveTab] = useState('research');
  const [stepStatus, setStepStatus] = useState({});
  const [toast, setToast]         = useState(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
  }

  function updateStep(stepId, status) {
    setStepStatus(prev => ({ ...prev, [stepId]: status }));
  }

  async function handleResearch() {
    if (!company.trim() || loading) return;
    setLoading(true);
    setReport(null);
    setStepStatus({});
    setActiveTab('research');

    await runLeadPipeline(
      company.trim(),
      updateStep,
      (result, err) => {
        if (err) {
          showToast(`❌ ${err}`, 'error');
        } else {
          setReport(result);
          setHistory(JSON.parse(localStorage.getItem('lead-reports') || '[]'));
          showToast(`✅ ${company} researched and logged to Sheets!`);
        }
        setLoading(false);
      }
    );
  }

  function parseScore(scoreText) {
    const match = scoreText?.match(/SCORE:\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  function parseTier(scoreText) {
    const match = scoreText?.match(/TIER:\s*(\w+)/);
    return match ? match[1] : 'UNKNOWN';
  }

  const tierColors = { HOT: '#ef4444', WARM: '#f59e0b', COLD: '#3b82f6' };

  const progressPct = () => {
    const done = AGENT_STEPS.filter(s => stepStatus[s.id] === 'done').length;
    return Math.round((done / AGENT_STEPS.length) * 100);
  };

  return (
    <div className="lead-page">

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'error' : ''}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="lead-header">
        <div className="lead-header-left">
          <h1>💼 Lead Research Pipeline</h1>
          <p>AI-powered B2B sales intelligence for tech companies</p>
        </div>
        <a href="/" className="back-btn">← Back to Agent</a>
      </div>

      {/* Search */}
      <div className="lead-search">
        <div className="search-box">
          <input
            type="text"
            placeholder="Enter company name (e.g. Stripe, Notion, Linear...)"
            value={company}
            onChange={e => setCompany(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleResearch()}
            disabled={loading}
          />
          <button onClick={handleResearch} disabled={loading || !company.trim()}>
            {loading ? 'Researching...' : '🔍 Research'}
          </button>
        </div>

        {/* Progress bar */}
        {loading && (
          <div className="pipeline-progress">
            <div className="progress-steps">
              {AGENT_STEPS.map(step => (
                <div key={step.id}
                  className={`progress-step ${stepStatus[step.id] || ''}`}>
                  {stepStatus[step.id] === 'done'    ? '✅' :
                   stepStatus[step.id] === 'running' ? '⚡' : '○'} {step.label}
                </div>
              ))}
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill"
                style={{ width: `${progressPct()}%` }} />
            </div>
          </div>
        )}

        {/* Agent step details */}
        {loading && AGENT_STEPS.map(step => {
          const status = stepStatus[step.id];
          if (!status) return null;
          return (
            <div key={step.id} className={`agent-step ${status}`}>
              {status === 'running'
                ? <div className="agent-spinner"/>
                : <span>✅</span>}
              {status === 'running' ? step.desc : `${step.label} complete`}
            </div>
          );
        })}
      </div>

      <div className="lead-content">
        {report && (
          <div className="lead-report">
            <div className="score-card">
              <div className="score-circle">
                <span className="score-num">{parseScore(report.score)}</span>
                <span className="score-label">/10</span>
              </div>
              <div className="score-info">
                <h2>{report.company}</h2>
                <span className="tier-badge"
                  style={{ background: tierColors[parseTier(report.score)] }}>
                  {parseTier(report.score)} LEAD
                </span>
                <p className="score-time">
                  {new Date(report.timestamp).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="report-tabs">
              {['research', 'score', 'email'].map(tab => (
                <button key={tab}
                  className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}>
                  {tab === 'research' ? '🔍 Research' :
                   tab === 'score'    ? '📊 Score'    : '📧 Email'}
                </button>
              ))}
            </div>

            <div className="tab-content">
              {activeTab === 'research' && (
                <div className="report-section">
                  <h3>📋 Company Summary</h3><p>{report.research}</p>
                  <h3>📰 Latest News</h3><p>{report.news}</p>
                  <h3>⚙️ Tech Stack</h3><p>{report.tech}</p>
                  <h3>💰 Funding</h3><p>{report.funding}</p>
                </div>
              )}
              {activeTab === 'score' && (
                <div className="report-section">
                  <pre className="score-text">{report.score}</pre>
                </div>
              )}
              {activeTab === 'email' && (
                <div className="report-section">
                  <div className="email-box">
                    <pre>{report.email}</pre>
                  </div>
                  <div style={{display:'flex', gap:'10px', marginTop:'12px'}}>
                    <button className="copy-btn" onClick={() => {
                      navigator.clipboard.writeText(report.email);
                      showToast('📋 Email copied to clipboard!');
                    }}>
                      📋 Copy Email
                    </button>
                    <button className="copy-btn"
                      style={{background:'#3b82f6', color:'white'}}
                      onClick={async () => {
                        const subjMatch = report.email.match(/SUBJECT:\s*(.+)/);
                        const subject = subjMatch ? subjMatch[1].trim() : `Following up — ${report.company}`;
                        const body = report.email.replace(/SUBJECT:.+\n/, '').trim();
                        const to = prompt('Send to email address:');
                        if (!to) return;
                        try {
                          const r = await fetch(`${BACKEND_URL}/api/leads/send-email`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ to, subject, body, company: report.company })
                          });
                          const d = await r.json();
                          if (d.success) showToast('📧 Email sent successfully!');
                          else showToast(`❌ ${d.error}`, 'error');
                        } catch (err) {
                          showToast(`❌ ${err.message}`, 'error');
                        }
                      }}>
                      📧 Send Email
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="lead-history">
            <h3>📁 Recent Leads</h3>
            {history.map((h, i) => (
              <div key={i} className="history-item"
                onClick={() => { setReport(h); setActiveTab('research'); }}>
                <span className="history-company">{h.company}</span>
                <span className="history-tier"
                  style={{ color: tierColors[parseTier(h.score)] }}>
                  {parseTier(h.score)}
                </span>
                <span className="history-score">{parseScore(h.score)}/10</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}