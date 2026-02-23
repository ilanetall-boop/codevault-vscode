# CodeVault — Your Coding Agent Never Forgets

**Persistent memory for AI coding agents. Works with Claude Code, Copilot, Cursor, and any AI assistant.**

[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)](https://marketplace.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## The Problem

Every time you start a new conversation with your AI coding agent, it forgets everything:
- Your project architecture
- Your coding conventions
- The bugs you already fixed
- Your technology choices

You waste time re-explaining the same things over and over.

## The Solution

CodeVault gives your coding agent **persistent memory**. It automatically learns about your project and injects that knowledge into every conversation.

**Press `Ctrl+Alt+E` -> paste in your agent -> it knows everything.**

---

## Quick Demo

```
=== CodeVault Memory Context ===

PROJECT: MyApp
CURRENT FILE: src/api/auth.ts

STACK:
- Languages: TypeScript
- Frameworks: React, Express
- Tools: ESLint, Prettier, Jest

ARCHITECTURE:
- src/api/: REST API routes (auth, users, payments)
- src/components/: React UI components
- src/hooks/: Custom React hooks
- src/services/: Business logic

RELEVANT MEMORIES:
- [fact] Authentication uses OAuth 2.0 with JWT tokens
- [fact] Database is PostgreSQL with Prisma ORM
- [event] Fixed CORS issue on /api/auth endpoint last week
- [how-to] Deploy: npm run build -> vercel deploy --prod

CONVENTIONS:
- Linting: ESLint (strict)
- Formatting: Prettier (single quotes, no semicolons)
- Naming: camelCase

================================
```

Your agent instantly knows your entire project context. No more re-explaining.

---

## Getting Started

### 1. Install the Extension

```bash
code --install-extension codevault-0.1.0.vsix
```

### 2. Start the Memory Backend

```bash
# In the AgentVault directory
pip install -e .
python -m agentvault.cli.main serve --port 8420
```

### 3. Open Your Project

Open any project folder in VS Code. CodeVault automatically:
- Detects your tech stack
- Analyzes your architecture
- Captures your coding conventions

### 4. Use It

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+E` | **Export context** — Copy memory context, paste in your agent |
| `Ctrl+Alt+R` | **Remember** — Save selected code or notes to memory |
| `Ctrl+Alt+M` | **Recall** — Search your memories |

---

## Features

### Auto-Capture
CodeVault silently learns from your workflow:
- **Git commits** -> stored as episodic memories
- **File changes** -> architecture knowledge updated

### 3 Memory Types
- **Semantic** (facts): *"Project uses FastAPI + PostgreSQL"*
- **Episodic** (events): *"Fixed auth bug on Feb 21"*
- **Procedural** (how-tos): *"To deploy: npm run build -> vercel deploy"*

### One-Click Context Export
`Ctrl+Alt+E` generates a rich context block tailored to your current file and project. Paste it in any AI agent conversation.

### Smart Recall
Finds the right memories based on what you're currently working on.

### Memory Sidebar
See everything CodeVault knows about your project in the VS Code sidebar.

### Privacy-First
Everything stays local. No data sent to external servers.

---

## How It Works

```
+------------------------------------------+
|           VS Code Extension              |
|  Auto-Capture -> Memory Manager -> Export |
+------------------------------------------+
|         AgentVault Backend               |
|  Episodic + Semantic + Procedural Memory |
|  FAISS Vector Search + SQLite Storage    |
+------------------------------------------+
```

CodeVault is powered by [AgentVault](https://github.com/ilanetall-boop/AgentVault), an open-source persistent memory engine for AI agents.

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `codevault.backendUrl` | `http://localhost:8420` | AgentVault backend URL |
| `codevault.autoCapture` | `true` | Auto-capture events |
| `codevault.autoCaptureGit` | `true` | Capture git commits |
| `codevault.autoCaptureFiles` | `true` | Capture important file changes |
| `codevault.agentId` | `""` | Agent ID (defaults to project name) |
| `codevault.maxContextMemories` | `10` | Max memories in context export |

---

## Roadmap

- [ ] VS Code Marketplace publication
- [ ] Cloud sync (access memories across machines)
- [ ] Dashboard web for memory visualization
- [ ] Native integration with Claude Code
- [ ] Copilot Chat context injection
- [ ] Team shared memory

---

## Related

- [AgentVault](https://github.com/ilanetall-boop/AgentVault) — The memory engine behind CodeVault

---

## License

MIT

---

**Built for developers who are tired of re-explaining their codebase to AI.**

*If this saves you time, give it a star.*
