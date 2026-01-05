import Store from 'electron-store'

interface LLMProviderConfig {
  type: 'custom' | 'anthropic'
  apiKey: string
  baseUrl?: string
  model?: string
}

interface AppConfig {
  // UI Settings
  sidebarCollapsed: boolean
  currentView: 'chat' | 'settings'
  theme: 'light' | 'dark' | 'system'
  
  // Provider Settings
  currentProvider: LLMProviderConfig | null
  savedProviders: Record<string, LLMProviderConfig>
}

// Initialize store with encryption for API keys
const store = new Store<AppConfig>({
  name: 'hye-config',
  encryptionKey: 'hye-secret-key',
  defaults: {
    sidebarCollapsed: false,
    currentView: 'chat',
    theme: 'system',
    currentProvider: null,
    savedProviders: {}
  }
})

export class ConfigStorage {
  // Get entire config
  static getConfig(): AppConfig {
    return {
      sidebarCollapsed: store.get('sidebarCollapsed'),
      currentView: store.get('currentView'),
      theme: store.get('theme'),
      currentProvider: store.get('currentProvider'),
      savedProviders: store.get('savedProviders')
    }
  }

  // Save entire config
  static saveConfig(config: Partial<AppConfig>): void {
    Object.entries(config).forEach(([key, value]) => {
      if (value !== undefined) {
        store.set(key as keyof AppConfig, value)
      }
    })
  }

  // Provider-specific methods
  static getCurrentProvider(): LLMProviderConfig | null {
    return store.get('currentProvider')
  }

  static setCurrentProvider(provider: LLMProviderConfig | null): void {
    store.set('currentProvider', provider)
  }

  static getSavedProviders(): Record<string, LLMProviderConfig> {
    return store.get('savedProviders')
  }

  static saveProvider(name: string, config: LLMProviderConfig): void {
    const providers = store.get('savedProviders')
    store.set('savedProviders', { ...providers, [name]: config })
  }

  static removeProvider(name: string): void {
    const providers = store.get('savedProviders')
    const { [name]: removed, ...rest } = providers
    store.set('savedProviders', rest)
  }

  // UI-specific methods
  static setSidebarCollapsed(collapsed: boolean): void {
    store.set('sidebarCollapsed', collapsed)
  }

  static setTheme(theme: 'light' | 'dark' | 'system'): void {
    store.set('theme', theme)
  }

  static setCurrentView(view: 'chat' | 'settings'): void {
    store.set('currentView', view)
  }

  // Clear all data (for reset/debugging)
  static clear(): void {
    store.clear()
  }

  // Get storage file path (for debugging)
  static getStorePath(): string {
    return store.path
  }
}
