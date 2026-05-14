import { useEffect, useState } from 'react'
import { XIcon, PlusIcon } from 'lucide-react'
import dayjs from 'dayjs'
import type { Card, CardWithTags, Tag } from '../../../shared/types'
import Modal from './Modal'
import { notify } from '../lib/confirm'

interface Props {
  card: CardWithTags
  onClose: () => void
}

const PALETTE = [
  '#fca5a5', // rosa coral
  '#fcd5b5', // melocotón
  '#fde68a', // limón
  '#bbf7d0', // menta
  '#a5f3fc', // celeste
  '#93c5fd', // azul pastel
  '#c4b5fd', // morado pastel
  '#f9a8d4', // rosa pastel
  '#cbd5e1'  // gris suave
]

export default function CardEditor({ card, onClose }: Props): JSX.Element {
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description ?? '')
  const [startDate, setStartDate] = useState(card.start_date ?? '')
  const [dueDate, setDueDate] = useState(card.due_date ?? '')
  const [progress, setProgress] = useState(card.progress ?? 0)
  const [dependsOn, setDependsOn] = useState<number | null>(card.depends_on ?? null)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set(card.tags.map((t) => t.id)))
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(PALETTE[5])
  const [boardCards, setBoardCards] = useState<Card[]>([])

  useEffect(() => {
    window.api.tags.list().then(setAllTags)
    window.api.cards.listSiblings(card.id).then((siblings) => {
      setBoardCards(siblings.filter((c) => c.id !== card.id))
    })
  }, [card.id])

  async function handleSave(): Promise<void> {
    if (startDate && dueDate && dayjs(dueDate).isBefore(dayjs(startDate))) {
      await notify('La fecha de fin no puede ser anterior a la de inicio')
      return
    }
    try {
      await window.api.cards.update(card.id, {
        title: title.trim() || card.title,
        description: description || null,
        start_date: startDate || null,
        due_date: dueDate || null,
        progress,
        depends_on: dependsOn
      })
      await window.api.cards.setTags(card.id, [...selected])
      onClose()
    } catch (e) {
      await notify((e as Error).message)
    }
  }

  async function handleCreateTag(): Promise<void> {
    if (!newTagName.trim()) return
    const t = await window.api.tags.create(newTagName.trim(), newTagColor)
    setAllTags((prev) => [...prev, t])
    setSelected((prev) => new Set(prev).add(t.id))
    setNewTagName('')
  }

  function toggleTag(id: number): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Modal onClose={onClose} title="Editar tarjeta">
      <div className="space-y-3">
        <div>
          <label className="text-xs text-ink-400">Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" autoFocus />
        </div>
        <div>
          <label className="text-xs text-ink-400">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="input resize-y"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-ink-400">Fecha de inicio</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="text-xs text-ink-400">Fecha límite</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="input"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-ink-400 flex items-center justify-between">
            <span>Progreso</span>
            <span className="text-ink-200 font-medium">{progress}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-full accent-pastel-purple"
          />
        </div>
        <div>
          <label className="text-xs text-ink-400">Depende de</label>
          <select
            value={dependsOn ?? ''}
            onChange={(e) => setDependsOn(e.target.value ? Number(e.target.value) : null)}
            className="input"
          >
            <option value="">— Ninguna —</option>
            {boardCards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-ink-400">Etiquetas</label>
          <div className="flex flex-wrap gap-1 mt-1">
            {allTags.map((t) => (
              <button
                key={t.id}
                onClick={() => toggleTag(t.id)}
                className={`text-xs px-2 py-1 rounded-full transition-opacity ${
                  selected.has(t.id) ? 'opacity-100 ring-2 ring-pastel-purple' : 'opacity-60 hover:opacity-100'
                }`}
                style={{ backgroundColor: t.color, color: '#3d2e5c' }}
              >
                {t.name}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-2 rounded-lg border border-pastel-purple/30 bg-pastel-purple/5 p-2">
            <div className="text-xs text-ink-400">Crear nueva etiqueta</div>
            <div className="flex gap-2">
              <input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleCreateTag()
                  }
                }}
                placeholder="Nombre"
                className="input flex-1"
              />
              <button onClick={handleCreateTag} className="btn btn-primary flex-shrink-0">
                <PlusIcon size={14} /> Añadir
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewTagColor(c)}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    newTagColor === c ? 'ring-2 ring-pastel-purple scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn">
            <XIcon size={14} /> Cancelar
          </button>
          <button onClick={handleSave} className="btn btn-primary">
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  )
}
