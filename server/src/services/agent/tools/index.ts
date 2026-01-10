import type { ToolContext, AgentTool } from './types.js'
import { createBashTool } from './bash.js'

export type { ToolContext, AgentTool } from './types.js'
export { createBashTool } from './bash.js'

export type AgentTools = Record<string, AgentTool>

export function createTools(context: ToolContext): AgentTools {
  return {
    bash: createBashTool(context),
  }
}
