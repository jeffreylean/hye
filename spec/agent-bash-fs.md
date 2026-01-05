# Agent Architecture: just-bash + agentfs

## Overview

Build Hye's agentic capabilities using **just-bash** for sandboxed bash execution and **agentfs** for persistent filesystem state, integrated directly with the **AI SDK** agentic loop—no framework overhead.

## Goals

1. **Sandboxed Bash Execution** - Safe command execution with 70+ built-in commands
2. **Copy-on-Write Filesystem** - Read real files, writes stay isolated
3. **Persistent Agent State** - SQLite-backed filesystem and KV store via agentfs
4. **Tool Audit Trail** - Automatic logging of all tool calls with timing
5. **Streaming** - Real-time streaming of agent responses and tool executions

## Stack

| Component | Package | Purpose |
|-----------|---------|---------|
| **Bash Engine** | `just-bash` | Sandboxed bash interpreter (TypeScript) |
| **Filesystem** | `agentfs-sdk` | SQLite-backed persistent FS + KV store |
| **AI Loop** | `ai` (AI SDK) | `streamText()` with tools and maxSteps |
| **LLM Providers** | `@ai-sdk/openai`, `@ai-sdk/anthropic` | Already installed |

## Architecture

```
src/
├── main/
│   ├── agent/
│   │   ├── index.ts              # Agent runner & exports
│   │   ├── tools/
│   │   │   ├── index.ts          # Tool registry
│   │   │   └── bash.ts           # createBashTool configuration
│   │   └── prompts/
│   │       └── system.ts         # System prompt for agent
│   ├── services/
│   │   ├── llmService.ts         # Keep for model config
│   │   ├── database.ts           # Keep for chat storage
│   │   └── configStorage.ts      # Provider config
│   └── index.ts                  # IPC handlers (add agent handlers)
├── preload/
│   └── index.ts                  # Add agent IPC bridge
├── renderer/
│   ├── hooks/
│   │   └── useAssistantRuntime.ts  # Update for agent streaming
│   └── components/
│       └── ToolCallDisplay.tsx   # Display tool executions
└── shared/
    └── types/
        └── agent.ts              # Agent-related types
```

## Core Concepts

### 1. just-bash Sandboxing

just-bash provides three filesystem modes:

| Mode | Reads | Writes | Use Case |
|------|-------|--------|----------|
| **InMemoryFs** | Memory only | Memory only | Isolated sandbox |
| **OverlayFs** | Real disk | Memory only | Safe exploration |
| **ReadWriteFs** | Real disk | Real disk | Full access (dangerous) |

For Hye, use **OverlayFs** by default:
- Agent can read user's project files
- Writes stay in memory (safe)
- User can optionally enable real writes

### 2. agentfs Persistence

agentfs provides three subsystems in one SQLite database:

```
┌─────────────────────────────────────────────────────────┐
│                    AgentFS Database                      │
├─────────────────┬─────────────────┬─────────────────────┤
│   Filesystem    │   Key-Value     │   Tool Calls        │
│   (fs_*)        │   (kv)          │   (tool_calls)      │
├─────────────────┼─────────────────┼─────────────────────┤
│ - fs_inode      │ - key           │ - id                │
│ - fs_dentry     │ - value (JSON)  │ - name              │
│ - fs_data       │ - created_at    │ - parameters        │
│ - fs_symlink    │ - updated_at    │ - result            │
│ - fs_whiteout   │                 │ - error             │
│                 │                 │ - started_at        │
│                 │                 │ - completed_at      │
│                 │                 │ - duration_ms       │
└─────────────────┴─────────────────┴─────────────────────┘
```

### 3. AI SDK Agentic Loop

The loop uses `streamText()` with tools:

```
User Message
     │
     ▼
┌─────────────────────────────────────────┐
│           streamText()                   │
│  ┌─────────────────────────────────┐    │
│  │ 1. LLM reasons about task       │    │
│  │ 2. Decides: respond or use tool │    │
│  │ 3. If tool: execute bash        │    │
│  │ 4. Observe result               │    │
│  │ 5. Loop until done (maxSteps)   │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
     │
     ▼
Streaming Response (text + tool calls)
```

## Implementation

### Dependencies

```bash
bun add just-bash agentfs-sdk
```

### Agent Runner

```typescript
// src/main/agent/index.ts
import { streamText, type CoreMessage } from 'ai'
import { OverlayFs } from 'just-bash'
import { createBashTool } from 'just-bash/ai'
import { getModel } from './model'
import { SYSTEM_PROMPT } from './prompts/system'

export interface AgentOptions {
  projectRoot?: string
  maxSteps?: number
}

export interface AgentCallbacks {
  onText?: (text: string) => void
  onToolCall?: (name: string, args: unknown) => void
  onToolResult?: (name: string, result: unknown) => void
  onError?: (error: Error) => void
}

export function createAgentRunner(options: AgentOptions = {}) {
  const { projectRoot, maxSteps = 20 } = options

  // Create filesystem - OverlayFs for safe exploration
  const fs = projectRoot
    ? new OverlayFs({ root: projectRoot })
    : undefined

  // Create bash tool
  const bashTool = createBashTool({
    fs,
    extraInstructions: `
You have access to the user's filesystem at ${projectRoot || 'a virtual environment'}.
Use bash commands to explore, search, and analyze files.
Always verify paths exist before operating on them.
    `.trim(),
  })

  // Conversation history
  const history: CoreMessage[] = []

  return {
    async chat(message: string, callbacks: AgentCallbacks = {}) {
      history.push({ role: 'user', content: message })

      try {
        const result = streamText({
          model: getModel(), // Dynamic from config
          system: SYSTEM_PROMPT,
          messages: history,
          tools: { bash: bashTool },
          maxSteps,
          onStepFinish: ({ toolCalls, toolResults }) => {
            if (toolCalls?.length) {
              for (const call of toolCalls) {
                callbacks.onToolCall?.(call.toolName, call.args)
              }
            }
            if (toolResults?.length) {
              for (const result of toolResults) {
                callbacks.onToolResult?.(result.toolName, result.result)
              }
            }
          },
        })

        let fullText = ''
        for await (const chunk of result.textStream) {
          fullText += chunk
          callbacks.onText?.(chunk)
        }

        history.push({ role: 'assistant', content: fullText })
        return { success: true, text: fullText }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        callbacks.onError?.(err)
        return { success: false, error: err.message }
      }
    },

    clearHistory() {
      history.length = 0
    },

    getHistory() {
      return [...history]
    },
  }
}

export type AgentRunner = ReturnType<typeof createAgentRunner>
```

### Model Configuration

```typescript
// src/main/agent/model.ts
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { ConfigStorage } from '../services/configStorage'

export function getModel() {
  const config = ConfigStorage.getConfig()
  const provider = config.currentProvider

  if (!provider) {
    throw new Error('No provider configured')
  }

  switch (provider.type) {
    case 'openai':
      return createOpenAI({
        apiKey: provider.apiKey,
        baseURL: provider.baseUrl,
      })(provider.model)

    case 'anthropic':
      return createAnthropic({
        apiKey: provider.apiKey,
      })(provider.model)

    case 'custom':
      return createOpenAI({
        apiKey: provider.apiKey,
        baseURL: provider.baseUrl,
      })(provider.model)

    default:
      throw new Error(`Unknown provider: ${provider.type}`)
  }
}
```

### System Prompt

```typescript
// src/main/agent/prompts/system.ts
export const SYSTEM_PROMPT = `You are Hye, a helpful desktop assistant with access to the user's filesystem via bash commands.

## Capabilities

You can execute bash commands to:
- Read and explore files (cat, head, tail, less)
- Search content (grep, find, ag)
- List directories (ls, tree)
- Analyze code and data (wc, awk, jq)
- Manipulate text (sed, cut, sort, uniq)

## Guidelines

1. **Explore first**: Use ls, find, or tree to understand the project structure before diving in
2. **Be efficient**: Combine commands with pipes when appropriate
3. **Handle errors**: Check if files exist before operating on them
4. **Explain your work**: Tell the user what you're doing and why
5. **Stay safe**: You're in a sandboxed environment - writes don't affect the real filesystem

## Limitations

- Cannot execute arbitrary binaries (only built-in bash commands)
- Cannot access network unless explicitly enabled
- File writes are isolated (copy-on-write)
`
```

### IPC Handlers

```typescript
// src/main/index.ts - Add to existing handlers

import { createAgentRunner, type AgentRunner } from './agent'

// Store active agent instances per window
const agents = new Map<number, AgentRunner>()

ipcMain.handle('agent:init', async (event, options: { projectRoot?: string }) => {
  const webContentsId = event.sender.id
  const agent = createAgentRunner({
    projectRoot: options.projectRoot,
    maxSteps: 20,
  })
  agents.set(webContentsId, agent)
  return { success: true }
})

ipcMain.handle('agent:chat', async (event, message: string) => {
  const webContentsId = event.sender.id
  const agent = agents.get(webContentsId)

  if (!agent) {
    return { success: false, error: 'Agent not initialized' }
  }

  const streamId = `agent-${Date.now()}`

  const result = await agent.chat(message, {
    onText: (text) => {
      event.sender.send('agent:text', { streamId, text })
    },
    onToolCall: (name, args) => {
      event.sender.send('agent:tool:call', { streamId, name, args })
    },
    onToolResult: (name, result) => {
      event.sender.send('agent:tool:result', { streamId, name, result })
    },
    onError: (error) => {
      event.sender.send('agent:error', { streamId, error: error.message })
    },
  })

  event.sender.send('agent:complete', { streamId })
  return result
})

ipcMain.handle('agent:clear', async (event) => {
  const webContentsId = event.sender.id
  const agent = agents.get(webContentsId)
  agent?.clearHistory()
  return { success: true }
})
```

### Preload API

```typescript
// src/preload/index.ts - Add agent API

agent: {
  init: (options: { projectRoot?: string }) =>
    ipcRenderer.invoke('agent:init', options),

  chat: (message: string) =>
    ipcRenderer.invoke('agent:chat', message),

  clear: () =>
    ipcRenderer.invoke('agent:clear'),

  onText: (callback: (data: { streamId: string; text: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { streamId: string; text: string }) =>
      callback(data)
    ipcRenderer.on('agent:text', handler)
    return () => ipcRenderer.off('agent:text', handler)
  },

  onToolCall: (callback: (data: { streamId: string; name: string; args: unknown }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { streamId: string; name: string; args: unknown }) =>
      callback(data)
    ipcRenderer.on('agent:tool:call', handler)
    return () => ipcRenderer.off('agent:tool:call', handler)
  },

  onToolResult: (callback: (data: { streamId: string; name: string; result: unknown }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { streamId: string; name: string; result: unknown }) =>
      callback(data)
    ipcRenderer.on('agent:tool:result', handler)
    return () => ipcRenderer.off('agent:tool:result', handler)
  },

  onComplete: (callback: (data: { streamId: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { streamId: string }) =>
      callback(data)
    ipcRenderer.on('agent:complete', handler)
    return () => ipcRenderer.off('agent:complete', handler)
  },

  onError: (callback: (data: { streamId: string; error: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { streamId: string; error: string }) =>
      callback(data)
    ipcRenderer.on('agent:error', handler)
    return () => ipcRenderer.off('agent:error', handler)
  },
}
```

### Types

```typescript
// src/shared/types/agent.ts
export interface ToolCall {
  name: string
  args: Record<string, unknown>
  result?: BashResult
  status: 'pending' | 'running' | 'completed' | 'error'
}

export interface BashResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
}

export interface AgentStreamEvent {
  type: 'text' | 'tool:call' | 'tool:result' | 'complete' | 'error'
  streamId: string
  data: unknown
}
```

## UI Integration

### Update useAssistantRuntime

The hook needs to handle agent streaming instead of raw LLM streaming:

```typescript
// Key changes in useAssistantRuntime.ts

const onNew = useCallback(async (message: AppendMessage): Promise<void> => {
  // ... existing setup ...

  // Initialize agent if needed
  await window.electronAPI?.agent?.init({ projectRoot: selectedProject })

  // Set up listeners
  const removeTextListener = window.electronAPI?.agent?.onText?.(({ text }) => {
    streamContent += text
    useChatStore.getState().updateLastMessage(chatId!, streamContent)
  })

  const removeToolCallListener = window.electronAPI?.agent?.onToolCall?.(({ name, args }) => {
    // Handle tool call display (add to message state)
  })

  // Send message
  const result = await window.electronAPI?.agent?.chat(textContent.text)

  // Cleanup
  removeTextListener?.()
  removeToolCallListener?.()
}, [])
```

### Tool Call Display Component

```tsx
// src/renderer/components/ToolCallDisplay.tsx
import { cn } from '@/lib/utils'
import type { ToolCall } from '@shared/types/agent'

interface ToolCallDisplayProps {
  toolCall: ToolCall
}

export function ToolCallDisplay({ toolCall }: ToolCallDisplayProps) {
  const isRunning = toolCall.status === 'running'
  const isError = toolCall.status === 'error'

  return (
    <div className={cn(
      'rounded-lg border p-3 my-2 font-mono text-sm',
      isRunning && 'border-yellow-500 bg-yellow-500/10',
      isError && 'border-red-500 bg-red-500/10',
      !isRunning && !isError && 'border-border bg-muted/50'
    )}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-muted-foreground">$</span>
        <span className="font-semibold">{toolCall.args.command as string}</span>
        {isRunning && <span className="animate-pulse">⏳</span>}
      </div>

      {toolCall.result && (
        <pre className="mt-2 p-2 bg-background rounded text-xs overflow-x-auto">
          {toolCall.result.stdout}
          {toolCall.result.stderr && (
            <span className="text-red-400">{toolCall.result.stderr}</span>
          )}
        </pre>
      )}
    </div>
  )
}
```

## Future: agentfs Integration

For persistent agent state (Phase 2), integrate agentfs:

```typescript
// src/main/agent/persistence.ts
import { AgentFS } from 'agentfs-sdk'
import { agentfs } from 'agentfs-sdk/just-bash'
import { app } from 'electron'
import { join } from 'path'

export async function createPersistentAgent(agentId: string) {
  const dbPath = join(app.getPath('userData'), 'agents', `${agentId}.db`)

  const agent = await AgentFS.open({
    id: agentId,
    path: dbPath,
  })

  // Create just-bash compatible filesystem
  const fs = await agentfs(agent)

  return {
    fs,               // For createBashTool
    kv: agent.kv,     // For agent state
    tools: agent.tools, // For audit trail
  }
}
```

## Implementation Phases

### Phase 1: Core Agent (This Sprint)
- [ ] Install `just-bash` dependency
- [ ] Create `src/main/agent/` structure
- [ ] Implement agent runner with OverlayFs
- [ ] Add IPC handlers for agent:chat
- [ ] Update preload with agent API
- [ ] Basic tool call display in UI

### Phase 2: Persistence (Next Sprint)
- [ ] Install `agentfs-sdk` dependency
- [ ] Add agentfs persistence layer
- [ ] Store tool call audit trail
- [ ] Add agent state via KV store
- [ ] Project-specific agent memory

### Phase 3: Enhanced Tools
- [ ] Add custom commands (Electron-specific)
- [ ] Network access controls (fetch URLs)
- [ ] File write permissions (user confirmation)
- [ ] Dangerous command warnings

### Phase 4: UI Polish
- [ ] Collapsible tool call display
- [ ] Syntax highlighting for code output
- [ ] Progress indicators for long operations
- [ ] Cancel in-progress operations

## Configuration

```typescript
// In configStore or separate agentConfig
interface AgentConfig {
  maxSteps: number           // Default: 20
  defaultProjectRoot: string // User's home or workspace
  allowNetworkAccess: boolean // Default: false
  allowFileWrites: boolean   // Default: false (sandbox mode)
  confirmDangerousCommands: boolean // Default: true
}
```

## Comparison: This Stack vs Mastra

| Aspect | just-bash + AI SDK | Mastra |
|--------|-------------------|--------|
| **Dependencies** | 2 (just-bash, ai) | 1 (but heavier) |
| **Bash support** | ✅ 70+ commands built-in | ❌ Write from scratch |
| **Filesystem sandbox** | ✅ OverlayFs included | ❌ Manual |
| **Agentic loop** | ✅ AI SDK streamText | ✅ Agent.stream |
| **Tool definition** | AI SDK `tool()` | Mastra `createTool()` |
| **Memory** | agentfs KV (optional) | Built-in agent memory |
| **Complexity** | Lower | Higher |
| **Flexibility** | Full control | Framework conventions |

## References

- [just-bash README](https://github.com/vercel-labs/just-bash)
- [agentfs SPEC](https://github.com/tursodatabase/agentfs/blob/main/SPEC.md)
- [AI SDK streamText](https://ai-sdk.dev/docs/ai-sdk-core/generating-text#streamtext)
- [AI SDK Tools](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
