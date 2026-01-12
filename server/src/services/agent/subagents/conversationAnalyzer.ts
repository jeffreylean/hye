import { generateText, Output } from 'ai'
import { z } from 'zod'
import { createSubagentModel } from './provider.js'

const ANALYZER_CONFIG = {
  provider: 'custom' as const,
  model: 'accounts/fireworks/models/kimi-k2-thinking',
  baseUrl: 'https://api.fireworks.ai/inference/v1',
}

const ExtractedItemSchema = z.object({
  title: z.string().describe('Concise title for this note (max 60 chars)'),
  summary: z.string().describe('Brief summary (max 200 chars)'),
  content: z.string().describe('The full content to save'),
  suggestedPath: z.string().describe('Suggested filepath like "category/slug.md"'),
  tags: z.array(z.string()).describe('3-5 relevant tags'),
  importance: z.enum(['high', 'medium', 'low']).describe('How important this item is'),
})

export type ExtractedItem = z.infer<typeof ExtractedItemSchema>

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

function buildAnalyzerPrompt(messages: ConversationMessage[]): string {
  const conversationText = messages
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join('\n\n')

  return `You are a conversation analyzer. Analyze the following conversation and extract notable items worth saving to a personal knowledge base.

CONVERSATION:
${conversationText}

RULES:
1. Extract distinct, valuable pieces of information (facts, decisions, ideas, code snippets, explanations)
2. DO NOT extract:
   - Greetings or small talk
   - Questions without answers
   - Redundant or duplicate information
   - Low-value chitchat
3. For each item:
   - title: Concise, descriptive (max 60 chars)
   - summary: Brief overview (max 200 chars)
   - content: Full extracted content, properly formatted
   - suggestedPath: Use format "category/slug.md" with categories like: programming, ideas, research, personal, work, learning, projects, reference
   - tags: 3-5 lowercase tags
   - importance: high (key decisions, critical info), medium (useful reference), low (nice to have)
4. Use lowercase, kebab-case for paths and slugs
5. If nothing worth saving, return empty items array

Extract notable items now.`
}

export async function analyzeConversation(
  messages: ConversationMessage[]
): Promise<ExtractedItem[]> {
  if (messages.length === 0) {
    return []
  }

  const model = createSubagentModel(ANALYZER_CONFIG)

  if (!model) {
    return fallbackAnalyze(messages)
  }

  try {
    const result = await generateText({
      model,
      output: Output.array({ element: ExtractedItemSchema }),
      prompt: buildAnalyzerPrompt(messages),
    })

    return result.output ?? []
  } catch (error) {
    console.error('ConversationAnalyzer failed, using fallback:', error)
    return fallbackAnalyze(messages)
  }
}

function fallbackAnalyze(messages: ConversationMessage[]): ExtractedItem[] {
  const assistantMessages = messages.filter((m) => m.role === 'assistant' && m.content.length > 100)

  if (assistantMessages.length === 0) {
    return []
  }

  const timestamp = Date.now()

  return assistantMessages.slice(0, 3).map((msg, i) => {
    const preview = msg.content.slice(0, 50).replace(/[^a-zA-Z0-9\s]/g, '')
    const slug = `note-${timestamp}-${i}`

    return {
      title: preview || `Note ${i + 1}`,
      summary: msg.content.slice(0, 200),
      content: msg.content,
      suggestedPath: `reference/${slug}.md`,
      tags: ['conversation', 'extracted'],
      importance: 'medium' as const,
    }
  })
}
