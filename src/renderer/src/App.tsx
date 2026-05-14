import { useEffect, useRef, useState } from 'react'
import {
  HomeIcon,
  KanbanIcon,
  WalletIcon,
  DownloadIcon,
  UploadIcon,
  FileSpreadsheetIcon,
  GanttChartIcon,
  DatabaseIcon,
  ChevronDownIcon,
  FlowerIcon,
  SearchIcon
} from 'lucide-react'
import HomePage from './pages/HomePage'
import KanbanPage from './pages/KanbanPage'
import FinancesPage from './pages/FinancesPage'
import GanttPage from './pages/GanttPage'
import CommandPalette from './components/CommandPalette'
import ConfirmModalRoot from './components/ConfirmModalRoot'
import { useNavStore } from './lib/navStore'
import { notify } from './lib/confirm'

export default function App(): JSX.Element {
  const tab = useNavStore((s) => s.tab)
  const setTab = useNavStore((s) => s.setTab)
  const activeBoardId = useNavStore((s) => s.activeBoardId)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const isMac = navigator.platform.toLowerCase().includes('mac')
      const cmdK = (isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k'
      if (cmdK) {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Listen to native-menu actions and route them to the right place.
  useEffect(() => {
    return window.api.menu.onAction(async (action) => {
      switch (action) {
        case 'go-home':
          setTab('home')
          break
        case 'go-kanban':
          if (activeBoardId) setTab('kanban')
          break
        case 'go-gantt':
          if (activeBoardId) setTab('gantt')
          break
        case 'go-finances':
          setTab('finances')
          break
        case 'open-search':
          setPaletteOpen(true)
          break
        case 'new-board':
          setTab('home')
          // HomePage will render; the user clicks 'Nuevo tablero'. A future
          // refactor could push a global 'open-new-board-modal' flag.
          break
        case 'export-db':
          await run(
            () => window.api.exports.backupDb(),
            (p) => `Backup guardado en:\n${p}`
          )
          break
        case 'export-excel':
          await run(
            () => window.api.exports.excel(),
            (p) => `Excel guardado en:\n${p}`
          )
          break
        case 'import-db':
          await run(
            () => window.api.imports.db(),
            (p) => `Base de datos restaurada desde:\n${p}\n\nLa app se recargará.`,
            true
          )
          break
        case 'import-excel':
          await run(
            () => window.api.imports.excel(),
            (p) => `Datos importados desde:\n${p}\n\nLa app se recargará.`,
            true
          )
          break
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBoardId])

  useEffect(() => {
    if (!menuOpen) return
    function onClick(e: MouseEvent): void {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  async function run(action: () => Promise<{ ok: boolean; path?: string; error?: string }>, successMsg: (path?: string) => string, reload = false): Promise<void> {
    setMenuOpen(false)
    if (busy) return
    setBusy(true)
    try {
      const r = await action()
      if (r.ok) {
        await notify(successMsg(r.path))
        if (reload) window.location.reload()
      } else if (r.error) {
        await notify(`Error: ${r.error}`)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between px-4 py-2 border-b border-pastel-purple/30 bg-white/70 backdrop-blur">
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1.5 mr-4">
            <FlowerIcon size={20} className="text-pastel-purple" />
            <h1 className="text-lg font-semibold bg-gradient-to-r from-pastel-pink via-pastel-purple to-pastel-blue bg-clip-text text-transparent tracking-tight">
              Bloom
            </h1>
          </div>
          <button
            onClick={() => setTab('home')}
            className={`btn ${tab === 'home' ? 'btn-primary' : ''}`}
          >
            <HomeIcon size={16} /> Inicio
          </button>
          <button
            onClick={() => setTab('kanban')}
            disabled={!activeBoardId}
            className={`btn ${tab === 'kanban' ? 'btn-primary' : ''} disabled:opacity-40 disabled:cursor-not-allowed`}
            title={activeBoardId ? 'Kanban' : 'Abre un tablero desde Inicio'}
          >
            <KanbanIcon size={16} /> Kanban
          </button>
          <button
            onClick={() => setTab('gantt')}
            disabled={!activeBoardId}
            className={`btn ${tab === 'gantt' ? 'btn-primary' : ''} disabled:opacity-40 disabled:cursor-not-allowed`}
            title={activeBoardId ? 'Gantt' : 'Abre un tablero desde Inicio'}
          >
            <GanttChartIcon size={16} /> Gantt
          </button>
          <button
            onClick={() => setTab('finances')}
            className={`btn ${tab === 'finances' ? 'btn-primary' : ''}`}
          >
            <WalletIcon size={16} /> Finanzas
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaletteOpen(true)}
            className="btn"
            title="Buscar (Cmd/Ctrl+K)"
          >
            <SearchIcon size={16} /> Buscar
            <kbd className="text-[10px] font-mono ml-1 px-1 rounded bg-pastel-purple/20 border border-pastel-purple/30 text-ink-300">
              ⌘K
            </kbd>
          </button>
          <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="btn"
            disabled={busy}
            title="Importar / Exportar datos"
          >
            <DatabaseIcon size={16} /> Datos <ChevronDownIcon size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-64 bg-white border border-pastel-purple/40 rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-2 text-xs font-semibold text-ink-300 uppercase tracking-wide bg-pastel-purple/10">
                Exportar
              </div>
              <button
                onClick={() =>
                  run(
                    () => window.api.exports.backupDb(),
                    (p) => `Backup guardado en:\n${p}`
                  )
                }
                className="w-full px-3 py-2 flex items-center gap-2 text-sm hover:bg-pastel-purple/10 text-left"
              >
                <DownloadIcon size={14} /> Respaldar (.db)
              </button>
              <button
                onClick={() =>
                  run(
                    () => window.api.exports.excel(),
                    (p) => `Excel guardado en:\n${p}`
                  )
                }
                className="w-full px-3 py-2 flex items-center gap-2 text-sm hover:bg-pastel-purple/10 text-left"
              >
                <FileSpreadsheetIcon size={14} /> Exportar Excel
              </button>
              <div className="px-3 py-2 text-xs font-semibold text-ink-300 uppercase tracking-wide bg-pastel-pink/10 border-t border-pastel-purple/20">
                Importar (reemplaza datos)
              </div>
              <button
                onClick={() =>
                  run(
                    () => window.api.imports.db(),
                    (p) => `Base de datos restaurada desde:\n${p}\n\nLa app se recargará.`,
                    true
                  )
                }
                className="w-full px-3 py-2 flex items-center gap-2 text-sm hover:bg-pastel-pink/15 text-left"
              >
                <UploadIcon size={14} /> Restaurar (.db)
              </button>
              <button
                onClick={() =>
                  run(
                    () => window.api.imports.excel(),
                    (p) => `Datos importados desde:\n${p}\n\nLa app se recargará.`,
                    true
                  )
                }
                className="w-full px-3 py-2 flex items-center gap-2 text-sm hover:bg-pastel-pink/15 text-left"
              >
                <FileSpreadsheetIcon size={14} /> Importar Excel
              </button>
            </div>
          )}
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {tab === 'home' && <HomePage />}
        {tab === 'kanban' && activeBoardId !== null && <KanbanPage />}
        {tab === 'gantt' && activeBoardId !== null && <GanttPage />}
        {tab === 'finances' && <FinancesPage />}
      </main>
      <footer className="flex-shrink-0 px-4 py-2 border-t border-pastel-purple/30 bg-white/60 backdrop-blur text-center text-xs text-ink-300">
        Desarrollado por{' '}
        <a
          href="https://www.jfrankrobles.com/"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-ink-100 hover:text-pastel-purple hover:underline"
        >
          JFrancisco Robles
        </a>{' '}
        con cariño para{' '}
        <span className="font-semibold bg-gradient-to-r from-rose-400 to-fuchsia-400 bg-clip-text text-transparent">
          Palomita
        </span>{' '}
        🌸
      </footer>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      <ConfirmModalRoot />
    </div>
  )
}
