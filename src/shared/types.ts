export type LLMProviderType = 'custom' | 'anthropic'

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

export type Theme = AppConfig['theme']
