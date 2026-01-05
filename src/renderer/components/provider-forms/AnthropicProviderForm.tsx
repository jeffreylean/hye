import { ApiKeyField, ModelField } from './fields'
import type { ProviderFormProps, ProviderMetadata } from './types'

export const anthropicProviderMetadata: ProviderMetadata = {
  type: 'anthropic',
  name: 'Anthropic',
  description: 'Claude 3 models',
  defaultModels: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'],
  defaultConfig: {
    type: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
  },
}

export function AnthropicProviderForm({ config, onChange }: ProviderFormProps) {
  return (
    <div className="space-y-4">
      <ApiKeyField
        value={config.apiKey}
        onChange={(apiKey) => onChange({ ...config, apiKey })}
        placeholder="sk-ant-..."
      />
      <ModelField
        value={config.model || ''}
        onChange={(model) => onChange({ ...config, model })}
        suggestedModels={anthropicProviderMetadata.defaultModels}
      />
    </div>
  )
}
