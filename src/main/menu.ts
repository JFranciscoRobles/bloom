import { app, BrowserWindow, Menu, MenuItemConstructorOptions, shell } from 'electron'
import { showQuickCapture } from './quickCapture'

/**
 * Builds the native application menu. Items that need renderer cooperation
 * (navigate, open palette, open new-board modal) send a `menu:<action>` event
 * via the main window's webContents; the renderer listens for these in
 * `lib/menuChannel.ts`.
 */
export function buildAppMenu(getMainWindow: () => BrowserWindow | null): void {
  const isMac = process.platform === 'darwin'

  function send(action: string): void {
    const win = getMainWindow()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
    win.webContents.send('menu:action', action)
  }

  const fileMenu: MenuItemConstructorOptions = {
    label: 'Archivo',
    submenu: [
      {
        label: 'Captura rápida…',
        accelerator: 'CommandOrControl+Shift+N',
        click: () => showQuickCapture()
      },
      {
        label: 'Nuevo tablero…',
        accelerator: 'CommandOrControl+Shift+B',
        click: () => send('new-board')
      },
      { type: 'separator' },
      {
        label: 'Buscar…',
        accelerator: 'CommandOrControl+K',
        click: () => send('open-search')
      },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' }
    ]
  }

  const viewMenu: MenuItemConstructorOptions = {
    label: 'Ver',
    submenu: [
      {
        label: 'Inicio',
        accelerator: 'CommandOrControl+1',
        click: () => send('go-home')
      },
      {
        label: 'Kanban',
        accelerator: 'CommandOrControl+2',
        click: () => send('go-kanban')
      },
      {
        label: 'Gantt',
        accelerator: 'CommandOrControl+3',
        click: () => send('go-gantt')
      },
      {
        label: 'Finanzas',
        accelerator: 'CommandOrControl+4',
        click: () => send('go-finances')
      },
      { type: 'separator' },
      { role: 'reload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  }

  const editMenu: MenuItemConstructorOptions = {
    label: 'Edición',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      ...(isMac
        ? ([{ role: 'pasteAndMatchStyle' }, { role: 'delete' }, { role: 'selectAll' }] as const)
        : ([{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }] as const))
    ] as MenuItemConstructorOptions[]
  }

  const dataMenu: MenuItemConstructorOptions = {
    label: 'Datos',
    submenu: [
      { label: 'Respaldar (.db)…', click: () => send('export-db') },
      { label: 'Exportar Excel…', click: () => send('export-excel') },
      { type: 'separator' },
      { label: 'Restaurar (.db)…', click: () => send('import-db') },
      { label: 'Importar Excel…', click: () => send('import-excel') }
    ]
  }

  const helpMenu: MenuItemConstructorOptions = {
    role: 'help',
    submenu: [
      {
        label: 'Sitio del autor',
        click: () => shell.openExternal('https://www.jfrankrobles.com/')
      },
      {
        label: 'Repositorio en GitHub',
        click: () => shell.openExternal('https://github.com/JFranciscoRobles/bloom')
      }
    ]
  }

  const macAppMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  }

  const windowMenu: MenuItemConstructorOptions = {
    label: 'Ventana',
    submenu: isMac
      ? [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'front' }
        ]
      : [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }]
  }

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [macAppMenu] : []),
    fileMenu,
    editMenu,
    viewMenu,
    dataMenu,
    windowMenu,
    helpMenu
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
