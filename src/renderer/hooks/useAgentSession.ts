import { useCallback, useEffect, useRef } from 'react'
import { getApi } from '@/lib/api'
import { useChatStore } from '@/store/chatStore'

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

    // Add empty assistant message for streaming
    chatStore.addMessage(chatId, { role: 'assistant', content: '' })

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
        useChatStore.getState().updateToolCallResult(chatId, event.id, event.result)
      },
      onComplete: (event) => {
        if (!event.success && event.error) {
          useChatStore.getState().appendToLastMessage(chatId, `\n\nError: ${event.error}`)
        }
      },
      onError: (error) => {
        useChatStore.getState().appendToLastMessage(chatId, `\n\nError: ${error}`)
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
