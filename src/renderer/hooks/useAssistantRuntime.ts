import { useCallback, useMemo } from 'react'
import {
  useExternalStoreRuntime,
  type ThreadMessageLike,
  type AppendMessage,
} from '@assistant-ui/react'
import { useConfigStore } from '@/store/configStore'
import { useChatStore, type Message, type ToolCall } from '@/store/chatStore'
import { useAgentSession } from './useAgentSession'

type ToolCallStatus = 
  | { type: 'running' }
  | { type: 'complete' }
  | { type: 'incomplete'; reason: 'cancelled' | 'error'; error?: unknown }

function mapToolCallStatus(status: ToolCall['status']): ToolCallStatus {
  switch (status) {
    case 'running':
      return { type: 'running' }
    case 'complete':
      return { type: 'complete' }
    case 'error':
      return { type: 'incomplete', reason: 'error' }
    default:
      return { type: 'complete' }
  }
}

function convertToolCallToMessagePart(toolCall: ToolCall) {
  return {
    type: 'tool-call' as const,
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    argsText: JSON.stringify(toolCall.args, null, 2),
    result: toolCall.result,
    status: mapToolCallStatus(toolCall.status),
  }
}

export function useAssistantRuntime() {
  const { chats, currentChatId, createChat, addMessage } = useChatStore()
  const { sendMessage } = useAgentSession()

  const currentChat = chats.find((c) => c.id === currentChatId)

  const messages: ThreadMessageLike[] = useMemo(() => {
    if (!currentChat) return []
    return currentChat.messages.map((msg: Message) => {
      const parts: Array<{ type: 'text'; text: string } | ReturnType<typeof convertToolCallToMessagePart>> = []

      // Add text content if present
      if (msg.content) {
        parts.push({ type: 'text' as const, text: msg.content })
      }

      // Add tool calls if present
      if (msg.toolCalls?.length) {
        for (const tc of msg.toolCalls) {
          parts.push(convertToolCallToMessagePart(tc))
        }
      }

      return {
        role: msg.role,
        content: parts.length > 0 ? parts : [{ type: 'text' as const, text: '' }],
      }
    })
  }, [currentChat])

  const isRunning = useMemo(() => {
    if (!currentChat || currentChat.messages.length === 0) return false
    const lastMessage = currentChat.messages[currentChat.messages.length - 1]
    if (lastMessage?.role !== 'assistant') return false

    // Running if content is empty or any tool call is still running
    if (lastMessage.content === '' && !lastMessage.toolCalls?.length) return true
    if (lastMessage.toolCalls?.some((tc) => tc.status === 'running')) return true

    return false
  }, [currentChat])

  const convertMessage = useCallback(
    (msg: ThreadMessageLike): ThreadMessageLike => msg,
    []
  )

  const onNew = useCallback(
    async (message: AppendMessage): Promise<void> => {
      const { currentProvider } = useConfigStore.getState()
      const chatStore = useChatStore.getState()

      const textContent = message.content.find((c) => c.type === 'text')
      if (!textContent || textContent.type !== 'text') return

      let chatId = chatStore.currentChatId
      if (!chatId) {
        chatId = chatStore.createChat()
      }

      chatStore.addMessage(chatId, { role: 'user', content: textContent.text })

      if (!currentProvider) {
        chatStore.addMessage(chatId, {
          role: 'assistant',
          content: 'Please configure an AI provider in Settings first.',
        })
        return
      }

      try {
        await sendMessage(chatId, textContent.text)
      } catch (error) {
        chatStore.addMessage(chatId, {
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
      }
    },
    [sendMessage]
  )

  return useExternalStoreRuntime({
    messages,
    isRunning,
    convertMessage,
    onNew,
  })
}
