import { create } from 'zustand'
import { getApi } from '@/lib/api'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface Chat {
  id: string
  title: string
  messages: Message[]
  createdAt: number
}

interface ChatState {
  chats: Chat[]
  currentChatId: string | null
  isLoaded: boolean

  loadChats: () => Promise<void>
  createChat: () => string
  deleteChat: (id: string) => void
  setCurrentChat: (id: string) => void
  addMessage: (chatId: string, message: Message) => void
  updateLastMessage: (chatId: string, content: string) => void
  updateChatTitle: (chatId: string, title: string) => void
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
    const chats = await api.db.getAllChats()
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
    getApi().db.addMessage(chatId, message.role, message.content)
    
    set(state => ({
      chats: state.chats.map(chat => {
        if (chat.id !== chatId) return chat
        const newMessages = [...chat.messages, message]
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
}))
