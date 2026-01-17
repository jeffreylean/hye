export type LLMProviderType = 'custom' | 'anthropic' | 'google'

export type SubagentProviderType = 'google' | 'custom'

export interface LLMProviderConfig {
  type: LLMProviderType
  apiKey: string
  baseUrl?: string
  model?: string
}

export interface AppConfig {
  theme: 'light' | 'dark' | 'system'
  currentProvider: LLMProviderConfig | null
  savedProviders: Record<string, LLMProviderConfig>
}

export interface Message {
  id: number
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
  provider: LLMProviderType
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
  type: LLMProviderType
  name: string
  description: string
  requiresBaseUrl: boolean
  defaultModels: string[]
}

export interface StreamChunk {
  chunk: string
  done: boolean
}
