import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import dayjs from 'dayjs'
import {
  CalendarIcon,
  Trash2Icon,
  LinkIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  CheckSquare2Icon
} from 'lucide-react'
import type { CardWithTags } from '../../../shared/types'
import CardEditor from './CardEditor'
import { confirm } from '../lib/confirm'
import { attachmentUrl, isImage } from '../lib/attachments'

// TipTap saves descriptions as HTML; old notes were plain text. This is a
// cheap-and-good-enough sniff so we render new descriptions with formatting
// but don't accidentally inject `< x >` text as markup.
function isLikelyHtml(s: string): boolean {
  return /<\/?[a-zA-Z][^>]*>/.test(s)
}

interface Props {
  card: CardWithTags
  onChange?: () => void
  dragging?: boolean
}

export default function CardItem({ card, onChange, dragging }: Props): JSX.Element {
  const [editing, setEditing] = useState(false)
  const sortable = useSortable({ id: `card-${card.id}`, disabled: dragging })

  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1
  }

  const today = dayjs().startOf('day')
  const dueDay = card.due_date ? dayjs(card.due_date) : null
  const overdue = dueDay && card.progress < 100 && dueDay.isBefore(today, 'day')
  const dueSoon = dueDay && !overdue && dueDay.diff(today, 'day') <= 2 && card.progress < 100
  const completed = card.progress >= 100

  const startDay = card.start_date ? dayjs(card.start_date) : null
  const accentColor = card.tags[0]?.color ?? null
  const cover = card.cover && isImage(card.cover.mime_type) ? card.cover : null

  function formatDateRange(): string {
    if (startDay && dueDay && !startDay.isSame(dueDay, 'day')) {
      const sameYear = startDay.year() === dueDay.year()
      const sameMonth = sameYear && startDay.month() === dueDay.month()
      if (sameMonth) {
        return `${startDay.format('D')}–${dueDay.format('D MMM')}`
      }
      if (sameYear) {
        return `${startDay.format('D MMM')} → ${dueDay.format('D MMM')}`
      }
      return `${startDay.format('D MMM YY')} → ${dueDay.format('D MMM YY')}`
    }
    if (dueDay) return dueDay.format('D MMM YYYY')
    if (startDay) return startDay.format('D MMM YYYY')
    return ''
  }

  async function handleRemove(e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    if (!(await confirm({ message: `Borrar la tarjeta "${card.title}"?`, confirmText: 'Borrar' })))
      return
    await window.api.cards.remove(card.id)
    onChange?.()
  }

  // Banner-style card: solid color band, used as a section divider inside a column.
  if (card.kind === 'banner') {
    return (
      <>
        <div
          ref={sortable.setNodeRef}
          {...sortable.attributes}
          {...sortable.listeners}
          onClick={() => !dragging && setEditing(true)}
          className={`group relative cursor-pointer rounded-lg px-3 py-2 text-ink-50 font-semibold uppercase tracking-wider text-xs shadow-sm hover:shadow-md transition-all ${
            dragging ? 'shadow-2xl rotate-1' : ''
          }`}
          style={{ ...style, backgroundColor: card.banner_color ?? '#c4b5fd' }}
        >
          <div className="flex items-center gap-2">
            <span className="flex-1 truncate">{card.title}</span>
            {!dragging && (
              <button
                onClick={handleRemove}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-black/15 transition-opacity"
                title="Borrar"
              >
                <Trash2Icon size={12} />
              </button>
            )}
          </div>
        </div>
        {editing && (
          <CardEditor
            card={card}
            onClose={() => {
              setEditing(false)
              onChange?.()
            }}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div
        ref={sortable.setNodeRef}
        style={style}
        {...sortable.attributes}
        {...sortable.listeners}
        onClick={() => !dragging && setEditing(true)}
        className={`group relative cursor-pointer rounded-xl bg-white/90 backdrop-blur border border-pastel-purple/25 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-pastel-purple/60 transition-all duration-150 overflow-hidden ${
          dragging ? 'shadow-2xl rotate-1 ring-2 ring-pastel-purple/50' : ''
        } ${overdue ? 'ring-1 ring-rose-300' : ''}`}
      >
        {/* Cover image (Trello-style) */}
        {cover && (
          <img
            src={attachmentUrl(cover.path)}
            alt=""
            className="w-full h-28 object-cover bg-pastel-purple/10"
            draggable={false}
          />
        )}

        {/* Left accent stripe only when there is NO cover (cover already gives the card identity) */}
        {!cover && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5"
            style={{ backgroundColor: accentColor ?? 'var(--theme-accent)' }}
          />
        )}

        <div className={`flex items-start gap-2 p-3 ${cover ? '' : 'pl-4'}`}>
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Title with status icon */}
            <div className="flex items-start gap-1.5">
              {completed && (
                <CheckCircle2Icon
                  size={14}
                  className="flex-shrink-0 text-emerald-400 mt-0.5"
                />
              )}
              {overdue && !completed && (
                <AlertCircleIcon
                  size={14}
                  className="flex-shrink-0 text-rose-400 mt-0.5"
                />
              )}
              <div
                className={`text-sm font-medium leading-snug whitespace-pre-wrap break-words ${
                  completed ? 'line-through text-ink-400' : 'text-ink-100'
                }`}
              >
                {card.title}
              </div>
            </div>

            {/* Description preview: render HTML when produced by the editor,
                fallback to plain text for legacy notes. Capped to ~3 lines. */}
            {card.description && (
              isLikelyHtml(card.description) ? (
                <div
                  className="prose-bloom prose-bloom-preview text-xs leading-snug line-clamp-3"
                  dangerouslySetInnerHTML={{ __html: card.description }}
                />
              ) : (
                <div className="text-xs text-ink-400 line-clamp-2 leading-snug whitespace-pre-wrap">
                  {card.description}
                </div>
              )
            )}

            {/* Tags */}
            {card.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {card.tags.map((t) => (
                  <span
                    key={t.id}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full leading-tight"
                    style={{ backgroundColor: t.color, color: '#3d2e5c' }}
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            )}

            {/* Progress bar */}
            {card.progress > 0 && card.progress < 100 && (
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1 bg-pastel-purple/15 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-pastel-purple rounded-full transition-all"
                    style={{ width: `${card.progress}%` }}
                  />
                </div>
                <span className="text-[10px] text-ink-400 font-medium tabular-nums w-7 text-right">
                  {card.progress}%
                </span>
              </div>
            )}

            {/* Checklist preview: first 3 items, with inline toggle so the user
                can tick things off without opening the editor. */}
            {(card.checklist_preview?.length ?? 0) > 0 && (
              <div className="space-y-0.5">
                {card.checklist_preview!.map((item) => (
                  <button
                    key={item.id}
                    onClick={async (e) => {
                      e.stopPropagation()
                      await window.api.checklist.toggle(item.id, !item.done)
                      onChange?.()
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="w-full flex items-start gap-1.5 text-left text-[11px] leading-tight py-0.5 rounded hover:bg-pastel-purple/10 transition-colors"
                  >
                    <span
                      className={`mt-0.5 w-3 h-3 rounded flex-shrink-0 border flex items-center justify-center text-[8px] font-bold ${
                        item.done
                          ? 'bg-pastel-purple border-pastel-purple text-white'
                          : 'border-pastel-purple/50 bg-white'
                      }`}
                    >
                      {item.done ? '✓' : ''}
                    </span>
                    <span
                      className={`min-w-0 truncate ${
                        item.done ? 'line-through text-ink-400' : 'text-ink-200'
                      }`}
                    >
                      {item.text}
                    </span>
                  </button>
                ))}
                {(card.checklist_total ?? 0) > (card.checklist_preview?.length ?? 0) && (
                  <div className="text-[10px] text-ink-400 pl-4 pt-0.5">
                    +{(card.checklist_total ?? 0) - (card.checklist_preview?.length ?? 0)} más…
                  </div>
                )}
              </div>
            )}

            {/* Footer: dates + dependency + checklist + attachments badges */}
            {(dueDay ||
              startDay ||
              card.depends_on ||
              (card.checklist_total ?? 0) > 0) && (
              <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                {(dueDay || startDay) && (
                  <div
                    className={`text-[11px] flex items-center gap-1 ${
                      overdue
                        ? 'text-rose-400 font-medium'
                        : dueSoon
                          ? 'text-amber-500'
                          : 'text-ink-400'
                    }`}
                  >
                    <CalendarIcon size={11} />
                    {formatDateRange()}
                  </div>
                )}
                {(card.checklist_total ?? 0) > 0 && (
                  <div
                    className="text-[11px] flex items-center gap-1 text-ink-400"
                    title="Subtareas completadas"
                  >
                    <CheckSquare2Icon size={11} />
                    {card.checklist_done ?? 0}/{card.checklist_total}
                  </div>
                )}
                {card.depends_on && (
                  <div
                    className="text-[11px] flex items-center gap-1 text-ink-400"
                    title="Depende de otra tarjeta"
                  >
                    <LinkIcon size={11} />
                  </div>
                )}
              </div>
            )}
          </div>

          {!dragging && (
            <button
              onClick={handleRemove}
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 hover:bg-pastel-pink/50 rounded transition-opacity text-ink-400 hover:text-rose-400"
              title="Borrar"
            >
              <Trash2Icon size={12} />
            </button>
          )}
        </div>
      </div>
      {editing && (
        <CardEditor
          card={card}
          onClose={() => {
            setEditing(false)
            onChange?.()
          }}
        />
      )}
    </>
  )
}
