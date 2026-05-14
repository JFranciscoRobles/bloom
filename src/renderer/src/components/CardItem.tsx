import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import dayjs from 'dayjs'
import {
  CalendarIcon,
  Trash2Icon,
  LinkIcon,
  CheckCircle2Icon,
  AlertCircleIcon
} from 'lucide-react'
import type { CardWithTags } from '../../../shared/types'
import CardEditor from './CardEditor'
import { confirm } from '../lib/confirm'

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

  return (
    <>
      <div
        ref={sortable.setNodeRef}
        style={style}
        {...sortable.attributes}
        {...sortable.listeners}
        onClick={() => !dragging && setEditing(true)}
        className={`group relative cursor-pointer rounded-xl bg-white/90 backdrop-blur border border-pastel-purple/25 p-3 pl-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-pastel-purple/60 transition-all duration-150 overflow-hidden ${
          dragging ? 'shadow-2xl rotate-1 ring-2 ring-pastel-purple/50' : ''
        } ${overdue ? 'ring-1 ring-rose-300' : ''}`}
      >
        {/* Left accent stripe (uses first tag color, falls back to theme accent) */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl"
          style={{ backgroundColor: accentColor ?? 'var(--theme-accent)' }}
        />

        <div className="flex items-start gap-2">
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

            {/* Description preview */}
            {card.description && (
              <div className="text-xs text-ink-400 line-clamp-2 leading-snug">
                {card.description}
              </div>
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

            {/* Footer: dates + dependency */}
            {(dueDay || startDay || card.depends_on) && (
              <div className="flex items-center gap-2 pt-0.5">
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
