import { useEffect, useState } from 'react'
import Modal from './Modal'
import { BOARD_THEMES } from '../lib/themes'

interface Props {
  title: string
  initialName?: string
  initialThemeId?: string
  confirmText?: string
  onConfirm: (name: string, themeId: string) => void | Promise<void>
  onClose: () => void
}

export default function BoardPromptModal({
  title,
  initialName = '',
  initialThemeId = 'rose',
  confirmText = 'Guardar',
  onConfirm,
  onClose
}: Props): JSX.Element {
  const [name, setName] = useState(initialName)
  const [themeId, setThemeId] = useState(initialThemeId)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setName(initialName)
    setThemeId(initialThemeId)
  }, [initialName, initialThemeId])

  async function handleConfirm(): Promise<void> {
    const trimmed = name.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      await onConfirm(trimmed, themeId)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-ink-400">Nombre</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleConfirm()
              }
            }}
            placeholder="Nombre del tablero"
            className="input"
          />
        </div>
        <div>
          <label className="text-xs text-ink-400">Color</label>
          <div className="grid grid-cols-5 gap-2 mt-1">
            {BOARD_THEMES.map((t) => {
              const selected = themeId === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeId(t.id)}
                  className={`relative rounded-xl border h-14 overflow-hidden transition-all ${
                    selected
                      ? 'border-ink-200 ring-2 ring-ink-200 scale-105'
                      : 'border-ink-700/30 hover:scale-105'
                  }`}
                  style={{
                    background: `linear-gradient(135deg, ${t.gradient[0]} 0%, ${t.gradient[1]} 50%, ${t.gradient[2]} 100%)`
                  }}
                  title={t.name}
                >
                  <div
                    className="absolute bottom-1 right-1 w-3 h-3 rounded-full border border-white/60"
                    style={{ backgroundColor: t.accent }}
                  />
                  <span className="absolute bottom-0 left-0 right-0 text-[10px] font-medium text-ink-100 bg-white/40 backdrop-blur-sm py-0.5">
                    {t.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!name.trim() || submitting}
            className="btn btn-primary disabled:opacity-50"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}
