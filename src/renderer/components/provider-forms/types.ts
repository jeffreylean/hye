import type { LLMProviderConfig } from '@/store/configStore'
import type { LLMProviderType } from '../../../shared/types'

export interface ProviderFormProps {
  config: LLMProviderConfig
  onChange: (config: LLMProviderConfig) => void
}

export interface ProviderMetadata {
  type: LLMProviderType
  name: string
  description: string
  defaultModels: string[]
  defaultConfig: Omit<LLMProviderConfig, 'apiKey'>
}
