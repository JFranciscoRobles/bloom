import { useEffect, useState } from 'react'
import Modal from './Modal'

interface Props {
  title: string
  label?: string
  initial?: string
  placeholder?: string
  confirmText?: string
  cancelText?: string
  onConfirm: (value: string) => void | Promise<void>
  onClose: () => void
}

export default function PromptModal({
  title,
  label,
  initial = '',
  placeholder,
  confirmText = 'Guardar',
  cancelText = 'Cancelar',
  onConfirm,
  onClose
}: Props): JSX.Element {
  const [value, setValue] = useState(initial)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setValue(initial)
  }, [initial])

  async function handleConfirm(): Promise<void> {
    const trimmed = value.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      await onConfirm(trimmed)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-3">
        {label && <label className="text-xs text-ink-400">{label}</label>}
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleConfirm()
            }
          }}
          placeholder={placeholder}
          className="input"
        />
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn">
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!value.trim() || submitting}
            className="btn btn-primary disabled:opacity-50"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}
