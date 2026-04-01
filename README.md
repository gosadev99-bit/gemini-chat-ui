 # 🤖 Gossaye AI Agent — React Chat UI

A production-grade AI agent chat interface built with React and Google Gemini API.
Live demo: https://agent.gosanotary.tech

## 🚀 Features

- 🧮 **Calculator** — handles any math or number problems
- 🔍 **Web Search** — looks up facts and current information  
- 🐙 **GitHub PR** — create, list, and review pull requests
- 🧠 **Multi-turn memory** — remembers conversation history
- ⚡ **Tool status indicator** — shows which tool is running
- 📱 **Responsive design** — works on mobile and desktop

## 🛠️ Tech Stack

- React 18
- Google Gemini API (gemini-2.5-flash)
- DuckDuckGo Instant Answer API
- GitHub REST API
- VPS (deployment)

## ⚙️ Setup

### 1. Clone the repo
git clone https://github.com/gosadev99-bit/gemini-chat-ui.git


### 2. Install dependencies
npm install

### 3. Create your .env file
cp .env.example .env

Fill in your keys:
REACT_APP_GEMINI_API_KEY=your_gemini_key
REACT_APP_GITHUB_TOKEN=your_github_token
REACT_APP_GITHUB_USERNAME=your_github_username
REACT_APP_GITHUB_REPO=your_repo_name

### 4. Run locally
npm start

### 5. Build for production
npm run build

## 🧠 How It Works

User sends message
      ↓
Gemini reads the question
      ↓
Gemini decides which tool to use
      ↓
Tool runs in the browser
      ↓
Result sent back to Gemini
      ↓
Final answer displayed in chat

## 💡 Example Conversations

**Math:**
You: What is 18% tip on $120?
Bot: An 18% tip on $120 is $21.60.

**Search:**
You: Who founded Google?
Bot: Larry Page and Sergey Brin founded Google.

**GitHub:**
You: List open PRs
Bot: 📋 Open PRs (1): #1 — add persistent memory...

## 👨‍💻 Author

Gossaye Bireda —Full stack Developer/AI Agent Engineer. 

GitHub: https://github.com/gosadev99-bit
