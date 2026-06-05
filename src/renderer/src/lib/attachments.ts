/** Mirror of attachments.attachmentUrl in main — same scheme used by the custom protocol. */
export function attachmentUrl(relPath: string): string {
  return `bloom-attachment://local/${encodeURIComponent(relPath)}`
}

/** True for mime types that browsers can render with <img>. */
export function isImage(mime: string | null | undefined): boolean {
  if (!mime) return false
  return mime.startsWith('image/')
}

/** Human-readable file size. */
export function formatBytes(n: number | null | undefined): string {
  if (n == null) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
