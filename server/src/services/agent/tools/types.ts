import { tool } from 'ai'

export type AgentTool = ReturnType<typeof tool>

export interface ToolContext {
  projectRoot?: string
}
