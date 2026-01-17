import type { BunRequest } from 'bun'
import { MemoryService } from '../services/memory/MemoryService.js'
import { jsonResponse, errorResponse, parseJsonBody } from '../lib/http.js'
import {
  analyzeConversation,
  type ConversationMessage,
  type ExtractedItem,
} from '../services/agent/subagents/index.js'
import { batchSaveNotes } from '../services/agent/tools/memory/index.js'

interface TreeEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: TreeEntry[]
}

interface IndexEntry {
  filepath: string
  title: string
  tags: string[]
  summary: string
  createdAt: string
}

interface Index {
  notes: IndexEntry[]
}

async function buildTree(basePath: string = ''): Promise<TreeEntry[]> {
  const entries = await MemoryService.list(basePath)
  const result: TreeEntry[] = []

  for (const name of entries) {
    const entryPath = basePath ? `${basePath}/${name}` : name
    const isDir = !name.includes('.')

    if (isDir) {
      const children = await buildTree(entryPath)
      result.push({
        name,
        path: entryPath,
        type: 'directory',
        children,
      })
    } else {
      result.push({
        name,
        path: entryPath,
        type: 'file',
      })
    }
  }

  return result
}

async function getTree(): Promise<Response> {
  try {
    const tree = await buildTree()
    return jsonResponse({ tree })
  } catch (error) {
    console.error('Failed to get memory tree:', error)
    return jsonResponse({ tree: [] })
  }
}

async function getNote(req: BunRequest<'/memory/note/:path'>): Promise<Response> {
  const { path } = req.params
  const filepath = decodeURIComponent(path)

  try {
    const content = await MemoryService.read(filepath)

    const kv = await MemoryService.getKV()
    const index = await kv.get<Index>('memory:index')
    const meta = index?.notes.find((n) => n.filepath === filepath)

    return jsonResponse({
      content,
      meta: meta ?? {
        filepath,
        title: filepath.split('/').pop()?.replace('.md', '') ?? 'Unknown',
        tags: [],
        summary: '',
        createdAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Failed to read note:', error)
    return errorResponse('Note not found', 404)
  }
}

async function deleteNote(req: BunRequest<'/memory/note/:path'>): Promise<Response> {
  const { path } = req.params
  const filepath = decodeURIComponent(path)

  try {
    await MemoryService.delete(filepath)

    const kv = await MemoryService.getKV()
    const index = await kv.get<Index>('memory:index')
    if (index) {
      index.notes = index.notes.filter((n) => n.filepath !== filepath)
      await kv.set('memory:index', index)
    }

    return jsonResponse({ success: true })
  } catch (error) {
    console.error('Failed to delete note:', error)
    return errorResponse('Failed to delete note', 500)
  }
}

async function getIndex(): Promise<Response> {
  try {
    const kv = await MemoryService.getKV()
    const index = await kv.get<Index>('memory:index')
    return jsonResponse({ notes: index?.notes ?? [] })
  } catch (error) {
    console.error('Failed to get index:', error)
    return jsonResponse({ notes: [] })
  }
}

interface AnalyzeRequest {
  conversationId: string
  messages: ConversationMessage[]
}

async function analyzeMemory(req: Request): Promise<Response> {
  try {
    const { conversationId, messages } = await parseJsonBody<AnalyzeRequest>(req)

    if (!messages || messages.length === 0) {
      return jsonResponse({ items: [], count: 0, message: 'No messages to analyze.' })
    }

    const items = await analyzeConversation(messages)

    return jsonResponse({
      items: items.map((item) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        title: item.title,
        summary: item.summary,
        suggestedPath: item.suggestedPath,
        tags: item.tags,
        importance: item.importance,
        content: item.content,
      })),
      count: items.length,
      conversationId,
    })
  } catch (error) {
    console.error('Failed to analyze conversation:', error)
    return errorResponse('Failed to analyze conversation', 500)
  }
}

interface BatchSaveItem {
  title: string
  summary: string
  content: string
  suggestedPath: string
  tags: string[]
  importance: string
}

interface BatchSaveRequest {
  conversationId: string
  items: BatchSaveItem[]
}

async function batchSaveMemory(req: Request): Promise<Response> {
  try {
    const { conversationId, items } = await parseJsonBody<BatchSaveRequest>(req)

    if (!items || items.length === 0) {
      return jsonResponse({ saved: [], count: 0 })
    }

    const extractedItems: ExtractedItem[] = items.map((item) => ({
      title: item.title,
      summary: item.summary,
      content: item.content,
      suggestedPath: item.suggestedPath,
      tags: item.tags,
      importance: item.importance as 'high' | 'medium' | 'low',
    }))

    const saved = await batchSaveNotes(MemoryService, conversationId, extractedItems)

    return jsonResponse({
      saved,
      count: saved.length,
    })
  } catch (error) {
    console.error('Failed to batch save:', error)
    return errorResponse('Failed to save notes', 500)
  }
}

export const memoryRoutes = {
  '/memory/tree': {
    GET: getTree,
  },
  '/memory/note/:path': {
    GET: getNote,
    DELETE: deleteNote,
  },
  '/memory/index': {
    GET: getIndex,
  },
  '/memory/analyze': {
    POST: analyzeMemory,
  },
  '/memory/batch-save': {
    POST: batchSaveMemory,
  },
}
