import { useEffect, useState } from 'react'
import {
  XIcon,
  PlusIcon,
  PaperclipIcon,
  ImageIcon,
  Trash2Icon,
  ExternalLinkIcon,
  StarIcon,
  FileIcon,
  CheckSquareIcon,
  LayoutIcon
} from 'lucide-react'
import dayjs from 'dayjs'
import type {
  Attachment,
  Card,
  CardKind,
  CardWithTags,
  ChecklistItem,
  Tag
} from '../../../shared/types'
import Modal from './Modal'
import RichTextEditor from './RichTextEditor'
import { notify, confirm } from '../lib/confirm'
import { attachmentUrl, isImage, formatBytes } from '../lib/attachments'

interface Props {
  card: CardWithTags
  onClose: () => void
}

const PALETTE = [
  '#fca5a5',
  '#fcd5b5',
  '#fde68a',
  '#bbf7d0',
  '#a5f3fc',
  '#93c5fd',
  '#c4b5fd',
  '#f9a8d4',
  '#cbd5e1'
]

// Banner colors mirror Trello's bright section-divider palette.
const BANNER_COLORS = [
  '#86efac', // verde
  '#fcd34d', // ámbar
  '#fda4af', // rosa
  '#a78bfa', // morado
  '#7dd3fc', // azul
  '#fdba74', // naranja
  '#cbd5e1' // gris
]

export default function CardEditor({ card, onClose }: Props): JSX.Element {
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description ?? '')
  const [startDate, setStartDate] = useState(card.start_date ?? '')
  const [dueDate, setDueDate] = useState(card.due_date ?? '')
  const [progress, setProgress] = useState(card.progress ?? 0)
  const [dependsOn, setDependsOn] = useState<number | null>(card.depends_on ?? null)
  const [coverId, setCoverId] = useState<number | null>(card.cover_attachment_id ?? null)
  const [kind, setKind] = useState<CardKind>(card.kind ?? 'normal')
  const [bannerColor, setBannerColor] = useState<string>(card.banner_color ?? BANNER_COLORS[0])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set(card.tags.map((t) => t.id)))
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(PALETTE[5])
  const [boardCards, setBoardCards] = useState<Card[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [picking, setPicking] = useState(false)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [newChecklistText, setNewChecklistText] = useState('')

  useEffect(() => {
    window.api.tags.list().then(setAllTags)
    window.api.cards.listSiblings(card.id).then((siblings) => {
      setBoardCards(siblings.filter((c) => c.id !== card.id))
    })
    void reloadAttachments()
    void reloadChecklist()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id])

  async function reloadAttachments(): Promise<void> {
    const list = await window.api.attachments.listByCard(card.id)
    setAttachments(list)
  }

  async function reloadChecklist(): Promise<void> {
    const list = await window.api.checklist.listByCard(card.id)
    setChecklist(list)
  }

  // Auto-compute progress from checklist completion (overrides the slider when
  // checklist has items — same UX as Trello where checklist drives progress).
  const checklistTotal = checklist.length
  const checklistDone = checklist.filter((c) => c.done).length
  const computedProgress =
    checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : progress
  const hasChecklist = checklistTotal > 0

  async function handleAddChecklistItem(): Promise<void> {
    const t = newChecklistText.trim()
    if (!t) return
    await window.api.checklist.add(card.id, t)
    setNewChecklistText('')
    await reloadChecklist()
  }

  async function handleToggleChecklist(item: ChecklistItem): Promise<void> {
    await window.api.checklist.toggle(item.id, !item.done)
    await reloadChecklist()
  }

  async function handleRemoveChecklist(item: ChecklistItem): Promise<void> {
    await window.api.checklist.remove(item.id)
    await reloadChecklist()
  }

  const cover = attachments.find((a) => a.id === coverId) ?? null

  async function handleSave(): Promise<void> {
    if (kind === 'normal' && startDate && dueDate && dayjs(dueDate).isBefore(dayjs(startDate))) {
      await notify('La fecha de fin no puede ser anterior a la de inicio')
      return
    }
    try {
      if (kind === 'banner') {
        // Banners only carry title + color. We clear the rest so the card
        // doesn't accumulate stale data when toggled back.
        await window.api.cards.update(card.id, {
          title: title.trim() || card.title,
          kind: 'banner',
          banner_color: bannerColor,
          description: null,
          start_date: null,
          due_date: null,
          progress: 0,
          depends_on: null,
          cover_attachment_id: null
        })
      } else {
        await window.api.cards.update(card.id, {
          title: title.trim() || card.title,
          description: description || null,
          start_date: startDate || null,
          due_date: dueDate || null,
          // If there's a checklist, progress is driven by it (already kept in sync
          // server-side, but we send the computed value too to avoid races).
          progress: hasChecklist ? computedProgress : progress,
          depends_on: dependsOn,
          cover_attachment_id: coverId,
          kind: 'normal',
          banner_color: null
        })
      }
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

  async function handlePickAttachments(): Promise<void> {
    if (picking) return
    setPicking(true)
    try {
      const created = await window.api.attachments.pick(card.id)
      if (created.length > 0) {
        await reloadAttachments()
        // If the card has no cover yet and the first new attachment is an image, set it as cover.
        if (coverId == null) {
          const firstImage = created.find((a) => isImage(a.mime_type))
          if (firstImage) setCoverId(firstImage.id)
        }
      }
    } finally {
      setPicking(false)
    }
  }

  async function handleRemoveAttachment(a: Attachment): Promise<void> {
    if (
      !(await confirm({
        message: `Borrar el adjunto "${a.filename}"?`,
        confirmText: 'Borrar'
      }))
    )
      return
    await window.api.attachments.remove(a.id)
    if (coverId === a.id) setCoverId(null)
    await reloadAttachments()
  }

  function handleSetCover(a: Attachment): void {
    if (!isImage(a.mime_type)) return
    setCoverId(coverId === a.id ? null : a.id)
  }

  return (
    <Modal onClose={onClose} title={kind === 'banner' ? 'Editar separador' : 'Editar tarjeta'} wide>
      {/* Cover image preview at the top, Trello-style (only for normal cards) */}
      {kind === 'normal' && cover && isImage(cover.mime_type) && (
        <div className="-mx-4 -mt-4 mb-4 relative overflow-hidden rounded-t-2xl">
          <img
            src={attachmentUrl(cover.path)}
            alt={cover.filename}
            className="w-full h-44 object-cover"
          />
          <button
            onClick={() => setCoverId(null)}
            className="absolute top-2 right-2 px-2 py-1 rounded-full text-xs bg-white/85 hover:bg-white text-ink-200 shadow-sm"
            title="Quitar como portada"
          >
            Quitar portada
          </button>
        </div>
      )}

      <div className="space-y-3">
        {/* Kind toggle: normal vs banner/section divider */}
        <div className="flex items-center gap-1 p-1 rounded-full bg-pastel-purple/10 w-fit text-xs">
          <button
            onClick={() => setKind('normal')}
            className={`px-3 py-1 rounded-full flex items-center gap-1 transition-colors ${
              kind === 'normal'
                ? 'bg-white text-ink-100 shadow-sm font-medium'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            <LayoutIcon size={12} /> Tarjeta
          </button>
          <button
            onClick={() => setKind('banner')}
            className={`px-3 py-1 rounded-full flex items-center gap-1 transition-colors ${
              kind === 'banner'
                ? 'bg-white text-ink-100 shadow-sm font-medium'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            ▰ Separador
          </button>
        </div>

        <div>
          <label className="text-xs text-ink-400">Título</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            autoFocus
          />
        </div>

        {kind === 'banner' && (
          <>
            <div>
              <label className="text-xs text-ink-400">Color del separador</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {BANNER_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setBannerColor(c)}
                    className={`w-8 h-8 rounded-lg transition-transform ${
                      bannerColor === c ? 'ring-2 ring-ink-200 scale-110' : ''
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-ink-400">Vista previa</label>
              <div
                className="mt-1 px-3 py-2 rounded-lg font-semibold text-ink-50 uppercase tracking-wider text-sm"
                style={{ backgroundColor: bannerColor }}
              >
                {title || 'Título del separador'}
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
          </>
        )}

        {kind === 'normal' && (
          <>
        <div>
          <label className="text-xs text-ink-400">Descripción</label>
          <RichTextEditor
            value={description}
            onChange={setDescription}
            placeholder="Añade más detalles sobre esta tarjeta…"
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
            <span>Progreso{hasChecklist ? ' (auto por checklist)' : ''}</span>
            <span className="text-ink-200 font-medium">
              {hasChecklist
                ? `${checklistDone}/${checklistTotal} · ${computedProgress}%`
                : `${progress}%`}
            </span>
          </label>
          {hasChecklist ? (
            <div className="w-full h-2 rounded-full bg-pastel-purple/15 overflow-hidden mt-1">
              <div
                className="h-full bg-pastel-purple rounded-full transition-all"
                style={{ width: `${computedProgress}%` }}
              />
            </div>
          ) : (
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-pastel-purple"
            />
          )}
        </div>

        {/* Checklist */}
        <div>
          <label className="text-xs text-ink-400 flex items-center gap-1">
            <CheckSquareIcon size={12} /> Lista de subtareas
            {hasChecklist && (
              <span className="ml-1 text-ink-300">
                ({checklistDone}/{checklistTotal})
              </span>
            )}
          </label>
          {checklist.length > 0 && (
            <div className="mt-1 space-y-1">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-pastel-purple/10 group"
                >
                  <button
                    onClick={() => handleToggleChecklist(item)}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      item.done
                        ? 'bg-pastel-purple border-pastel-purple text-white'
                        : 'border-pastel-purple/40 hover:border-pastel-purple bg-white'
                    }`}
                  >
                    {item.done ? '✓' : ''}
                  </button>
                  <span
                    className={`flex-1 text-sm ${
                      item.done ? 'line-through text-ink-400' : 'text-ink-100'
                    }`}
                  >
                    {item.text}
                  </span>
                  <button
                    onClick={() => handleRemoveChecklist(item)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-pastel-pink/30 text-ink-400 hover:text-rose-400"
                    title="Borrar"
                  >
                    <Trash2Icon size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <input
              value={newChecklistText}
              onChange={(e) => setNewChecklistText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddChecklistItem()
                }
              }}
              placeholder="Añadir subtarea…"
              className="input flex-1"
            />
            <button
              onClick={handleAddChecklistItem}
              disabled={!newChecklistText.trim()}
              className="btn btn-primary flex-shrink-0 disabled:opacity-50"
            >
              <PlusIcon size={14} />
            </button>
          </div>
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

        {/* Attachments */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-ink-400 flex items-center gap-1">
              <PaperclipIcon size={12} /> Adjuntos
              {attachments.length > 0 && (
                <span className="ml-1 text-ink-300">({attachments.length})</span>
              )}
            </label>
            <button
              onClick={handlePickAttachments}
              disabled={picking}
              className="btn text-xs"
            >
              <PlusIcon size={12} /> {picking ? 'Subiendo…' : 'Añadir archivo'}
            </button>
          </div>
          {attachments.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {attachments.map((a) => {
                const isCover = coverId === a.id
                const image = isImage(a.mime_type)
                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border ${
                      isCover
                        ? 'border-pastel-purple bg-pastel-purple/10'
                        : 'border-pastel-purple/25 bg-white'
                    }`}
                  >
                    {image ? (
                      <img
                        src={attachmentUrl(a.path)}
                        alt={a.filename}
                        className="w-10 h-10 rounded object-cover flex-shrink-0 bg-pastel-purple/10"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded flex-shrink-0 bg-pastel-purple/15 flex items-center justify-center">
                        <FileIcon size={16} className="text-ink-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink-100 truncate">
                        {a.filename}
                      </div>
                      <div className="text-[11px] text-ink-400">
                        {formatBytes(a.size_bytes)} · {dayjs(a.created_at).format('DD MMM YYYY')}
                        {isCover && ' · Portada'}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {image && (
                        <button
                          onClick={() => handleSetCover(a)}
                          className={`p-1 rounded-full transition-colors ${
                            isCover
                              ? 'text-pastel-purple bg-pastel-purple/20'
                              : 'text-ink-400 hover:bg-pastel-purple/15 hover:text-ink-200'
                          }`}
                          title={isCover ? 'Quitar como portada' : 'Marcar como portada'}
                        >
                          <StarIcon
                            size={14}
                            className={isCover ? 'fill-current' : ''}
                          />
                        </button>
                      )}
                      <button
                        onClick={() => window.api.attachments.open(a.id, 'open')}
                        className="p-1 rounded-full text-ink-400 hover:bg-pastel-purple/15 hover:text-ink-200"
                        title="Abrir"
                      >
                        <ExternalLinkIcon size={14} />
                      </button>
                      <button
                        onClick={() => handleRemoveAttachment(a)}
                        className="p-1 rounded-full text-ink-400 hover:bg-pastel-pink/40 hover:text-rose-400"
                        title="Borrar"
                      >
                        <Trash2Icon size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {attachments.length === 0 && (
            <div className="mt-2 text-xs text-ink-400 rounded-lg border border-dashed border-pastel-purple/30 p-3 text-center">
              <ImageIcon size={18} className="mx-auto text-pastel-purple/50 mb-1" />
              Sin adjuntos. Imágenes, PDFs y otros archivos pueden marcarse como portada.
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-ink-400">Etiquetas</label>
          <div className="flex flex-wrap gap-1 mt-1">
            {allTags.map((t) => (
              <button
                key={t.id}
                onClick={() => toggleTag(t.id)}
                className={`text-xs px-2 py-1 rounded-full transition-opacity ${
                  selected.has(t.id)
                    ? 'opacity-100 ring-2 ring-pastel-purple'
                    : 'opacity-60 hover:opacity-100'
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
          </>
        )}
      </div>
    </Modal>
  )
}
