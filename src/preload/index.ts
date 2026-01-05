import { contextBridge, ipcRenderer } from 'electron'
import type { ModelMessage } from 'ai'
import type { LLMConfig, LLMProviderType } from '../main/services/llmService'

export interface Chat {
  id: string
  title: string
  messages: Message[]
  createdAt: number
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export type IpcApi = {
  ping: () => Promise<string>
  
  llm: {
    generate: (messages: ModelMessage[], config: LLMConfig) => Promise<{
      success: boolean
      data?: string
      error?: string
    }>
    stream: (messages: ModelMessage[], config: LLMConfig) => Promise<{
      success: boolean
      data?: string
      error?: string
    }>
    onStreamChunk: (callback: (chunk: string) => void) => () => void
    getSupportedProviders: () => Promise<Array<{
      type: LLMProviderType
      name: string
      description: string
      requiresBaseUrl: boolean
      defaultModels: string[]
    }>>
  }

  config: {
    get: () => Promise<unknown>
    save: (config: unknown) => Promise<boolean>
    setCurrentProvider: (provider: unknown) => Promise<boolean>
    saveProvider: (name: string, config: unknown) => Promise<boolean>
    removeProvider: (name: string) => Promise<boolean>
    getStorePath: () => Promise<string>
  }

  db: {
    getAllChats: () => Promise<Chat[]>
    getChat: (id: string) => Promise<Chat | null>
    createChat: (id: string, title: string) => Promise<Chat>
    updateChatTitle: (id: string, title: string) => Promise<boolean>
    deleteChat: (id: string) => Promise<boolean>
    addMessage: (chatId: string, role: 'user' | 'assistant', content: string) => Promise<boolean>
    updateLastMessage: (chatId: string, content: string) => Promise<boolean>
  }
}

const api: IpcApi = {
  ping: () => ipcRenderer.invoke('ping'),
  
  llm: {
    generate: (messages, config) => ipcRenderer.invoke('llm:generate', messages, config),
    stream: (messages, config) => ipcRenderer.invoke('llm:stream', messages, config),
    onStreamChunk: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { streamId: string; chunk: string; isComplete: boolean }) => {
        if (!data.isComplete) {
          callback(data.chunk)
        }
      }
      ipcRenderer.on('llm:stream:chunk', handler)
      return () => ipcRenderer.off('llm:stream:chunk', handler)
    },
    getSupportedProviders: () => ipcRenderer.invoke('llm:getSupportedProviders'),
  },

  config: {
    get: () => ipcRenderer.invoke('config:get'),
    save: (config) => ipcRenderer.invoke('config:save', config),
    setCurrentProvider: (provider) => ipcRenderer.invoke('config:setCurrentProvider', provider),
    saveProvider: (name, config) => ipcRenderer.invoke('config:saveProvider', name, config),
    removeProvider: (name) => ipcRenderer.invoke('config:removeProvider', name),
    getStorePath: () => ipcRenderer.invoke('config:getStorePath'),
  },

  db: {
    getAllChats: () => ipcRenderer.invoke('db:getAllChats'),
    getChat: (id) => ipcRenderer.invoke('db:getChat', id),
    createChat: (id, title) => ipcRenderer.invoke('db:createChat', id, title),
    updateChatTitle: (id, title) => ipcRenderer.invoke('db:updateChatTitle', id, title),
    deleteChat: (id) => ipcRenderer.invoke('db:deleteChat', id),
    addMessage: (chatId, role, content) => ipcRenderer.invoke('db:addMessage', chatId, role, content),
    updateLastMessage: (chatId, content) => ipcRenderer.invoke('db:updateLastMessage', chatId, content),
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (error) {
    console.error(error)
  }
} else {
  (window as unknown as { electronAPI: IpcApi }).electronAPI = api
}
