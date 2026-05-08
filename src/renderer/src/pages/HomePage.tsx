import { useEffect, useState } from 'react'
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  KanbanIcon,
  GanttChartIcon,
  LayoutGridIcon
} from 'lucide-react'
import type { Board } from '../../../shared/types'
import { useAsync } from '../hooks/useAsync'
import { BOARD_THEMES, getTheme } from '../lib/themes'
import { useNavStore } from '../lib/navStore'
import { useThemeStore } from '../lib/themeStore'
import BoardPromptModal from '../components/BoardPromptModal'

interface BoardStats {
  cards: number
  done: number
  overdue: number
}

export default function HomePage(): JSX.Element {
  const boardsQ = useAsync(() => window.api.boards.list(), [])
  const [stats, setStats] = useState<Map<number, BoardStats>>(new Map())
  const [editing, setEditing] = useState<Board | null>(null)
  const [creating, setCreating] = useState(false)
  const openBoard = useNavStore((s) => s.openBoard)
  const setThemeId = useThemeStore((s) => s.setThemeId)

  useEffect(() => {
    if (!boardsQ.data) return
    let cancelled = false
    void Promise.all(
      boardsQ.data.map(async (b) => {
        const cards = await window.api.cards.listForBoard(b.id)
        const today = new Date().toISOString().slice(0, 10)
        const done = cards.filter((c) => c.progress >= 100).length
        const overdue = cards.filter(
          (c) => c.progress < 100 && c.due_date && c.due_date < today
        ).length
        return [b.id, { cards: cards.length, done, overdue }] as const
      })
    ).then((entries) => {
      if (!cancelled) setStats(new Map(entries))
    })
    return () => {
      cancelled = true
    }
  }, [boardsQ.data])

  // Reset to default theme when on home so it doesn't keep last-board's theme.
  useEffect(() => {
    setThemeId('rose')
  }, [setThemeId])

  async function handleCreate(name: string, theme: string): Promise<void> {
    const b = await window.api.boards.create(name, theme)
    boardsQ.reload()
    openBoard(b.id, 'kanban')
  }

  async function handleUpdate(b: Board, name: string, theme: string): Promise<void> {
    await window.api.boards.update(b.id, { name, theme })
    boardsQ.reload()
  }

  async function handleRemove(b: Board, e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    if (!confirm(`Borrar tablero "${b.name}" y todas sus columnas y tarjetas?`)) return
    await window.api.boards.remove(b.id)
    boardsQ.reload()
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Tableros</h2>
            <p className="text-sm text-ink-400 mt-1">
              Tu jardín de proyectos. Cada tablero tiene su color y su propia colección de
              tareas.
            </p>
          </div>
          <button onClick={() => setCreating(true)} className="btn btn-primary">
            <PlusIcon size={16} /> Nuevo tablero
          </button>
        </div>

        {boardsQ.data && boardsQ.data.length === 0 && (
          <div className="rounded-2xl border border-dashed border-pastel-purple/40 bg-white/50 p-10 text-center">
            <LayoutGridIcon size={36} className="mx-auto text-pastel-purple mb-2" />
            <p className="text-ink-300">Aún no tienes tableros.</p>
            <button onClick={() => setCreating(true)} className="btn btn-primary mt-4">
              <PlusIcon size={14} /> Crear el primero
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boardsQ.data?.map((b) => {
            const theme = getTheme(b.theme)
            const s = stats.get(b.id)
            return (
              <div
                key={b.id}
                onClick={() => openBoard(b.id, 'kanban')}
                className="group relative rounded-2xl border border-ink-700/10 bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 overflow-hidden cursor-pointer"
              >
                {/* Color band */}
                <div
                  className="h-20 relative"
                  style={{
                    background: `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]}, ${theme.gradient[2]})`
                  }}
                >
                  <div
                    className="absolute bottom-2 left-3 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: theme.accent }}
                    title={theme.name}
                  />
                  {/* Hover quick actions */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditing(b)
                      }}
                      className="p-1.5 rounded-full bg-white/85 hover:bg-white shadow-sm text-ink-200"
                      title="Editar"
                    >
                      <PencilIcon size={13} />
                    </button>
                    <button
                      onClick={(e) => handleRemove(b, e)}
                      className="p-1.5 rounded-full bg-white/85 hover:bg-pastel-pink/70 shadow-sm text-ink-200 hover:text-rose-400"
                      title="Borrar"
                    >
                      <Trash2Icon size={13} />
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-base text-ink-100 truncate">{b.name}</h3>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-ink-400 px-2 py-0.5 rounded-full bg-pastel-purple/15">
                      {theme.name}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Stat label="Tareas" value={s?.cards ?? 0} />
                    <Stat
                      label="Completas"
                      value={s?.done ?? 0}
                      tone={s && s.done > 0 ? 'good' : 'mute'}
                    />
                    <Stat
                      label="Vencidas"
                      value={s?.overdue ?? 0}
                      tone={s && s.overdue > 0 ? 'bad' : 'mute'}
                    />
                  </div>

                  <div className="flex gap-1 pt-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openBoard(b.id, 'kanban')
                      }}
                      className="flex-1 btn justify-center text-xs"
                    >
                      <KanbanIcon size={13} /> Kanban
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openBoard(b.id, 'gantt')
                      }}
                      className="flex-1 btn justify-center text-xs"
                    >
                      <GanttChartIcon size={13} /> Gantt
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {boardsQ.data && boardsQ.data.length > 0 && (
          <div className="text-xs text-ink-400 text-center pt-2">
            {BOARD_THEMES.length} colores disponibles · Click en un tablero para abrir
          </div>
        )}
      </div>

      {creating && (
        <BoardPromptModal
          title="Nuevo tablero"
          confirmText="Crear"
          onConfirm={handleCreate}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <BoardPromptModal
          title="Editar tablero"
          initialName={editing.name}
          initialThemeId={editing.theme}
          onConfirm={(name, theme) => handleUpdate(editing, name, theme)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  tone = 'mute'
}: {
  label: string
  value: number
  tone?: 'good' | 'bad' | 'mute'
}): JSX.Element {
  const color =
    tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-rose-400' : 'text-ink-200'
  return (
    <div className="rounded-lg bg-pastel-purple/8 py-1.5">
      <div className={`text-base font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-ink-400">{label}</div>
    </div>
  )
}
