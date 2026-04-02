import { useState, useRef, useEffect } from "react";
import { loadProfile, clearProfile, formatProfileForPrompt } from "./memory/userProfile";
import { extractAndUpdateProfile } from "./memory/entityExtractor";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { runOrchestrator } from "./agents/orchestrator";
import "./App.css";

// Switch between direct Gemini (false) or Node.js backend (true)
const USE_BACKEND = true;
const BACKEND_URL = 'https://api.gosanotary.tech';
// ── TOOL DEFINITIONS ──────────────────────────────────────────────────────
const tools = [{
  functionDeclarations: [
    {
      name: "search_web",
      description: "Search the web for real-world facts, current events, people, places.",
      parameters: {
        type: "OBJECT",
        properties: {
          query: { type: "STRING", description: "The search query" }
        },
        required: ["query"]
      }
    },
    {
      name: "calculate",
      description: "Evaluate a math expression. Use for any arithmetic or numeric calculations.",
      parameters: {
        type: "OBJECT",
        properties: {
          expression: { type: "STRING", description: "Math expression e.g. '250 * 0.18'" }
        },
        required: ["expression"]
      }
    },
    {
      name: "github_pr",
      description: "Manage GitHub Pull Requests. Create, list or review PRs.",
      parameters: {
        type: "OBJECT",
        properties: {
          action: { type: "STRING", description: "One of: create, list, review" },
          title: { type: "STRING", description: "PR title (for create)" },
          head: { type: "STRING", description: "Source branch (for create)" },
          base: { type: "STRING", description: "Target branch (for create)" },
          body: { type: "STRING", description: "PR description (optional)" },
          pr_number: { type: "NUMBER", description: "PR number (for review)" }
        },
        required: ["action"]
      }
    }
  ]
}];

// ── TOOL IMPLEMENTATIONS ───────────────────────────────────────────────────
async function search_web({ query }) {
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    );
    const data = await res.json();
    const answer =
      data.AbstractText ||
      data.Answer ||
      data.RelatedTopics?.[0]?.Text;

    if (!answer) {
      return { result: `No live search result found. Please answer "${query}" using your own training knowledge.` };
    }
    return { result: answer };
  } catch {
    return { result: `Search failed. Please answer "${query}" using your own training knowledge.` };
  }
}

function calculate({ expression }) {
  const banned = ["process", "require", "import", "eval", "window"];
  if (banned.some(w => expression.includes(w))) {
    return { result: "Invalid expression." };
  }
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${expression})`)();
    return { result: result.toString() };
  } catch {
    return { result: "Calculation error." };
  }
}

async function github_pr({ action, title, head, base, body, pr_number }) {
  const BASE_URL = `https://api.github.com/repos/${process.env.REACT_APP_GITHUB_USERNAME}/${process.env.REACT_APP_GITHUB_REPO}`;
  const headers = {
    Authorization: `Bearer ${process.env.REACT_APP_GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  try {
    if (action === "create") {
      const res = await fetch(`${BASE_URL}/pulls`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title, head, base, body: body || "PR created by Gossaye AI 🤖" })
      });
      const data = await res.json();
      return { result: `✅ PR created!\n📌 ${data.title}\n🔗 ${data.html_url}` };
    }
    if (action === "list") {
      const res = await fetch(`${BASE_URL}/pulls?state=open`, { headers });
      const data = await res.json();
      if (!data.length) return { result: "📭 No open PRs found." };
      return { result: data.map(pr => `#${pr.number} — ${pr.title}\n🔗 ${pr.html_url}`).join("\n\n") };
    }
    if (action === "review") {
      const res = await fetch(`${BASE_URL}/pulls/${pr_number}`, { headers });
      const pr = await res.json();
      const filesRes = await fetch(`${BASE_URL}/pulls/${pr_number}/files`, { headers });
      const files = await filesRes.json();
      return {
        result: `🔍 PR #${pr_number}: ${pr.title}\n👤 ${pr.user.login}\n🔀 ${pr.head.ref} → ${pr.base.ref}\n📁 ${files.length} files changed\n🔗 ${pr.html_url}`
      };
    }
  } catch (err) {
    return { result: `❌ GitHub error: ${err.message}` };
  }
}

const toolHandlers = { search_web, calculate, github_pr };

// ── GEMINI AGENT ───────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);

const WELCOME = "👋 Hey Gossaye! I'm your AI Agent. I have 3 tools: 🧮 Calculator, 🔍 Web Search, and 🐙 GitHub PR. What can I help you with?";

async function runAgent(userMessage, history, onToolCall, profile) {
  const profileContext = formatProfileForPrompt(profile);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools,
    systemInstruction: `You are a helpful AI assistant with three tools:
1. search_web — facts, news, general knowledge
2. calculate — any math or number problems
3. github_pr — GitHub Pull Request actions (create, list, review)
Always use the right tool. Be concise and friendly.${profileContext}`
  });

  const chat = model.startChat({ history });
  let response = await chat.sendMessage(userMessage);
  let candidate = response.response.candidates[0];
  let content = candidate.content;

  while (content.parts.some(p => p.functionCall)) {
    const toolCallPart = content.parts.find(p => p.functionCall);
    const { name, args } = toolCallPart.functionCall;
    onToolCall(name);
    const toolResult = await toolHandlers[name](args);
    response = await chat.sendMessage([{
      functionResponse: { name, response: toolResult }
    }]);
    candidate = response.response.candidates[0];
    content = candidate.content;
  }

  return response.response.text();
}

// ── CONSTANTS ──────────────────────────────────────────────────────────────
const TOOL_LABELS = {
  search_web: "🔍 Searching web...",
  calculate: "🧮 Calculating...",
  github_pr: "🐙 Calling GitHub..."
};

// ── BACKEND AGENT CALL ────────────────────────────────────────────────────
async function callBackend(userMessage, sessionId = 'react-ui') {
  const res = await fetch(`${BACKEND_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userMessage, sessionId })
  });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  const data = await res.json();
  return data.answer;
}

// ── STREAMING BACKEND CALL ─────────────────────────────────────────────────
async function callBackendStream(userMessage, sessionId = 'react-ui', onChunk, onTool, onDone) {
  const res = await fetch(`${BACKEND_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userMessage, sessionId })
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split('\n').filter(l => l.startsWith('data: '));

    for (const line of lines) {
      try {
        const data = JSON.parse(line.replace('data: ', ''));

        if (data.type === 'chunk') onChunk(data.text);
        if (data.type === 'tool')  onTool(data.tool);
        if (data.type === 'done')  onDone(data);
        if (data.type === 'error') throw new Error(data.message);
      } catch (e) {
        // skip malformed chunks
      }
    }
  }
}

// ── COMPONENT ──────────────────────────────────────────────────────────────
export default function App() {

  // ── Fix 1: Each useState declared exactly ONCE ──────────────────────────
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('gossaye-agent-messages');
      return saved ? JSON.parse(saved) : [{ role: "bot", text: WELCOME }];
    } catch {
      return [{ role: "bot", text: WELCOME }];
    }
  });

  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('gossaye-agent-history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toolStatus, setToolStatus] = useState("");
  const bottomRef = useRef(null);
  const [userProfile, setUserProfile] = useState(() => loadProfile());
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming]     = useState(false);
  const [lastCost, setLastCost]           = useState(null);

  // ── Auto scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolStatus]);

  // ── Fix 2: clearChat defined once, in the right place ───────────────────
 function clearChat() {
  setMessages([{ role: "bot", text: WELCOME }]);
  setHistory([]);
  localStorage.removeItem('gossaye-agent-history');
  localStorage.removeItem('gossaye-agent-messages');
  // Note: we DON'T clear profile on chat clear
  // Profile is permanent — only cleared by the ✕ button
}

  // ── Fix 3: sendMessage with no duplicate setMessages ────────────────────
 async function sendMessage() {
  if (!input.trim() || loading) return;

  const userText = input.trim();
  setInput('');
  setLoading(true);
  setStreamingText('');
  setToolStatus('');

  setMessages(prev => [...prev, { role: 'user', text: userText }]);

  try {
    // Check orchestrator first
    const orchestratorAnswer = await runOrchestrator(
      userText,
      (status) => setToolStatus(status)
    );

    if (orchestratorAnswer) {
      // Orchestrator handled it — no streaming for multi-agent
      setMessages(prev => {
        const updated = [...prev, { role: 'bot', text: orchestratorAnswer }];
        const trimmed = updated.length > 50 ? updated.slice(-50) : updated;
        localStorage.setItem('gossaye-agent-messages', JSON.stringify(trimmed));
        return trimmed;
      });
      setHistory(prev => {
        const updated = [
          ...prev,
          { role: 'user',  parts: [{ text: userText }] },
          { role: 'model', parts: [{ text: orchestratorAnswer }] }
        ];
        const trimmed = updated.length > 20 ? updated.slice(-20) : updated;
        localStorage.setItem('gossaye-agent-history', JSON.stringify(trimmed));
        return trimmed;
      });
    } else if (USE_BACKEND) {
      // ── STREAMING MODE ──────────────────────────────────────────────────
      setIsStreaming(true);
      let fullAnswer = '';

      await callBackendStream(
        userText,
        'react-ui',
        // onChunk — append each word
        (chunk) => {
          fullAnswer += chunk;
          setStreamingText(fullAnswer);
        },
        // onTool — show tool status
        (toolName) => setToolStatus(TOOL_LABELS[toolName] || '🤖 Thinking...'),
        // onDone — finalize
        (data) => {
          setLastCost(data.usage);
          setIsStreaming(false);
          setStreamingText('');
          setMessages(prev => {
            const updated = [...prev, { role: 'bot', text: data.fullAnswer }];
            const trimmed = updated.length > 50 ? updated.slice(-50) : updated;
            localStorage.setItem('gossaye-agent-messages', JSON.stringify(trimmed));
            return trimmed;
          });
          // Extract profile in background
          extractAndUpdateProfile(userText, data.fullAnswer).then(updated => {
            if (updated) setUserProfile(updated);
          });
        }
      );
    } else {
      // Direct Gemini (dev mode)
      const answer = await runAgent(
        userText, history,
        (toolName) => setToolStatus(TOOL_LABELS[toolName] || '🤖 Thinking...'),
        userProfile
      );
      setMessages(prev => {
        const updated = [...prev, { role: 'bot', text: answer }];
        const trimmed = updated.length > 50 ? updated.slice(-50) : updated;
        localStorage.setItem('gossaye-agent-messages', JSON.stringify(trimmed));
        return trimmed;
      });
    }

  } catch (err) {
    setIsStreaming(false);
    setStreamingText('');
    setMessages(prev => [...prev, {
      role: 'bot',
      text: err.message?.includes('429')
        ? '⏳ Too many requests! Wait 15 seconds and try again.'
        : '❌ Something went wrong. Try again.'
    }]);
  }

  setToolStatus('');
  setLoading(false);
}

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ── Fix 4: Correct JSX structure with app wrapper ────────────────────────
  return (
    <div className="app">

      {/* Header */}
      <div className="header">
        <div className="header-avatar">G</div>
        <div style={{ flex: 1 }}>
          <h1>Gossaye AI Agent</h1>
          <span className={loading ? "status busy" : "status online"}>
            {loading ? "Thinking..." : "Online"}
          </span>
        </div>
        <button className="clear-btn" onClick={clearChat}>
          🗑️ Clear
        </button>
      </div>
       
       {/* Profile Panel */}
{(userProfile.name || userProfile.job || userProfile.location) && (
  <div className="profile-bar">
    <span>🧠 Known: </span>
    {userProfile.name && <span className="profile-tag">👤 {userProfile.name}</span>}
    {userProfile.job && <span className="profile-tag">💼 {userProfile.job}</span>}
    {userProfile.location && <span className="profile-tag">📍 {userProfile.location}</span>}
    {userProfile.company && <span className="profile-tag">🏢 {userProfile.company}</span>}
    <button className="profile-clear" onClick={() => {
      clearProfile();
      setUserProfile(loadProfile());
    }}>✕</button>
  </div>
)}

    {/* Cost tracker */}
{lastCost && (
  <div className="cost-bar">
    <span>Last request:</span>
    <span className="cost-tag">📥 {lastCost.inputTokens} in</span>
    <span className="cost-tag">📤 {lastCost.outputTokens} out</span>
    <span className="cost-tag">💰 {lastCost.estimatedCost}</span>
    <button className="profile-clear" onClick={() => setLastCost(null)}>✕</button>
  </div>
)}

      {/* Messages */}
{/* Streaming bubble — shows while response is coming in */}
{isStreaming && streamingText && (
  <div className="message bot">
    <div className="avatar">🤖</div>
    <div className="bubble streaming">
      {streamingText}
      <span className="cursor">▋</span>
    </div>
  </div>
)} 
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.role === "bot" && <div className="avatar">🤖</div>}
            <div className="bubble">{msg.text}</div>
            {msg.role === "user" && <div className="avatar">👤</div>}
          </div>
        ))}

        {toolStatus && (
          <div className="message bot">
            <div className="avatar">🤖</div>
            <div className="bubble typing">{toolStatus}</div>
          </div>
        )}

        {loading && !toolStatus && (
          <div className="message bot">
            <div className="avatar">🤖</div>
            <div className="bubble typing">
              <span className="dot"/><span className="dot"/><span className="dot"/>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div className="input-area">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask me anything — math, facts, or GitHub PRs..."
          disabled={loading}
          rows={1}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}>
          {loading ? "..." : "Send"}
        </button>
      </div>

    </div>
  );
}