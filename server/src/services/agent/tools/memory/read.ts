import { tool } from 'ai'
import { z } from 'zod'
import type { ToolContext } from '../types.js'

export function createMemoryReadTool(context: ToolContext) {
  const { memory } = context

  return tool({
    description: 'Read a specific file from memory by its path.',
    inputSchema: z.object({
      filepath: z.string().describe('Relative path to the file within memory'),
    }),
    execute: async ({ filepath }) => {
      if (!memory) {
        return { success: false, error: 'Memory service not available' }
      }

      try {
        const content = await memory.read(filepath)
        return {
          success: true,
          filepath,
          content,
        }
      } catch (error) {
        return {
          success: false,
          filepath,
          error: error instanceof Error ? error.message : 'Failed to read file',
        }
      }
    },
  })
}
