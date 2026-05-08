import { getDb } from './index'
import type {
  Account,
  Board,
  Card,
  CardWithTags,
  Category,
  Column,
  ExchangeRate,
  GanttCard,
  MonthlySummary,
  Tag,
  Transaction,
  TxType
} from '../../shared/types'

function wouldCreateCycle(cardId: number, newDep: number): boolean {
  if (cardId === newDep) return true
  const db = getDb()
  const stmt = db.prepare('SELECT depends_on FROM cards WHERE id = ?')
  const seen = new Set<number>()
  let current: number | null = newDep
  while (current !== null) {
    if (current === cardId) return true
    if (seen.has(current)) return true
    seen.add(current)
    const row = stmt.get(current) as { depends_on: number | null } | undefined
    current = row?.depends_on ?? null
  }
  return false
}

export const boardsRepo = {
  list(): Board[] {
    return getDb().prepare('SELECT * FROM boards ORDER BY position ASC, id ASC').all() as Board[]
  },
  create(name: string, theme = 'rose'): Board {
    const db = getDb()
    const max = (db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM boards').get() as { m: number }).m
    const info = db
      .prepare('INSERT INTO boards (name, theme, position) VALUES (?, ?, ?)')
      .run(name, theme, max + 1)
    return db.prepare('SELECT * FROM boards WHERE id = ?').get(info.lastInsertRowid) as Board
  },
  update(id: number, patch: Partial<Pick<Board, 'name' | 'theme'>>): void {
    const fields: string[] = []
    const values: unknown[] = []
    if (patch.name !== undefined) {
      fields.push('name = ?')
      values.push(patch.name)
    }
    if (patch.theme !== undefined) {
      fields.push('theme = ?')
      values.push(patch.theme)
    }
    if (fields.length === 0) return
    values.push(id)
    getDb().prepare(`UPDATE boards SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  },
  rename(id: number, name: string): void {
    getDb().prepare('UPDATE boards SET name = ? WHERE id = ?').run(name, id)
  },
  remove(id: number): void {
    getDb().prepare('DELETE FROM boards WHERE id = ?').run(id)
  }
}

export const columnsRepo = {
  listByBoard(boardId: number): Column[] {
    return getDb()
      .prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY position ASC, id ASC')
      .all(boardId) as Column[]
  },
  create(boardId: number, name: string): Column {
    const db = getDb()
    const max = (
      db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM columns WHERE board_id = ?').get(boardId) as {
        m: number
      }
    ).m
    const info = db
      .prepare('INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)')
      .run(boardId, name, max + 1)
    return db.prepare('SELECT * FROM columns WHERE id = ?').get(info.lastInsertRowid) as Column
  },
  rename(id: number, name: string): void {
    getDb().prepare('UPDATE columns SET name = ? WHERE id = ?').run(name, id)
  },
  remove(id: number): void {
    getDb().prepare('DELETE FROM columns WHERE id = ?').run(id)
  },
  reorder(boardId: number, orderedIds: number[]): void {
    const db = getDb()
    const stmt = db.prepare('UPDATE columns SET position = ? WHERE id = ? AND board_id = ?')
    db.transaction(() => {
      orderedIds.forEach((id, idx) => stmt.run(idx, id, boardId))
    })()
  }
}

export const cardsRepo = {
  listByColumn(columnId: number): CardWithTags[] {
    const db = getDb()
    const cards = db
      .prepare('SELECT * FROM cards WHERE column_id = ? ORDER BY position ASC, id ASC')
      .all(columnId) as Card[]
    if (cards.length === 0) return []
    const placeholders = cards.map(() => '?').join(',')
    const rows = db
      .prepare(
        `SELECT ct.card_id, t.id, t.name, t.color
         FROM card_tags ct JOIN tags t ON t.id = ct.tag_id
         WHERE ct.card_id IN (${placeholders})`
      )
      .all(...cards.map((c) => c.id)) as Array<Tag & { card_id: number }>
    const byCard = new Map<number, Tag[]>()
    for (const r of rows) {
      const list = byCard.get(r.card_id) ?? []
      list.push({ id: r.id, name: r.name, color: r.color })
      byCard.set(r.card_id, list)
    }
    return cards.map((c) => ({ ...c, tags: byCard.get(c.id) ?? [] }))
  },
  create(columnId: number, title: string): Card {
    const db = getDb()
    const max = (
      db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM cards WHERE column_id = ?').get(columnId) as {
        m: number
      }
    ).m
    const info = db
      .prepare('INSERT INTO cards (column_id, title, position) VALUES (?, ?, ?)')
      .run(columnId, title, max + 1)
    return db.prepare('SELECT * FROM cards WHERE id = ?').get(info.lastInsertRowid) as Card
  },
  update(
    id: number,
    patch: Partial<
      Pick<Card, 'title' | 'description' | 'start_date' | 'due_date' | 'progress' | 'depends_on'>
    >
  ): void {
    const fields: string[] = []
    const values: unknown[] = []
    if (patch.title !== undefined) {
      fields.push('title = ?')
      values.push(patch.title)
    }
    if (patch.description !== undefined) {
      fields.push('description = ?')
      values.push(patch.description)
    }
    if (patch.start_date !== undefined) {
      fields.push('start_date = ?')
      values.push(patch.start_date)
    }
    if (patch.due_date !== undefined) {
      fields.push('due_date = ?')
      values.push(patch.due_date)
    }
    if (patch.progress !== undefined) {
      fields.push('progress = ?')
      values.push(Math.max(0, Math.min(100, Math.round(patch.progress))))
    }
    if (patch.depends_on !== undefined) {
      if (patch.depends_on !== null && wouldCreateCycle(id, patch.depends_on)) {
        throw new Error('La dependencia crearía un ciclo')
      }
      fields.push('depends_on = ?')
      values.push(patch.depends_on)
    }
    if (fields.length === 0) return
    values.push(id)
    getDb().prepare(`UPDATE cards SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  },
  listForBoard(boardId: number): GanttCard[] {
    const db = getDb()
    const rows = db
      .prepare(
        `SELECT c.*, col.name AS column_name, col.position AS column_position,
                col.board_id AS board_id, b.name AS board_name
         FROM cards c
         JOIN columns col ON col.id = c.column_id
         JOIN boards b ON b.id = col.board_id
         WHERE col.board_id = ?
         ORDER BY col.position ASC, c.position ASC, c.id ASC`
      )
      .all(boardId) as Array<Card & { column_name: string; column_position: number; board_id: number; board_name: string }>
    if (rows.length === 0) return []
    const placeholders = rows.map(() => '?').join(',')
    const tagRows = db
      .prepare(
        `SELECT ct.card_id, t.id, t.name, t.color
         FROM card_tags ct JOIN tags t ON t.id = ct.tag_id
         WHERE ct.card_id IN (${placeholders})`
      )
      .all(...rows.map((c) => c.id)) as Array<Tag & { card_id: number }>
    const byCard = new Map<number, Tag[]>()
    for (const r of tagRows) {
      const list = byCard.get(r.card_id) ?? []
      list.push({ id: r.id, name: r.name, color: r.color })
      byCard.set(r.card_id, list)
    }
    return rows.map((r) => ({ ...r, tags: byCard.get(r.id) ?? [] }))
  },
  remove(id: number): void {
    getDb().prepare('DELETE FROM cards WHERE id = ?').run(id)
  },
  move(cardId: number, toColumnId: number, orderedIds: number[]): void {
    const db = getDb()
    const moveStmt = db.prepare('UPDATE cards SET column_id = ? WHERE id = ?')
    const posStmt = db.prepare('UPDATE cards SET position = ? WHERE id = ?')
    db.transaction(() => {
      moveStmt.run(toColumnId, cardId)
      orderedIds.forEach((id, idx) => posStmt.run(idx, id))
    })()
  },
  setTags(cardId: number, tagIds: number[]): void {
    const db = getDb()
    const del = db.prepare('DELETE FROM card_tags WHERE card_id = ?')
    const ins = db.prepare('INSERT INTO card_tags (card_id, tag_id) VALUES (?, ?)')
    db.transaction(() => {
      del.run(cardId)
      for (const tagId of tagIds) ins.run(cardId, tagId)
    })()
  },
  listSiblings(cardId: number): GanttCard[] {
    const db = getDb()
    const row = db
      .prepare(
        `SELECT col.board_id AS board_id FROM cards c
         JOIN columns col ON col.id = c.column_id
         WHERE c.id = ?`
      )
      .get(cardId) as { board_id: number } | undefined
    if (!row) return []
    return cardsRepo.listForBoard(row.board_id)
  }
}

export const tagsRepo = {
  list(): Tag[] {
    return getDb().prepare('SELECT * FROM tags ORDER BY name ASC').all() as Tag[]
  },
  create(name: string, color: string): Tag {
    const db = getDb()
    const info = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(name, color)
    return db.prepare('SELECT * FROM tags WHERE id = ?').get(info.lastInsertRowid) as Tag
  },
  update(id: number, patch: Partial<Pick<Tag, 'name' | 'color'>>): void {
    const fields: string[] = []
    const values: unknown[] = []
    if (patch.name !== undefined) {
      fields.push('name = ?')
      values.push(patch.name)
    }
    if (patch.color !== undefined) {
      fields.push('color = ?')
      values.push(patch.color)
    }
    if (fields.length === 0) return
    values.push(id)
    getDb().prepare(`UPDATE tags SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  },
  remove(id: number): void {
    getDb().prepare('DELETE FROM tags WHERE id = ?').run(id)
  }
}

export const accountsRepo = {
  list(): Account[] {
    return getDb().prepare('SELECT * FROM accounts ORDER BY name ASC').all() as Account[]
  },
  create(name: string, currency: string, initialBalance: number): Account {
    const db = getDb()
    const info = db
      .prepare('INSERT INTO accounts (name, currency, initial_balance) VALUES (?, ?, ?)')
      .run(name, currency.toUpperCase(), initialBalance)
    return db.prepare('SELECT * FROM accounts WHERE id = ?').get(info.lastInsertRowid) as Account
  },
  update(id: number, patch: Partial<Pick<Account, 'name' | 'currency' | 'initial_balance'>>): void {
    const fields: string[] = []
    const values: unknown[] = []
    if (patch.name !== undefined) {
      fields.push('name = ?')
      values.push(patch.name)
    }
    if (patch.currency !== undefined) {
      fields.push('currency = ?')
      values.push(patch.currency.toUpperCase())
    }
    if (patch.initial_balance !== undefined) {
      fields.push('initial_balance = ?')
      values.push(patch.initial_balance)
    }
    if (fields.length === 0) return
    values.push(id)
    getDb().prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  },
  remove(id: number): void {
    getDb().prepare('DELETE FROM accounts WHERE id = ?').run(id)
  }
}

export const categoriesRepo = {
  list(): Category[] {
    return getDb().prepare('SELECT * FROM categories ORDER BY type, name ASC').all() as Category[]
  },
  create(name: string, type: TxType, color: string): Category {
    const db = getDb()
    const info = db
      .prepare('INSERT INTO categories (name, type, color) VALUES (?, ?, ?)')
      .run(name, type, color)
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid) as Category
  },
  update(id: number, patch: Partial<Pick<Category, 'name' | 'color'>>): void {
    const fields: string[] = []
    const values: unknown[] = []
    if (patch.name !== undefined) {
      fields.push('name = ?')
      values.push(patch.name)
    }
    if (patch.color !== undefined) {
      fields.push('color = ?')
      values.push(patch.color)
    }
    if (fields.length === 0) return
    values.push(id)
    getDb().prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  },
  remove(id: number): void {
    getDb().prepare('DELETE FROM categories WHERE id = ?').run(id)
  }
}

export const transactionsRepo = {
  list(filters?: { from?: string; to?: string; accountId?: number }): Transaction[] {
    const where: string[] = []
    const params: unknown[] = []
    if (filters?.from) {
      where.push('date >= ?')
      params.push(filters.from)
    }
    if (filters?.to) {
      where.push('date <= ?')
      params.push(filters.to)
    }
    if (filters?.accountId) {
      where.push('account_id = ?')
      params.push(filters.accountId)
    }
    const sql =
      'SELECT * FROM transactions' +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      ' ORDER BY date DESC, id DESC'
    return getDb().prepare(sql).all(...params) as Transaction[]
  },
  create(tx: Omit<Transaction, 'id' | 'created_at'>): Transaction {
    const db = getDb()
    const info = db
      .prepare(
        `INSERT INTO transactions (account_id, category_id, type, amount, currency, date, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        tx.account_id,
        tx.category_id,
        tx.type,
        tx.amount,
        tx.currency.toUpperCase(),
        tx.date,
        tx.note
      )
    return db.prepare('SELECT * FROM transactions WHERE id = ?').get(info.lastInsertRowid) as Transaction
  },
  update(id: number, patch: Partial<Omit<Transaction, 'id' | 'created_at'>>): void {
    const fields: string[] = []
    const values: unknown[] = []
    for (const [k, v] of Object.entries(patch)) {
      fields.push(`${k} = ?`)
      values.push(k === 'currency' && typeof v === 'string' ? v.toUpperCase() : v)
    }
    if (fields.length === 0) return
    values.push(id)
    getDb().prepare(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  },
  remove(id: number): void {
    getDb().prepare('DELETE FROM transactions WHERE id = ?').run(id)
  },
  monthlySummary(year: number): MonthlySummary[] {
    return getDb()
      .prepare(
        `SELECT substr(date,1,7) AS month, currency,
                SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS income,
                SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expense
         FROM transactions
         WHERE substr(date,1,4) = ?
         GROUP BY month, currency
         ORDER BY month ASC, currency ASC`
      )
      .all(String(year)) as MonthlySummary[]
  }
}

export const ratesRepo = {
  list(): ExchangeRate[] {
    return getDb()
      .prepare('SELECT * FROM exchange_rates ORDER BY from_currency, to_currency')
      .all() as ExchangeRate[]
  },
  upsert(rate: ExchangeRate): void {
    getDb()
      .prepare(
        `INSERT INTO exchange_rates (from_currency, to_currency, rate, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(from_currency, to_currency) DO UPDATE SET
           rate = excluded.rate, updated_at = datetime('now')`
      )
      .run(rate.from_currency.toUpperCase(), rate.to_currency.toUpperCase(), rate.rate)
  },
  remove(from: string, to: string): void {
    getDb()
      .prepare('DELETE FROM exchange_rates WHERE from_currency = ? AND to_currency = ?')
      .run(from.toUpperCase(), to.toUpperCase())
  }
}
