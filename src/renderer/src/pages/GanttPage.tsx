import { useEffect, useMemo } from 'react'
import { ArrowLeftIcon } from 'lucide-react'
import { useAsync } from '../hooks/useAsync'
import GanttView from '../components/GanttView'
import { useThemeStore } from '../lib/themeStore'
import { useNavStore } from '../lib/navStore'
import { getTheme } from '../lib/themes'

export default function GanttPage(): JSX.Element {
  const activeBoardId = useNavStore((s) => s.activeBoardId)
  const goHome = useNavStore((s) => s.goHome)
  const boardsQ = useAsync(() => window.api.boards.list(), [])
  const setThemeId = useThemeStore((s) => s.setThemeId)

  const board = useMemo(
    () => boardsQ.data?.find((b) => b.id === activeBoardId) ?? null,
    [boardsQ.data, activeBoardId]
  )

  useEffect(() => {
    if (board) setThemeId(board.theme)
  }, [board, setThemeId])

  if (!activeBoardId || !board) return <div className="p-6 text-ink-400">Cargando…</div>
  const theme = getTheme(board.theme)

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-pastel-purple/30 bg-white/40 backdrop-blur">
        <button onClick={goHome} className="btn" title="Volver a inicio">
          <ArrowLeftIcon size={14} /> Inicio
        </button>
        <div
          className="w-3 h-3 rounded-full ml-1"
          style={{ backgroundColor: theme.accent }}
          title={theme.name}
        />
        <h2 className="font-semibold">{board.name}</h2>
        <span className="text-[10px] uppercase tracking-wide text-ink-400 px-2 py-0.5 rounded-full bg-pastel-purple/15">
          Gantt · {theme.name}
        </span>
      </div>
      <GanttView boardId={activeBoardId} />
    </div>
  )
}
