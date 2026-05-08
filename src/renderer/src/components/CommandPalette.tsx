import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  SearchIcon,
  KanbanIcon,
  WalletIcon,
  LayoutGridIcon,
  ArrowRightIcon,
  ClipboardPasteIcon,
  PlusCircleIcon
} from 'lucide-react'
import dayjs from 'dayjs'
import type { SearchResult } from '../../../shared/types'
import { useNavStore } from '../lib/navStore'
import { formatMoney } from '../lib/currency'
import { getTheme } from '../lib/themes'

interface Props {
  onClose: () => void
}

interface Action {
  id: string
  label: string
  hint: string
  icon: JSX.Element
  run: () => void | Promise<void>
}

/**
 * Cmd/Ctrl+K command palette: searches cards, boards and transactions
 * across the whole app and navigates to the result on selection.
 */
export default function CommandPalette({ onClose }: Props): JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [clipText, setClipText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const openCard = useNavStore((s) => s.openCard)
  const openBoard = useNavStore((s) => s.openBoard)
  const openTransaction = useNavStore((s) => s.openTransaction)

  // Read clipboard on mount so we can offer a 'capture from clipboard' action
  // when there's content. This is explicit (not auto-pasted), respecting privacy.
  useEffect(() => {
    try {
      setClipText(window.api.clipboard.readText().trim())
    } catch {
      setClipText('')
    }
  }, [])

  async function captureToInbox(text: string): Promise<void> {
    if (!text.trim()) return
    await window.api.inbox.capture(text.trim())
    onClose()
  }

  // Build the static action list. Capture-actions appear in addition to
  // search results; they live in their own section above results.
  const actions = useMemo<Action[]>(() => {
    const list: Action[] = []
    const q = query.trim()
    if (q) {
      list.push({
        id: 'capture-query',
        label: `Crear tarea en Inbox: "${q.slice(0, 60)}${q.length > 60 ? '…' : ''}"`,
        hint: 'Inbox',
        icon: <PlusCircleIcon size={14} className="text-pastel-purple" />,
        run: () => captureToInbox(q)
      })
    }
    if (clipText) {
      const preview = clipText.slice(0, 60).replace(/\s+/g, ' ')
      list.push({
        id: 'capture-clipboard',
        label: `Pegar como tarea: "${preview}${clipText.length > 60 ? '…' : ''}"`,
        hint: 'Inbox',
        icon: <ClipboardPasteIcon size={14} className="text-pastel-purple" />,
        run: () => captureToInbox(clipText)
      })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, clipText])

  // Debounced search.
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      setHighlight(0)
      return
    }
    setLoading(true)
    const handle = setTimeout(async () => {
      try {
        const r = await window.api.search.all(q, 8)
        setResults(r)
        setHighlight(0)
      } finally {
        setLoading(false)
      }
    }, 120)
    return () => clearTimeout(handle)
  }, [query])

  // Keyboard navigation across both actions and results.
  const totalItems = actions.length + results.length
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlight((h) => Math.min(h + 1, Math.max(totalItems - 1, 0)))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlight((h) => Math.max(h - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (highlight < actions.length) {
          actions[highlight]?.run()
        } else {
          const r = results[highlight - actions.length]
          if (r) handleSelect(r)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, actions, highlight, totalItems, onClose])

  // Scroll highlighted into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlight])

  function handleSelect(r: SearchResult): void {
    if (r.kind === 'card') openCard(r.board_id, r.id)
    else if (r.kind === 'board') openBoard(r.id, 'kanban')
    else if (r.kind === 'transaction') openTransaction(r.id)
    onClose()
  }

  const grouped = useMemo(() => {
    const g: { boards: SearchResult[]; cards: SearchResult[]; txs: SearchResult[] } = {
      boards: [],
      cards: [],
      txs: []
    }
    for (const r of results) {
      if (r.kind === 'board') g.boards.push(r)
      else if (r.kind === 'card') g.cards.push(r)
      else g.txs.push(r)
    }
    return g
  }, [results])

  // Build a flat list of indices so highlighting maps to actions+results.
  // Actions occupy [0..actions.length-1]; results start after them.
  let runningIdx = actions.length - 1

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[10vh] bg-ink-100/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-pastel-purple/40 overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-pastel-purple/30 bg-gradient-to-r from-pastel-pink/15 via-pastel-purple/15 to-pastel-blue/15">
          <SearchIcon size={18} className="text-pastel-purple flex-shrink-0" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar tableros, tareas, transacciones…"
            className="flex-1 bg-transparent border-0 outline-none text-base text-ink-100 placeholder-ink-400"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/70 border border-pastel-purple/30 text-ink-300">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto scrollbar-thin">
          {actions.length > 0 && (
            <Section icon={<PlusCircleIcon size={12} />} label="Acciones">
              {actions.map((a, i) => (
                <Row
                  key={a.id}
                  idx={i}
                  active={i === highlight}
                  onSelect={() => a.run()}
                  onHover={() => setHighlight(i)}
                >
                  <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center bg-pastel-purple/15">
                    {a.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{a.label}</div>
                    <div className="text-[11px] text-ink-400">{a.hint}</div>
                  </div>
                </Row>
              ))}
            </Section>
          )}

          {!query.trim() && actions.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-ink-400">
              <SearchIcon size={28} className="mx-auto text-pastel-purple/60 mb-2" />
              Escribe para buscar.
              <div className="text-xs mt-1 text-ink-400/80">
                Encuentra tareas por título, descripción o etiqueta · transacciones por monto, nota
                o cuenta · tableros por nombre.
              </div>
            </div>
          )}

          {query.trim() && results.length === 0 && !loading && (
            <div className="px-4 py-10 text-center text-sm text-ink-400">
              Sin resultados para <span className="font-medium text-ink-200">"{query}"</span>
            </div>
          )}

          {loading && results.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-ink-400">Buscando…</div>
          )}

          {grouped.boards.length > 0 && (
            <Section icon={<LayoutGridIcon size={12} />} label="Tableros">
              {grouped.boards.map((r) => {
                runningIdx++
                const idx = runningIdx
                if (r.kind !== 'board') return null
                const theme = getTheme(r.theme)
                return (
                  <Row
                    key={`b-${r.id}`}
                    idx={idx}
                    active={idx === highlight}
                    onSelect={() => handleSelect(r)}
                    onHover={() => setHighlight(idx)}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]}, ${theme.gradient[2]})`
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full border border-white"
                        style={{ backgroundColor: theme.accent }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{r.name}</div>
                      <div className="text-[11px] text-ink-400">Tablero · {theme.name}</div>
                    </div>
                  </Row>
                )
              })}
            </Section>
          )}

          {grouped.cards.length > 0 && (
            <Section icon={<KanbanIcon size={12} />} label="Tareas">
              {grouped.cards.map((r) => {
                runningIdx++
                const idx = runningIdx
                if (r.kind !== 'card') return null
                return (
                  <Row
                    key={`c-${r.id}`}
                    idx={idx}
                    active={idx === highlight}
                    onSelect={() => handleSelect(r)}
                    onHover={() => setHighlight(idx)}
                  >
                    <div
                      className="w-1 self-stretch rounded flex-shrink-0"
                      style={{ backgroundColor: r.tag_color ?? 'var(--theme-accent)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{r.title}</div>
                      <div className="text-[11px] text-ink-400 truncate">
                        {r.board_name} · {r.column_name}
                        {r.snippet && ` · ${r.snippet}`}
                      </div>
                    </div>
                  </Row>
                )
              })}
            </Section>
          )}

          {grouped.txs.length > 0 && (
            <Section icon={<WalletIcon size={12} />} label="Transacciones">
              {grouped.txs.map((r) => {
                runningIdx++
                const idx = runningIdx
                if (r.kind !== 'transaction') return null
                return (
                  <Row
                    key={`t-${r.id}`}
                    idx={idx}
                    active={idx === highlight}
                    onSelect={() => handleSelect(r)}
                    onHover={() => setHighlight(idx)}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-semibold ${
                        r.type === 'income'
                          ? 'bg-pastel-mint text-ink-50'
                          : 'bg-pastel-pink text-ink-50'
                      }`}
                    >
                      {r.type === 'income' ? '+' : '−'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm flex items-center gap-2">
                        <span
                          className={
                            r.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                          }
                        >
                          {r.type === 'income' ? '+' : '−'}
                          {formatMoney(r.amount, r.currency)}
                        </span>
                        {r.category_name && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-ink-300">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: r.category_color ?? '#cbd5e1' }}
                            />
                            {r.category_name}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-ink-400 truncate">
                        {dayjs(r.date).format('DD/MM/YYYY')} · {r.account_name}
                        {r.note && ` · ${r.note}`}
                      </div>
                    </div>
                  </Row>
                )
              })}
            </Section>
          )}
        </div>

        {totalItems > 0 && (
          <div className="px-3 py-2 border-t border-pastel-purple/20 bg-pastel-purple/5 text-[10px] text-ink-400 flex items-center gap-3">
            <span>
              <kbd className="font-mono px-1 rounded bg-white/70 border border-pastel-purple/30">↑↓</kbd>{' '}
              navegar
            </span>
            <span>
              <kbd className="font-mono px-1 rounded bg-white/70 border border-pastel-purple/30">↵</kbd>{' '}
              abrir
            </span>
            <span className="ml-auto">
              {actions.length > 0 && `${actions.length} acción(es)`}
              {actions.length > 0 && results.length > 0 && ' · '}
              {results.length > 0 && `${results.length} resultado(s)`}
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

function Section({
  icon,
  label,
  children
}: {
  icon: JSX.Element
  label: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div>
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400 bg-pastel-purple/8 flex items-center gap-1">
        {icon} {label}
      </div>
      {children}
    </div>
  )
}

function Row({
  idx,
  active,
  onSelect,
  onHover,
  children
}: {
  idx: number
  active: boolean
  onSelect: () => void
  onHover: () => void
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      data-idx={idx}
      onMouseEnter={onHover}
      onClick={onSelect}
      className={`w-full px-3 py-2 flex items-center gap-3 text-left border-l-2 ${
        active ? 'bg-pastel-purple/15 border-pastel-purple' : 'border-transparent'
      }`}
    >
      {children}
      <ArrowRightIcon
        size={14}
        className={`flex-shrink-0 transition-opacity ${active ? 'opacity-100 text-pastel-purple' : 'opacity-0'}`}
      />
    </button>
  )
}
