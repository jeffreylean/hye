import type { ApiClient } from './types'
import { createHttpClient } from './http-client'

export type { ApiClient } from './types'
export type { 
  Message, 
  Chat, 
  LLMConfig, 
  LLMMessage, 
  GenerateResponse, 
  ProviderMetadata, 
  StreamChunk 
} from './types'

const DEFAULT_BASE_URL = 'http://localhost:9876'

let client: ApiClient | null = null

export function initializeApi(httpBaseUrl?: string): ApiClient {
  client = createHttpClient(httpBaseUrl || DEFAULT_BASE_URL)
  return client
}

export function getApi(): ApiClient {
  if (!client) {
    client = createHttpClient(DEFAULT_BASE_URL)
  }
  return client
}
