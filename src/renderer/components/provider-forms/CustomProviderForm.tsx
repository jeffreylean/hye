import { ApiKeyField, BaseUrlField, ModelField } from './fields'
import type { ProviderFormProps, ProviderMetadata } from './types'

export const customProviderMetadata: ProviderMetadata = {
  type: 'custom',
  name: 'Custom provider',
  description: 'OpenAI, LocalAI, Ollama, etc.',
  defaultModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'],
  defaultConfig: {
    type: 'custom',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
}

export function CustomProviderForm({ config, onChange }: ProviderFormProps) {
  return (
    <div className="space-y-4">
      <BaseUrlField
        value={config.baseUrl || ''}
        onChange={(baseUrl) => onChange({ ...config, baseUrl })}
      />
      <ApiKeyField
        value={config.apiKey}
        onChange={(apiKey) => onChange({ ...config, apiKey })}
      />
      <ModelField
        value={config.model || ''}
        onChange={(model) => onChange({ ...config, model })}
        suggestedModels={customProviderMetadata.defaultModels}
      />
    </div>
  )
}
