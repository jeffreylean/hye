import { tool } from 'ai'
import { z } from 'zod'
import type { ToolContext } from '../types.js'

export function createMemorySettingsTool(context: ToolContext) {
  const { memory } = context

  return tool({
    description: 'Get or set memory settings for the current conversation.',
    inputSchema: z.object({
      op: z.enum(['get', 'set']).describe('Operation to perform'),
      key: z.string().describe('Setting key'),
      value: z.unknown().optional().describe('Value to set (required for set operation)'),
    }),
    execute: async ({ op, key, value }) => {
      if (!memory) {
        return { success: false, error: 'Memory service not available' }
      }

      const kv = await memory.getKV()
      const settingsKey = `memory:settings:${key}`

      if (op === 'set') {
        await kv.set(settingsKey, value)
        return { success: true, key, value }
      }

      const stored = await kv.get(settingsKey)
      return { success: true, key, value: stored }
    },
  })
}
