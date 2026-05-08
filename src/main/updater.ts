import { BrowserWindow, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'

/**
 * Wires up auto-update against the GitHub release configured in
 * package.json#build.publish. Behavior: ask before downloading,
 * ask before restarting to install. Silently skips in dev (no app.asar).
 */
export function initAutoUpdater(getMainWindow: () => BrowserWindow | null): void {
  // electron-updater logs to its own electron-log instance; keep it informative.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err?.message ?? err)
  })

  autoUpdater.on('update-available', async (info) => {
    const win = getMainWindow()
    const choice = await dialog.showMessageBox(win ?? undefined!, {
      type: 'info',
      title: 'Actualización disponible',
      message: `Hay una nueva versión de Bloom: ${info.version}`,
      detail:
        '¿Quieres descargarla ahora? Podrás seguir usando la app mientras se descarga en segundo plano.',
      buttons: ['Más tarde', 'Descargar'],
      defaultId: 1,
      cancelId: 0
    })
    if (choice.response === 1) {
      autoUpdater.downloadUpdate().catch((e) => {
        console.error('[updater] downloadUpdate failed:', e?.message ?? e)
      })
    }
  })

  autoUpdater.on('update-not-available', () => {
    // No-op in production; users don't need a 'You're up to date' dialog on every launch.
  })

  autoUpdater.on('update-downloaded', async (info) => {
    const win = getMainWindow()
    const choice = await dialog.showMessageBox(win ?? undefined!, {
      type: 'info',
      title: 'Actualización lista',
      message: `Bloom ${info.version} está lista para instalarse`,
      detail: 'La app se cerrará y se reabrirá con la nueva versión.',
      buttons: ['Después', 'Reiniciar e instalar'],
      defaultId: 1,
      cancelId: 0
    })
    if (choice.response === 1) {
      // isSilent=true so NSIS doesn't show its UI; isForceRunAfter relaunches the new app.
      autoUpdater.quitAndInstall(true, true)
    }
  })

  // Kick off check after a short delay to let the window settle.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((e) => {
      console.error('[updater] checkForUpdates failed:', e?.message ?? e)
    })
  }, 4000)
}
