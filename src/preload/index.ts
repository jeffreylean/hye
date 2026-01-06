import { contextBridge, ipcRenderer, shell } from 'electron'

export interface NativeApi {
  openExternal: (url: string) => Promise<void>
  showOpenDialog: (options?: Electron.OpenDialogOptions) => Promise<string[]>
  showSaveDialog: (options?: Electron.SaveDialogOptions) => Promise<string | undefined>
  getAppVersion: () => Promise<string>
  getAppPath: (name: 'home' | 'appData' | 'userData' | 'documents' | 'downloads') => Promise<string>
  platform: NodeJS.Platform
}

const api: NativeApi = {
  openExternal: (url: string) => shell.openExternal(url),
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:open', options),
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:save', options),
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getAppPath: (name) => ipcRenderer.invoke('app:path', name),
  platform: process.platform,
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (error) {
    console.error(error)
  }
} else {
  (window as unknown as { electronAPI: NativeApi }).electronAPI = api
}
