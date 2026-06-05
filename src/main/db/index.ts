import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import Database from 'better-sqlite3'
import { SCHEMA_SQL, SEED_SQL } from './schema'

let db: Database.Database | null = null

export function getDbPath(): string {
  return path.join(app.getPath('userData'), 'dashboard.db')
}

function ensureColumn(
  conn: Database.Database,
  table: string,
  column: string,
  ddl: string
): void {
  const cols = conn.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === column)) {
    conn.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
  }
}

function runMigrations(conn: Database.Database): void {
  ensureColumn(conn, 'cards', 'start_date', 'start_date TEXT')
  ensureColumn(conn, 'cards', 'progress', 'progress INTEGER NOT NULL DEFAULT 0')
  ensureColumn(conn, 'cards', 'depends_on', 'depends_on INTEGER REFERENCES cards(id) ON DELETE SET NULL')
  conn.exec('CREATE INDEX IF NOT EXISTS idx_cards_depends_on ON cards(depends_on)')
  ensureColumn(conn, 'boards', 'theme', "theme TEXT NOT NULL DEFAULT 'rose'")
  // Cover attachment: id of the attachment used as cover, or null.
  // ON DELETE SET NULL is enforced at the application layer (SQLite doesn't
  // allow adding a column with a FK constraint via ALTER TABLE).
  ensureColumn(conn, 'cards', 'cover_attachment_id', 'cover_attachment_id INTEGER')
  ensureColumn(conn, 'cards', 'kind', "kind TEXT NOT NULL DEFAULT 'normal'")
  ensureColumn(conn, 'cards', 'banner_color', 'banner_color TEXT')
  // Checklist table (created here in case the SCHEMA_SQL is too old to include it).
  conn.exec(`
    CREATE TABLE IF NOT EXISTS checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_checklist_card ON checklist_items(card_id);
  `)
}

export function getDb(): Database.Database {
  if (db) return db
  const dbPath = getDbPath()
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  db = new Database(dbPath)
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA_SQL)
  runMigrations(db)
  db.exec(SEED_SQL)
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

/**
 * Closes the current connection, copies `sourcePath` over the live db,
 * and reopens (running migrations). Existing live db is moved aside as `.replaced-<ts>.db`
 * inside userData so the user could recover it manually if needed.
 */
export function replaceDbFromFile(sourcePath: string): void {
  const target = getDbPath()
  closeDb()
  if (fs.existsSync(target)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const aside = `${target}.replaced-${stamp}`
    fs.renameSync(target, aside)
  }
  // SQLite WAL/SHM sidecars from the previous db must not linger.
  for (const ext of ['-wal', '-shm']) {
    const p = target + ext
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }
  fs.copyFileSync(sourcePath, target)
  // Lazily reopen on next getDb()
  getDb()
}
