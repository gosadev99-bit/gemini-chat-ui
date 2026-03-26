import { useState, useRef, useEffect } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import "./App.css";

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

    // If DuckDuckGo finds nothing, tell Gemini to answer from its own knowledge
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

async function runAgent(userMessage, history, onToolCall) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools,
    systemInstruction: `You are a helpful AI assistant with three tools:
1. search_web — facts, news, general knowledge
2. calculate — any math or number problems
3. github_pr — GitHub Pull Request actions (create, list, review)
Always use the right tool. Be concise and friendly.`
  });

  const chat = model.startChat({ history });
  let response = await chat.sendMessage(userMessage);
  let candidate = response.response.candidates[0];
  let content = candidate.content;

  while (content.parts.some(p => p.functionCall)) {
    const toolCallPart = content.parts.find(p => p.functionCall);
    const { name, args } = toolCallPart.functionCall;

    // Tell UI which tool is being called
    onToolCall(name, args);

    const toolResult = await toolHandlers[name](args);
    response = await chat.sendMessage([{
      functionResponse: { name, response: toolResult }
    }]);
    candidate = response.response.candidates[0];
    content = candidate.content;
  }

  return response.response.text();
}

// ── CHAT UI ────────────────────────────────────────────────────────────────
const TOOL_LABELS = {
  search_web: "🔍 Searching web...",
  calculate: "🧮 Calculating...",
  github_pr: "🐙 Calling GitHub..."
};

export default function App() {
  const [messages, setMessages] = useState([
    { role: "bot", text: "👋 Hey Gossaye! I'm your AI Agent. I have 3 tools: 🧮 Calculator, 🔍 Web Search, and 🐙 GitHub PR. What can I help you with?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toolStatus, setToolStatus] = useState("");
  const [history, setHistory] = useState([]);
  const bottomRef = useRef(null);

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolStatus]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput("");
    setLoading(true);
    setToolStatus("");

    // Add user message
    setMessages(prev => [...prev, { role: "user", text: userText }]);

    try {
      const answer = await runAgent(
        userText,
        history,
        (toolName) => setToolStatus(TOOL_LABELS[toolName] || "🤖 Thinking...")
      );

      // Save to history
      setHistory(prev => [
        ...prev,
        { role: "user", parts: [{ text: userText }] },
        { role: "model", parts: [{ text: answer }] }
      ]);

      setMessages(prev => [...prev, { role: "bot", text: answer }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "bot",
        text: err.message?.includes("429")
          ? "⏳ Too many requests! Wait 15 seconds and try again."
          : "❌ Something went wrong. Try again."
      }]);
    }

    setToolStatus("");
    setLoading(false);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <div className="header-avatar">G</div>
        <div>
          <h1>Gossaye AI Agent</h1>
          <span className={loading ? "status busy" : "status online"}>
            {loading ? "Thinking..." : "Online"}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.role === "bot" && <div className="avatar">🤖</div>}
            <div className="bubble">{msg.text}</div>
            {msg.role === "user" && <div className="avatar">👤</div>}
          </div>
        ))}

        {/* Tool status indicator */}
        {toolStatus && (
          <div className="message bot">
            <div className="avatar">🤖</div>
            <div className="bubble typing">{toolStatus}</div>
          </div>
        )}

        {/* Loading dots */}
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