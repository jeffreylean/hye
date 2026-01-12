import { create } from 'zustand'

export interface MemoryNote {
  filepath: string
  title: string
  tags: string[]
  summary: string
  createdAt: string
}

export interface MemoryTreeEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: MemoryTreeEntry[]
}

export interface ExtractedItem {
  id: string
  title: string
  summary: string
  suggestedPath: string
  tags: string[]
  importance: 'high' | 'medium' | 'low'
  content: string
  selected: boolean
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

type MainTab = 'chat' | 'note'

interface MemoryState {
  isOpen: boolean
  tree: MemoryTreeEntry[]
  selectedNote: MemoryNote | null
  noteContent: string | null
  isLoading: boolean
  error: string | null
  activeTab: MainTab

  // Smart save state
  isSaveModalOpen: boolean
  extractedItems: ExtractedItem[]
  isAnalyzing: boolean
  isSaving: boolean
  analyzeError: string | null

  setOpen: (open: boolean) => void
  toggleOpen: () => void
  setTree: (tree: MemoryTreeEntry[]) => void
  setSelectedNote: (note: MemoryNote | null) => void
  setNoteContent: (content: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setActiveTab: (tab: MainTab) => void

  fetchTree: () => Promise<void>
  fetchNote: (filepath: string) => Promise<void>
  deleteNote: (filepath: string) => Promise<void>

  // Smart save actions
  openSaveModal: () => void
  closeSaveModal: () => void
  analyzeConversation: (conversationId: string, messages: ConversationMessage[]) => Promise<void>
  toggleItemSelection: (itemId: string) => void
  selectAllItems: () => void
  deselectAllItems: () => void
  saveSelectedItems: (conversationId: string) => Promise<void>
}

const API_BASE = 'http://localhost:9876'

export const useMemoryStore = create<MemoryState>()((set, get) => ({
  isOpen: true,
  tree: [],
  selectedNote: null,
  noteContent: null,
  isLoading: false,
  error: null,
  activeTab: 'chat' as MainTab,

  // Smart save state
  isSaveModalOpen: false,
  extractedItems: [],
  isAnalyzing: false,
  isSaving: false,
  analyzeError: null,

  setOpen: (open) => set({ isOpen: open }),
  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  setTree: (tree) => set({ tree }),
  setSelectedNote: (note) => set({ selectedNote: note }),
  setNoteContent: (content) => set({ noteContent: content }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  fetchTree: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/memory/tree`)
      if (!res.ok) throw new Error('Failed to fetch memory tree')
      const data = await res.json()
      set({ tree: data.tree, isLoading: false })
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
    }
  },

  fetchNote: async (filepath: string) => {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/memory/note/${encodeURIComponent(filepath)}`)
      if (!res.ok) throw new Error('Failed to fetch note')
      const data = await res.json()
      set({
        selectedNote: data.meta,
        noteContent: data.content,
        isLoading: false,
        activeTab: 'note',
      })
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
    }
  },

  deleteNote: async (filepath: string) => {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/memory/note/${encodeURIComponent(filepath)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete note')
      set({ selectedNote: null, noteContent: null, isLoading: false })
      get().fetchTree()
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
    }
  },

  // Smart save actions
  openSaveModal: () => set({ isSaveModalOpen: true }),
  closeSaveModal: () =>
    set({
      isSaveModalOpen: false,
      extractedItems: [],
      analyzeError: null,
    }),

  analyzeConversation: async (conversationId: string, messages: ConversationMessage[]) => {
    set({ isAnalyzing: true, analyzeError: null, extractedItems: [] })
    try {
      const res = await fetch(`${API_BASE}/memory/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, messages }),
      })
      if (!res.ok) throw new Error('Failed to analyze conversation')
      const data = await res.json()

      const items: ExtractedItem[] = (data.items || []).map(
        (item: Omit<ExtractedItem, 'selected'>) => ({
          ...item,
          selected: item.importance === 'high' || item.importance === 'medium',
        })
      )

      set({ extractedItems: items, isAnalyzing: false })
    } catch (err) {
      set({ analyzeError: (err as Error).message, isAnalyzing: false })
    }
  },

  toggleItemSelection: (itemId: string) => {
    set((state) => ({
      extractedItems: state.extractedItems.map((item) =>
        item.id === itemId ? { ...item, selected: !item.selected } : item
      ),
    }))
  },

  selectAllItems: () => {
    set((state) => ({
      extractedItems: state.extractedItems.map((item) => ({ ...item, selected: true })),
    }))
  },

  deselectAllItems: () => {
    set((state) => ({
      extractedItems: state.extractedItems.map((item) => ({ ...item, selected: false })),
    }))
  },

  saveSelectedItems: async (conversationId: string) => {
    const selectedItems = get().extractedItems.filter((item) => item.selected)
    if (selectedItems.length === 0) return

    set({ isSaving: true })
    try {
      const res = await fetch(`${API_BASE}/memory/batch-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          items: selectedItems.map((item) => ({
            title: item.title,
            summary: item.summary,
            content: item.content,
            suggestedPath: item.suggestedPath,
            tags: item.tags,
            importance: item.importance,
          })),
        }),
      })
      if (!res.ok) throw new Error('Failed to save notes')

      set({
        isSaving: false,
        isSaveModalOpen: false,
        extractedItems: [],
      })

      // Refresh the memory tree
      get().fetchTree()
    } catch (err) {
      set({ analyzeError: (err as Error).message, isSaving: false })
    }
  },
}))
