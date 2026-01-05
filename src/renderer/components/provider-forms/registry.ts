import type { ComponentType } from 'react'
import type { LLMProviderType } from '../../../shared/types'
import type { ProviderFormProps, ProviderMetadata } from './types'
import { CustomProviderForm, customProviderMetadata } from './CustomProviderForm'
import { AnthropicProviderForm, anthropicProviderMetadata } from './AnthropicProviderForm'

interface ProviderRegistryEntry {
  Form: ComponentType<ProviderFormProps>
  metadata: ProviderMetadata
}

const registry: Record<LLMProviderType, ProviderRegistryEntry> = {
  custom: {
    Form: CustomProviderForm,
    metadata: customProviderMetadata,
  },
  anthropic: {
    Form: AnthropicProviderForm,
    metadata: anthropicProviderMetadata,
  },
}

export function getProviderForm(type: LLMProviderType): ComponentType<ProviderFormProps> {
  return registry[type].Form
}

export function getProviderMetadata(type: LLMProviderType): ProviderMetadata {
  return registry[type].metadata
}

export function getAllProviders(): ProviderMetadata[] {
  return Object.values(registry).map((entry) => entry.metadata)
}
