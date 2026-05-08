import { BrowserWindow, Notification } from 'electron'
import { notificationsRepo } from './db/repos'

const HOUR_MS = 60 * 60 * 1000
let timer: NodeJS.Timeout | null = null
let getMainWindow: (() => BrowserWindow | null) | null = null

// Avoid spamming the same card multiple times in the same session.
const notifiedThisSession = new Set<number>()

interface RunOptions {
  /** If true, don't show a popup when there's nothing due. Default true. */
  silentIfEmpty?: boolean
}

export function runDueNotifications({ silentIfEmpty = true }: RunOptions = {}): void {
  const cards = notificationsRepo.dueSoon()
  const fresh = cards.filter((c) => !notifiedThisSession.has(c.id))

  if (cards.length === 0) {
    if (!silentIfEmpty) {
      new Notification({
        title: 'Bloom 🌸',
        body: 'No hay tareas vencidas ni próximas a vencer.'
      }).show()
    }
    return
  }

  const today = new Date().toISOString().slice(0, 10)
  const overdue = cards.filter((c) => c.due_date < today)
  const dueToday = cards.filter((c) => c.due_date === today)
  const dueTomorrow = cards.filter((c) => c.due_date > today)

  if (fresh.length === 0 && silentIfEmpty) {
    // Nothing new since last check this session — don't repeat.
    return
  }

  // Single combined notification keeps things calm.
  const parts: string[] = []
  if (overdue.length > 0) parts.push(`${overdue.length} vencida(s)`)
  if (dueToday.length > 0) parts.push(`${dueToday.length} para hoy`)
  if (dueTomorrow.length > 0) parts.push(`${dueTomorrow.length} mañana`)

  const title = overdue.length > 0 ? '⚠️ Tareas pendientes' : '🌸 Tareas próximas'
  const body =
    parts.join(' · ') +
    (cards[0] ? `\n${cards[0].title} (${cards[0].board_name})` : '')

  const n = new Notification({ title, body, silent: false })
  n.on('click', () => {
    const win = getMainWindow?.()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })
  n.show()

  for (const c of cards) notifiedThisSession.add(c.id)
}

export function startNotifications(getWin: () => BrowserWindow | null): void {
  getMainWindow = getWin
  // Initial check ~10s after launch (lets the UI settle first).
  setTimeout(() => runDueNotifications(), 10_000)
  // Hourly thereafter.
  if (timer) clearInterval(timer)
  timer = setInterval(() => runDueNotifications(), HOUR_MS)
}

export function stopNotifications(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
