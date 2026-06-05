import { app, dialog, shell, protocol, net } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { attachmentsRepo } from './db/repos'
import type { Attachment } from '../shared/types'

const PROTOCOL = 'bloom-attachment'

export function attachmentsDir(): string {
  const dir = path.join(app.getPath('userData'), 'attachments')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function safeExt(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  // Allow only common extensions, fallback to .bin.
  if (/^\.[a-z0-9]{1,8}$/i.test(ext)) return ext
  return '.bin'
}

function guessMime(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase()
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.zip': 'application/zip',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg'
  }
  return map[ext] ?? null
}

/**
 * Copies the file at `sourcePath` into the attachments dir under a unique
 * filename and creates the DB row. Returns the new Attachment row.
 */
export function ingest(cardId: number, sourcePath: string): Attachment {
  const stat = fs.statSync(sourcePath)
  if (!stat.isFile()) throw new Error('No es un archivo válido')
  const original = path.basename(sourcePath)
  const ext = safeExt(original)
  const unique = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`
  const destAbs = path.join(attachmentsDir(), unique)
  fs.copyFileSync(sourcePath, destAbs)
  return attachmentsRepo.create({
    cardId,
    path: unique,
    filename: original,
    mimeType: guessMime(original),
    sizeBytes: stat.size
  })
}

/** Opens the native open dialog and ingests each selected file. */
export async function pickAndIngest(cardId: number): Promise<Attachment[]> {
  const r = await dialog.showOpenDialog({
    title: 'Seleccionar adjunto',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] },
      { name: 'Documentos', extensions: ['pdf', 'txt', 'md', 'docx', 'xlsx'] },
      { name: 'Todos', extensions: ['*'] }
    ]
  })
  if (r.canceled || r.filePaths.length === 0) return []
  return r.filePaths.map((p) => ingest(cardId, p))
}

/** Removes the DB row AND the file on disk. */
export function removeAttachment(id: number): boolean {
  const row = attachmentsRepo.remove(id)
  if (!row) return false
  try {
    fs.unlinkSync(path.join(attachmentsDir(), row.path))
  } catch {
    // already gone — ignore
  }
  return true
}

/** Reveals the attachment in Finder/Explorer or opens it with the default app. */
export function openAttachment(id: number, mode: 'open' | 'reveal'): boolean {
  const a = attachmentsRepo.get(id)
  if (!a) return false
  const abs = path.join(attachmentsDir(), a.path)
  if (mode === 'open') shell.openPath(abs)
  else shell.showItemInFolder(abs)
  return true
}

/**
 * Registers `bloom-attachment://<relative>` so the renderer can <img src="..."/>
 * without CSP/file:// issues. Call once during app whenReady.
 */
export function registerProtocol(): void {
  protocol.handle(PROTOCOL, (request) => {
    const url = new URL(request.url)
    // URL shape: bloom-attachment://local/<filename>
    // We only care about the pathname (the filename); the "local" host is a
    // dummy authority needed for the URL to parse.
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    const dir = attachmentsDir()
    const abs = path.resolve(dir, rel)
    if (!abs.startsWith(dir + path.sep)) {
      return new Response('Forbidden', { status: 403 })
    }
    if (!fs.existsSync(abs)) {
      return new Response('Not found: ' + rel, { status: 404 })
    }
    return net.fetch(pathToFileURL(abs).toString())
  })
}

/** Must be called BEFORE `app.whenReady()` to set the scheme as privileged. */
export function registerPrivilegedScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: PROTOCOL,
      privileges: {
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: false
      }
    }
  ])
}

export function attachmentUrl(rel: string): string {
  // Use the leading authority slot for the filename so URL parses sanely.
  return `${PROTOCOL}://local/${encodeURIComponent(rel)}`
}
