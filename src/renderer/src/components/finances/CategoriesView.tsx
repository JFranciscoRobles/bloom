import { useState } from 'react'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { useAsync } from '../../hooks/useAsync'
import type { Category, TxType } from '../../../../shared/types'
import { confirm, notify } from '../../lib/confirm'

const PALETTE = ['#fca5a5', '#fcd5b5', '#fde68a', '#bbf7d0', '#a5f3fc', '#93c5fd', '#c4b5fd', '#f9a8d4']

export default function CategoriesView(): JSX.Element {
  const q = useAsync(() => window.api.categories.list(), [])
  const [name, setName] = useState('')
  const [type, setType] = useState<TxType>('expense')
  const [color, setColor] = useState(PALETTE[0])

  async function handleCreate(): Promise<void> {
    if (!name.trim()) return
    try {
      await window.api.categories.create(name.trim(), type, color)
      setName('')
      q.reload()
    } catch (e) {
      await notify('Ya existe una categoría con ese nombre y tipo')
    }
  }

  async function handleRemove(c: Category): Promise<void> {
    if (!(await confirm({ message: `Borrar la categoría "${c.name}"?`, confirmText: 'Borrar' })))
      return
    await window.api.categories.remove(c.id)
    q.reload()
  }

  const income = q.data?.filter((c) => c.type === 'income') ?? []
  const expense = q.data?.filter((c) => c.type === 'expense') ?? []

  return (
    <div className="p-4 space-y-4 max-w-3xl">
      <h2 className="font-semibold">Categorías</h2>
      <div className="card space-y-2">
        <div className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-ink-400">Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
          <div className="w-32">
            <label className="text-xs text-ink-400">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TxType)}
              className="input"
            >
              <option value="expense">Gasto</option>
              <option value="income">Ingreso</option>
            </select>
          </div>
          <div className="flex gap-1">
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full ${color === c ? 'ring-2 ring-pastel-purple' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button onClick={handleCreate} className="btn btn-primary">
            <PlusIcon size={14} /> Crear
          </button>
        </div>
      </div>

      <CategorySection title="Ingresos" items={income} onRemove={handleRemove} />
      <CategorySection title="Gastos" items={expense} onRemove={handleRemove} />
    </div>
  )
}

function CategorySection({
  title,
  items,
  onRemove
}: {
  title: string
  items: Category[]
  onRemove: (c: Category) => void
}): JSX.Element {
  return (
    <div>
      <h3 className="text-sm text-ink-400 uppercase tracking-wide mb-2">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-pastel-purple/40 bg-white/70"
          >
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
            <span className="text-sm">{c.name}</span>
            <button onClick={() => onRemove(c)} className="text-ink-400 hover:text-rose-400">
              <Trash2Icon size={12} />
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-ink-400">Sin categorías.</p>}
      </div>
    </div>
  )
}
