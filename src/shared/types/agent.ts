export interface BashResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
  result?: BashResult
  status: 'pending' | 'running' | 'completed' | 'error'
}

export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
}

export interface AgentInitOptions {
  projectRoot?: string
  maxSteps?: number
}

export interface AgentChatResult {
  success: boolean
  text?: string
  error?: string
}

export interface AgentStreamEvent {
  type: 'text' | 'tool:call' | 'tool:result' | 'complete' | 'error'
  streamId: string
  data: unknown
}

export interface AgentTextEvent {
  streamId: string
  text: string
}

export interface AgentToolCallEvent {
  streamId: string
  id: string
  name: string
  args: unknown
}

export interface AgentToolResultEvent {
  streamId: string
  id: string
  name: string
  result: unknown
}

export interface AgentCompleteEvent {
  streamId: string
  text: string
}

export interface AgentErrorEvent {
  streamId: string
  error: string
}
