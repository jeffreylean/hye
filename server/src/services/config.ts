import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import type { AppConfig, LLMProviderConfig } from '../lib/types.js'
import { DATA_DIR, CONFIG_PATH } from '../lib/paths.js'

const DEFAULT_CONFIG: AppConfig = {
  theme: 'system',
  currentProvider: null,
  savedProviders: {}
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

function loadConfig(): AppConfig {
  ensureDataDir()
  if (!existsSync(CONFIG_PATH)) {
    return { ...DEFAULT_CONFIG }
  }
  try {
    const data = readFileSync(CONFIG_PATH, 'utf-8')
    return { ...DEFAULT_CONFIG, ...JSON.parse(data) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

function saveConfigToFile(config: AppConfig): void {
  ensureDataDir()
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}

export const ConfigService = {
  getConfig(): AppConfig {
    return loadConfig()
  },

  saveConfig(partial: Partial<AppConfig>): void {
    const current = loadConfig()
    const updated = { ...current, ...partial }
    saveConfigToFile(updated)
  },

  getCurrentProvider(): LLMProviderConfig | null {
    return loadConfig().currentProvider
  },

  setCurrentProvider(provider: LLMProviderConfig | null): void {
    const config = loadConfig()
    config.currentProvider = provider
    saveConfigToFile(config)
  },

  getSavedProviders(): Record<string, LLMProviderConfig> {
    return loadConfig().savedProviders
  },

  saveProvider(name: string, providerConfig: LLMProviderConfig): void {
    const config = loadConfig()
    config.savedProviders = { ...config.savedProviders, [name]: providerConfig }
    saveConfigToFile(config)
  },

  removeProvider(name: string): void {
    const config = loadConfig()
    const { [name]: _, ...rest } = config.savedProviders
    config.savedProviders = rest
    saveConfigToFile(config)
  },

  getStorePath(): string {
    return CONFIG_PATH
  }
}
