import type { LanguageModel } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { BaseProvider } from './BaseProvider.js'
import type { ProviderMetadata } from './types.js'

export class AnthropicProvider extends BaseProvider {
  readonly metadata: ProviderMetadata = {
    type: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3 models',
    requiresBaseUrl: false,
    defaultModels: [
      'claude-sonnet-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-haiku-20240307',
      'claude-3-opus-20240229',
    ],
  }

  createModel(modelName?: string): LanguageModel {
    const anthropic = createAnthropic({
      apiKey: this.apiKey,
    })
    return anthropic.languageModel(modelName ?? this.metadata.defaultModels[0]!)
  }
}
