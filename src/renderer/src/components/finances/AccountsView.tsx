import { useState } from 'react'
import { PlusIcon, Trash2Icon, PencilIcon } from 'lucide-react'
import { useAsync } from '../../hooks/useAsync'
import type { Account } from '../../../../shared/types'
import PromptModal from '../PromptModal'
import { useCurrencies } from '../../hooks/useCurrencies'

export default function AccountsView(): JSX.Element {
  const q = useAsync(() => window.api.accounts.list(), [])
  const { currencies, reload: reloadCurrencies } = useCurrencies()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('MXN')
  const [initial, setInitial] = useState('0')
  const [renaming, setRenaming] = useState<Account | null>(null)

  async function handleCreate(): Promise<void> {
    if (!name.trim() || !currency.trim()) return
    await window.api.accounts.create(name.trim(), currency.trim(), Number(initial) || 0)
    setName('')
    setCurrency('MXN')
    setInitial('0')
    setAdding(false)
    q.reload()
    reloadCurrencies()
  }

  async function handleRename(a: Account, n: string): Promise<void> {
    if (n === a.name) return
    await window.api.accounts.update(a.id, { name: n })
    q.reload()
  }

  async function handleRemove(a: Account): Promise<void> {
    if (!confirm(`Borrar cuenta "${a.name}" y todas sus transacciones?`)) return
    await window.api.accounts.remove(a.id)
    q.reload()
  }

  return (
    <div className="p-4 space-y-3 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Cuentas / Wallets</h2>
        <button onClick={() => setAdding((v) => !v)} className="btn btn-primary">
          <PlusIcon size={14} /> Nueva
        </button>
      </div>
      {adding && (
        <div className="card flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-ink-400">Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
          <div className="w-28">
            <label className="text-xs text-ink-400">Moneda</label>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="input"
              maxLength={3}
              list="currency-suggestions"
              placeholder="MXN"
            />
            <datalist id="currency-suggestions">
              {currencies.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="w-36">
            <label className="text-xs text-ink-400">Saldo inicial</label>
            <input
              type="number"
              step="0.01"
              value={initial}
              onChange={(e) => setInitial(e.target.value)}
              className="input"
            />
          </div>
          <button onClick={handleCreate} className="btn btn-primary">
            Guardar
          </button>
        </div>
      )}
      <div className="space-y-2">
        {q.data?.map((a) => (
          <div key={a.id} className="card flex items-center justify-between">
            <div>
              <div className="font-medium">{a.name}</div>
              <div className="text-xs text-ink-400">
                {a.currency} · saldo inicial {a.initial_balance.toFixed(2)}
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setRenaming(a)} className="btn">
                <PencilIcon size={14} />
              </button>
              <button onClick={() => handleRemove(a)} className="btn btn-danger">
                <Trash2Icon size={14} />
              </button>
            </div>
          </div>
        ))}
        {q.data?.length === 0 && (
          <p className="text-sm text-ink-400">
            No hay cuentas todavía. Crea una para empezar a registrar transacciones.
          </p>
        )}
      </div>
      {renaming && (
        <PromptModal
          title="Renombrar cuenta"
          label="Nombre"
          initial={renaming.name}
          onConfirm={(n) => handleRename(renaming, n)}
          onClose={() => setRenaming(null)}
        />
      )}
    </div>
  )
}
