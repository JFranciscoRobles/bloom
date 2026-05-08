import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners
} from '@dnd-kit/core'
import { arrayMove, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { ArrowLeftIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import type { Board, CardWithTags, Column } from '../../../shared/types'
import { useAsync } from '../hooks/useAsync'
import KanbanColumn from '../components/KanbanColumn'
import CardItem from '../components/CardItem'
import CardEditor from '../components/CardEditor'
import PromptModal from '../components/PromptModal'
import BoardPromptModal from '../components/BoardPromptModal'
import { useThemeStore } from '../lib/themeStore'
import { useNavStore } from '../lib/navStore'
import { getTheme } from '../lib/themes'

export default function KanbanPage(): JSX.Element {
  const activeBoardId = useNavStore((s) => s.activeBoardId)
  const goHome = useNavStore((s) => s.goHome)
  const boardsQ = useAsync(() => window.api.boards.list(), [])
  const setThemeId = useThemeStore((s) => s.setThemeId)
  const [editingBoard, setEditingBoard] = useState<Board | null>(null)

  const board = useMemo(
    () => boardsQ.data?.find((b) => b.id === activeBoardId) ?? null,
    [boardsQ.data, activeBoardId]
  )

  useEffect(() => {
    if (board) setThemeId(board.theme)
  }, [board, setThemeId])

  async function handleUpdateBoard(b: Board, name: string, theme: string): Promise<void> {
    await window.api.boards.update(b.id, { name, theme })
    boardsQ.reload()
  }

  async function handleRemoveBoard(b: Board): Promise<void> {
    if (!confirm(`Borrar tablero "${b.name}" y todas sus columnas y tarjetas?`)) return
    await window.api.boards.remove(b.id)
    goHome()
  }

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
          {theme.name}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setEditingBoard(board)}
            className="btn"
            title="Editar tablero"
          >
            <PencilIcon size={14} />
          </button>
          <button
            onClick={() => handleRemoveBoard(board)}
            className="btn btn-danger"
            title="Borrar tablero"
          >
            <Trash2Icon size={14} />
          </button>
        </div>
      </div>
      <BoardView boardId={activeBoardId} />
      {editingBoard && (
        <BoardPromptModal
          title="Editar tablero"
          initialName={editingBoard.name}
          initialThemeId={editingBoard.theme}
          onConfirm={(name, theme) => handleUpdateBoard(editingBoard, name, theme)}
          onClose={() => setEditingBoard(null)}
        />
      )}
    </div>
  )
}

interface ColumnState extends Column {
  cards: CardWithTags[]
}

function BoardView({ boardId }: { boardId: number }): JSX.Element {
  const [columns, setColumns] = useState<ColumnState[]>([])
  const [activeCard, setActiveCard] = useState<CardWithTags | null>(null)
  const [addingColumn, setAddingColumn] = useState(false)
  const [openCard, setOpenCard] = useState<CardWithTags | null>(null)
  const pendingCardId = useNavStore((s) => s.pendingCardId)
  const consumePendingCard = useNavStore((s) => s.consumePendingCard)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  async function load(): Promise<void> {
    const cols = await window.api.columns.listByBoard(boardId)
    const withCards = await Promise.all(
      cols.map(async (c) => ({ ...c, cards: await window.api.cards.listByColumn(c.id) }))
    )
    setColumns(withCards)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId])

  // When the user opens a card from the command palette, find it in the loaded
  // columns and open the editor.
  useEffect(() => {
    if (pendingCardId == null) return
    for (const col of columns) {
      const found = col.cards.find((c) => c.id === pendingCardId)
      if (found) {
        setOpenCard(found)
        consumePendingCard()
        return
      }
    }
  }, [pendingCardId, columns, consumePendingCard])

  const columnIds = useMemo(() => columns.map((c) => `col-${c.id}`), [columns])

  function findColumn(cardId: number): ColumnState | undefined {
    return columns.find((c) => c.cards.some((card) => card.id === cardId))
  }

  function onDragStart(e: DragStartEvent): void {
    const id = String(e.active.id)
    if (id.startsWith('card-')) {
      const cardId = Number(id.replace('card-', ''))
      const col = findColumn(cardId)
      const card = col?.cards.find((c) => c.id === cardId) ?? null
      setActiveCard(card)
    }
  }

  async function onDragEnd(e: DragEndEvent): Promise<void> {
    setActiveCard(null)
    const activeId = String(e.active.id)
    const overId = e.over ? String(e.over.id) : null
    if (!overId) return
    if (activeId === overId) return

    if (activeId.startsWith('col-') && overId.startsWith('col-')) {
      const oldIndex = columns.findIndex((c) => `col-${c.id}` === activeId)
      const newIndex = columns.findIndex((c) => `col-${c.id}` === overId)
      if (oldIndex < 0 || newIndex < 0) return
      const next = arrayMove(columns, oldIndex, newIndex)
      setColumns(next)
      await window.api.columns.reorder(boardId, next.map((c) => c.id))
      return
    }

    if (activeId.startsWith('card-')) {
      const cardId = Number(activeId.replace('card-', ''))
      const fromCol = findColumn(cardId)
      if (!fromCol) return

      let toCol: ColumnState | undefined
      let toIndex: number | undefined

      if (overId.startsWith('col-')) {
        toCol = columns.find((c) => `col-${c.id}` === overId)
        toIndex = toCol ? toCol.cards.length : 0
      } else if (overId.startsWith('card-')) {
        const overCardId = Number(overId.replace('card-', ''))
        toCol = findColumn(overCardId)
        toIndex = toCol?.cards.findIndex((c) => c.id === overCardId)
      }
      if (!toCol || toIndex === undefined) return

      const next = columns.map((c) => ({ ...c, cards: [...c.cards] }))
      const fromColNext = next.find((c) => c.id === fromCol.id)!
      const toColNext = next.find((c) => c.id === toCol!.id)!
      const idx = fromColNext.cards.findIndex((c) => c.id === cardId)
      const [moved] = fromColNext.cards.splice(idx, 1)
      toColNext.cards.splice(toIndex, 0, moved)
      setColumns(next)
      await window.api.cards.move(cardId, toCol.id, toColNext.cards.map((c) => c.id))
    }
  }

  async function handleAddColumn(name: string): Promise<void> {
    await window.api.columns.create(boardId, name)
    load()
  }

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-3 p-4 h-full items-start">
          <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
            {columns.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                cards={col.cards}
                onChange={load}
              />
            ))}
          </SortableContext>
          <button onClick={() => setAddingColumn(true)} className="btn flex-shrink-0">
            <PlusIcon size={16} /> Columna
          </button>
        </div>
        <DragOverlay>
          {activeCard ? <CardItem card={activeCard} dragging /> : null}
        </DragOverlay>
      </DndContext>
      {addingColumn && (
        <PromptModal
          title="Nueva columna"
          label="Nombre"
          placeholder="Ej. Por hacer"
          confirmText="Crear"
          onConfirm={handleAddColumn}
          onClose={() => setAddingColumn(false)}
        />
      )}
      {openCard && (
        <CardEditor
          card={openCard}
          onClose={() => {
            setOpenCard(null)
            load()
          }}
        />
      )}
    </div>
  )
}
