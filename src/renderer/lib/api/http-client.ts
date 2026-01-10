import type {
  ApiClient,
  LLMConfig,
  LLMMessage,
  GenerateResponse,
  ProviderMetadata,
  Chat,
  StreamChunk,
  AgentInitOptions,
  AgentCallbacks,
  AgentTextEvent,
  AgentToolCallEvent,
  AgentToolResultEvent,
  AgentCompleteEvent,
} from './types'
import type { AppConfig, LLMProviderConfig } from '../../../shared/types'

const DEFAULT_BASE_URL = 'http://localhost:9876'

interface SSEMessage {
  event: string
  data: string
}

function parseSSEChunk(chunk: string): SSEMessage | null {
  const eventMatch = chunk.match(/^event: (.+)$/m)
  const dataMatch = chunk.match(/^data: (.+)$/m)

  const event = eventMatch?.[1]
  const data = dataMatch?.[1]

  if (!event || !data) return null

  return { event, data }
}

export function createHttpClient(baseUrl: string = DEFAULT_BASE_URL): ApiClient {
  const fetchJSON = async <T>(path: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(error || `HTTP ${response.status}`)
    }

    return response.json()
  }

  return {
    ping: async () => {
      const response = await fetch(`${baseUrl}/ping`)
      return response.text()
    },

    llm: {
      generate: async (messages: LLMMessage[], config: LLMConfig): Promise<GenerateResponse> => {
        try {
          return await fetchJSON<GenerateResponse>('/api/llm/generate', {
            method: 'POST',
            body: JSON.stringify({ messages, config }),
          })
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      stream: async (
        messages: LLMMessage[],
        config: LLMConfig,
        onChunk: (chunk: string) => void
      ): Promise<GenerateResponse> => {
        try {
          const response = await fetch(`${baseUrl}/api/llm/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages, config }),
          })

          if (!response.ok) {
            const error = await response.text()
            return { success: false, error }
          }

          const reader = response.body?.getReader()
          if (!reader) {
            return { success: false, error: 'No response body' }
          }

          const decoder = new TextDecoder()
          let buffer = ''
          let fullContent = ''

          const processLine = (line: string): { success: boolean; error?: string; done?: boolean } | null => {
            if (!line.startsWith('data: ')) return null
            try {
              const jsonStr = line.slice(6).trim()
              if (!jsonStr) return null
              const data: StreamChunk = JSON.parse(jsonStr)
              if (data.chunk) {
                fullContent += data.chunk
                onChunk(data.chunk)
              }
              if ('error' in data && data.error) {
                return { success: false, error: data.error as string }
              }
              if (data.done) {
                return { success: true, done: true }
              }
            } catch {
              // Skip malformed JSON
            }
            return null
          }

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              const result = processLine(line)
              if (result) {
                if (!result.success) {
                  return { success: false, error: result.error }
                }
                if (result.done) {
                  return { success: true, data: fullContent }
                }
              }
            }
          }

          // Process any remaining data in buffer after stream ends
          if (buffer.trim()) {
            const result = processLine(buffer)
            if (result && !result.success) {
              return { success: false, error: result.error }
            }
          }

          return { success: true, data: fullContent }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      getSupportedProviders: async (): Promise<ProviderMetadata[]> => {
        return fetchJSON<ProviderMetadata[]>('/api/llm/providers')
      },
    },

    config: {
      get: async (): Promise<AppConfig | undefined> => {
        try {
          return await fetchJSON<AppConfig>('/api/config')
        } catch {
          return undefined
        }
      },

      save: async (config: Partial<AppConfig>): Promise<boolean> => {
        try {
          await fetchJSON('/api/config', {
            method: 'PUT',
            body: JSON.stringify(config),
          })
          return true
        } catch {
          return false
        }
      },

      setCurrentProvider: async (provider: LLMProviderConfig | null): Promise<boolean> => {
        try {
          await fetchJSON('/api/config/provider/current', {
            method: 'PUT',
            body: JSON.stringify(provider),
          })
          return true
        } catch {
          return false
        }
      },

      saveProvider: async (name: string, config: LLMProviderConfig): Promise<boolean> => {
        try {
          await fetchJSON(`/api/config/provider/${encodeURIComponent(name)}`, {
            method: 'PUT',
            body: JSON.stringify(config),
          })
          return true
        } catch {
          return false
        }
      },

      removeProvider: async (name: string): Promise<boolean> => {
        try {
          await fetchJSON(`/api/config/provider/${encodeURIComponent(name)}`, {
            method: 'DELETE',
          })
          return true
        } catch {
          return false
        }
      },

      getStorePath: async (): Promise<string> => {
        try {
          const result = await fetchJSON<{ path: string }>('/api/config/path')
          return result.path
        } catch {
          return ''
        }
      },
    },

    db: {
      getAllChats: async (): Promise<Chat[]> => {
        try {
          return await fetchJSON<Chat[]>('/api/chats')
        } catch {
          return []
        }
      },

      getChat: async (id: string): Promise<Chat | null> => {
        try {
          return await fetchJSON<Chat>(`/api/chats/${encodeURIComponent(id)}`)
        } catch {
          return null
        }
      },

      createChat: async (id: string, title: string): Promise<Chat> => {
        return fetchJSON<Chat>('/api/chats', {
          method: 'POST',
          body: JSON.stringify({ id, title }),
        })
      },

      updateChatTitle: async (id: string, title: string): Promise<boolean> => {
        try {
          await fetchJSON(`/api/chats/${encodeURIComponent(id)}/title`, {
            method: 'PUT',
            body: JSON.stringify({ title }),
          })
          return true
        } catch {
          return false
        }
      },

      deleteChat: async (id: string): Promise<boolean> => {
        try {
          await fetchJSON(`/api/chats/${encodeURIComponent(id)}`, {
            method: 'DELETE',
          })
          return true
        } catch {
          return false
        }
      },

      addMessage: async (chatId: string, role: 'user' | 'assistant', content: string): Promise<boolean> => {
        try {
          await fetchJSON(`/api/chats/${encodeURIComponent(chatId)}/messages`, {
            method: 'POST',
            body: JSON.stringify({ role, content }),
          })
          return true
        } catch {
          return false
        }
      },

      updateLastMessage: async (chatId: string, content: string): Promise<boolean> => {
        try {
          await fetchJSON(`/api/chats/${encodeURIComponent(chatId)}/messages/last`, {
            method: 'PUT',
            body: JSON.stringify({ content }),
          })
          return true
        } catch {
          return false
        }
      },
    },

    agent: {
      init: async (options: AgentInitOptions): Promise<{ success: boolean; sessionId?: string; error?: string }> => {
        try {
          return await fetchJSON('/api/agent/init', {
            method: 'POST',
            body: JSON.stringify(options),
          })
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      },

      chat: async (sessionId: string, message: string, callbacks: AgentCallbacks): Promise<void> => {
        const response = await fetch(`${baseUrl}/api/agent/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message }),
        })

        if (!response.ok) {
          const error = await response.text()
          callbacks.onError?.(error)
          return
        }

        const reader = response.body?.getReader()
        if (!reader) {
          callbacks.onError?.('No response body')
          return
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() ?? ''

          for (const chunk of lines) {
            if (!chunk.trim()) continue

            const parsed = parseSSEChunk(chunk)
            if (!parsed) continue

            const data = JSON.parse(parsed.data)

            switch (parsed.event) {
              case 'text':
                callbacks.onText?.(data as AgentTextEvent)
                break
              case 'tool:call':
                callbacks.onToolCall?.(data as AgentToolCallEvent)
                break
              case 'tool:result':
                callbacks.onToolResult?.(data as AgentToolResultEvent)
                break
              case 'complete':
                callbacks.onComplete?.(data as AgentCompleteEvent)
                break
              case 'error':
                callbacks.onError?.((data as { error: string }).error)
                break
            }
          }
        }
      },

      clear: async (sessionId: string): Promise<{ success: boolean }> => {
        try {
          return await fetchJSON('/api/agent/clear', {
            method: 'POST',
            body: JSON.stringify({ sessionId }),
          })
        } catch {
          return { success: false }
        }
      },

      deleteSession: async (sessionId: string): Promise<{ success: boolean }> => {
        try {
          await fetchJSON(`/api/agent/session/${encodeURIComponent(sessionId)}`, {
            method: 'DELETE',
          })
          return { success: true }
        } catch {
          return { success: false }
        }
      },
    },
  }
}
