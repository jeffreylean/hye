import { tool } from 'ai'
import { z } from 'zod'
import type { ToolContext } from '../types.js'
import { analyzeConversation, type ExtractedItem } from '../../subagents/index.js'

function buildNoteMarkdown(meta: {
  title: string
  conversationId: string
  createdAt: string
  tags: string[]
  summary: string
  content: string
}): string {
  const frontmatter = [
    '---',
    `title: "${meta.title}"`,
    `conversation_id: "${meta.conversationId}"`,
    `created_at: "${meta.createdAt}"`,
    `tags: [${meta.tags.map((t) => `"${t}"`).join(', ')}]`,
    `summary: "${meta.summary}"`,
    '---',
    '',
  ].join('\n')

  return frontmatter + meta.content
}

async function updateIndex(
  memory: ToolContext['memory'],
  entry: {
    filepath: string
    title: string
    tags: string[]
    summary: string
    createdAt: string
  }
): Promise<void> {
  if (!memory) return

  const kv = await memory.getKV()
  const existing = await kv.get<{ notes: typeof entry[] }>('memory:index')
  const notes = existing?.notes ?? []

  notes.push(entry)
  await kv.set('memory:index', { notes })
}

export interface SavedNote {
  filepath: string
  title: string
  tags: string[]
}

export async function batchSaveNotes(
  memory: NonNullable<ToolContext['memory']>,
  conversationId: string,
  items: ExtractedItem[]
): Promise<SavedNote[]> {
  const saved: SavedNote[] = []

  for (const item of items) {
    const createdAt = new Date().toISOString()

    const markdown = buildNoteMarkdown({
      title: item.title,
      conversationId,
      createdAt,
      tags: item.tags,
      summary: item.summary,
      content: item.content,
    })

    const fullPath = await memory.write(item.suggestedPath, markdown)

    await updateIndex(memory, {
      filepath: item.suggestedPath,
      title: item.title,
      tags: item.tags,
      summary: item.summary,
      createdAt,
    })

    saved.push({
      filepath: fullPath,
      title: item.title,
      tags: item.tags,
    })
  }

  return saved
}

export function createMemoryAnalyzeTool(context: ToolContext) {
  const { memory } = context

  return tool({
    description:
      'Analyze conversation to extract notable items worth saving to memory. Returns a list of extractable notes with suggested titles, summaries, and paths. Use this when the user asks to save important things from the conversation.',
    inputSchema: z.object({
      conversation_id: z.string().describe('Current conversation ID'),
      messages: z
        .array(
          z.object({
            role: z.enum(['user', 'assistant']),
            content: z.string(),
          })
        )
        .describe('Conversation messages to analyze'),
      auto_save: z
        .boolean()
        .default(false)
        .describe('If true, save all extracted items automatically'),
    }),
    execute: async ({ conversation_id, messages, auto_save }) => {
      if (!memory) {
        return { success: false, error: 'Memory service not available' }
      }

      const items = await analyzeConversation(messages)

      if (items.length === 0) {
        return { items: [], count: 0, message: 'No notable items found in the conversation.' }
      }

      if (!auto_save) {
        return {
          items: items.map((item) => ({
            title: item.title,
            summary: item.summary,
            suggestedPath: item.suggestedPath,
            tags: item.tags,
            importance: item.importance,
            content: item.content,
          })),
          count: items.length,
        }
      }

      const saved = await batchSaveNotes(memory, conversation_id, items)

      return {
        items: saved,
        count: saved.length,
        saved: true,
      }
    },
  })
}
