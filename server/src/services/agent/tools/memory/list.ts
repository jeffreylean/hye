import { tool } from 'ai'
import { z } from 'zod'
import type { ToolContext } from '../types.js'

interface TreeNode {
  name: string
  type: 'file' | 'directory'
  children?: TreeNode[]
}

async function listTreeRecursive(
  memory: NonNullable<ToolContext['memory']>,
  path: string,
  depth: number,
  currentDepth: number = 0
): Promise<TreeNode[]> {
  if (currentDepth >= depth) {
    return []
  }

  const fs = await memory.getFS()
  const root = memory.getRoot()
  const fullPath = path ? `${root}/${path}` : root

  let entries: string[]
  try {
    entries = await fs.readdir(fullPath)
  } catch {
    return []
  }

  const nodes: TreeNode[] = []

  for (const entry of entries) {
    const entryPath = path ? `${path}/${entry}` : entry
    const fullEntryPath = `${root}/${entryPath}`

    let isDir = false
    try {
      const stat = await fs.stat(fullEntryPath)
      isDir = stat.isDirectory()
    } catch {
      continue
    }

    if (isDir) {
      const children = await listTreeRecursive(memory, entryPath, depth, currentDepth + 1)
      nodes.push({
        name: entry,
        type: 'directory',
        children,
      })
    } else {
      nodes.push({
        name: entry,
        type: 'file',
      })
    }
  }

  return nodes
}

export function createMemoryListTool(context: ToolContext) {
  const { memory } = context

  return tool({
    description: 'List the memory filesystem structure. Browse saved notes and directories.',
    inputSchema: z.object({
      path: z.string().default('').describe('Relative path within memory to list (empty for root)'),
      depth: z.number().default(2).describe('How many levels deep to list'),
    }),
    execute: async ({ path, depth }) => {
      if (!memory) {
        return { success: false, error: 'Memory service not available', tree: [] }
      }

      const tree = await listTreeRecursive(memory, path, depth)

      return {
        success: true,
        root: memory.getRoot(),
        path: path || '/',
        tree,
      }
    },
  })
}
