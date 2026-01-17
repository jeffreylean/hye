import { AgentFS } from 'agentfs-sdk'
import { MEMORY_DB_PATH } from '../../lib/paths.js'

const MEMORY_ROOT = '/hye/memory'

let agentfs: AgentFS | null = null
let initPromise: Promise<AgentFS> | null = null

async function pathExists(fs: AgentFS['fs'], path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

async function getAgentFS(): Promise<AgentFS> {
  if (agentfs) {
    return agentfs
  }

  // Use a promise lock to prevent concurrent initialization
  if (!initPromise) {
    initPromise = (async () => {
      try {
        agentfs = await AgentFS.open({ path: MEMORY_DB_PATH })
        await ensureRootExists()
        return agentfs
      } catch (error) {
        initPromise = null
        throw error
      }
    })()
  }

  return initPromise
}

async function ensureRootExists(): Promise<void> {
  if (!agentfs) return
  
  // Create parent directories recursively: /hye, then /hye/memory
  const parts = MEMORY_ROOT.split('/').filter(Boolean)
  let currentPath = ''
  
  for (const part of parts) {
    currentPath += '/' + part
    const exists = await pathExists(agentfs.fs, currentPath)
    if (!exists) {
      await agentfs.fs.mkdir(currentPath)
    }
  }
}

export const MemoryService = {
  async getFS() {
    const afs = await getAgentFS()
    return afs.fs
  },

  async getKV() {
    const afs = await getAgentFS()
    return afs.kv
  },

  async getTools() {
    const afs = await getAgentFS()
    return afs.tools
  },

  async getInstance(): Promise<AgentFS> {
    return getAgentFS()
  },

  getRoot(): string {
    return MEMORY_ROOT
  },

  async write(relativePath: string, content: string): Promise<string> {
    const fs = await this.getFS()
    const fullPath = `${MEMORY_ROOT}/${relativePath}`
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'))
    
    if (dir && dir !== MEMORY_ROOT) {
      const parts = dir.split('/').filter(Boolean)
      let currentPath = ''
      
      for (const part of parts) {
        currentPath += '/' + part
        if (currentPath.length > MEMORY_ROOT.length) {
          const exists = await pathExists(fs, currentPath)
          if (!exists) {
            await fs.mkdir(currentPath)
          }
        }
      }
    }
    
    await fs.writeFile(fullPath, content)
    return fullPath
  },

  async read(relativePath: string): Promise<string> {
    const fs = await this.getFS()
    const fullPath = `${MEMORY_ROOT}/${relativePath}`
    return await fs.readFile(fullPath, 'utf-8') as string
  },

  async list(relativePath: string = ''): Promise<string[]> {
    const fs = await this.getFS()
    const fullPath = relativePath ? `${MEMORY_ROOT}/${relativePath}` : MEMORY_ROOT
    return await fs.readdir(fullPath)
  },

  async exists(relativePath: string): Promise<boolean> {
    const fs = await this.getFS()
    const fullPath = `${MEMORY_ROOT}/${relativePath}`
    return await pathExists(fs, fullPath)
  },

  async delete(relativePath: string): Promise<void> {
    const fs = await this.getFS()
    const fullPath = `${MEMORY_ROOT}/${relativePath}`
    await fs.deleteFile(fullPath)
  },

  async close(): Promise<void> {
    if (agentfs) {
      await agentfs.close?.()
    }
    agentfs = null
    initPromise = null
  },
}

export type MemoryServiceType = typeof MemoryService
