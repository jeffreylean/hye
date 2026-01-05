import type { IpcApi } from '../../preload/index'

declare global {
  interface Window {
    electronAPI: IpcApi
  }
}

export {}
