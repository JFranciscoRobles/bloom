import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVerticalIcon, PlusIcon, Trash2Icon, PencilIcon } from 'lucide-react'
import type { CardWithTags, Column } from '../../../shared/types'
import CardItem from './CardItem'
import PromptModal from './PromptModal'
import { confirm } from '../lib/confirm'

interface Props {
  column: Column
  cards: CardWithTags[]
  onChange: () => void
}

export default function KanbanColumn({ column, cards, onChange }: Props): JSX.Element {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [renaming, setRenaming] = useState(false)

  const sortable = useSortable({ id: `col-${column.id}` })
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.35 : 1
  }
  // When something is hovering this column as a sortable target, lift it slightly.
  const isOver = sortable.isOver && !sortable.isDragging

  async function handleRename(name: string): Promise<void> {
    if (name === column.name) return
    await window.api.columns.rename(column.id, name)
    onChange()
  }

  async function handleRemove(): Promise<void> {
    if (
      !(await confirm({
        message: `Borrar la columna "${column.name}" y todas sus tarjetas?`,
        confirmText: 'Borrar'
      }))
    )
      return
    await window.api.columns.remove(column.id)
    onChange()
  }

  async function handleAddCard(): Promise<void> {
    if (!newTitle.trim()) {
      setAdding(false)
      return
    }
    await window.api.cards.create(column.id, newTitle.trim())
    setNewTitle('')
    setAdding(false)
    onChange()
  }

  const cardIds = cards.map((c) => `card-${c.id}`)

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={`w-72 flex-shrink-0 bg-white/80 backdrop-blur rounded-2xl flex flex-col max-h-full shadow-sm transition-shadow ${
        isOver
          ? 'border-2 border-pastel-purple shadow-md'
          : 'border border-pastel-purple/30'
      }`}
    >
      {/* The entire header is the drag handle, so users can grab anywhere
          along its width. Action buttons stop propagation so they keep working. */}
      <div
        {...sortable.attributes}
        {...sortable.listeners}
        className="flex items-center gap-1 p-2 border-b border-pastel-purple/30 bg-gradient-to-r from-pastel-pink/15 via-pastel-purple/15 to-pastel-blue/15 rounded-t-2xl cursor-grab active:cursor-grabbing select-none touch-none"
      >
        <GripVerticalIcon size={16} className="text-ink-400 flex-shrink-0" />
        <span className="font-medium flex-1 truncate">{column.name}</span>
        <span className="text-xs text-ink-400 mr-1">{cards.length}</span>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setRenaming(true)}
          className="p-1 hover:bg-pastel-purple/20 rounded"
          title="Renombrar"
        >
          <PencilIcon size={14} />
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleRemove}
          className="p-1 hover:bg-pastel-pink/40 rounded"
          title="Borrar"
        >
          <Trash2Icon size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((c) => (
            <CardItem key={c.id} card={c} onChange={onChange} />
          ))}
        </SortableContext>
        {adding ? (
          <div className="space-y-2">
            <textarea
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onBlur={handleAddCard}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleAddCard()
                }
                if (e.key === 'Escape') {
                  setAdding(false)
                  setNewTitle('')
                }
              }}
              className="input"
              rows={2}
              placeholder="Título de la tarjeta"
            />
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full text-left text-sm text-ink-400 hover:text-ink-100 p-2 rounded-lg hover:bg-pastel-purple/15"
          >
            <PlusIcon size={14} className="inline mr-1" /> Agregar tarjeta
          </button>
        )}
      </div>
      {renaming && (
        <PromptModal
          title="Renombrar columna"
          label="Nombre"
          initial={column.name}
          onConfirm={handleRename}
          onClose={() => setRenaming(false)}
        />
      )}
    </div>
  )
}
