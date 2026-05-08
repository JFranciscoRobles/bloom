import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  title: string
  children: React.ReactNode
  onClose: () => void
  wide?: boolean
}

export default function Modal({ title, children, onClose, wide }: Props): JSX.Element {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 bg-ink-100/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white border border-pastel-purple/40 rounded-2xl shadow-2xl ${wide ? 'w-full max-w-4xl' : 'w-full max-w-lg'} max-h-[90vh] overflow-y-auto scrollbar-thin`}
      >
        <div className="px-4 py-3 border-b border-pastel-purple/30 bg-gradient-to-r from-pastel-pink/20 via-pastel-purple/20 to-pastel-blue/20 rounded-t-2xl">
          <h2 className="font-semibold">{title}</h2>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body
  )
}
