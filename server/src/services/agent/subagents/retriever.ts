import { generateText, Output } from 'ai'
import { z } from 'zod'
import { createSubagentModel } from './provider.js'

const RETRIEVER_CONFIG = {
  provider: 'google' as const,
  model: 'gemini-2.0-flash-lite',
}

export interface IndexEntry {
  filepath: string
  title: string
  tags: string[]
  summary: string
  createdAt: string
}

const RetrievalSchema = z.object({
  filepaths: z
    .array(z.string())
    .describe('Ordered list of filepaths, most relevant first'),
  reasoning: z
    .string()
    .describe('Brief explanation of why these notes were selected'),
})

export type RetrievalResult = z.infer<typeof RetrievalSchema>

function buildRetrieverPrompt(query: string, notes: IndexEntry[]): string {
  const notesSection = notes
    .map(
      (n, i) =>
        `${i + 1}. filepath: "${n.filepath}"
   title: "${n.title}"
   tags: [${n.tags.join(', ')}]
   summary: "${n.summary}"
   created: ${n.createdAt}`
    )
    .join('\n\n')

  return `You are a note retrieval assistant. Given a user query, find the most relevant notes from the index.

USER QUERY:
${query}

AVAILABLE NOTES:
${notesSection}

RULES:
1. Return filepaths of notes that best match the query semantically
2. Consider title, tags, and summary for relevance
3. Order by relevance (most relevant first)
4. Return empty array if no notes are relevant
5. Provide brief reasoning for your selection

Select the relevant notes now.`
}

export async function retrieve(
  query: string,
  notes: IndexEntry[],
  limit: number = 5
): Promise<RetrievalResult> {
  if (notes.length === 0) {
    return { filepaths: [], reasoning: 'No notes available to search.' }
  }

  const model = createSubagentModel(RETRIEVER_CONFIG)

  if (!model) {
    return fallbackRetrieve(query, notes, limit)
  }

  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: RetrievalSchema }),
      prompt: buildRetrieverPrompt(query, notes),
    })

    if (!result.output) {
      return fallbackRetrieve(query, notes, limit)
    }

    return {
      filepaths: result.output.filepaths.slice(0, limit),
      reasoning: result.output.reasoning,
    }
  } catch (error) {
    console.error('RetrieverAgent failed, using fallback:', error)
    return fallbackRetrieve(query, notes, limit)
  }
}

function fallbackRetrieve(
  query: string,
  notes: IndexEntry[],
  limit: number
): RetrievalResult {
  const queryTerms = query.toLowerCase().split(/\s+/)

  const scored = notes.map((note) => {
    let score = 0
    const searchText = `${note.title} ${note.summary} ${note.tags.join(' ')}`.toLowerCase()

    for (const term of queryTerms) {
      if (searchText.includes(term)) {
        score += 1
      }
      if (note.title.toLowerCase().includes(term)) {
        score += 2
      }
      if (note.tags.some((t) => t.toLowerCase().includes(term))) {
        score += 1.5
      }
    }

    return { note, score }
  })

  const topResults = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.note.filepath)

  return {
    filepaths: topResults,
    reasoning: 'Keyword-based matching (fallback mode)',
  }
}
