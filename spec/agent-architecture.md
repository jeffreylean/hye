# Agent Architecture Spec

## Overview

Transform Hye from a simple chat interface into an agentic system with reasoning capabilities, tool use, and multi-step task execution using the Mastra agent framework.

## Goals

1. **Agentic Loop** - LLM can reason, use tools, observe results, and iterate until task completion
2. **Tool System** - Extensible tools for file operations, web search, code execution, etc.
3. **Reasoning** - Chain-of-thought or ReAct-style reasoning for complex tasks
4. **Memory** - Conversation context and working memory for multi-turn interactions
5. **Streaming** - Real-time streaming of agent thoughts and tool executions

## Current Architecture

```
src/
├── main/                    # Electron main process
│   ├── services/
│   │   ├── llmService.ts    # Direct LLM calls (OpenAI, Anthropic)
│   │   ├── database.ts      # SQLite chat storage
│   │   └── configStorage.ts # Provider config
│   └── index.ts             # IPC handlers
├── preload/                 # IPC bridge
├── renderer/                # React frontend
│   ├── hooks/
│   │   └── useAssistantRuntime.ts  # assistant-ui integration
│   └── store/
│       └── chatStore.ts     # Chat state (Zustand)
└── shared/                  # Shared types
```

## Proposed Architecture

```
src/
├── main/
│   ├── agent/                      # NEW: Agent layer
│   │   ├── index.ts                # Agent exports & Mastra instance
│   │   ├── agents/
│   │   │   └── hye-agent.ts        # Main Hye agent definition
│   │   └── tools/
│   │       ├── index.ts            # Tool registry
│   │       ├── web-search.ts       # Web search tool
│   │       ├── file-system.ts      # File read/write tools
│   │       ├── shell-execute.ts    # Shell command execution
│   │       └── knowledge.ts        # RAG/knowledge retrieval
│   ├── services/
│   │   ├── llmService.ts           # Keep for direct LLM (used by agent)
│   │   ├── database.ts
│   │   └── configStorage.ts
│   └── index.ts                    # IPC handlers (add agent handlers)
├── preload/
│   └── index.ts                    # Add agent IPC bridge
├── renderer/
│   ├── hooks/
│   │   └── useAssistantRuntime.ts  # Update for agent streaming
│   └── components/
│       └── AgentThinking.tsx       # NEW: Display reasoning steps
└── shared/
    └── types/
        └── agent.ts                # Agent-related types
```

## Mastra v1 Agent Integration

> **Note**: This spec uses Mastra v1 (beta). Key differences from v0.x:
> - Subpath imports: `@mastra/core/agent`, `@mastra/core/tools`, `@mastra/core/mastra`
> - Agent requires `id` field
> - Tool execute signature: `(inputData, context)` instead of `({ context })`
> - `RuntimeContext` renamed to `RequestContext`

### Agent Definition

```typescript
// src/main/agent/agents/hye-agent.ts
import { Agent } from '@mastra/core/agent'
import { webSearchTool, fileSystemTool, shellExecuteTool } from '../tools'

export const hyeAgent = new Agent({
  id: 'hye-agent',  // Required in v1
  name: 'hye-agent',
  instructions: `You are Hye, a helpful desktop assistant with access to tools.

When solving tasks:
1. Break down complex problems into steps
2. Use available tools to gather information or take actions
3. Explain your reasoning as you work
4. Verify your results before responding

Available capabilities:
- Search the web for information
- Read and write files on the user's system
- Execute shell commands
- Retrieve knowledge from documents`,
  
  model: 'openai/gpt-4o', // or configured dynamically
  tools: {
    webSearchTool,
    fileSystemTool,
    shellExecuteTool,
  },
})
```

### Mastra Instance

```typescript
// src/main/agent/index.ts
import { Mastra } from '@mastra/core/mastra'
import { hyeAgent } from './agents/hye-agent'

export const mastra = new Mastra({
  agents: { hyeAgent },
})

export { hyeAgent }
```

### Tool Example (v1 Signature)

```typescript
// src/main/agent/tools/web-search.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const webSearchTool = createTool({
  id: 'web-search',
  description: 'Search the web for information. Use when you need current information or facts.',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    maxResults: z.number().optional().default(5),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
    })),
  }),
  // v1 signature: (inputData, context) instead of ({ context })
  execute: async (inputData, context) => {
    const { query, maxResults } = inputData
    // context.requestContext for request-specific data (renamed from runtimeContext)
    const results = await performWebSearch(query, maxResults)
    return { results }
  },
})
```

## Agentic Loop Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Message                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Agent.generate() / .stream()                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 1. Reasoning: Analyze user request                        │  │
│  │ 2. Decision: Choose tool(s) or respond directly           │  │
│  │ 3. Tool Call: Execute selected tool                       │  │
│  │ 4. Observation: Process tool result                       │  │
│  │ 5. Loop: Repeat 1-4 until task complete (maxSteps)        │  │
│  │ 6. Response: Generate final answer                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Streaming to UI                             │
│  - Text deltas (reasoning + response)                           │
│  - Tool call events (name, args, result)                        │
│  - Step completion events                                       │
└─────────────────────────────────────────────────────────────────┘
```

## IPC Handler Changes

```typescript
// src/main/index.ts - Add agent handlers

ipcMain.handle('agent:generate', async (event, messages, options) => {
  const agent = mastra.getAgent('hyeAgent')
  const config = ConfigStorage.getConfig()
  
  // Dynamic model from config
  const response = await agent.generate(messages, {
    maxSteps: options?.maxSteps ?? 10,
    onStepFinish: ({ text, toolCalls, toolResults }) => {
      event.sender.send('agent:step', { text, toolCalls, toolResults })
    },
  })
  
  return { success: true, data: response.text }
})

ipcMain.handle('agent:stream', async (event, messages, options) => {
  const agent = mastra.getAgent('hyeAgent')
  const streamId = `stream-${Date.now()}`
  
  const response = await agent.stream(messages, {
    maxSteps: options?.maxSteps ?? 10,
    onStepFinish: ({ text, toolCalls, toolResults }) => {
      event.sender.send('agent:step', { streamId, text, toolCalls, toolResults })
    },
  })
  
  // Stream text chunks
  for await (const chunk of response.textStream) {
    event.sender.send('agent:stream:chunk', { streamId, chunk })
  }
  
  event.sender.send('agent:stream:complete', { streamId })
  return { success: true, streamId }
})
```

## Preload Updates

```typescript
// src/preload/index.ts - Add agent API

agent: {
  generate: (messages, options) => ipcRenderer.invoke('agent:generate', messages, options),
  stream: (messages, options) => ipcRenderer.invoke('agent:stream', messages, options),
  onStep: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('agent:step', handler)
    return () => ipcRenderer.off('agent:step', handler)
  },
  onStreamChunk: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('agent:stream:chunk', handler)
    return () => ipcRenderer.off('agent:stream:chunk', handler)
  },
}
```

## UI Components

assistant-ui provides built-in components for reasoning and tool calls. No need to build from scratch.

### Dependencies

```bash
bun add tw-shimmer
```

### Reasoning Component

Use assistant-ui's `Reasoning` and `ReasoningGroup` components for displaying LLM thinking steps:

```tsx
// src/renderer/components/assistant-ui/reasoning.tsx
// Install via: npx shadcn@latest add @assistant-ui/reasoning
// Or copy from assistant-ui docs

import { Reasoning, ReasoningGroup } from '@/components/assistant-ui/reasoning'
```

Features:
- Collapsible UI with brain icon
- Shimmer animation while streaming
- Auto-groups consecutive reasoning parts
- Scroll lock on collapse to prevent jumps

### Tool UI Components

Use `makeAssistantToolUI` to create custom UI for each tool:

```tsx
// src/renderer/components/tool-ui/WebSearchUI.tsx
import { makeAssistantToolUI } from '@assistant-ui/react'

export const WebSearchUI = makeAssistantToolUI<
  { query: string },
  { results: Array<{ title: string; url: string; snippet: string }> }
>({
  toolName: 'web-search',
  render: ({ args, result, status }) => {
    if (status.type === 'running') {
      return <div className="animate-pulse">Searching: {args.query}...</div>
    }
    
    return (
      <div className="search-results rounded-lg border p-3">
        <div className="text-sm text-muted-foreground mb-2">
          🔍 Search: {args.query}
        </div>
        {result?.results.map((item, i) => (
          <a key={i} href={item.url} className="block hover:bg-accent p-2 rounded">
            <div className="font-medium">{item.title}</div>
            <div className="text-sm text-muted-foreground">{item.snippet}</div>
          </a>
        ))}
      </div>
    )
  },
})
```

### ToolFallback Component

For tools without custom UI, use the default `ToolFallback`:

```tsx
// src/renderer/components/assistant-ui/tool-fallback.tsx
import { ToolFallback } from '@assistant-ui/react'
```

### Integration in Thread

Register components with `MessagePrimitive.Parts`:

```tsx
// src/renderer/components/Thread.tsx
import { MessagePrimitive } from '@assistant-ui/react'
import { Reasoning, ReasoningGroup } from '@/components/assistant-ui/reasoning'
import { WebSearchUI } from '@/components/tool-ui/WebSearchUI'
import { FileReadUI } from '@/components/tool-ui/FileReadUI'

const AssistantMessage = () => (
  <MessagePrimitive.Root>
    <MessagePrimitive.Parts
      components={{
        Reasoning,
        ReasoningGroup,
        // Tool UIs are auto-matched by toolName
      }}
    />
  </MessagePrimitive.Root>
)

// Register tool UIs at app level
function App() {
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <WebSearchUI />
      <FileReadUI />
      <Thread />
    </AssistantRuntimeProvider>
  )
}
```

## Initial Tool Set

| Tool | Description | Priority |
|------|-------------|----------|
| `web-search` | Search the web for information | P0 |
| `read-file` | Read file contents from disk | P0 |
| `write-file` | Write content to a file | P1 |
| `list-directory` | List files in a directory | P1 |
| `shell-execute` | Execute shell commands | P1 |
| `fetch-url` | Fetch content from a URL | P1 |
| `knowledge-search` | RAG search over indexed docs | P2 |

## Configuration

### Agent Config in ConfigStorage

```typescript
interface AgentConfig {
  maxSteps: number        // Default: 10
  enableTools: string[]   // Which tools are enabled
  reasoningMode: 'default' | 'verbose'  // Show reasoning steps
  confirmDangerousActions: boolean      // Confirm before shell/write
}
```

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create `src/main/agent/` directory structure
- [ ] Set up Mastra instance with basic agent
- [ ] Create 2 simple tools (web-search, read-file)
- [ ] Add IPC handlers for agent:stream
- [ ] Update useAssistantRuntime to use agent

### Phase 2: Core Tools (Week 2)
- [ ] Add file system tools (write, list-dir)
- [ ] Add shell execution tool (with confirmation)
- [ ] Add fetch-url tool
- [ ] Display tool calls in UI

### Phase 3: Memory & RAG (Week 3)
- [ ] Integrate agent memory for context
- [ ] Add knowledge indexing (local docs)
- [ ] Add knowledge-search tool
- [ ] Persist tool outputs in chat history

### Phase 4: Polish (Week 4)
- [ ] Add assistant-ui Reasoning component (bun add tw-shimmer)
- [ ] Create custom Tool UI components (WebSearchUI, FileReadUI, etc.)
- [ ] Agent configuration in settings
- [ ] Error handling and retries
- [ ] Tool permission system

## Open Questions

1. **Model Configuration**: Should agent use dynamic model from configStore, or separate agent-specific model config?
2. **Tool Permissions**: Should dangerous tools (shell, write) require user confirmation per-call?
3. **Memory Strategy**: Use Mastra's built-in memory, or continue with current SQLite approach?
4. **Streaming Format**: Keep current chunk format or switch to Mastra's event format?

## References

- [Mastra Agent Docs](https://mastra.ai/docs/agents/overview)
- [Mastra Tools Docs](https://mastra.ai/docs/agents/using-tools)
- [Mastra Agent Memory](https://mastra.ai/docs/agents/agent-memory)
- [AI SDK Integration](https://ai-sdk.dev/)
