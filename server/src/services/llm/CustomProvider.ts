import type { LanguageModel } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { BaseProvider } from './BaseProvider.js'
import type { LLMConfig, ProviderMetadata } from './types.js'

export class CustomProvider extends BaseProvider {
  readonly metadata: ProviderMetadata = {
    type: 'custom',
    name: 'OpenAI Compatible',
    description: 'OpenAI, LocalAI, Ollama, etc.',
    requiresBaseUrl: true,
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'],
  }

  constructor(config: LLMConfig) {
    super(config)
  }

  createModel(modelName?: string): LanguageModel {
    const openai = createOpenAI({
      apiKey: this.apiKey,
      baseURL: this.config.baseUrl || 'https://api.openai.com/v1',
    })
    return openai.languageModel(modelName ?? this.metadata.defaultModels[0]!)
  }
}
