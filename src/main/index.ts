import { app, BrowserWindow, shell, globalShortcut } from 'electron'
import path from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { getDb, closeDb } from './db'
import { registerIpcHandlers } from './ipc'
import { initAutoUpdater } from './updater'
import { createTray, destroyTray } from './tray'
import { showQuickCapture, registerQuickCaptureIpc } from './quickCapture'
import { startNotifications, stopNotifications } from './notifications'
import { buildAppMenu } from './menu'

let mainWindow: BrowserWindow | null = null
let isQuiting = false

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b1020',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow = win
  win.on('ready-to-show', () => win.show())
  // Closing the window hides it (kept alive in tray) unless we're truly quitting.
  win.on('close', (e) => {
    if (!isQuiting) {
      e.preventDefault()
      win.hide()
    }
  })
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.jfrankrobles.bloom')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  getDb()
  registerIpcHandlers()
  registerQuickCaptureIpc()
  createWindow()
  buildAppMenu(() => mainWindow)
  createTray(() => mainWindow)
  startNotifications(() => mainWindow)

  // Global shortcut for quick capture from any app.
  globalShortcut.register('CommandOrControl+Shift+N', () => showQuickCapture())

  if (!is.dev) {
    initAutoUpdater(() => mainWindow)
  }

  app.on('activate', () => {
    if (mainWindow) mainWindow.show()
    else if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  isQuiting = true
  stopNotifications()
  destroyTray()
  globalShortcut.unregisterAll()
  closeDb()
})

// Don't quit when the last window is closed: the tray keeps the app alive.
// On macOS this is also the standard behavior.
app.on('window-all-closed', () => {
  // intentionally do nothing — tray menu has 'Salir de Bloom' to quit.
})
