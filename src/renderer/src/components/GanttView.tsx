import { useEffect, useMemo, useRef, useState } from 'react'
import dayjs, { Dayjs } from 'dayjs'
import { CalendarPlusIcon, ZoomInIcon, ZoomOutIcon } from 'lucide-react'
import type { GanttCard } from '../../../shared/types'
import CardEditor from './CardEditor'

type Zoom = 'day' | 'week' | 'month'

interface Props {
  boardId: number
}

const ROW_HEIGHT = 36
const HEADER_HEIGHT = 56
const SIDEBAR_WIDTH = 260
const GROUP_HEADER_HEIGHT = 28

const ZOOM_PX: Record<Zoom, number> = {
  day: 36,
  week: 14,
  month: 6
}

interface Drag {
  cardId: number
  mode: 'move' | 'resize-start' | 'resize-end'
  startX: number
  origStart: Dayjs
  origEnd: Dayjs
}

export default function GanttView({ boardId }: Props): JSX.Element {
  const [cards, setCards] = useState<GanttCard[]>([])
  const [zoom, setZoom] = useState<Zoom>('day')
  const [editing, setEditing] = useState<GanttCard | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [dragPreview, setDragPreview] = useState<{ start: Dayjs; end: Dayjs } | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)

  async function load(): Promise<void> {
    const data = await window.api.cards.listForBoard(boardId)
    setCards(data)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId])

  const dayPx = ZOOM_PX[zoom]

  const dated = useMemo(() => {
    return cards
      .map((c) => {
        const start = c.start_date ? dayjs(c.start_date) : c.due_date ? dayjs(c.due_date) : null
        const end = c.due_date ? dayjs(c.due_date) : c.start_date ? dayjs(c.start_date) : null
        return start && end ? { card: c, start, end: end.isBefore(start) ? start : end } : null
      })
      .filter((x): x is { card: GanttCard; start: Dayjs; end: Dayjs } => x !== null)
  }, [cards])

  const undated = useMemo(
    () => cards.filter((c) => !c.start_date && !c.due_date),
    [cards]
  )

  const range = useMemo(() => {
    const today = dayjs().startOf('day')
    if (dated.length === 0) {
      return { start: today.subtract(7, 'day'), end: today.add(30, 'day') }
    }
    const min = dated.reduce((a, b) => (b.start.isBefore(a) ? b.start : a), dated[0].start)
    const max = dated.reduce((a, b) => (b.end.isAfter(a) ? b.end : a), dated[0].end)
    return {
      start: min.subtract(7, 'day').startOf('day'),
      end: max.add(14, 'day').startOf('day')
    }
  }, [dated])

  const totalDays = range.end.diff(range.start, 'day') + 1
  const timelineWidth = totalDays * dayPx

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { columnId: number; columnName: string; columnPosition: number; items: GanttCard[] }
    >()
    for (const c of cards) {
      const key = String(c.column_id)
      const g = map.get(key) ?? {
        columnId: c.column_id,
        columnName: c.column_name,
        columnPosition: c.column_position,
        items: []
      }
      g.items.push(c)
      map.set(key, g)
    }
    return [...map.values()].sort((a, b) => a.columnPosition - b.columnPosition)
  }, [cards])

  const cardPositions = useMemo(() => {
    const m = new Map<number, { y: number }>()
    let y = 0
    for (const g of groups) {
      y += GROUP_HEADER_HEIGHT
      for (const c of g.items) {
        m.set(c.id, { y })
        y += ROW_HEIGHT
      }
    }
    return { positions: m, totalHeight: y }
  }, [groups])

  function dateToX(d: Dayjs): number {
    return d.startOf('day').diff(range.start, 'day') * dayPx
  }

  function xToDate(x: number): Dayjs {
    return range.start.add(Math.round(x / dayPx), 'day')
  }

  useEffect(() => {
    if (!drag) return
    function onMove(e: MouseEvent): void {
      if (!drag) return
      const dx = e.clientX - drag.startX
      const dDays = Math.round(dx / dayPx)
      let newStart = drag.origStart
      let newEnd = drag.origEnd
      if (drag.mode === 'move') {
        newStart = drag.origStart.add(dDays, 'day')
        newEnd = drag.origEnd.add(dDays, 'day')
      } else if (drag.mode === 'resize-start') {
        newStart = drag.origStart.add(dDays, 'day')
        if (newStart.isAfter(newEnd)) newStart = newEnd
      } else if (drag.mode === 'resize-end') {
        newEnd = drag.origEnd.add(dDays, 'day')
        if (newEnd.isBefore(newStart)) newEnd = newStart
      }
      setDragPreview({ start: newStart, end: newEnd })
    }
    async function onUp(): Promise<void> {
      if (!drag || !dragPreview) {
        setDrag(null)
        setDragPreview(null)
        return
      }
      const { cardId } = drag
      const { start, end } = dragPreview
      try {
        await window.api.cards.update(cardId, {
          start_date: start.format('YYYY-MM-DD'),
          due_date: end.format('YYYY-MM-DD')
        })
        await load()
      } finally {
        setDrag(null)
        setDragPreview(null)
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, dragPreview, dayPx])

  function startDrag(
    e: React.MouseEvent,
    cardId: number,
    mode: Drag['mode'],
    start: Dayjs,
    end: Dayjs
  ): void {
    e.stopPropagation()
    e.preventDefault()
    setDrag({ cardId, mode, startX: e.clientX, origStart: start, origEnd: end })
    setDragPreview({ start, end })
  }

  // Generate header ticks
  const ticks = useMemo(() => {
    const out: Array<{ x: number; label: string; major: boolean }> = []
    if (zoom === 'day') {
      let d = range.start
      while (d.isBefore(range.end) || d.isSame(range.end)) {
        const isMonthStart = d.date() === 1
        out.push({
          x: dateToX(d),
          label: isMonthStart ? d.format('MMM YYYY') : String(d.date()),
          major: isMonthStart
        })
        d = d.add(1, 'day')
      }
    } else if (zoom === 'week') {
      let d = range.start.startOf('week')
      while (d.isBefore(range.end)) {
        out.push({ x: dateToX(d), label: d.format('DD MMM'), major: d.date() <= 7 })
        d = d.add(1, 'week')
      }
    } else {
      let d = range.start.startOf('month')
      while (d.isBefore(range.end)) {
        out.push({ x: dateToX(d), label: d.format('MMM YY'), major: d.month() === 0 })
        d = d.add(1, 'month')
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, zoom, dayPx])

  const todayX = dateToX(dayjs().startOf('day'))

  // Dependency arrows: from end of dep to start of card
  const arrows = useMemo(() => {
    const out: Array<{ from: { x: number; y: number }; to: { x: number; y: number }; key: string }> = []
    const byId = new Map(dated.map((d) => [d.card.id, d]))
    for (const item of dated) {
      const depId = item.card.depends_on
      if (!depId) continue
      const dep = byId.get(depId)
      if (!dep) continue
      const fromPos = cardPositions.positions.get(dep.card.id)
      const toPos = cardPositions.positions.get(item.card.id)
      if (!fromPos || !toPos) continue
      out.push({
        from: { x: dateToX(dep.end.add(1, 'day')), y: fromPos.y + ROW_HEIGHT / 2 },
        to: { x: dateToX(item.start), y: toPos.y + ROW_HEIGHT / 2 },
        key: `${dep.card.id}->${item.card.id}`
      })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dated, cardPositions, dayPx, range.start])

  function scrollToToday(): void {
    if (!scrollerRef.current) return
    scrollerRef.current.scrollLeft = Math.max(0, todayX - 200)
  }

  useEffect(() => {
    scrollToToday()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, zoom])

  function setBarDates(card: GanttCard, days = 3): Promise<void> {
    const today = dayjs().startOf('day')
    return window.api.cards
      .update(card.id, {
        start_date: today.format('YYYY-MM-DD'),
        due_date: today.add(days, 'day').format('YYYY-MM-DD')
      })
      .then(load)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-pastel-purple/30">
        <h2 className="font-semibold mr-2">Diagrama de Gantt</h2>
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs text-ink-400 mr-1">Zoom:</span>
          {(['day', 'week', 'month'] as Zoom[]).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`btn text-xs ${zoom === z ? 'btn-primary' : ''}`}
            >
              {z === 'day' ? 'Día' : z === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
          <button onClick={() => setZoom('day')} className="btn" title="Acercar">
            <ZoomInIcon size={14} />
          </button>
          <button onClick={() => setZoom('month')} className="btn" title="Alejar">
            <ZoomOutIcon size={14} />
          </button>
          <button onClick={scrollToToday} className="btn">
            Hoy
          </button>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-ink-400 text-sm">
          No hay tarjetas en este tablero. Créalas desde la pestaña Kanban.
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div
            className="flex-shrink-0 border-r border-pastel-purple/30 bg-white/60 overflow-y-auto scrollbar-thin"
            style={{ width: SIDEBAR_WIDTH }}
          >
            <div
              className="sticky top-0 z-10 bg-gradient-to-r from-pastel-pink/20 via-pastel-purple/20 to-pastel-blue/20 border-b border-pastel-purple/30 px-3 flex items-center text-xs font-semibold text-ink-200 uppercase tracking-wide"
              style={{ height: HEADER_HEIGHT }}
            >
              Tarea
            </div>
            <div>
              {groups.map((g) => (
                <div key={g.columnId}>
                  <div
                    className="px-3 flex items-center text-xs font-semibold text-ink-300 bg-pastel-purple/10"
                    style={{ height: GROUP_HEADER_HEIGHT }}
                  >
                    {g.columnName}{' '}
                    <span className="ml-1 text-ink-400 font-normal">({g.items.length})</span>
                  </div>
                  {g.items.map((c) => {
                    const hasDates = !!(c.start_date || c.due_date)
                    return (
                      <div
                        key={c.id}
                        className="px-3 flex items-center gap-2 border-b border-pastel-purple/15 hover:bg-pastel-purple/10 cursor-pointer text-sm"
                        style={{ height: ROW_HEIGHT }}
                        onClick={() => setEditing(c)}
                        title={c.title}
                      >
                        <div className="flex-1 truncate">{c.title}</div>
                        {!hasDates && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setBarDates(c)
                            }}
                            className="opacity-60 hover:opacity-100 text-ink-400"
                            title="Programar 3 días desde hoy"
                          >
                            <CalendarPlusIcon size={14} />
                          </button>
                        )}
                        <span className="text-xs text-ink-400 w-9 text-right">{c.progress}%</span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div ref={scrollerRef} className="flex-1 overflow-auto scrollbar-thin">
            <div
              className="relative"
              style={{ width: timelineWidth, minWidth: '100%' }}
            >
              {/* Header */}
              <div
                className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-pastel-purple/30"
                style={{ height: HEADER_HEIGHT }}
              >
                <div className="relative h-full">
                  {ticks.map((t, i) => (
                    <div
                      key={i}
                      className={`absolute top-0 h-full flex items-end pb-1 text-xs ${
                        t.major ? 'text-ink-100 font-semibold' : 'text-ink-400'
                      }`}
                      style={{ left: t.x, width: dayPx }}
                    >
                      <span className="px-1 truncate">{t.label}</span>
                    </div>
                  ))}
                  {/* today line marker in header */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-pastel-pink"
                    style={{ left: todayX }}
                  />
                </div>
              </div>

              {/* Body grid */}
              <div className="relative" style={{ height: cardPositions.totalHeight }}>
                {/* Vertical grid lines */}
                {ticks.map((t, i) => (
                  <div
                    key={i}
                    className={`absolute top-0 bottom-0 w-px ${
                      t.major ? 'bg-pastel-purple/30' : 'bg-pastel-purple/10'
                    }`}
                    style={{ left: t.x }}
                  />
                ))}
                {/* Today line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-pastel-pink z-10 pointer-events-none"
                  style={{ left: todayX }}
                />
                {/* Group separators / row backgrounds */}
                {(() => {
                  let y = 0
                  const rows: JSX.Element[] = []
                  for (const g of groups) {
                    rows.push(
                      <div
                        key={`gh-${g.columnId}`}
                        className="absolute left-0 right-0 bg-pastel-purple/5 border-y border-pastel-purple/20"
                        style={{ top: y, height: GROUP_HEADER_HEIGHT }}
                      />
                    )
                    y += GROUP_HEADER_HEIGHT
                    for (let i = 0; i < g.items.length; i++) {
                      if (i % 2 === 1) {
                        rows.push(
                          <div
                            key={`row-${g.columnId}-${i}`}
                            className="absolute left-0 right-0 bg-pastel-purple/5"
                            style={{ top: y, height: ROW_HEIGHT }}
                          />
                        )
                      }
                      y += ROW_HEIGHT
                    }
                  }
                  return rows
                })()}

                {/* Dependency arrows (SVG) */}
                <svg
                  className="absolute inset-0 pointer-events-none"
                  width={timelineWidth}
                  height={cardPositions.totalHeight}
                >
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="8"
                      markerHeight="8"
                      refX="6"
                      refY="4"
                      orient="auto"
                    >
                      <path d="M0,0 L0,8 L8,4 z" fill="#a78bfa" />
                    </marker>
                  </defs>
                  {arrows.map((a) => {
                    const midX = a.from.x + Math.max(12, (a.to.x - a.from.x) / 2)
                    const path = `M ${a.from.x} ${a.from.y} L ${midX} ${a.from.y} L ${midX} ${a.to.y} L ${a.to.x - 4} ${a.to.y}`
                    return (
                      <path
                        key={a.key}
                        d={path}
                        stroke="#a78bfa"
                        strokeWidth="1.5"
                        fill="none"
                        markerEnd="url(#arrowhead)"
                      />
                    )
                  })}
                </svg>

                {/* Bars */}
                {dated.map((item) => {
                  const pos = cardPositions.positions.get(item.card.id)
                  if (!pos) return null
                  const isDragging = drag?.cardId === item.card.id && dragPreview
                  const start = isDragging ? dragPreview!.start : item.start
                  const end = isDragging ? dragPreview!.end : item.end
                  const x = dateToX(start)
                  const width = Math.max(dayPx, dateToX(end.add(1, 'day')) - x)
                  const tagColor = item.card.tags[0]?.color
                  const overdue =
                    item.card.progress < 100 && end.isBefore(dayjs(), 'day')
                  return (
                    <div
                      key={item.card.id}
                      className={`absolute group rounded-lg border shadow-sm overflow-hidden cursor-grab active:cursor-grabbing select-none ${
                        overdue
                          ? 'border-pastel-pink'
                          : 'border-pastel-purple/50'
                      }`}
                      style={{
                        top: pos.y + 4,
                        height: ROW_HEIGHT - 8,
                        left: x,
                        width,
                        backgroundColor: tagColor ?? '#c4b5fd'
                      }}
                      onMouseDown={(e) => startDrag(e, item.card.id, 'move', item.start, item.end)}
                      onClick={(e) => {
                        if (drag) {
                          e.stopPropagation()
                          return
                        }
                        setEditing(item.card)
                      }}
                      title={`${item.card.title}\n${start.format('DD/MM/YYYY')} → ${end.format('DD/MM/YYYY')}\n${item.card.progress}% completado`}
                    >
                      {/* Progress fill */}
                      <div
                        className="absolute inset-y-0 left-0 bg-black/15 pointer-events-none"
                        style={{ width: `${item.card.progress}%` }}
                      />
                      {/* Resize handle left */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-black/0 hover:bg-black/20"
                        onMouseDown={(e) =>
                          startDrag(e, item.card.id, 'resize-start', item.start, item.end)
                        }
                      />
                      {/* Resize handle right */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-black/0 hover:bg-black/20"
                        onMouseDown={(e) =>
                          startDrag(e, item.card.id, 'resize-end', item.start, item.end)
                        }
                      />
                      <div className="relative h-full flex items-center px-2 text-xs font-medium text-ink-50 truncate">
                        {item.card.title}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {undated.length > 0 && (
        <div className="border-t border-pastel-purple/30 bg-white/60 px-4 py-2 text-xs text-ink-400">
          {undated.length} tarea(s) sin fechas — agrega fecha de inicio y fin para verlas en el
          Gantt.
        </div>
      )}

      {editing && (
        <CardEditor
          card={{ ...editing }}
          onClose={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}
