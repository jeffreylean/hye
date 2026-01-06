import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'

const isDev = process.env.NODE_ENV === 'development'

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: !isDev,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    if (isDev) {
      mainWindow.webContents.openDevTools()
    }
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Native dialog handlers
ipcMain.handle('dialog:open', async (_event, options?: Electron.OpenDialogOptions) => {
  const result = await dialog.showOpenDialog(options ?? {})
  return result.filePaths
})

ipcMain.handle('dialog:save', async (_event, options?: Electron.SaveDialogOptions) => {
  const result = await dialog.showSaveDialog(options ?? {})
  return result.filePath
})

// App info handlers
ipcMain.handle('app:version', () => {
  return app.getVersion()
})

ipcMain.handle('app:path', (_event, name: 'home' | 'appData' | 'userData' | 'documents' | 'downloads') => {
  return app.getPath(name)
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
