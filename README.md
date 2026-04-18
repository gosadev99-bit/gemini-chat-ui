# 💬 Gossaye AI Agent — React UI

> Full-stack AI agent chat interface with multi-agent orchestration, streaming responses, RAG user profiling, cost tracking, and a 4-agent Lead Research Pipeline.

**Live Demo:** https://agent.gosanotary.tech  
**Lead Pipeline:** https://agent.gosanotary.tech/leads  
**Backend API:** https://api.gosanotary.tech  

---

## 🚀 What This Does

A production React application that provides two AI-powered tools:

### 1. AI Agent Chat (`/`)
- Multi-agent orchestration — routes to Sales or Code Review agents
- Streaming word-by-word responses like ChatGPT
- RAG user profile — permanently remembers name, job, location
- Token usage + cost tracking per request
- Persistent conversation history via localStorage
- 3 tools: Calculator, Web Search, GitHub PR management

### 2. Lead Research Pipeline (`/leads`)
- Research any tech company with one click
- 4-agent pipeline: Researcher → Scorer → Writer → Logger
- Auto-logs every lead to Google Sheets
- One-click email copy or direct send
- HOT/WARM/COLD lead scoring with 1-10 quality score
- Progress bar showing each agent step in real time

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 |
| Styling | CSS3 (custom dark theme) |
| AI | Google Gemini API (via backend) |
| State | React useState + localStorage |
| Streaming | Server-Sent Events (SSE) |
| Routing | window.location.pathname |
| Deployment | Ubuntu VPS + Nginx + SSL |

---

## 📁 Project Structure

```
src/
├── App.js                    ← Main chat agent UI
├── App.css                   ← Chat styles
├── index.js                  ← Router (/ vs /leads)
├── agents/
│   ├── orchestrator.js       ← Routes to Sales or Code Review
│   ├── salesAgent.js         ← Research → Score → Write pipeline
│   └── codeReviewAgent.js    ← Fetch → Review → Report pipeline
├── memory/
│   ├── userProfile.js        ← Persistent RAG user profile
│   └── entityExtractor.js    ← Extracts facts from conversation
└── leads/
    ├── LeadResearch.js       ← 4-agent lead research UI
    └── LeadResearch.css      ← Lead pipeline styles
```

---

## 🤖 Multi-Agent Architecture

```
User message
      ↓
Orchestrator (classifies intent)
      ↓
   SALES?           CODE REVIEW?         GENERAL?
      ↓                  ↓                  ↓
Research Agent     Fetch PR files     Backend API
Score Agent        Review code        (streaming)
Write Agent        Generate report
```

---

## 📊 Lead Research Pipeline

```
User types: "Stripe"
      ↓
🔍 Researcher  → company overview, news, tech stack, funding
      ↓
📊 Scorer      → quality score 1-10, HOT/WARM/COLD tier
      ↓
✍️  Writer      → personalized cold outreach email
      ↓
💾 Logger      → auto-saved to Google Sheets
      ↓
React UI shows full report with tabs + Send Email button
```

---

## ⚡ Streaming Architecture

```
React callBackendStream()
      ↓
POST /api/chat/stream (SSE)
      ↓
{ type: "tool",  tool: "calculate" }   → show tool status
{ type: "chunk", text: "word " }       → append to bubble
{ type: "done",  usage: {...} }        → show cost + finalize
```

---

## 🏃 Running Locally

### Prerequisites
- Node.js v18+
- Backend running at http://localhost:3001

### Setup
```bash
git clone https://github.com/gosadev99-bit/gemini-chat-ui
cd gemini-chat-ui
npm install
```

### Environment Variables
Create `.env`:
```
REACT_APP_GEMINI_API_KEY=your_gemini_key
REACT_APP_GITHUB_TOKEN=your_github_token
REACT_APP_GITHUB_USERNAME=your_username
REACT_APP_GITHUB_REPO=your_repo
```

### Run
```bash
# Development
npm start

# Production build
npm run build
```

### Switch between local and production backend:
In `src/App.js`:
```js
const USE_BACKEND = true;  // false = direct Gemini (dev only)
const BACKEND_URL = 'http://localhost:3001';  // or production URL
```

---

## 🚀 Production Deployment

Built and deployed on Hostinger VPS:

```bash
npm run build
# Nginx serves /build at agent.gosanotary.tech
# SSL via Let's Encrypt (Certbot)
```

```
/var/www/gemini-chat-ui/
├── src/                ← React source
├── build/              ← Production build (served by Nginx)
└── public/
```

---

## 📈 Features Built

- ✅ Multi-agent orchestration (Sales + Code Review + General)
- ✅ Streaming word-by-word SSE responses
- ✅ RAG user profile — permanent memory never deleted
- ✅ Token usage + cost tracking (📥 in 📤 out 💰 cost)
- ✅ Persistent chat history via localStorage
- ✅ 4-agent Lead Research Pipeline
- ✅ Progress bar with individual agent step indicators
- ✅ Toast notifications for pipeline completion
- ✅ Google Sheets auto-logging
- ✅ One-click email copy + direct send
- ✅ HOT/WARM/COLD lead scoring
- ✅ Lead history sidebar with localStorage
- ✅ Mobile-responsive dark theme UI

---

## 🌐 Live URLs

| URL | Description |
|---|---|
| https://agent.gosanotary.tech | AI Agent Chat UI |
| https://agent.gosanotary.tech/leads | Lead Research Pipeline |
| https://api.gosanotary.tech/health | Backend API health check |

---

## 👤 Author

**Gossaye Bireda** — AI Agent Engineer  
gosa.dev99@gmail.com  
https://agent.gosanotary.tech  
https://github.com/gosadev99-bit