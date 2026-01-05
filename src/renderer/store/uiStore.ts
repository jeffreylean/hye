import { create } from 'zustand'

interface UIState {
  sidebarCollapsed: boolean
  currentView: 'chat' | 'settings'

  setSidebarCollapsed: (collapsed: boolean) => void
  setCurrentView: (view: UIState['currentView']) => void
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarCollapsed: false,
  currentView: 'chat',

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setCurrentView: (view) => set({ currentView: view }),
}))
