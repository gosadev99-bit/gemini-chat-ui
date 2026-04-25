import { useState, useEffect, useRef } from "react";
import Dashboard from "./Dashboards";
import "./LeadResearch.css";

const BACKEND_URL = 'https://api.gosanotary.tech';

const AGENT_STEPS = [
  { id: 'research', label: 'Researcher', icon: '🔍', desc: 'Scanning company intelligence...' },
  { id: 'score',    label: 'Scorer',     icon: '📊', desc: 'Evaluating lead quality...' },
  { id: 'email',    label: 'Writer',     icon: '✍️',  desc: 'Crafting outreach email...' },
  { id: 'log',      label: 'Logger',     icon: '💾', desc: 'Saving to Google Sheets...' },
];

async function runLeadPipeline(company, onStepUpdate, onComplete) {
  try {
    onStepUpdate('research', 'running');
   const res = await fetch(`${BACKEND_URL}/api/leads/research`, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'X-API-Key': process.env.REACT_APP_API_KEY 
  },
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

function parseScore(scoreText) {
  const match = scoreText?.match(/SCORE:\s*(\d+)/);
  return match ? parseInt(match[1]) : 0;
}
function parseTier(scoreText) {
  const match = scoreText?.match(/TIER:\s*(\w+)/);
  return match ? match[1] : 'UNKNOWN';
}
function parseBudget(scoreText) {
  const match = scoreText?.match(/BUDGET_ESTIMATE:\s*(.+)/);
  return match ? match[1].trim() : 'N/A';
}
function parseTiming(scoreText) {
  const match = scoreText?.match(/TIMING:\s*(.+)/);
  return match ? match[1].trim() : 'N/A';
}
function parseOpportunity(scoreText) {
  const match = scoreText?.match(/OPPORTUNITY:\s*(.+)/);
  return match ? match[1].trim() : '';
}
function parsePainPoints(scoreText) {
  const matches = scoreText?.match(/- (.+)/g);
  return matches ? matches.map(m => m.replace('- ', '').trim()).slice(0, 3) : [];
}

const TIER_CONFIG = {
  HOT:     { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   glow: '0 0 20px rgba(239,68,68,0.3)',   label: '🔥 HOT' },
  WARM:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  glow: '0 0 20px rgba(245,158,11,0.3)',  label: '⚡ WARM' },
  COLD:    { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  glow: '0 0 20px rgba(59,130,246,0.3)',  label: '❄️ COLD' },
  UNKNOWN: { color: '#64748b', bg: 'rgba(100,116,139,0.12)', glow: 'none', label: '? UNKNOWN' },
};

export default function LeadResearch() {
  const [company, setCompany]       = useState('');
  const [report, setReport]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [history, setHistory]       = useState(() =>
    JSON.parse(localStorage.getItem('lead-reports') || '[]'));
  const [activeTab, setActiveTab]   = useState('research');
  const [stepStatus, setStepStatus] = useState({});
  const [toast, setToast]           = useState(null);
  const [favicon, setFavicon]       = useState(null);
  const inputRef                    = useRef(null);
  const [pageTab, setPageTab] = useState('research');

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  function showToast(msg, type = 'success') { setToast({ msg, type }); }

  function updateStep(stepId, status) {
    setStepStatus(prev => ({ ...prev, [stepId]: status }));
  }

  function fetchFavicon(companyName) {
    const domains = [`${companyName.toLowerCase()}.com`, `${companyName.toLowerCase()}.io`];
    setFavicon(`https://www.google.com/s2/favicons?domain=${domains[0]}&sz=64`);
  }

  async function handleResearch() {
    if (!company.trim() || loading) return;
    setLoading(true);
    setReport(null);
    setStepStatus({});
    setActiveTab('research');
    setFavicon(null);
    fetchFavicon(company.trim());

    await runLeadPipeline(
      company.trim(),
      updateStep,
      (result, err) => {
        if (err) {
          showToast(`❌ ${err}`, 'error');
        } else {
          setReport(result);
          setHistory(JSON.parse(localStorage.getItem('lead-reports') || '[]'));
          showToast(`✅ ${company} researched & logged to Sheets!`);
        }
        setLoading(false);
      }
    );
  }

  function exportCSV() {
    if (!history.length) return;
    const headers = ['Company', 'Score', 'Tier', 'Budget', 'Timestamp'];
    const rows = history.map(h => [
      h.company,
      parseScore(h.score),
      parseTier(h.score),
      parseBudget(h.score),
      new Date(h.timestamp).toLocaleString()
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'leads.csv'; a.click();
    showToast('📥 CSV exported!');
  }

  function clearHistory() {
    if (!window.confirm('Clear all lead history?')) return;
    localStorage.removeItem('lead-reports');
    setHistory([]);
    showToast('🗑️ History cleared');
  }

  const progressPct = () => {
    const done = AGENT_STEPS.filter(s => stepStatus[s.id] === 'done').length;
    return Math.round((done / AGENT_STEPS.length) * 100);
  };

  const tier = parseTier(report?.score);
  const tierConf = TIER_CONFIG[tier] || TIER_CONFIG.UNKNOWN;
  const score = parseScore(report?.score);

  return (
    <div className="lrp-root">

      {/* Toast */}
      {toast && (
        <div className={`lrp-toast ${toast.type === 'error' ? 'error' : ''}`}>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* HERO HEADER */}
      <div className="lrp-hero">
        <div className="lrp-hero-bg"/>
        <div className="lrp-hero-inner">
          <div className="lrp-hero-badge">AI Sales Intelligence</div>
          <h1 className="lrp-hero-title">
            Lead Research
            <span className="lrp-hero-accent"> Pipeline</span>
          </h1>
          <p className="lrp-hero-sub">
            4-agent AI system that researches companies, scores leads,
            drafts outreach emails, and logs to Google Sheets — automatically.
          </p>

          {/* Search box */}
          <div className="lrp-search-wrap">
            <div className="lrp-search-box">
              <span className="lrp-search-icon">🏢</span>
              <input
                ref={inputRef}
                type="text"
                placeholder="Enter company name (e.g. Stripe, Linear, Notion...)"
                value={company}
                onChange={e => setCompany(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleResearch()}
                disabled={loading}
                className="lrp-search-input"
              />
              <button
                onClick={handleResearch}
                disabled={loading || !company.trim()}
                className="lrp-search-btn"
              >
                {loading ? <span className="lrp-btn-spinner"/> : '🔍 Research'}
              </button>
            </div>

            {/* Agent pipeline progress */}
            {loading && (
              <div className="lrp-progress-wrap">
                <div className="lrp-agent-steps">
                  {AGENT_STEPS.map((step, i) => {
                    const st = stepStatus[step.id];
                    return (
                      <div key={step.id} className={`lrp-agent-step ${st || 'idle'}`}>
                        <div className="lrp-step-icon">
                          {st === 'done' ? '✅' : st === 'running'
                            ? <span className="lrp-mini-spinner"/>
                            : step.icon}
                        </div>
                        <div className="lrp-step-info">
                          <div className="lrp-step-label">{step.label}</div>
                          {st === 'running' && (
                            <div className="lrp-step-desc">{step.desc}</div>
                          )}
                        </div>
                        {i < AGENT_STEPS.length - 1 && (
                          <div className={`lrp-step-arrow ${st === 'done' ? 'done' : ''}`}>→</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="lrp-bar-track">
                  <div className="lrp-bar-fill" style={{ width: `${progressPct()}%` }}/>
                </div>
              </div>
            )}
          </div>

          {/* Stats bar */}
          <div className="lrp-stats">
            <div className="lrp-stat">
              <span className="lrp-stat-num">{history.length}</span>
              <span className="lrp-stat-label">Leads Researched</span>
            </div>
            <div className="lrp-stat-div"/>
            <div className="lrp-stat">
              <span className="lrp-stat-num">
                {history.filter(h => parseTier(h.score) === 'HOT').length}
              </span>
              <span className="lrp-stat-label">🔥 Hot Leads</span>
            </div>
            <div className="lrp-stat-div"/>
            <div className="lrp-stat">
              <span className="lrp-stat-num">4</span>
              <span className="lrp-stat-label">AI Agents</span>
            </div>
            <div className="lrp-stat-div"/>
            <div className="lrp-stat">
              <span className="lrp-stat-num">Auto</span>
              <span className="lrp-stat-label">Sheets Logging</span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="lrp-body">

        {pageTab === 'research' ? (
  // existing lrp-body div with report + sidebar
  <div className="lrp-body">
    ...existing content...
  </div>
) : (
  <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 40px 60px'}}>
    <Dashboard
      leads={history}
      onSelectLead={(lead) => {
        setReport(lead);
        setActiveTab('research');
        setPageTab('research');
      }}
    />
  </div>
)}

        {/* LEFT — Report */}
        <div className="lrp-report-col">
          {!report && !loading && (
            <div className="lrp-empty">
              <div className="lrp-empty-icon">🎯</div>
              <h3>Start researching a lead</h3>
              <p>Enter a company name above to run the full 4-agent pipeline</p>
              <div className="lrp-empty-agents">
                {AGENT_STEPS.map(s => (
                  <div key={s.id} className="lrp-empty-agent">
                    <span>{s.icon}</span>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report && (
            <div className="lrp-report">
              {/* Score hero */}
              <div className="lrp-score-hero" style={{
                background: tierConf.bg,
                boxShadow: tierConf.glow,
                borderColor: tierConf.color + '40'
              }}>
                <div className="lrp-score-left">
                  {favicon && (
                    <img src={favicon} alt="" className="lrp-company-favicon"
                      onError={e => e.target.style.display='none'}/>
                  )}
                  <div>
                    <h2 className="lrp-company-name">{report.company}</h2>
                    <div className="lrp-tier-pill" style={{
                      background: tierConf.color,
                    }}>
                      {tierConf.label}
                    </div>
                    <div className="lrp-report-meta">
                      {new Date(report.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="lrp-score-ring">
                  <svg viewBox="0 0 100 100" className="lrp-score-svg">
                    <circle cx="50" cy="50" r="42" className="lrp-ring-bg"/>
                    <circle cx="50" cy="50" r="42" className="lrp-ring-fill"
                      style={{
                        stroke: tierConf.color,
                        strokeDashoffset: 264 - (264 * score / 10)
                      }}/>
                  </svg>
                  <div className="lrp-score-text">
                    <span className="lrp-score-num">{score}</span>
                    <span className="lrp-score-denom">/10</span>
                  </div>
                </div>
              </div>

              {/* Quick stats */}
              <div className="lrp-quick-stats">
                <div className="lrp-qs-item">
                  <span className="lrp-qs-label">Budget</span>
                  <span className="lrp-qs-value">{parseBudget(report.score)}</span>
                </div>
                <div className="lrp-qs-item">
                  <span className="lrp-qs-label">Timing</span>
                  <span className="lrp-qs-value">{parseTiming(report.score)}</span>
                </div>
                <div className="lrp-qs-item">
                  <span className="lrp-qs-label">Opportunity</span>
                  <span className="lrp-qs-value lrp-qs-opp">{parseOpportunity(report.score)}</span>
                </div>
              </div>

              {/* Pain points */}
              {parsePainPoints(report.score).length > 0 && (
                <div className="lrp-pain-points">
                  <div className="lrp-pp-label">Pain Points</div>
                  {parsePainPoints(report.score).map((pp, i) => (
                    <div key={i} className="lrp-pp-item">
                      <span style={{color: tierConf.color}}>▸</span> {pp}
                    </div>
                  ))}
                </div>
              )}

             {/* Page tabs */}
<div style={{display:'flex', gap:8, marginTop:16}}>
  {['research','dashboard'].map(t => (
    <button key={t} onClick={() => setPageTab(t)} style={{
      padding:'8px 18px', borderRadius:8, border:'1.5px solid',
      borderColor: pageTab===t ? '#3b82f6' : 'transparent',
      background: pageTab===t ? 'rgba(59,130,246,0.12)' : 'transparent',
      color: pageTab===t ? '#93c5fd' : '#475569',
      fontSize:13, fontWeight:600, cursor:'pointer',
      textTransform:'capitalize'
    }}>
      {t === 'research' ? '🔍 Research' : '📊 Dashboard'}
    </button>
  ))}
</div>

              <div className="lrp-tab-content">
                {activeTab === 'research' && (
                  <div className="lrp-research-content">
                    <div className="lrp-section">
                      <div className="lrp-section-title">📋 Company Summary</div>
                      <p>{report.research}</p>
                    </div>
                    <div className="lrp-section">
                      <div className="lrp-section-title">📰 Latest News</div>
                      <p>{report.news}</p>
                    </div>
                    <div className="lrp-two-col">
                      <div className="lrp-section">
                        <div className="lrp-section-title">⚙️ Tech Stack</div>
                        <p>{report.tech}</p>
                      </div>
                      <div className="lrp-section">
                        <div className="lrp-section-title">💰 Funding</div>
                        <p>{report.funding}</p>
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === 'score' && (
                  <pre className="lrp-score-pre">{report.score}</pre>
                )}
                {activeTab === 'email' && (
                  <div>
                    <div className="lrp-email-box">
                      <pre>{report.email}</pre>
                    </div>
                    <div className="lrp-email-actions">
                      <button className="lrp-action-btn secondary" onClick={() => {
                        navigator.clipboard.writeText(report.email);
                        showToast('📋 Email copied!');
                      }}>📋 Copy</button>
                      <button className="lrp-action-btn primary" onClick={async () => {
                        const subjMatch = report.email.match(/SUBJECT:\s*(.+)/);
                        const subject = subjMatch ? subjMatch[1].trim() : `Re: ${report.company}`;
                        const body = report.email.replace(/SUBJECT:.+\n/, '').trim();
                        const to = prompt('Send to email address:');
                        if (!to) return;
                        try {
                        const r = await fetch(`${BACKEND_URL}/api/leads/send-email`, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'X-API-Key': 'gosa-react-ui-key-2026'
  },
                            body: JSON.stringify({ to, subject, body, company: report.company })
                          });
                          const d = await r.json();
                          if (d.success) showToast('📧 Email sent!');
                          else showToast(`❌ ${d.error}`, 'error');
                        } catch (err) {
                          showToast(`❌ ${err.message}`, 'error');
                        }
                      }}>📧 Send Email</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — History sidebar */}
        <div className="lrp-sidebar">
          <div className="lrp-sidebar-header">
            <h3>📁 Recent Leads</h3>
            <div className="lrp-sidebar-actions">
              {history.length > 0 && (
                <>
                  <button className="lrp-icon-btn" onClick={exportCSV} title="Export CSV">
                    📥
                  </button>
                  <button className="lrp-icon-btn danger" onClick={clearHistory} title="Clear history">
                    🗑️
                  </button>
                </>
              )}
            </div>
          </div>

          {history.length === 0 ? (
            <div className="lrp-sidebar-empty">
              No leads yet — research a company to get started!
            </div>
          ) : (
            <div className="lrp-history-list">
              {history.map((h, i) => {
                const t = parseTier(h.score);
                const tc = TIER_CONFIG[t] || TIER_CONFIG.UNKNOWN;
                return (
                  <div key={i} className="lrp-history-item"
                    onClick={() => { setReport(h); setActiveTab('research'); }}
                    style={{ borderLeftColor: tc.color }}>
                    <div className="lrp-hi-top">
                      <span className="lrp-hi-company">{h.company}</span>
                      <span className="lrp-hi-score" style={{ color: tc.color }}>
                        {parseScore(h.score)}/10
                      </span>
                    </div>
                    <div className="lrp-hi-bottom">
                      <span className="lrp-hi-tier" style={{
                        background: tc.bg, color: tc.color
                      }}>{tc.label}</span>
                      <span className="lrp-hi-date">
                        {new Date(h.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Back link */}
          <a href="/" className="lrp-back-link">← Back to AI Agent</a>
        </div>

      </div>
    </div>
  );
}