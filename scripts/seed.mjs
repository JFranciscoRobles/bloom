// Seed the Bloom database with realistic data for portfolio screenshots.
// Run with: npm run seed
//
// What it does:
//   1) Locates the live db at <userData>/dashboard.db (same path the app uses)
//   2) Backs it up to <userData>/dashboard.db.before-seed-<ts>
//   3) Wipes all tables (in the right order, respecting FKs)
//   4) Inserts boards, columns, cards (with tags + dependencies + progress),
//      accounts, categories, transactions over the last 6 months, and rates.
//
// Safe to re-run: every run wipes + reseeds.

import { existsSync, copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import Database from 'better-sqlite3'

// --------------------------------------------------------------------------
// Locate the userData db path (matches Electron's app.getPath('userData'))
// --------------------------------------------------------------------------
function userDataDir() {
  const home = homedir()
  if (process.platform === 'darwin') return join(home, 'Library', 'Application Support', 'bloom')
  if (process.platform === 'win32') return join(process.env.APPDATA || home, 'bloom')
  return join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'bloom')
}

const dbPath = join(userDataDir(), 'dashboard.db')
mkdirSync(dirname(dbPath), { recursive: true })

// --------------------------------------------------------------------------
// Backup the current db if it exists
// --------------------------------------------------------------------------
if (existsSync(dbPath)) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = `${dbPath}.before-seed-${stamp}`
  copyFileSync(dbPath, backup)
  console.log(`✓ Backed up current db to: ${backup}`)
}

const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

// Make sure tables exist (use the same schema as the app).
db.exec(`
CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  theme TEXT NOT NULL DEFAULT 'rose',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS columns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  column_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date TEXT,
  due_date TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  depends_on INTEGER REFERENCES cards(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#cbd5e1'
);
CREATE TABLE IF NOT EXISTS card_tags (
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, tag_id)
);
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  initial_balance REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  color TEXT NOT NULL DEFAULT '#cbd5e1',
  UNIQUE (name, type)
);
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS exchange_rates (
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate REAL NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (from_currency, to_currency)
);
`)

// --------------------------------------------------------------------------
// Wipe in the right order (children -> parents)
// --------------------------------------------------------------------------
db.transaction(() => {
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
})()
console.log('✓ Wiped all tables')

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
const today = new Date()
const TODAY = today.toISOString().slice(0, 10)

function shiftDate(days) {
  const d = new Date(today)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function insertBoard(name, theme, position) {
  return db
    .prepare('INSERT INTO boards (name, theme, position) VALUES (?, ?, ?)')
    .run(name, theme, position).lastInsertRowid
}
function insertColumn(boardId, name, position) {
  return db
    .prepare('INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)')
    .run(boardId, name, position).lastInsertRowid
}
function insertCard({
  columnId,
  title,
  description = null,
  startOffset = null,
  dueOffset = null,
  progress = 0,
  dependsOn = null,
  position = 0,
  tags = []
}) {
  const id = db
    .prepare(
      `INSERT INTO cards
         (column_id, title, description, start_date, due_date, progress, depends_on, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      columnId,
      title,
      description,
      startOffset != null ? shiftDate(startOffset) : null,
      dueOffset != null ? shiftDate(dueOffset) : null,
      progress,
      dependsOn,
      position
    ).lastInsertRowid
  for (const tagId of tags) {
    db.prepare('INSERT INTO card_tags (card_id, tag_id) VALUES (?, ?)').run(id, tagId)
  }
  return id
}
function insertTag(name, color) {
  return db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(name, color).lastInsertRowid
}
function insertAccount(name, currency, initial) {
  return db
    .prepare('INSERT INTO accounts (name, currency, initial_balance) VALUES (?, ?, ?)')
    .run(name, currency, initial).lastInsertRowid
}
function insertCategory(name, type, color) {
  return db
    .prepare('INSERT INTO categories (name, type, color) VALUES (?, ?, ?)')
    .run(name, type, color).lastInsertRowid
}
function insertTransaction(accountId, categoryId, type, amount, currency, date, note = null) {
  return db
    .prepare(
      `INSERT INTO transactions (account_id, category_id, type, amount, currency, date, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(accountId, categoryId, type, amount, currency, date, note).lastInsertRowid
}

// --------------------------------------------------------------------------
// Tags (shared across boards)
// --------------------------------------------------------------------------
const tag = {
  urgente: insertTag('Urgente', '#fca5a5'),
  importante: insertTag('Importante', '#f9a8d4'),
  rapido: insertTag('Quick win', '#86efac'),
  enfoque: insertTag('Enfoque', '#c4b5fd'),
  bloqueado: insertTag('Bloqueado', '#fcd5b5'),
  reunion: insertTag('Reunión', '#93c5fd'),
  esperando: insertTag('Esperando', '#fde68a'),
  personal: insertTag('Personal', '#a5f3fc'),
  cliente: insertTag('Cliente', '#e9d5ff'),
  casa: insertTag('Casa', '#fcd5b5')
}
console.log('✓ Tags created')

// --------------------------------------------------------------------------
// Boards
// --------------------------------------------------------------------------
const trabajoId = insertBoard('Trabajo', 'sky', 0)
const personalId = insertBoard('Personal', 'rose', 1)
const casaId = insertBoard('Casa', 'mint', 2)
const freelanceId = insertBoard('Freelance · Cliente Acme', 'lavender', 3)
const saludId = insertBoard('Salud y bienestar', 'peach', 4)

const inboxId = insertBoard('Inbox', 'rose', 5)
const inboxCol = insertColumn(inboxId, 'Por revisar', 0)
insertCard({
  columnId: inboxCol,
  title: 'Revisar artículo sobre productividad pastel',
  description: 'Link que mandó Pao por whatsapp. Ver si aplica al post de marzo.',
  position: 0
})
insertCard({
  columnId: inboxCol,
  title: 'Cotizar mantenimiento del coche',
  description: 'Pedir 3 cotizaciones. Servicio mayor a 80,000km.',
  position: 1,
  tags: [tag.casa]
})
insertCard({
  columnId: inboxCol,
  title: 'Idea: agregar widget de "hoy" a Bloom',
  description: 'En el inicio mostrar tareas que vencen + balance del día.',
  position: 2
})

console.log('✓ Boards created')

// --------------------------------------------------------------------------
// Trabajo
// --------------------------------------------------------------------------
{
  const cBacklog = insertColumn(trabajoId, 'Backlog', 0)
  const cSemana = insertColumn(trabajoId, 'Esta semana', 1)
  const cProgreso = insertColumn(trabajoId, 'En progreso', 2)
  const cReview = insertColumn(trabajoId, 'En review', 3)
  const cHecho = insertColumn(trabajoId, 'Hecho', 4)

  // En progreso / Esta semana
  const designId = insertCard({
    columnId: cProgreso,
    title: 'Rediseño del dashboard de ventas',
    description:
      'Trabajar con Diego en los nuevos mockups. Reunión el viernes para revisar avance con dirección.',
    startOffset: -5,
    dueOffset: 4,
    progress: 60,
    position: 0,
    tags: [tag.importante, tag.cliente]
  })
  insertCard({
    columnId: cProgreso,
    title: 'Implementar filtros de reporte por fecha',
    description: 'Tarea técnica relacionada al rediseño. Bloqueada hasta tener mocks finales.',
    startOffset: -2,
    dueOffset: 7,
    progress: 25,
    dependsOn: designId,
    position: 1,
    tags: [tag.bloqueado]
  })
  insertCard({
    columnId: cSemana,
    title: 'Preparar demo para reunión del jueves',
    description: 'Slides + walkthrough con datos reales. 15 min máximo.',
    startOffset: 1,
    dueOffset: 3,
    progress: 10,
    position: 0,
    tags: [tag.urgente, tag.reunion]
  })
  insertCard({
    columnId: cSemana,
    title: 'Reunión 1:1 con Lupita',
    description: 'Revisar OKRs del trimestre. Llevar notas de las últimas 2 sesiones.',
    startOffset: 2,
    dueOffset: 2,
    progress: 0,
    position: 1,
    tags: [tag.reunion]
  })
  insertCard({
    columnId: cSemana,
    title: 'Responder PR de Diego sobre auth',
    description: 'Pendiente desde el lunes. Revisar especialmente el manejo de refresh tokens.',
    startOffset: -1,
    dueOffset: 1,
    progress: 0,
    position: 2,
    tags: [tag.rapido]
  })
  insertCard({
    columnId: cReview,
    title: 'PR: migración de logger',
    description: 'Esperando feedback de Roberto.',
    startOffset: -3,
    dueOffset: 1,
    progress: 90,
    position: 0,
    tags: [tag.esperando]
  })

  // Backlog
  insertCard({
    columnId: cBacklog,
    title: 'Investigar adopción de Tanstack Query v5',
    description: 'Notas en Notion. Identificar puntos de migración.',
    progress: 0,
    position: 0,
    tags: [tag.enfoque]
  })
  insertCard({
    columnId: cBacklog,
    title: 'Documentar setup de entorno local',
    description: 'Para nuevos integrantes. Pedido por RRHH.',
    progress: 0,
    position: 1
  })
  insertCard({
    columnId: cBacklog,
    title: 'Refactor del módulo de notificaciones',
    description: 'Llevamos 6 meses con código temporal. Estimar cuándo meterlo en sprint.',
    progress: 0,
    position: 2
  })
  insertCard({
    columnId: cBacklog,
    title: 'Hacer audit de accesibilidad básica',
    description: 'Pasar Lighthouse en las 5 pantallas principales.',
    progress: 0,
    position: 3
  })

  // Hecho
  insertCard({
    columnId: cHecho,
    title: 'Actualizar dependencias a Node 20',
    description: 'Sin breaking changes. Tests verdes.',
    startOffset: -14,
    dueOffset: -10,
    progress: 100,
    position: 0
  })
  insertCard({
    columnId: cHecho,
    title: 'Onboarding de Diego',
    description: 'Setup completo, ya tomó su primer ticket.',
    startOffset: -20,
    dueOffset: -16,
    progress: 100,
    position: 1
  })
  insertCard({
    columnId: cHecho,
    title: 'Presentación Q1 a stakeholders',
    description: 'Bien recibida. Quedaron 3 follow-ups en otra columna.',
    startOffset: -28,
    dueOffset: -25,
    progress: 100,
    position: 2,
    tags: [tag.reunion]
  })
}

// --------------------------------------------------------------------------
// Personal
// --------------------------------------------------------------------------
{
  const cIdeas = insertColumn(personalId, 'Ideas', 0)
  const cAhorita = insertColumn(personalId, 'Esta semana', 1)
  const cProgreso = insertColumn(personalId, 'En progreso', 2)
  const cHecho = insertColumn(personalId, 'Hecho', 3)

  insertCard({
    columnId: cAhorita,
    title: 'Renovar pasaporte',
    description: 'Cita el martes 11am. Llevar acta, comprobante, foto, pago de derechos.',
    startOffset: 4,
    dueOffset: 4,
    progress: 50,
    position: 0,
    tags: [tag.urgente, tag.personal]
  })
  insertCard({
    columnId: cAhorita,
    title: 'Llamar al cardiólogo de papá',
    description: 'Confirmar resultados del último estudio.',
    startOffset: 0,
    dueOffset: 1,
    progress: 0,
    position: 1,
    tags: [tag.urgente]
  })
  insertCard({
    columnId: cAhorita,
    title: 'Comprar regalo de cumple para Pao',
    description: 'Tiene su cumple el 30. Pensar algo no obvio.',
    startOffset: -1,
    dueOffset: 16,
    progress: 30,
    position: 2,
    tags: [tag.importante]
  })
  insertCard({
    columnId: cProgreso,
    title: 'Curso "Diseño de sistemas" en Frontend Masters',
    description: 'Voy en el módulo 3 de 7. ~2h por semana.',
    startOffset: -30,
    dueOffset: 45,
    progress: 40,
    position: 0,
    tags: [tag.enfoque]
  })
  insertCard({
    columnId: cProgreso,
    title: 'Leer "The Pragmatic Programmer"',
    description: 'Capítulo 6 en adelante. Tomar notas en Obsidian.',
    startOffset: -25,
    dueOffset: 60,
    progress: 55,
    position: 1
  })

  insertCard({
    columnId: cIdeas,
    title: 'Idea: blog post sobre Electron + SQLite',
    description: 'Basado en lo que aprendí construyendo Bloom.',
    position: 0
  })
  insertCard({
    columnId: cIdeas,
    title: 'Aprender un poco de Rust en vacaciones',
    description: 'Solo para entender. Sin meta de producir nada.',
    position: 1
  })
  insertCard({
    columnId: cIdeas,
    title: 'Hacer un viaje a Oaxaca antes de fin de año',
    description: 'Buscar fechas baratas en septiembre.',
    position: 2
  })

  insertCard({
    columnId: cHecho,
    title: 'Pagar tenencia',
    startOffset: -7,
    dueOffset: -7,
    progress: 100,
    position: 0
  })
  insertCard({
    columnId: cHecho,
    title: 'Configurar Bloom 🌸',
    description: '¡Listo! Migración desde Notion completa.',
    startOffset: -10,
    dueOffset: -8,
    progress: 100,
    position: 1
  })
}

// --------------------------------------------------------------------------
// Casa
// --------------------------------------------------------------------------
{
  const cPorHacer = insertColumn(casaId, 'Por hacer', 0)
  const cCompras = insertColumn(casaId, 'Compras', 1)
  const cMantto = insertColumn(casaId, 'Mantenimiento', 2)
  const cHecho = insertColumn(casaId, 'Hecho', 3)

  insertCard({
    columnId: cPorHacer,
    title: 'Cambiar el foco del baño',
    description: 'El de la regadera. Comprar uno cálido.',
    dueOffset: 5,
    progress: 0,
    position: 0,
    tags: [tag.casa, tag.rapido]
  })
  insertCard({
    columnId: cPorHacer,
    title: 'Organizar el closet de la entrada',
    description: 'Sacar lo que no se usa. Donar lo que se pueda.',
    dueOffset: 14,
    progress: 0,
    position: 1,
    tags: [tag.casa]
  })
  insertCard({
    columnId: cPorHacer,
    title: 'Llamar al plomero por la fuga del lavabo',
    dueOffset: 2,
    progress: 0,
    position: 2,
    tags: [tag.urgente, tag.casa]
  })
  insertCard({
    columnId: cCompras,
    title: 'Detergente, suavizante, papel higiénico',
    description: 'En Costco, va para mes y medio.',
    dueOffset: 3,
    progress: 0,
    position: 0
  })
  insertCard({
    columnId: cCompras,
    title: 'Maceta grande para la sala',
    description: 'La monstera ya está muy apretada.',
    dueOffset: 21,
    progress: 0,
    position: 1
  })
  insertCard({
    columnId: cMantto,
    title: 'Servicio del coche (80,000 km)',
    description: 'Verificar precios y disponibilidad este mes.',
    startOffset: 7,
    dueOffset: 25,
    progress: 10,
    position: 0,
    tags: [tag.casa]
  })
  insertCard({
    columnId: cMantto,
    title: 'Revisar boiler antes de invierno',
    description: 'Última vez fue hace un año.',
    dueOffset: 90,
    progress: 0,
    position: 1
  })
  insertCard({
    columnId: cHecho,
    title: 'Pago de mantenimiento mensual',
    startOffset: -6,
    dueOffset: -6,
    progress: 100,
    position: 0
  })
  insertCard({
    columnId: cHecho,
    title: 'Colgar el cuadro de la sala',
    progress: 100,
    startOffset: -12,
    dueOffset: -12,
    position: 1
  })
}

// --------------------------------------------------------------------------
// Freelance · Cliente Acme
// --------------------------------------------------------------------------
{
  const cDiscovery = insertColumn(freelanceId, 'Discovery', 0)
  const cDiseno = insertColumn(freelanceId, 'Diseño', 1)
  const cDev = insertColumn(freelanceId, 'Desarrollo', 2)
  const cQA = insertColumn(freelanceId, 'QA', 3)
  const cEntregado = insertColumn(freelanceId, 'Entregado', 4)

  const briefId = insertCard({
    columnId: cEntregado,
    title: 'Brief inicial con cliente',
    description: 'Reunión con el equipo de marketing. Acordamos alcance y entregables.',
    startOffset: -45,
    dueOffset: -42,
    progress: 100,
    position: 0,
    tags: [tag.cliente, tag.reunion]
  })
  const moodId = insertCard({
    columnId: cEntregado,
    title: 'Moodboard + propuesta de dirección',
    description: 'Aprobado en la segunda iteración.',
    startOffset: -40,
    dueOffset: -33,
    progress: 100,
    dependsOn: briefId,
    position: 1
  })
  const wireId = insertCard({
    columnId: cDiseno,
    title: 'Wireframes alta fidelidad - landing',
    description: 'Hero, beneficios, testimonios, pricing, FAQ, footer.',
    startOffset: -10,
    dueOffset: 4,
    progress: 70,
    dependsOn: moodId,
    position: 0,
    tags: [tag.cliente]
  })
  insertCard({
    columnId: cDev,
    title: 'Setup Next.js + Tailwind + Vercel',
    description: 'Listo en preview. URL compartida con el cliente.',
    startOffset: -7,
    dueOffset: -2,
    progress: 100,
    position: 0
  })
  insertCard({
    columnId: cDev,
    title: 'Implementar hero animado',
    description: 'Framer Motion para entrada, sticky scroll. Avanzando bien.',
    startOffset: -3,
    dueOffset: 6,
    progress: 50,
    dependsOn: wireId,
    position: 1,
    tags: [tag.enfoque]
  })
  insertCard({
    columnId: cDev,
    title: 'Form de contacto con Resend',
    description: 'Validación con Zod, anti-spam con honeypot.',
    startOffset: 4,
    dueOffset: 10,
    progress: 0,
    position: 2,
    tags: [tag.cliente]
  })
  insertCard({
    columnId: cDev,
    title: 'Sección de pricing con toggle mensual/anual',
    startOffset: 6,
    dueOffset: 12,
    progress: 0,
    position: 3
  })
  insertCard({
    columnId: cQA,
    title: 'Pruebas en Safari iOS',
    description: 'Esperando que dev termine hero animado.',
    startOffset: 12,
    dueOffset: 16,
    progress: 0,
    position: 0,
    tags: [tag.esperando]
  })
  insertCard({
    columnId: cDiscovery,
    title: 'Definir scope de fase 2 (blog + CMS)',
    description: 'Llamada agendada para la próxima semana.',
    dueOffset: 9,
    progress: 0,
    position: 0,
    tags: [tag.cliente, tag.reunion]
  })
}

// --------------------------------------------------------------------------
// Salud y bienestar
// --------------------------------------------------------------------------
{
  const cRutina = insertColumn(saludId, 'Rutina', 0)
  const cMedico = insertColumn(saludId, 'Médico', 1)
  const cMetas = insertColumn(saludId, 'Metas del mes', 2)

  insertCard({
    columnId: cRutina,
    title: 'Gym 3x/semana',
    description: 'Lunes, miércoles, viernes 7am. Plan de fuerza.',
    startOffset: -30,
    dueOffset: 365,
    progress: 70,
    position: 0,
    tags: [tag.enfoque, tag.personal]
  })
  insertCard({
    columnId: cRutina,
    title: 'Meditar 10 min al día',
    description: 'App Insight Timer. Antes de dormir.',
    startOffset: -60,
    dueOffset: 365,
    progress: 85,
    position: 1,
    tags: [tag.personal]
  })
  insertCard({
    columnId: cRutina,
    title: 'Cocinar el lunch los domingos',
    description: 'Ahorra tiempo, dinero y como mejor.',
    startOffset: -90,
    dueOffset: 365,
    progress: 90,
    position: 2
  })
  insertCard({
    columnId: cMedico,
    title: 'Cita con el dentista (limpieza)',
    description: 'Ya tocaba. Sacar cita esta semana.',
    dueOffset: 8,
    progress: 0,
    position: 0,
    tags: [tag.importante]
  })
  insertCard({
    columnId: cMedico,
    title: 'Análisis de sangre anual',
    description: 'En ayuno. Pedirlo con tiempo en el laboratorio.',
    dueOffset: 30,
    progress: 0,
    position: 1
  })
  insertCard({
    columnId: cMetas,
    title: 'Caminar 8,000 pasos al día (mayo)',
    description: 'Voy en 6,200 promedio.',
    startOffset: -14,
    dueOffset: 16,
    progress: 65,
    position: 0,
    tags: [tag.enfoque]
  })
  insertCard({
    columnId: cMetas,
    title: 'Reducir café a 1 taza al día',
    description: 'Cambiar la segunda por té verde.',
    startOffset: -10,
    dueOffset: 20,
    progress: 40,
    position: 1
  })
}

console.log('✓ Cards seeded')

// --------------------------------------------------------------------------
// Finance: accounts, categories, transactions
// --------------------------------------------------------------------------
const nominaId = insertAccount('Cuenta nómina', 'MXN', 12500)
const ahorrosId = insertAccount('Ahorros BBVA', 'MXN', 84000)
const freelanceAccId = insertAccount('Freelance USD', 'USD', 1850)
const efectivoId = insertAccount('Efectivo', 'MXN', 600)

// Categories
const catRenta = insertCategory('Renta', 'expense', '#fca5a5')
const catDespensa = insertCategory('Despensa', 'expense', '#fcd5b5')
const catRestaurantes = insertCategory('Restaurantes', 'expense', '#fde68a')
const catTransporte = insertCategory('Transporte', 'expense', '#93c5fd')
const catSuscripciones = insertCategory('Suscripciones', 'expense', '#c4b5fd')
const catSalud = insertCategory('Salud', 'expense', '#bbf7d0')
const catCasa = insertCategory('Casa y servicios', 'expense', '#f9a8d4')
const catOcio = insertCategory('Ocio', 'expense', '#a5f3fc')
const catEducacion = insertCategory('Educación', 'expense', '#e9d5ff')
const catRegalos = insertCategory('Regalos', 'expense', '#f5d0fe')

const catSueldo = insertCategory('Sueldo', 'income', '#86efac')
const catFreelance = insertCategory('Freelance', 'income', '#a5f3fc')
const catInteres = insertCategory('Intereses', 'income', '#fde68a')
const catReembolso = insertCategory('Reembolsos', 'income', '#fcd5b5')

// Exchange rate
db.prepare(
  `INSERT INTO exchange_rates (from_currency, to_currency, rate, updated_at)
   VALUES (?, ?, ?, datetime('now'))`
).run('USD', 'MXN', 17.2)
db.prepare(
  `INSERT INTO exchange_rates (from_currency, to_currency, rate, updated_at)
   VALUES (?, ?, ?, datetime('now'))`
).run('MXN', 'USD', 0.058)

// Distribute transactions across the last 6 months
function range(n) {
  return Array.from({ length: n }, (_, i) => i)
}
function dateInMonth(monthsBack, dayOfMonth) {
  const d = new Date(today)
  d.setMonth(d.getMonth() - monthsBack)
  d.setDate(dayOfMonth)
  return d.toISOString().slice(0, 10)
}

// 6 months ago through current; index 0 = current month, 5 = 5 months ago.
for (const m of range(6)) {
  // === Income ===
  // Sueldo quincenal
  insertTransaction(nominaId, catSueldo, 'income', 18500, 'MXN', dateInMonth(m, 1), 'Quincena 1')
  insertTransaction(nominaId, catSueldo, 'income', 18500, 'MXN', dateInMonth(m, 15), 'Quincena 2')
  // Pago de cliente freelance (algunos meses)
  if ([0, 1, 3, 5].includes(m)) {
    insertTransaction(
      freelanceAccId,
      catFreelance,
      'income',
      m === 0 ? 1200 : 800,
      'USD',
      dateInMonth(m, 10),
      m === 0 ? 'Acme · primer hito' : 'Cliente · proyecto landing'
    )
  }
  // Intereses
  insertTransaction(
    ahorrosId,
    catInteres,
    'income',
    260 + Math.floor(Math.random() * 40),
    'MXN',
    dateInMonth(m, 28),
    'Intereses BBVA'
  )
  if (m === 2) {
    insertTransaction(
      nominaId,
      catReembolso,
      'income',
      450,
      'MXN',
      dateInMonth(m, 8),
      'Reembolso seguro'
    )
  }

  // === Expenses ===
  // Renta
  insertTransaction(nominaId, catRenta, 'expense', 9500, 'MXN', dateInMonth(m, 2), 'Renta depto')
  // Casa y servicios
  insertTransaction(nominaId, catCasa, 'expense', 720, 'MXN', dateInMonth(m, 5), 'CFE')
  insertTransaction(nominaId, catCasa, 'expense', 380, 'MXN', dateInMonth(m, 7), 'Internet Totalplay')
  insertTransaction(nominaId, catCasa, 'expense', 220, 'MXN', dateInMonth(m, 12), 'Agua')
  insertTransaction(nominaId, catCasa, 'expense', 1100, 'MXN', dateInMonth(m, 4), 'Mantenimiento depto')

  // Despensa (varias compras)
  insertTransaction(nominaId, catDespensa, 'expense', 1850, 'MXN', dateInMonth(m, 3), 'Super semanal')
  insertTransaction(nominaId, catDespensa, 'expense', 920, 'MXN', dateInMonth(m, 11), 'Bodega Aurrera')
  insertTransaction(nominaId, catDespensa, 'expense', 1640, 'MXN', dateInMonth(m, 19), 'Costco')
  insertTransaction(nominaId, catDespensa, 'expense', 540, 'MXN', dateInMonth(m, 26), 'Frutas y verduras')

  // Restaurantes
  insertTransaction(nominaId, catRestaurantes, 'expense', 320, 'MXN', dateInMonth(m, 6), 'Comida con Pao')
  insertTransaction(nominaId, catRestaurantes, 'expense', 180, 'MXN', dateInMonth(m, 13), 'Café')
  insertTransaction(nominaId, catRestaurantes, 'expense', 460, 'MXN', dateInMonth(m, 20), 'Cena viernes')
  insertTransaction(efectivoId, catRestaurantes, 'expense', 95, 'MXN', dateInMonth(m, 22), 'Tacos')

  // Transporte
  insertTransaction(nominaId, catTransporte, 'expense', 220, 'MXN', dateInMonth(m, 4), 'Uber')
  insertTransaction(nominaId, catTransporte, 'expense', 180, 'MXN', dateInMonth(m, 14), 'Gasolina')
  insertTransaction(nominaId, catTransporte, 'expense', 65, 'MXN', dateInMonth(m, 21), 'Metro/recarga')

  // Suscripciones
  insertTransaction(nominaId, catSuscripciones, 'expense', 219, 'MXN', dateInMonth(m, 1), 'Spotify')
  insertTransaction(nominaId, catSuscripciones, 'expense', 299, 'MXN', dateInMonth(m, 3), 'Netflix')
  insertTransaction(freelanceAccId, catSuscripciones, 'expense', 11, 'USD', dateInMonth(m, 8), 'GitHub Pro')
  if (m % 2 === 0) {
    insertTransaction(
      freelanceAccId,
      catSuscripciones,
      'expense',
      20,
      'USD',
      dateInMonth(m, 17),
      'ChatGPT Plus'
    )
  }

  // Educación
  if ([0, 2, 4].includes(m)) {
    insertTransaction(
      freelanceAccId,
      catEducacion,
      'expense',
      39,
      'USD',
      dateInMonth(m, 9),
      'Frontend Masters'
    )
  }

  // Ocio
  insertTransaction(nominaId, catOcio, 'expense', 250, 'MXN', dateInMonth(m, 18), 'Cine + palomitas')
  if (m === 1) {
    insertTransaction(
      ahorrosId,
      catOcio,
      'expense',
      3200,
      'MXN',
      dateInMonth(m, 23),
      'Boletos concierto'
    )
  }

  // Salud
  insertTransaction(nominaId, catSalud, 'expense', 580, 'MXN', dateInMonth(m, 16), 'Gym mensual')
  if (m === 3) {
    insertTransaction(
      nominaId,
      catSalud,
      'expense',
      950,
      'MXN',
      dateInMonth(m, 9),
      'Consulta médica'
    )
  }

  // Regalos
  if (m === 0) {
    insertTransaction(
      ahorrosId,
      catRegalos,
      'expense',
      1400,
      'MXN',
      dateInMonth(m, 24),
      'Regalo cumple Pao'
    )
  }
  if (m === 2) {
    insertTransaction(
      nominaId,
      catRegalos,
      'expense',
      650,
      'MXN',
      dateInMonth(m, 12),
      'Día de las madres'
    )
  }
}

console.log('✓ Finance data seeded')

// --------------------------------------------------------------------------
// Summary
// --------------------------------------------------------------------------
const counts = {
  boards: db.prepare('SELECT COUNT(*) AS c FROM boards').get().c,
  columns: db.prepare('SELECT COUNT(*) AS c FROM columns').get().c,
  cards: db.prepare('SELECT COUNT(*) AS c FROM cards').get().c,
  tags: db.prepare('SELECT COUNT(*) AS c FROM tags').get().c,
  accounts: db.prepare('SELECT COUNT(*) AS c FROM accounts').get().c,
  categories: db.prepare('SELECT COUNT(*) AS c FROM categories').get().c,
  transactions: db.prepare('SELECT COUNT(*) AS c FROM transactions').get().c
}

console.log('\n✨ Seed complete:')
for (const [k, v] of Object.entries(counts)) {
  console.log(`  ${k.padEnd(14)} ${v}`)
}
console.log(`\nDatabase at: ${dbPath}`)
console.log('Restart Bloom to see the new data.')

db.close()
