import type { LanguageModel, ModelMessage } from 'ai'
import type { LLMProviderType } from '../../lib/types.js'

export interface LLMConfig {
  provider: LLMProviderType
  apiKey: string
  baseUrl?: string
  model?: string
  temperature?: number
  maxOutputTokens?: number
}

export interface ProviderMetadata {
  type: LLMProviderType
  name: string
  description: string
  requiresBaseUrl: boolean
  defaultModels: string[]
}

export interface LLMProvider {
  readonly metadata: ProviderMetadata
  createModel(modelName?: string): LanguageModel
  streamResponse(messages: ModelMessage[]): AsyncGenerator<string, void, unknown>
  generateResponse(messages: ModelMessage[]): Promise<string>
}

export type ProviderConstructor = new (config: LLMConfig) => LLMProvider
