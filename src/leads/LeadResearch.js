import { useState } from "react";
import "./LeadResearch.css";


// ── MAIN PIPELINE ─────────────────────────────────────────────────────────
const BACKEND_URL = 'https://api.gosanotary.tech';

async function runLeadPipeline(company, onUpdate, onComplete) {
  try {
    onUpdate("🚀 Starting Lead Research Pipeline...");
    onUpdate("🔍 Research Agent searching...");

    const res = await fetch(`${BACKEND_URL}/api/leads/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company })
    });

    onUpdate("📊 Scorer Agent evaluating lead...");
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    // ── Log to Google Sheets ──────────────────────────────
    onUpdate("💾 Logging to Google Sheets...");
    try {
      const scoreMatch  = data.report.score.match(/SCORE:\s*(\d+)/);
      const tierMatch   = data.report.score.match(/TIER:\s*(\w+)/);
      const budgetMatch = data.report.score.match(/BUDGET_ESTIMATE:\s*(.+)/);
      const oppMatch    = data.report.score.match(/OPPORTUNITY:\s*(.+)/);
      const subjMatch   = data.report.email.match(/SUBJECT:\s*(.+)/);

      await fetch(`${BACKEND_URL}/api/leads/log-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company,
          score:          scoreMatch  ? scoreMatch[1]         : 'N/A',
          tier:           tierMatch   ? tierMatch[1]          : 'N/A',
          budgetEstimate: budgetMatch ? budgetMatch[1].trim() : 'N/A',
          opportunity:    oppMatch    ? oppMatch[1].trim()    : 'N/A',
          emailSubject:   subjMatch   ? subjMatch[1].trim()   : 'N/A',
          research:       data.report.research,
        })
      });
      onUpdate("✅ Logged to Google Sheets!");
    } catch (sheetErr) {
      console.error('Sheets error:', sheetErr);
      onUpdate("⚠️ Pipeline complete (Sheets log failed)");
    }
    // ─────────────────────────────────────────────────────

    onComplete(data.report);
  } catch (err) {
    onUpdate(`❌ Error: ${err.message}`);
  }
}

// ── UI COMPONENT ──────────────────────────────────────────────────────────
export default function LeadResearch() {
  const [company, setCompany]     = useState('');
  const [status, setStatus]       = useState('');
  const [report, setReport]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [history, setHistory]     = useState(() => {
    return JSON.parse(localStorage.getItem('lead-reports') || '[]');
  });
  const [activeTab, setActiveTab] = useState('research');

  async function handleResearch() {
    if (!company.trim() || loading) return;
    setLoading(true);
    setReport(null);
    setStatus('');

    await runLeadPipeline(
      company.trim(),
      (msg) => setStatus(msg),
      (result) => {
        setReport(result);
        setHistory(JSON.parse(localStorage.getItem('lead-reports') || '[]'));
        setLoading(false);
      }
    );
  }

  function parseScore(scoreText) {
    const match = scoreText.match(/SCORE:\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  function parseTier(scoreText) {
    const match = scoreText.match(/TIER:\s*(\w+)/);
    return match ? match[1] : 'UNKNOWN';
  }

  const tierColors = { HOT: '#ef4444', WARM: '#f59e0b', COLD: '#3b82f6' };

  return (
    <div className="lead-page">

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

        {/* Pipeline status */}
        {status && (
          <div className="pipeline-status">
            <div className="status-dot"/>
            {status}
          </div>
        )}
      </div>

      <div className="lead-content">

        {/* Report */}
        {report && (
          <div className="lead-report">

            {/* Score card */}
            <div className="score-card">
              <div className="score-circle">
                <span className="score-num">{parseScore(report.score)}</span>
                <span className="score-label">/10</span>
              </div>
              <div className="score-info">
                <h2>{report.company}</h2>
                <span
                  className="tier-badge"
                  style={{ background: tierColors[parseTier(report.score)] }}
                >
                  {parseTier(report.score)} LEAD
                </span>
                <p className="score-time">
                  {new Date(report.timestamp).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="report-tabs">
              {['research', 'score', 'email'].map(tab => (
                <button
                  key={tab}
                  className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'research' ? '🔍 Research' :
                   tab === 'score'    ? '📊 Score'    :
                                        '📧 Email'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="tab-content">
              {activeTab === 'research' && (
                <div className="report-section">
                  <h3>📋 Company Summary</h3>
                  <p>{report.research}</p>
                  <h3>📰 Latest News</h3>
                  <p>{report.news}</p>
                  <h3>⚙️ Tech Stack</h3>
                  <p>{report.tech}</p>
                  <h3>💰 Funding</h3>
                  <p>{report.funding}</p>
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
                <div style={{display:'flex', gap:'10px'}}>
  <button
    className="copy-btn"
    onClick={() => {
      navigator.clipboard.writeText(report.email);
      alert('Email copied!');
    }}
  >
    📋 Copy Email
  </button>
  <button
    className="copy-btn"
    style={{background:'#3b82f6', color:'white'}}
    onClick={async () => {
      const subjMatch = report.email.match(/SUBJECT:\s*(.+)/);
      const subject   = subjMatch ? subjMatch[1].trim() : `Following up — ${report.company}`;
      const body      = report.email.replace(/SUBJECT:.+\n/, '').trim();

      const to = prompt('Send to email address:');
      if (!to) return;

      try {
        const r = await fetch('https://api.gosanotary.tech/api/leads/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, subject, body, company: report.company })
        });
        const data = await r.json();
        if (data.success) alert('✅ Email sent!');
        else alert('❌ Error: ' + data.error);
      } catch (err) {
        alert('❌ Failed: ' + err.message);
      }
    }}
  >
    📧 Send Email
  </button>
</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* History sidebar */}
        {history.length > 0 && (
          <div className="lead-history">
            <h3>📁 Recent Leads</h3>
            {history.map((h, i) => (
              <div
                key={i}
                className="history-item"
                onClick={() => { setReport(h); setActiveTab('research'); }}
              >
                <span className="history-company">{h.company}</span>
                <span
                  className="history-tier"
                  style={{ color: tierColors[parseTier(h.score)] }}
                >
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