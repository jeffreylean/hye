import type { Tool } from 'ai'
import type { MemoryServiceType } from '../../memory/index.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AgentTool = Tool<any, any>

export interface ToolContext {
  projectRoot?: string
  memory?: MemoryServiceType
}
