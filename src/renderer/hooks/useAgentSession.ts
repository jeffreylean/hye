import { useCallback, useRef } from 'react'
import { getApi } from '@/lib/api'
import { useChatStore } from '@/store/chatStore'
import { useMemoryStore } from '@/store/memoryStore'

export function useAgentSession() {
  const initializingRef = useRef<Set<string>>(new Set())

  const initSession = useCallback(async (chatId: string): Promise<string> => {
    const existingSessionId = useChatStore.getState().getAgentSessionId(chatId)
    if (existingSessionId) {
      return existingSessionId
    }

    if (initializingRef.current.has(chatId)) {
      // Wait for ongoing initialization
      await new Promise<void>(resolve => {
        const check = () => {
          if (!initializingRef.current.has(chatId)) {
            resolve()
          } else {
            setTimeout(check, 50)
          }
        }
        check()
      })
      return useChatStore.getState().getAgentSessionId(chatId) ?? chatId
    }

    initializingRef.current.add(chatId)

    try {
      const api = getApi()
      const result = await api.agent.init({ sessionId: chatId })

      if (result.success && result.sessionId) {
        useChatStore.getState().setAgentSessionId(chatId, result.sessionId)
        return result.sessionId
      }

      // Fallback: use chatId as sessionId
      useChatStore.getState().setAgentSessionId(chatId, chatId)
      return chatId
    } finally {
      initializingRef.current.delete(chatId)
    }
  }, [])

  const sendMessage = useCallback(async (chatId: string, message: string): Promise<void> => {
    const sessionId = await initSession(chatId)
    const api = getApi()
    const chatStore = useChatStore.getState()

    // Add empty assistant message for streaming (UI only, not persisted yet)
    chatStore.addStreamingMessage(chatId)

    await api.agent.chat(sessionId, message, {
      onText: (event) => {
        useChatStore.getState().appendToLastMessage(chatId, event.text)
      },
      onToolCall: (event) => {
        useChatStore.getState().addToolCall(chatId, {
          id: event.id,
          name: event.name,
          args: event.args,
        })
      },
      onToolResult: (event) => {
        useChatStore.getState().updateToolCallResult(chatId, event.id, event.result, event.isError)
        
        // Refresh memory tree when a memory tool completes successfully
        if (event.name === 'memory_save' && !event.isError) {
          useMemoryStore.getState().fetchTree()
        }
      },
      onComplete: (event) => {
        // Mark any still-running tools as errored
        useChatStore.getState().markRunningToolsAsError(chatId)
        if (!event.success && event.error) {
          useChatStore.getState().appendToLastMessage(chatId, `\n\nError: ${event.error}`)
        }
        // Persist the final message to the database
        useChatStore.getState().finalizeStreamingMessage(chatId)
      },
      onError: (error) => {
        // Mark any still-running tools as errored
        useChatStore.getState().markRunningToolsAsError(chatId)
        useChatStore.getState().appendToLastMessage(chatId, `\n\nError: ${error}`)
        // Persist the error message to the database
        useChatStore.getState().finalizeStreamingMessage(chatId)
      },
    })
  }, [initSession])

  const clearSession = useCallback(async (chatId: string): Promise<void> => {
    const sessionId = useChatStore.getState().getAgentSessionId(chatId)
    if (sessionId) {
      const api = getApi()
      await api.agent.clear(sessionId)
    }
  }, [])

  const deleteSession = useCallback(async (chatId: string): Promise<void> => {
    const sessionId = useChatStore.getState().getAgentSessionId(chatId)
    if (sessionId) {
      const api = getApi()
      await api.agent.deleteSession(sessionId)
    }
  }, [])

  return {
    initSession,
    sendMessage,
    clearSession,
    deleteSession,
  }
}
