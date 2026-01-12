import { homedir, platform } from 'os'
import { join } from 'path'

const APP_NAME = 'hye'

function getDefaultDataDir(): string {
  const home = homedir()
  
  switch (platform()) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', APP_NAME)
    case 'win32':
      return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), APP_NAME)
    default:
      return join(process.env.XDG_DATA_HOME || join(home, '.local', 'share'), APP_NAME)
  }
}

export const DATA_DIR = process.env.HYE_DATA_DIR || getDefaultDataDir()
export const DB_PATH = join(DATA_DIR, 'hye.db')
export const MEMORY_DB_PATH = join(DATA_DIR, 'memory.db')  // Separate DB for AgentFS
export const CONFIG_PATH = join(DATA_DIR, 'config.json')
