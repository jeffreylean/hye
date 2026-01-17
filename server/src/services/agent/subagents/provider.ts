import type { LanguageModel } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import type { SubagentProviderType } from '../../../lib/types.js'

export interface SubagentModelConfig {
  provider: SubagentProviderType
  model: string
  apiKey?: string
  baseUrl?: string
}

function getApiKey(provider: SubagentProviderType, explicitKey?: string): string | undefined {
  if (explicitKey) return explicitKey

  switch (provider) {
    case 'google':
      return process.env.GOOGLE_API_KEY
    case 'custom':
      return process.env.CUSTOM_API_KEY ?? process.env.OPENAI_API_KEY
  }
}

export function createSubagentModel(config: SubagentModelConfig): LanguageModel | null {
  const { provider, model, baseUrl, apiKey: explicitKey } = config
  const apiKey = getApiKey(provider, explicitKey)

  if (!apiKey) {
    return null
  }

  switch (provider) {
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey })
      return google(model)
    }
    case 'custom': {
      if (!baseUrl) {
        console.error('Custom provider requires baseUrl')
        return null
      }
      const openai = createOpenAI({
        apiKey,
        baseURL: baseUrl,
      })
      return openai.chat(model)
    }
    default:
      return null
  }
}
