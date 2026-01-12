import { tool } from 'ai'
import { z } from 'zod'
import type { ToolContext } from '../types.js'
import { retrieve, type IndexEntry } from '../../subagents/index.js'

interface Index {
  notes: IndexEntry[]
}

export function createMemoryRetrieveTool(context: ToolContext) {
  const { memory } = context

  return tool({
    description:
      'Search and retrieve information from persistent memory. Use this to recall previously saved notes and information.',
    inputSchema: z.object({
      query: z.string().describe('Natural language search query'),
      limit: z.number().default(5).describe('Maximum number of results to return'),
    }),
    execute: async ({ query, limit }) => {
      if (!memory) {
        return { success: false, error: 'Memory service not available', notes: [] }
      }

      const kv = await memory.getKV()
      const index = await kv.get<Index>('memory:index')

      if (!index || !index.notes.length) {
        return { success: true, notes: [], count: 0, message: 'No notes saved yet' }
      }

      const retrieval = await retrieve(query, index.notes, limit)

      const notes = await Promise.all(
        retrieval.filepaths.map(async (filepath) => {
          const meta = index.notes.find((n) => n.filepath === filepath)
          try {
            const content = await memory.read(filepath)
            return {
              filepath,
              title: meta?.title ?? 'Unknown',
              tags: meta?.tags ?? [],
              summary: meta?.summary ?? '',
              content,
            }
          } catch {
            return {
              filepath,
              title: meta?.title ?? 'Unknown',
              tags: meta?.tags ?? [],
              summary: meta?.summary ?? '',
              content: '[Error reading file]',
            }
          }
        })
      )

      return {
        success: true,
        notes,
        count: notes.length,
        reasoning: retrieval.reasoning,
      }
    },
  })
}
