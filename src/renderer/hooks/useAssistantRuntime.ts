import { useCallback, useMemo } from 'react'
import { 
  useExternalStoreRuntime, 
  type ThreadMessageLike,
  type AppendMessage 
} from '@assistant-ui/react'
import { useConfigStore } from '@/store/configStore'
import { useChatStore, type Message } from '@/store/chatStore'
import { getApi } from '@/lib/api'

export function useAssistantRuntime() {
  const { chats, currentChatId, createChat, addMessage, updateLastMessage } = useChatStore()
  
  const currentChat = chats.find(c => c.id === currentChatId)
  
  const messages: ThreadMessageLike[] = useMemo(() => {
    if (!currentChat) return []
    return currentChat.messages.map((msg: Message) => ({
      role: msg.role,
      content: [{ type: 'text' as const, text: msg.content }],
    }))
  }, [currentChat])

  const isRunning = useMemo(() => {
    if (!currentChat || currentChat.messages.length === 0) return false
    const lastMessage = currentChat.messages[currentChat.messages.length - 1]
    return lastMessage?.role === 'assistant' && lastMessage?.content === ''
  }, [currentChat])

  const convertMessage = useCallback((msg: ThreadMessageLike): ThreadMessageLike => msg, [])

  const onNew = useCallback(async (message: AppendMessage): Promise<void> => {
    const { currentProvider } = useConfigStore.getState()
    const chatStore = useChatStore.getState()
    
    const textContent = message.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') return

    let chatId = chatStore.currentChatId
    if (!chatId) {
      chatId = chatStore.createChat()
    }

    chatStore.addMessage(chatId, { role: 'user', content: textContent.text })

    if (!currentProvider) {
      chatStore.addMessage(chatId, { 
        role: 'assistant', 
        content: 'Please configure an AI provider in Settings first.' 
      })
      return
    }

    chatStore.addMessage(chatId, { role: 'assistant', content: '' })

    let streamContent = ''
    const api = getApi()

    try {
      const result = await api.llm.stream(
        [{ role: 'user', content: textContent.text }],
        {
          provider: currentProvider.type,
          apiKey: currentProvider.apiKey,
          baseUrl: currentProvider.baseUrl,
          model: currentProvider.model,
        },
        (chunk: string) => {
          streamContent += chunk
          useChatStore.getState().updateLastMessage(chatId!, streamContent)
        }
      )

      if (!result?.success) {
        useChatStore.getState().updateLastMessage(
          chatId!, 
          `Error: ${result?.error || 'Unknown error'}`
        )
      }
    } catch (error) {
      useChatStore.getState().updateLastMessage(
        chatId!, 
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }, [])

  return useExternalStoreRuntime({
    messages,
    isRunning,
    convertMessage,
    onNew,
  })
}
