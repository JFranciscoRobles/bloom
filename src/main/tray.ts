import { app, BrowserWindow, Menu, Tray, clipboard, nativeImage } from 'electron'
import path from 'node:path'
import { showQuickCapture } from './quickCapture'
import { runDueNotifications } from './notifications'

let tray: Tray | null = null

function trayIconPath(): string {
  // In production the build/ resources are extracted next to the executable;
  // in dev they live at the project root.
  const candidates = [
    path.join(process.resourcesPath ?? '', 'build', 'tray-icon.png'),
    path.join(app.getAppPath(), 'build', 'tray-icon.png'),
    path.join(app.getAppPath(), '..', 'build', 'tray-icon.png')
  ]
  for (const p of candidates) {
    try {
      const img = nativeImage.createFromPath(p)
      if (!img.isEmpty()) return p
    } catch {
      // try next
    }
  }
  return candidates[0]
}

export function createTray(getMainWindow: () => BrowserWindow | null): Tray {
  const icon = nativeImage.createFromPath(trayIconPath())
  // On macOS a smaller representation looks cleaner in the menu bar.
  if (process.platform === 'darwin') icon.setTemplateImage(false)

  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('Bloom 🌸')

  function showApp(): void {
    const win = getMainWindow()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }

  function captureFromClipboard(): void {
    const text = clipboard.readText().trim()
    showQuickCapture(text || undefined)
  }

  function rebuildMenu(): void {
    const clip = clipboard.readText().trim()
    const clipPreview =
      clip.length > 0 ? clip.slice(0, 40).replace(/\s+/g, ' ') + (clip.length > 40 ? '…' : '') : ''
    const menu = Menu.buildFromTemplate([
      { label: 'Abrir Bloom', click: showApp },
      { type: 'separator' },
      {
        label: 'Captura rápida…',
        accelerator: 'CommandOrControl+Shift+N',
        click: () => showQuickCapture()
      },
      {
        label: clipPreview ? `Capturar del portapapeles: "${clipPreview}"` : 'Portapapeles vacío',
        enabled: clipPreview.length > 0,
        click: captureFromClipboard
      },
      { type: 'separator' },
      {
        label: 'Revisar tareas próximas',
        click: () => runDueNotifications({ silentIfEmpty: false })
      },
      { type: 'separator' },
      { label: 'Salir de Bloom', role: 'quit' }
    ])
    tray!.setContextMenu(menu)
  }

  rebuildMenu()
  // Click left on the tray icon: on Windows opens the app, on Mac shows the menu.
  tray.on('click', () => {
    if (process.platform === 'darwin') tray!.popUpContextMenu()
    else showApp()
  })
  // Refresh the clipboard preview each time the user opens the menu.
  tray.on('right-click', rebuildMenu)
  tray.on('mouse-enter', rebuildMenu)

  return tray
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
