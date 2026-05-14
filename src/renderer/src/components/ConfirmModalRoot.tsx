import { useEffect, useRef } from 'react'
import { AlertTriangleIcon } from 'lucide-react'
import Modal from './Modal'
import { useConfirmStore } from '../lib/confirm'

/**
 * Mount once at the App root. Renders the active confirm dialog (if any)
 * and resolves the pending promise on user response.
 */
export default function ConfirmModalRoot(): JSX.Element | null {
  const current = useConfirmStore((s) => s.current)
  const close = useConfirmStore((s) => s.close)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  // Autofocus the destructive button when the dialog opens so Enter triggers it
  // and Esc cancels (handled by Modal's existing Escape listener).
  useEffect(() => {
    if (current) confirmBtnRef.current?.focus()
  }, [current])

  if (!current) return null

  return (
    <Modal title={current.title ?? 'Confirmar acción'} onClose={() => close(false)}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          {current.destructive && (
            <div className="flex-shrink-0 mt-0.5 w-9 h-9 rounded-full bg-pastel-pink/40 flex items-center justify-center">
              <AlertTriangleIcon size={18} className="text-rose-400" />
            </div>
          )}
          <p className="text-sm text-ink-200 whitespace-pre-wrap">{current.message}</p>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          {current.cancelText !== '' && (
            <button
              onClick={() => close(false)}
              className="btn"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  close(false)
                }
              }}
            >
              {current.cancelText ?? 'Cancelar'}
            </button>
          )}
          <button
            ref={confirmBtnRef}
            onClick={() => close(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                close(true)
              }
            }}
            className={current.destructive ? 'btn btn-danger' : 'btn btn-primary'}
          >
            {current.confirmText ?? (current.destructive ? 'Borrar' : 'Confirmar')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
