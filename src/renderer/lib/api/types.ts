import type { AppConfig, LLMProviderConfig } from '../../../shared/types'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface Chat {
  id: string
  title: string
  messages: Message[]
  createdAt: number
}

export interface LLMConfig {
  provider: string
  apiKey: string
  baseUrl?: string
  model?: string
  temperature?: number
  maxOutputTokens?: number
}

export interface LLMMessage {
  role: string
  content: string
}

export interface GenerateResponse {
  success: boolean
  data?: string
  error?: string
}

export interface ProviderMetadata {
  type: string
  name: string
  description: string
  requiresBaseUrl: boolean
  defaultModels: string[]
}

export interface StreamChunk {
  chunk: string
  done: boolean
}

export interface ApiClient {
  // Health
  ping(): Promise<string>

  // LLM
  llm: {
    generate(messages: LLMMessage[], config: LLMConfig): Promise<GenerateResponse>
    stream(
      messages: LLMMessage[],
      config: LLMConfig,
      onChunk: (chunk: string) => void
    ): Promise<GenerateResponse>
    getSupportedProviders(): Promise<ProviderMetadata[]>
  }

  // Config
  config: {
    get(): Promise<AppConfig | undefined>
    save(config: Partial<AppConfig>): Promise<boolean>
    setCurrentProvider(provider: LLMProviderConfig | null): Promise<boolean>
    saveProvider(name: string, config: LLMProviderConfig): Promise<boolean>
    removeProvider(name: string): Promise<boolean>
    getStorePath(): Promise<string>
  }

  // Database
  db: {
    getAllChats(): Promise<Chat[]>
    getChat(id: string): Promise<Chat | null>
    createChat(id: string, title: string): Promise<Chat>
    updateChatTitle(id: string, title: string): Promise<boolean>
    deleteChat(id: string): Promise<boolean>
    addMessage(chatId: string, role: 'user' | 'assistant', content: string): Promise<boolean>
    updateLastMessage(chatId: string, content: string): Promise<boolean>
  }
}
