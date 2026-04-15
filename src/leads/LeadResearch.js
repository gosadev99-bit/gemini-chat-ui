import { useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import "./LeadResearch.css";

const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);

// ── SEARCH HELPER ──────────────────────────────────────────────────────────
async function searchWeb(query) {
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    );
    const data = await res.json();
    return (
      data.AbstractText ||
      data.Answer ||
      data.RelatedTopics?.[0]?.Text ||
      `No result found for: ${query}`
    );
  } catch {
    return `Search failed for: ${query}`;
  }
}

async function askGemini(prompt) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ── AGENT 1: RESEARCHER ────────────────────────────────────────────────────
async function runResearchAgent(company, onUpdate) {
  onUpdate("🔍 Researching company overview...");
  const [overview, news, tech, funding] = await Promise.all([
    searchWeb(`${company} company SaaS startup overview`),
    searchWeb(`${company} latest news 2025`),
    searchWeb(`${company} tech stack technology`),
    searchWeb(`${company} funding valuation investors`)
  ]);

  onUpdate("📊 Analyzing research data...");
  const summary = await askGemini(`
    You are a B2B sales researcher. Summarize this company for a sales rep.
    Company: ${company}
    Overview: ${overview}
    News: ${news}
    Tech: ${tech}
    Funding: ${funding}
    
    Write a concise 3-paragraph summary covering:
    1. What the company does and their market
    2. Recent developments and growth signals
    3. Technology and infrastructure
    
    Be specific and factual. No fluff.
  `);

  return { overview, news, tech, funding, summary };
}

// ── AGENT 2: SCORER ───────────────────────────────────────────────────────
async function runScorerAgent(company, research, onUpdate) {
  onUpdate("🎯 Scoring lead quality...");
  const scoreData = await askGemini(`
    You are a B2B sales lead scorer for a tech/SaaS company.
    Score this lead and respond in this EXACT format:

    SCORE: [number 1-10]
    TIER: [HOT/WARM/COLD]
    BUDGET_ESTIMATE: [e.g. $50K-$200K/year]
    COMPANY_SIZE: [e.g. 50-200 employees]
    PAIN_POINTS:
    - [pain point 1]
    - [pain point 2]
    - [pain point 3]
    OPPORTUNITY: [one sentence on best sales opportunity]
    TIMING: [IMMEDIATE/3-6 MONTHS/6-12 MONTHS]

    Company: ${company}
    Research: ${research.summary}
    News: ${research.news}
    Funding: ${research.funding}
  `);

  return scoreData;
}

// ── AGENT 3: WRITER ───────────────────────────────────────────────────────
async function runWriterAgent(company, research, score, onUpdate) {
  onUpdate("✍️ Writing personalized outreach email...");
  const email = await askGemini(`
    You are an expert B2B sales copywriter for a tech company.
    Write a personalized cold outreach email to ${company}.

    Research: ${research.summary}
    Score data: ${score}
    Recent news: ${research.news}

    Rules:
    - Subject line that gets opened (reference something specific)
    - Opening line references something real about the company
    - 3 short paragraphs max
    - Clear value proposition
    - Soft CTA — ask for 15 min call
    - Professional but conversational tone
    - NO generic phrases like "I hope this email finds you well"

    Format:
    SUBJECT: [subject line]

    [email body]
  `);

  return email;
}

// ── AGENT 4: LOGGER ───────────────────────────────────────────────────────
async function runLoggerAgent(company, research, score, email, onUpdate) {
  onUpdate("💾 Saving to Google Sheets...");

  // Parse score data
  const scoreMatch  = score.match(/SCORE:\s*(\d+)/);
  const tierMatch   = score.match(/TIER:\s*(\w+)/);
  const budgetMatch = score.match(/BUDGET_ESTIMATE:\s*(.+)/);
  const oppMatch    = score.match(/OPPORTUNITY:\s*(.+)/);
  const subjMatch   = email.match(/SUBJECT:\s*(.+)/);

  // Log to Google Sheets
  try {
    await fetch('https://api.gosanotary.tech/api/leads/log-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company,
        score:          scoreMatch  ? scoreMatch[1]  : 'N/A',
        tier:           tierMatch   ? tierMatch[1]   : 'N/A',
        budgetEstimate: budgetMatch ? budgetMatch[1].trim() : 'N/A',
        opportunity:    oppMatch    ? oppMatch[1].trim()    : 'N/A',
        emailSubject:   subjMatch   ? subjMatch[1].trim()  : 'N/A',
        research:       research.summary || research,
      })
    });
    onUpdate("✅ Logged to Google Sheets!");
  } catch (err) {
    console.error('Sheets log error:', err);
    onUpdate("⚠️ Sheets log failed — saved locally");
  }

  // Also save to localStorage as backup
  const report = {
    company,
    timestamp: new Date().toISOString(),
    research: research.summary || research,
    news: research.news || '',
    tech: research.tech || '',
    funding: research.funding || '',
    score,
    email,
  };

  const existing = JSON.parse(localStorage.getItem('lead-reports') || '[]');
  existing.unshift(report);
  if (existing.length > 20) existing.pop();
  localStorage.setItem('lead-reports', JSON.stringify(existing));

  return report;
}

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

    onUpdate("💾 Saving to Google Sheets...");
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