import type { ModelMessage } from 'ai'
import { ProviderFactory } from './ProviderFactory.js'
import type { LLMConfig, LLMProvider, ProviderMetadata } from './types.js'

export type { LLMConfig, LLMProvider, ProviderMetadata }

export class LLMService {
  private provider: LLMProvider

  constructor(private config: LLMConfig) {
    this.validateConfig()
    this.provider = ProviderFactory.create(config)
  }

  async generateResponse(messages: ModelMessage[]): Promise<string> {
    try {
      return await this.provider.generateResponse(messages)
    } catch (error) {
      throw new Error(
        `LLM generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async *streamResponse(messages: ModelMessage[]): AsyncGenerator<string, void, unknown> {
    try {
      yield* this.provider.streamResponse(messages)
    } catch (error) {
      throw new Error(
        `LLM streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private validateConfig(): void {
    if (!this.config.apiKey) {
      throw new Error('API key is required')
    }
    if (this.config.provider === 'custom' && !this.config.baseUrl) {
      throw new Error('Base URL is required for custom providers')
    }
    if (!this.config.model) {
      throw new Error('Model name is required')
    }
  }

  static getSupportedProviders(): ProviderMetadata[] {
    return ProviderFactory.getSupportedProviders()
  }
}
