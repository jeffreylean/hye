import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { AppConfig, LLMProviderConfig, Theme } from '../../shared/types'
import { getApi } from '@/lib/api'

interface ConfigState extends AppConfig {
  isLoaded: boolean

  loadConfig: () => Promise<void>
  setTheme: (theme: Theme) => void
  setCurrentProvider: (config: LLMProviderConfig) => void
  saveProvider: (name: string, config: LLMProviderConfig) => void
  removeProvider: (name: string) => void
}

export const useConfigStore = create<ConfigState>()(
  subscribeWithSelector((set) => ({
    theme: 'system',
    currentProvider: null,
    savedProviders: {},
    isLoaded: false,

    loadConfig: async () => {
      try {
        const api = getApi()
        const config = await api.config.get()
        if (config) {
          set({
            theme: config.theme ?? 'system',
            currentProvider: config.currentProvider ?? null,
            savedProviders: config.savedProviders ?? {},
            isLoaded: true,
          })
        } else {
          set({ isLoaded: true })
        }
      } catch (error) {
        console.error('Failed to load config:', error)
        set({ isLoaded: true })
      }
    },

    setTheme: (theme) => {
      set({ theme })
      getApi().config.save({ theme })
    },

    setCurrentProvider: (config) => {
      set({ currentProvider: config })
      getApi().config.setCurrentProvider(config)
    },

    saveProvider: (name, config) => {
      set((state) => ({
        savedProviders: { ...state.savedProviders, [name]: config },
      }))
      getApi().config.saveProvider(name, config)
    },

    removeProvider: (name) => {
      set((state) => {
        const { [name]: _removed, ...rest } = state.savedProviders
        return { savedProviders: rest }
      })
      getApi().config.removeProvider(name)
    },
  }))
)

export type { LLMProviderConfig, Theme }
