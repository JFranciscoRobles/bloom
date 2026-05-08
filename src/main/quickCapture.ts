import { BrowserWindow, screen, ipcMain } from 'electron'
import { inboxRepo } from './db/repos'

let win: BrowserWindow | null = null

const HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; font-family: ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif; }
  body {
    background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 50%, #f5d0fe 100%);
    color: #3d2e5c;
    -webkit-app-region: drag;
    user-select: none;
    border-radius: 14px;
    overflow: hidden;
  }
  .frame {
    height: 100%;
    padding: 14px 14px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .row { display: flex; align-items: center; gap: 8px; }
  .title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #7a6aa0;
  }
  .hint { font-size: 10px; color: #9d8fbf; margin-left: auto; }
  input {
    -webkit-app-region: no-drag;
    user-select: text;
    width: 100%;
    border: 1px solid rgba(196,181,253,0.5);
    background: rgba(255,255,255,0.85);
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 14px;
    color: #3d2e5c;
    outline: none;
  }
  input:focus { border-color: #c4b5fd; box-shadow: 0 0 0 3px rgba(196,181,253,0.25); }
  .actions {
    -webkit-app-region: no-drag;
    display: flex;
    gap: 6px;
    justify-content: space-between;
    align-items: center;
  }
  button {
    border: 1px solid rgba(196,181,253,0.5);
    background: rgba(255,255,255,0.85);
    color: #3d2e5c;
    border-radius: 999px;
    padding: 5px 11px;
    font-size: 11px;
    cursor: pointer;
    font-weight: 500;
  }
  button:hover { background: white; }
  button.primary { background: #c4b5fd; border-color: #c4b5fd; color: #3d2e5c; font-weight: 600; }
  button.primary:hover { background: #a78bfa; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .status { font-size: 11px; color: #7a6aa0; margin-left: 4px; flex: 1; }
  .status.success { color: #16a34a; }
</style>
</head>
<body>
  <div class="frame">
    <div class="row">
      <span class="title">🌸 Captura rápida</span>
      <span class="hint">Inbox · ⏎ guardar · esc cerrar</span>
    </div>
    <input id="i" autofocus placeholder="¿Qué hay que hacer?" />
    <div class="actions">
      <span class="status" id="status"></span>
      <button id="paste">Pegar</button>
      <button id="save" class="primary">Guardar</button>
    </div>
  </div>
<script>
  const { ipcRenderer, clipboard } = require('electron')
  const input = document.getElementById('i')
  const status = document.getElementById('status')
  const save = document.getElementById('save')
  const paste = document.getElementById('paste')

  function close() { ipcRenderer.send('qc:close') }

  async function submit() {
    const v = input.value.trim()
    if (!v) return
    save.disabled = true
    try {
      await ipcRenderer.invoke('qc:capture', v)
      status.textContent = '✓ Guardada en Inbox'
      status.className = 'status success'
      input.value = ''
      setTimeout(() => { status.textContent = ''; status.className = 'status' }, 1500)
    } catch (e) {
      status.textContent = 'Error: ' + (e.message || e)
    } finally {
      save.disabled = false
      input.focus()
    }
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submit() }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
  })
  save.addEventListener('click', submit)
  paste.addEventListener('click', () => {
    const text = clipboard.readText()
    if (text) input.value = (input.value + ' ' + text).trim()
    input.focus()
  })

  ipcRenderer.on('qc:focus', () => {
    input.value = ''
    status.textContent = ''
    status.className = 'status'
    input.focus()
  })
  ipcRenderer.on('qc:prefill', (_e, text) => {
    input.value = text
    input.focus()
    input.select()
  })
</script>
</body>
</html>`

export function createQuickCaptureWindow(): BrowserWindow {
  if (win && !win.isDestroyed()) return win

  const display = screen.getPrimaryDisplay()
  const { width } = display.workAreaSize
  win = new BrowserWindow({
    width: 480,
    height: 150,
    x: Math.round(width / 2 - 240),
    y: 120,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      // The HTML is fully under our control (data URL, no remote content),
      // so node integration here is safe and avoids a separate preload bundle.
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(HTML))

  win.on('blur', () => {
    if (win && !win.isDestroyed()) win.hide()
  })
  win.on('closed', () => {
    win = null
  })

  return win
}

export function showQuickCapture(prefill?: string): void {
  const w = createQuickCaptureWindow()
  if (!w.isVisible()) {
    w.show()
    w.focus()
  } else {
    w.focus()
  }
  // Fire after the window is ready in case it's the first time.
  if (w.webContents.isLoading()) {
    w.webContents.once('did-finish-load', () => emit(w, prefill))
  } else {
    emit(w, prefill)
  }
}

function emit(w: BrowserWindow, prefill?: string): void {
  if (prefill) w.webContents.send('qc:prefill', prefill)
  else w.webContents.send('qc:focus')
}

export function registerQuickCaptureIpc(): void {
  ipcMain.handle('qc:capture', (_e, title: string) => {
    return inboxRepo.capture(title)
  })
  ipcMain.on('qc:close', () => {
    if (win && !win.isDestroyed()) win.hide()
  })
}
