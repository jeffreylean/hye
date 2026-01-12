import { tool } from 'ai'
import { z } from 'zod'
import type { ToolContext } from '../types.js'
import { categorize } from '../../subagents/index.js'

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

export function createMemorySaveTool(context: ToolContext) {
  const { memory } = context

  return tool({
    description:
      'Save information to persistent memory. Automatically categorizes and stores as markdown. Use this to remember important information from conversations.',
    inputSchema: z.object({
      conversation_id: z.string().describe('Current conversation ID'),
      content: z.string().describe('The content/information to save'),
      user_hint: z
        .string()
        .optional()
        .describe('Optional hint about the topic, e.g. "this is about project X"'),
    }),
    execute: async ({ conversation_id, content, user_hint }) => {
      if (!memory) {
        return { success: false, error: 'Memory service not available' }
      }

      const categorized = await categorize(content, user_hint)

      const createdAt = new Date().toISOString()
      const markdown = buildNoteMarkdown({
        title: categorized.title,
        conversationId: conversation_id,
        createdAt,
        tags: categorized.tags,
        summary: categorized.summary,
        content,
      })

      const fullPath = await memory.write(categorized.filepath, markdown)

      await updateIndex(memory, {
        filepath: categorized.filepath,
        title: categorized.title,
        tags: categorized.tags,
        summary: categorized.summary,
        createdAt,
      })

      return {
        success: true,
        filepath: fullPath,
        title: categorized.title,
        tags: categorized.tags,
      }
    },
  })
}
