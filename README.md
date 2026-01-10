# Hye

Desktop GUI Agent toolbox for productivity.

## Overview

Hye is an Electron-based desktop chat application built with React and TypeScript. It provides a local AI chat interface with support for multiple LLM providers.

### Tech Stack

- **Runtime**: Electron + Node.js
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Build**: electron-vite, Bun
- **State**: Zustand
- **Database**: SQLite (better-sqlite3)
- **Chat UI**: assistant-ui

### Architecture

```
src/
├── main/           # Electron main process
│   ├── services/   # LLM providers, database, config storage
│   └── index.ts    # App entry, IPC handlers
├── preload/        # IPC bridge (window.electronAPI)
├── renderer/       # React frontend
│   ├── components/ # UI components (Chat, Sidebar, etc.)
│   ├── hooks/      # Custom hooks (useAssistantRuntime, etc.)
│   └── store/      # Zustand stores (chat, config, ui)
└── shared/         # Shared types
```

### Features

- Multi-provider LLM support (OpenAI, Anthropic, etc.)
- Persistent chat history (SQLite)
- Multiple chat sessions
- Keyboard shortcuts (⌘N / Ctrl+N for new chat)

## Setup

```bash
bun install
```

## Development

```bash
bun run dev
```

## Build

```bash
bun run build
```

## Future TODOs

- [ ] **Chat lazy loading / pagination** - Implement infinite scroll for large chat histories. See [spec/chat-pagination.md](spec/chat-pagination.md) for details.
- [ ] Context engineering & agent memory management
- [ ] **Web search tool for agent** - Add web search capability. Options: Serper.dev/Tavily API (simple), DuckDuckGo scraping (complex), or Firecrawl SDK. See Firecrawl's search v2 for reference.
