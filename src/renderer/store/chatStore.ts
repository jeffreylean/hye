import { create } from 'zustand'
import { getApi } from '@/lib/api'

export interface ToolCall {
  id: string
  name: string
  args: unknown
  result?: unknown
  status: 'running' | 'complete' | 'error'
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
  reasoning?: string
}

export interface Chat {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  agentSessionId?: string
}

interface ChatState {
  chats: Chat[]
  currentChatId: string | null
  isLoaded: boolean

  loadChats: () => Promise<void>
  createChat: () => string
  deleteChat: (id: string) => void
  setCurrentChat: (id: string) => void
  addMessage: (chatId: string, message: Omit<Message, 'id'> & { id?: string }) => void
  updateLastMessage: (chatId: string, content: string) => void
  updateChatTitle: (chatId: string, title: string) => void
  setAgentSessionId: (chatId: string, sessionId: string) => void
  getAgentSessionId: (chatId: string) => string | undefined
  addToolCall: (chatId: string, toolCall: Omit<ToolCall, 'status'>) => void
  updateToolCallResult: (chatId: string, toolCallId: string, result: unknown, isError?: boolean) => void
  markRunningToolsAsError: (chatId: string) => void
  appendToLastMessage: (chatId: string, text: string) => void
  addStreamingMessage: (chatId: string) => void
  finalizeStreamingMessage: (chatId: string) => void
}

const generateId = () => crypto.randomUUID()

const generateTitle = (messages: Message[]) => {
  const firstUserMessage = messages.find(m => m.role === 'user')
  if (firstUserMessage) {
    return firstUserMessage.content.slice(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '')
  }
  return 'New Chat'
}

export const useChatStore = create<ChatState>()((set, get) => ({
  chats: [],
  currentChatId: null,
  isLoaded: false,

  loadChats: async () => {
    const api = getApi()
    const rawChats = await api.db.getAllChats()
    const chats: Chat[] = rawChats.map(chat => ({
      ...chat,
      messages: chat.messages.map(msg => ({
        ...msg,
        id: msg.id ? String(msg.id) : generateId(),
      })),
    }))
    set({ 
      chats, 
      isLoaded: true,
      currentChatId: chats.length > 0 ? chats[0]?.id ?? null : null,
    })
  },

  createChat: () => {
    const id = generateId()
    const title = 'New Chat'
    const newChat: Chat = {
      id,
      title,
      messages: [],
      createdAt: Date.now(),
    }
    
    getApi().db.createChat(id, title)
    
    set(state => ({
      chats: [newChat, ...state.chats],
      currentChatId: id,
    }))
    return id
  },

  deleteChat: (id) => {
    getApi().db.deleteChat(id)
    
    set(state => {
      const newChats = state.chats.filter(c => c.id !== id)
      let newCurrentId = state.currentChatId
      
      if (state.currentChatId === id) {
        newCurrentId = newChats.length > 0 ? newChats[0]?.id ?? null : null
      }
      
      return {
        chats: newChats,
        currentChatId: newCurrentId,
      }
    })
  },

  setCurrentChat: (id) => {
    set({ currentChatId: id })
  },

  addMessage: (chatId, message) => {
    const messageWithId = { ...message, id: message.id || generateId() }
    getApi().db.addMessage(chatId, messageWithId.role, messageWithId.content)
    
    set(state => ({
      chats: state.chats.map(chat => {
        if (chat.id !== chatId) return chat
        const newMessages = [...chat.messages, messageWithId]
        const newTitle = chat.title === 'New Chat' ? generateTitle(newMessages) : chat.title
        
        if (newTitle !== chat.title) {
          getApi().db.updateChatTitle(chatId, newTitle)
        }
        
        return {
          ...chat,
          messages: newMessages,
          title: newTitle,
        }
      }),
    }))
  },

  updateLastMessage: (chatId, content) => {
    getApi().db.updateLastMessage(chatId, content)
    
    set(state => ({
      chats: state.chats.map(chat => {
        if (chat.id !== chatId) return chat
        const messages = [...chat.messages]
        const lastMessage = messages[messages.length - 1]
        if (messages.length > 0 && lastMessage) {
          messages[messages.length - 1] = { ...lastMessage, content }
        }
        return { ...chat, messages }
      }),
    }))
  },

  updateChatTitle: (chatId, title) => {
    getApi().db.updateChatTitle(chatId, title)
    
    set(state => ({
      chats: state.chats.map(chat =>
        chat.id === chatId ? { ...chat, title } : chat
      ),
    }))
  },

  setAgentSessionId: (chatId, sessionId) => {
    set(state => ({
      chats: state.chats.map(chat =>
        chat.id === chatId ? { ...chat, agentSessionId: sessionId } : chat
      ),
    }))
  },

  getAgentSessionId: (chatId) => {
    return get().chats.find(c => c.id === chatId)?.agentSessionId
  },

  addToolCall: (chatId, toolCall) => {
    set(state => ({
      chats: state.chats.map(chat => {
        if (chat.id !== chatId) return chat
        const messages = [...chat.messages]
        const lastMessage = messages[messages.length - 1]
        if (lastMessage?.role === 'assistant') {
          const existingToolCalls = lastMessage.toolCalls ?? []
          messages[messages.length - 1] = {
            ...lastMessage,
            toolCalls: [...existingToolCalls, { ...toolCall, status: 'running' as const }],
          }
        }
        return { ...chat, messages }
      }),
    }))
  },

  updateToolCallResult: (chatId, toolCallId, result, isError) => {
    set(state => ({
      chats: state.chats.map(chat => {
        if (chat.id !== chatId) return chat
        const messages = [...chat.messages]
        const lastMessage = messages[messages.length - 1]
        if (lastMessage?.role === 'assistant' && lastMessage.toolCalls) {
          messages[messages.length - 1] = {
            ...lastMessage,
            toolCalls: lastMessage.toolCalls.map(tc =>
              tc.id === toolCallId 
                ? { ...tc, result, status: isError ? 'error' as const : 'complete' as const } 
                : tc
            ),
          }
        }
        return { ...chat, messages }
      }),
    }))
  },

  markRunningToolsAsError: (chatId) => {
    set(state => ({
      chats: state.chats.map(chat => {
        if (chat.id !== chatId) return chat
        const messages = [...chat.messages]
        const lastMessage = messages[messages.length - 1]
        if (lastMessage?.role === 'assistant' && lastMessage.toolCalls) {
          messages[messages.length - 1] = {
            ...lastMessage,
            toolCalls: lastMessage.toolCalls.map(tc =>
              tc.status === 'running' 
                ? { ...tc, status: 'error' as const, result: 'Tool execution failed' } 
                : tc
            ),
          }
        }
        return { ...chat, messages }
      }),
    }))
  },

  appendToLastMessage: (chatId, text) => {
    set(state => ({
      chats: state.chats.map(chat => {
        if (chat.id !== chatId) return chat
        const messages = [...chat.messages]
        const lastMessage = messages[messages.length - 1]
        if (lastMessage?.role === 'assistant') {
          messages[messages.length - 1] = {
            ...lastMessage,
            content: lastMessage.content + text,
          }
        }
        return { ...chat, messages }
      }),
    }))
  },

  // Add empty assistant message for streaming (UI only, not persisted)
  addStreamingMessage: (chatId) => {
    set(state => ({
      chats: state.chats.map(chat => {
        if (chat.id !== chatId) return chat
        return {
          ...chat,
          messages: [...chat.messages, { id: generateId(), role: 'assistant' as const, content: '' }],
        }
      }),
    }))
  },

  // Persist the final assistant message to the database
  finalizeStreamingMessage: (chatId) => {
    const chat = get().chats.find(c => c.id === chatId)
    if (!chat) return

    const lastMessage = chat.messages[chat.messages.length - 1]
    if (lastMessage?.role === 'assistant' && lastMessage.content) {
      getApi().db.addMessage(chatId, 'assistant', lastMessage.content)
    }
  },
}))
