import type { ToolContext, AgentTool } from './types.js'
import { createBashTool } from './bash.js'
import { MemoryService } from '../../memory/index.js'
import {
  createMemorySaveTool,
  createMemoryRetrieveTool,
  createMemoryListTool,
  createMemoryReadTool,
  createMemorySettingsTool,
  createMemoryAnalyzeTool,
} from './memory/index.js'

export type { ToolContext, AgentTool } from './types.js'
export { createBashTool } from './bash.js'

export type AgentTools = Record<string, AgentTool>

export function createTools(context: ToolContext): AgentTools {
  const contextWithMemory: ToolContext = {
    ...context,
    memory: context.memory ?? MemoryService,
  }

  return {
    bash: createBashTool(contextWithMemory),
    memory_save: createMemorySaveTool(contextWithMemory),
    memory_retrieve: createMemoryRetrieveTool(contextWithMemory),
    memory_list: createMemoryListTool(contextWithMemory),
    memory_read: createMemoryReadTool(contextWithMemory),
    memory_settings: createMemorySettingsTool(contextWithMemory),
    memory_analyze: createMemoryAnalyzeTool(contextWithMemory),
  }
}
