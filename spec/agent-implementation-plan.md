# Agent Implementation Plan

## Overview

Transform Hye into an agentic assistant using **just-bash** for sandboxed bash execution and **AI SDK** for the agentic loop. This plan covers Phase 1 (Core Agent) implementation.

**Estimated time:** 6-8 hours

---

## Phase 1: Core Agent Implementation

### Step 1: Install Dependencies

```bash
bun add just-bash
```

**Files:** None (package.json auto-updated)

---

### Step 2: Create Agent Types

**File:** `src/shared/types/agent.ts`

```typescript
export interface ToolCall {
  id: string
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
```

---

### Step 3: Create Agent Module Structure

Create the following directory structure:

```
src/main/agent/
├── index.ts          # Agent runner & exports
├── model.ts          # Dynamic model configuration
└── prompts/
    └── system.ts     # System prompt
```

---

### Step 4: Implement Model Configuration

**File:** `src/main/agent/model.ts`

Reuses existing provider configuration from `ConfigStorage`:

```typescript
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
      throw new Error(`Unsupported provider: ${provider.type}`)
  }
}
```

---

### Step 5: Create System Prompt

**File:** `src/main/agent/prompts/system.ts`

```typescript
export const SYSTEM_PROMPT = `You are Hye, a helpful desktop assistant with access to a sandboxed bash environment.

## Capabilities
- Execute bash commands to explore files and directories
- Read file contents using cat, head, tail, etc.
- Search with grep, find, and other utilities
- Analyze code and project structures

## Guidelines
1. Use bash commands to gather information before answering
2. Verify paths exist before operating on them
3. Be concise in responses - show relevant output, summarize when appropriate
4. If a command fails, explain why and try alternatives
5. For code questions, read the relevant files first

## Safety
- You can read files but writes are sandboxed (won't persist)
- Avoid commands that could hang (infinite loops, blocking I/O)
- Don't expose sensitive information from files

When helping with tasks:
1. Understand what the user needs
2. Use bash to explore the relevant files/directories
3. Provide a clear, helpful response based on what you found`
```

---

### Step 6: Implement Agent Runner

**File:** `src/main/agent/index.ts`

Core implementation using AI SDK's `streamText()` with just-bash tool:

```typescript
import { streamText, type CoreMessage } from 'ai'
import { OverlayFs } from 'just-bash'
import { createBashTool } from 'just-bash/ai'
import { getModel } from './model'
import { SYSTEM_PROMPT } from './prompts/system'
import type { AgentOptions, AgentCallbacks } from '../../shared/types/agent'

export function createAgentRunner(options: AgentOptions = {}) {
  const { projectRoot, maxSteps = 20 } = options

  // OverlayFs: reads from disk, writes to memory (safe)
  const fs = projectRoot
    ? new OverlayFs({ root: projectRoot })
    : undefined

  const bashTool = createBashTool({
    fs,
    extraInstructions: `
You have access to the filesystem at ${projectRoot || 'a virtual environment'}.
Use bash commands to explore, search, and analyze files.
Always verify paths exist before operating on them.
    `.trim(),
  })

  const history: CoreMessage[] = []

  return {
    async chat(message: string, callbacks: AgentCallbacks = {}) {
      history.push({ role: 'user', content: message })

      try {
        const result = streamText({
          model: getModel(),
          system: SYSTEM_PROMPT,
          messages: history,
          tools: { bash: bashTool },
          maxSteps,
          onStepFinish: ({ toolCalls, toolResults }) => {
            toolCalls?.forEach(call => {
              callbacks.onToolCall?.(call.toolName, call.args)
            })
            toolResults?.forEach(res => {
              callbacks.onToolResult?.(res.toolName, res.result)
            })
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

---

### Step 7: Add IPC Handlers

**File:** `src/main/index.ts` (add to existing)

```typescript
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

---

### Step 8: Update Preload API

**File:** `src/preload/index.ts` (add agent section)

```typescript
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

Update `IpcApi` type to include agent:

```typescript
agent: {
  init: (options: { projectRoot?: string }) => Promise<{ success: boolean }>
  chat: (message: string) => Promise<{ success: boolean; text?: string; error?: string }>
  clear: () => Promise<{ success: boolean }>
  onText: (callback: (data: { streamId: string; text: string }) => void) => () => void
  onToolCall: (callback: (data: { streamId: string; name: string; args: unknown }) => void) => () => void
  onToolResult: (callback: (data: { streamId: string; name: string; result: unknown }) => void) => () => void
  onComplete: (callback: (data: { streamId: string }) => void) => () => void
  onError: (callback: (data: { streamId: string; error: string }) => void) => () => void
}
```

---

### Step 9: Update useAssistantRuntime Hook

**File:** `src/renderer/hooks/useAssistantRuntime.ts`

Key changes to switch from raw LLM streaming to agent:

```typescript
const onNew = useCallback(async (message: AppendMessage): Promise<void> => {
  const { currentProvider } = useConfigStore.getState()
  const chatStore = useChatStore.getState()

  const textContent = message.content.find(c => c.type === 'text')
  if (!textContent || textContent.type !== 'text') return

  let chatId = chatStore.currentChatId
  if (!chatId) {
    chatId = chatStore.createChat()
  }

  chatStore.addMessage(chatId, { role: 'user', content: textContent.text })

  if (!currentProvider) {
    chatStore.addMessage(chatId, {
      role: 'assistant',
      content: 'Please configure an AI provider in Settings first.'
    })
    return
  }

  chatStore.addMessage(chatId, { role: 'assistant', content: '' })

  // Initialize agent (could pass project root from UI state)
  await window.electronAPI?.agent?.init({})

  let streamContent = ''

  // Set up streaming listeners
  const removeTextListener = window.electronAPI?.agent?.onText?.(({ text }) => {
    streamContent += text
    useChatStore.getState().updateLastMessage(chatId!, streamContent)
  })

  const removeToolCallListener = window.electronAPI?.agent?.onToolCall?.(({ name, args }) => {
    // For Phase 1: append tool call info to message
    // TODO: Proper tool call UI in Phase 4
    streamContent += `\n\n🔧 Running: ${name}\n`
    useChatStore.getState().updateLastMessage(chatId!, streamContent)
  })

  const removeToolResultListener = window.electronAPI?.agent?.onToolResult?.(({ name, result }) => {
    // Show abbreviated result
    const resultStr = JSON.stringify(result, null, 2)
    const preview = resultStr.length > 500 ? resultStr.slice(0, 500) + '...' : resultStr
    streamContent += `\n\`\`\`\n${preview}\n\`\`\`\n`
    useChatStore.getState().updateLastMessage(chatId!, streamContent)
  })

  try {
    const result = await window.electronAPI?.agent?.chat(textContent.text)

    if (!result?.success) {
      useChatStore.getState().updateLastMessage(
        chatId!,
        `Error: ${result?.error || 'Unknown error'}`
      )
    }
  } catch (error) {
    useChatStore.getState().updateLastMessage(
      chatId!,
      `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  } finally {
    removeTextListener?.()
    removeToolCallListener?.()
    removeToolResultListener?.()
  }
}, [])
```

---

### Step 10: Add electron.d.ts Declaration

**File:** `src/renderer/types/electron.d.ts` (update if exists, or create)

```typescript
import type { IpcApi } from '../../preload/index'

declare global {
  interface Window {
    electronAPI: IpcApi
  }
}
```

---

## File Checklist

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `package.json` | Modify | Add `just-bash` dependency |
| 2 | `src/shared/types/agent.ts` | Create | Agent types |
| 3 | `src/main/agent/model.ts` | Create | Dynamic model config |
| 4 | `src/main/agent/prompts/system.ts` | Create | System prompt |
| 5 | `src/main/agent/index.ts` | Create | Agent runner |
| 6 | `src/main/index.ts` | Modify | Add IPC handlers |
| 7 | `src/preload/index.ts` | Modify | Add agent API |
| 8 | `src/renderer/hooks/useAssistantRuntime.ts` | Modify | Use agent instead of raw LLM |
| 9 | `src/renderer/types/electron.d.ts` | Modify | Update Window interface |

---

## Testing Plan

### Manual Testing

1. **Basic Chat**: Send a simple message, verify streaming response
2. **File Exploration**: Ask "list files in current directory"
3. **Tool Execution**: Verify tool calls appear in UI
4. **Multi-step**: Ask a question requiring multiple bash commands
5. **Error Handling**: Test with invalid provider config

### Verification Commands

```bash
# Type check
bun run type-check

# Dev mode test
bun run dev
```

---

## Phase 2+ Preview (Future)

### Phase 2: Persistence (agentfs)
- Install `agentfs-sdk`
- Store tool call audit trail
- Per-project agent memory via KV store

### Phase 3: Enhanced Tools
- File write permissions (with user confirmation)
- Network access controls
- Custom Electron-specific commands

### Phase 4: UI Polish
- Collapsible tool call display component
- Syntax highlighting for code output
- Cancel in-progress operations
- Progress indicators

---

## Notes

- **OverlayFs** is safe by default: reads from disk, writes to memory only
- Agent history is in-memory per session; chat messages persist via existing SQLite
- The existing LLM streaming code (`llm:stream`) can be kept for non-agentic use cases
- Provider switching works automatically through `getModel()`
