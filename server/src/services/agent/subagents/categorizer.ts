import { generateText, Output } from 'ai'
import { z } from 'zod'
import { createSubagentModel } from './provider.js'

const CATEGORIZER_CONFIG = {
  provider: 'google' as const,
  model: 'gemini-2.0-flash-lite',
}

const DEFAULT_CATEGORIES = [
  'programming',
  'ideas',
  'research',
  'personal',
  'work',
  'learning',
  'projects',
  'reference',
] as const

const CategorizationSchema = z.object({
  filepath: z
    .string()
    .describe('Relative filepath like "category/subcategory/note-slug.md". Max 3 levels deep.'),
  title: z.string().describe('A concise, descriptive title for the note (max 60 chars)'),
  summary: z.string().describe('A brief summary of the content (max 200 chars)'),
  tags: z.array(z.string()).describe('3-5 relevant tags for searchability'),
})

export type CategorizationResult = z.infer<typeof CategorizationSchema>

function buildCategorizerPrompt(content: string, userHint?: string): string {
  const hintSection = userHint ? `\nUser hint about the topic: "${userHint}"` : ''

  return `You are a note categorization assistant. Analyze the following content and determine the best way to organize it in a filesystem-based knowledge base.

CONTENT TO CATEGORIZE:
${content}
${hintSection}

RULES:
1. Choose a top-level category from: ${DEFAULT_CATEGORIES.join(', ')}
2. Use max 3 directory levels (e.g., "programming/typescript/generics-tips.md")
3. Use lowercase, kebab-case for paths and slugs
4. Title should be human-readable, max 60 characters
5. Summary should capture the key points, max 200 characters
6. Tags should be lowercase, single words or hyphenated phrases
7. If content doesn't fit existing categories, use "reference" as fallback

Generate the categorization now.`
}

export async function categorize(
  content: string,
  userHint?: string
): Promise<CategorizationResult> {
  const model = createSubagentModel(CATEGORIZER_CONFIG)

  if (!model) {
    return fallbackCategorize(content, userHint)
  }

  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: CategorizationSchema }),
      prompt: buildCategorizerPrompt(content, userHint),
    })

    return result.output ?? fallbackCategorize(content, userHint)
  } catch (error) {
    console.error('CategorizerAgent failed, using fallback:', error)
    return fallbackCategorize(content, userHint)
  }
}

function fallbackCategorize(content: string, hint?: string): CategorizationResult {
  const timestamp = Date.now()
  const slug = `note-${timestamp}`

  const title = hint || content.slice(0, 50).replace(/[^a-zA-Z0-9\s]/g, '') || 'Untitled'
  const summary = content.slice(0, 200)

  const tags: string[] = []
  if (hint) {
    tags.push(
      ...hint
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3)
    )
  }

  const category = hint ? hint.toLowerCase().split(/\s+/)[0] : 'general'
  const filepath = `${category}/${slug}.md`

  return { title, summary, tags, filepath }
}
