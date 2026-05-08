import { dialog } from 'electron'
import fs from 'node:fs'
import dayjs from 'dayjs'
import Database from 'better-sqlite3'
import ExcelJS from 'exceljs'
import { getDb, getDbPath, replaceDbFromFile } from './db'

export async function backupDb(): Promise<{ ok: boolean; path?: string; error?: string }> {
  const stamp = dayjs().format('YYYYMMDD-HHmmss')
  const result = await dialog.showSaveDialog({
    title: 'Guardar copia de la base de datos',
    defaultPath: `bloom-backup-${stamp}.db`,
    filters: [{ name: 'SQLite DB', extensions: ['db'] }]
  })
  if (result.canceled || !result.filePath) return { ok: false }
  try {
    fs.copyFileSync(getDbPath(), result.filePath)
    return { ok: true, path: result.filePath }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function exportExcel(): Promise<{ ok: boolean; path?: string; error?: string }> {
  const stamp = dayjs().format('YYYYMMDD-HHmmss')
  const result = await dialog.showSaveDialog({
    title: 'Exportar a Excel',
    defaultPath: `bloom-${stamp}.xlsx`,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  })
  if (result.canceled || !result.filePath) return { ok: false }
  try {
    const db = getDb()
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Bloom'
    wb.created = new Date()

    const sheets: Array<{ name: string; sql: string }> = [
      { name: 'Boards', sql: 'SELECT * FROM boards ORDER BY position, id' },
      { name: 'Columns', sql: 'SELECT * FROM columns ORDER BY board_id, position' },
      { name: 'Cards', sql: 'SELECT * FROM cards ORDER BY column_id, position' },
      { name: 'Tags', sql: 'SELECT * FROM tags ORDER BY name' },
      { name: 'CardTags', sql: 'SELECT * FROM card_tags' },
      { name: 'Accounts', sql: 'SELECT * FROM accounts ORDER BY name' },
      { name: 'Categories', sql: 'SELECT * FROM categories ORDER BY type, name' },
      { name: 'Transactions', sql: 'SELECT * FROM transactions ORDER BY date DESC, id DESC' },
      { name: 'ExchangeRates', sql: 'SELECT * FROM exchange_rates' }
    ]

    for (const s of sheets) {
      const rows = db.prepare(s.sql).all() as Array<Record<string, unknown>>
      const ws = wb.addWorksheet(s.name)
      if (rows.length === 0) continue
      const headers = Object.keys(rows[0])
      ws.columns = headers.map((h) => ({ header: h, key: h, width: 18 }))
      ws.getRow(1).font = { bold: true }
      for (const r of rows) ws.addRow(r)
    }

    await wb.xlsx.writeFile(result.filePath)
    return { ok: true, path: result.filePath }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

const REQUIRED_TABLES = [
  'boards',
  'columns',
  'cards',
  'tags',
  'card_tags',
  'accounts',
  'categories',
  'transactions',
  'exchange_rates'
]

function validateDbFile(filePath: string): { ok: true } | { ok: false; error: string } {
  let probe: Database.Database | null = null
  try {
    probe = new Database(filePath, { readonly: true, fileMustExist: true })
    const rows = probe
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>
    const present = new Set(rows.map((r) => r.name))
    const missing = REQUIRED_TABLES.filter((t) => !present.has(t))
    if (missing.length > 0) {
      return { ok: false, error: `Faltan tablas: ${missing.join(', ')}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: `Archivo inválido: ${(e as Error).message}` }
  } finally {
    probe?.close()
  }
}

export async function importDb(): Promise<{ ok: boolean; path?: string; error?: string }> {
  const choice = await dialog.showMessageBox({
    type: 'warning',
    title: 'Importar base de datos',
    message: 'Esto reemplazará TODOS los datos actuales por los del archivo.',
    detail:
      'Se hará un respaldo automático de tu base de datos actual antes de reemplazarla. ¿Continuar?',
    buttons: ['Cancelar', 'Continuar'],
    defaultId: 0,
    cancelId: 0
  })
  if (choice.response !== 1) return { ok: false }

  const result = await dialog.showOpenDialog({
    title: 'Seleccionar respaldo .db',
    filters: [{ name: 'SQLite DB', extensions: ['db', 'sqlite', 'sqlite3'] }],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) return { ok: false }
  const source = result.filePaths[0]

  const validation = validateDbFile(source)
  if (!validation.ok) return { ok: false, error: validation.error }

  try {
    replaceDbFromFile(source)
    return { ok: true, path: source }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

interface SheetRow {
  [key: string]: unknown
}

function readSheet(wb: ExcelJS.Workbook, name: string): SheetRow[] {
  const ws = wb.getWorksheet(name)
  if (!ws) return []
  const headerRow = ws.getRow(1)
  const headers: string[] = []
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? '').trim()
  })
  const rows: SheetRow[] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const obj: SheetRow = {}
    let hasValue = false
    row.eachCell((cell, colNumber) => {
      const key = headers[colNumber - 1]
      if (!key) return
      let v: unknown = cell.value
      if (v && typeof v === 'object' && 'text' in (v as object)) {
        v = (v as { text: string }).text
      }
      if (v && typeof v === 'object' && 'result' in (v as object)) {
        v = (v as { result: unknown }).result
      }
      if (v instanceof Date) {
        v = dayjs(v).format('YYYY-MM-DD')
      }
      obj[key] = v
      if (v !== null && v !== undefined && v !== '') hasValue = true
    })
    if (hasValue) rows.push(obj)
  })
  return rows
}

export async function importExcel(): Promise<{ ok: boolean; path?: string; error?: string }> {
  const choice = await dialog.showMessageBox({
    type: 'warning',
    title: 'Importar desde Excel',
    message: 'Esto reemplazará TODOS los datos actuales con los del archivo Excel.',
    detail:
      'Se hará un respaldo automático antes de importar. El archivo debe tener el mismo formato que exporta la app. ¿Continuar?',
    buttons: ['Cancelar', 'Continuar'],
    defaultId: 0,
    cancelId: 0
  })
  if (choice.response !== 1) return { ok: false }

  const result = await dialog.showOpenDialog({
    title: 'Seleccionar archivo Excel',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) return { ok: false }
  const source = result.filePaths[0]

  // Auto-backup current db
  try {
    const stamp = dayjs().format('YYYYMMDD-HHmmss')
    fs.copyFileSync(getDbPath(), `${getDbPath()}.before-import-${stamp}`)
  } catch {
    // non-fatal
  }

  try {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(source)
    const db = getDb()

    const boards = readSheet(wb, 'Boards')
    const columns = readSheet(wb, 'Columns')
    const cards = readSheet(wb, 'Cards')
    const tags = readSheet(wb, 'Tags')
    const cardTags = readSheet(wb, 'CardTags')
    const accounts = readSheet(wb, 'Accounts')
    const categories = readSheet(wb, 'Categories')
    const transactions = readSheet(wb, 'Transactions')
    const rates = readSheet(wb, 'ExchangeRates')

    db.transaction(() => {
      // Wipe
      for (const t of [
        'card_tags',
        'transactions',
        'exchange_rates',
        'cards',
        'tags',
        'columns',
        'categories',
        'accounts',
        'boards'
      ]) {
        db.prepare(`DELETE FROM ${t}`).run()
        db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(t)
      }

      const num = (v: unknown, d = 0): number => {
        const n = Number(v)
        return Number.isFinite(n) ? n : d
      }
      const str = (v: unknown): string | null => {
        if (v === null || v === undefined || v === '') return null
        return String(v)
      }

      for (const b of boards) {
        db.prepare(
          'INSERT INTO boards (id, name, theme, position, created_at) VALUES (?, ?, ?, ?, COALESCE(?, datetime(\'now\')))'
        ).run(
          num(b.id),
          String(b.name ?? ''),
          str(b.theme) ?? 'rose',
          num(b.position),
          str(b.created_at)
        )
      }
      for (const c of columns) {
        db.prepare(
          'INSERT INTO columns (id, board_id, name, position) VALUES (?, ?, ?, ?)'
        ).run(num(c.id), num(c.board_id), String(c.name ?? ''), num(c.position))
      }
      for (const t of tags) {
        db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(
          num(t.id),
          String(t.name ?? ''),
          str(t.color) ?? '#cbd5e1'
        )
      }
      for (const c of cards) {
        db.prepare(
          `INSERT INTO cards
             (id, column_id, title, description, start_date, due_date, progress, depends_on, position, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
        ).run(
          num(c.id),
          num(c.column_id),
          String(c.title ?? ''),
          str(c.description),
          str(c.start_date),
          str(c.due_date),
          num(c.progress),
          c.depends_on != null && c.depends_on !== '' ? num(c.depends_on) : null,
          num(c.position),
          str(c.created_at)
        )
      }
      for (const ct of cardTags) {
        db.prepare('INSERT OR IGNORE INTO card_tags (card_id, tag_id) VALUES (?, ?)').run(
          num(ct.card_id),
          num(ct.tag_id)
        )
      }
      for (const a of accounts) {
        db.prepare(
          'INSERT INTO accounts (id, name, currency, initial_balance) VALUES (?, ?, ?, ?)'
        ).run(num(a.id), String(a.name ?? ''), String(a.currency ?? 'MXN'), num(a.initial_balance))
      }
      for (const c of categories) {
        db.prepare(
          'INSERT INTO categories (id, name, type, color) VALUES (?, ?, ?, ?)'
        ).run(
          num(c.id),
          String(c.name ?? ''),
          c.type === 'income' ? 'income' : 'expense',
          str(c.color) ?? '#cbd5e1'
        )
      }
      for (const t of transactions) {
        db.prepare(
          `INSERT INTO transactions
             (id, account_id, category_id, type, amount, currency, date, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
        ).run(
          num(t.id),
          num(t.account_id),
          t.category_id != null && t.category_id !== '' ? num(t.category_id) : null,
          t.type === 'income' ? 'income' : 'expense',
          num(t.amount),
          String(t.currency ?? 'MXN'),
          String(t.date ?? dayjs().format('YYYY-MM-DD')),
          str(t.note),
          str(t.created_at)
        )
      }
      for (const r of rates) {
        db.prepare(
          `INSERT INTO exchange_rates (from_currency, to_currency, rate, updated_at)
           VALUES (?, ?, ?, COALESCE(?, datetime('now')))`
        ).run(
          String(r.from_currency ?? '').toUpperCase(),
          String(r.to_currency ?? '').toUpperCase(),
          num(r.rate, 1),
          str(r.updated_at)
        )
      }
    })()

    return { ok: true, path: source }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
