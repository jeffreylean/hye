import { LLMError } from '../../lib/effect.js'
import type { LLMConfig, LLMProvider, LLMProviderType, ProviderConstructor, ProviderMetadata } from './types.js'
import { CustomProvider } from './CustomProvider.js'
import { AnthropicProvider } from './AnthropicProvider.js'

class ProviderRegistry {
  private providers = new Map<LLMProviderType, ProviderConstructor>()

  register(type: LLMProviderType, providerClass: ProviderConstructor): void {
    this.providers.set(type, providerClass)
  }

  get(type: LLMProviderType): ProviderConstructor | undefined {
    return this.providers.get(type)
  }

  getAll(): LLMProviderType[] {
    return Array.from(this.providers.keys())
  }

  getAllMetadata(): ProviderMetadata[] {
    return this.getAll().map((type) => {
      const ProviderClass = this.providers.get(type)!
      const instance = new ProviderClass({ provider: type, apiKey: '' })
      return instance.metadata
    })
  }
}

const registry = new ProviderRegistry()

registry.register('custom', CustomProvider)
registry.register('anthropic', AnthropicProvider)

export class ProviderFactory {
  static create(config: LLMConfig): LLMProvider {
    const ProviderClass = registry.get(config.provider)

    if (!ProviderClass) {
      throw new LLMError(`Unsupported provider: ${config.provider}`)
    }

    return new ProviderClass(config)
  }

  static getSupportedProviders(): ProviderMetadata[] {
    return registry.getAllMetadata()
  }

  static registerProvider(type: LLMProviderType, providerClass: ProviderConstructor): void {
    registry.register(type, providerClass)
  }
}
