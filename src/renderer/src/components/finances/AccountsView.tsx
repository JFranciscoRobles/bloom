import { useState } from 'react'
import { PlusIcon, Trash2Icon, PencilIcon } from 'lucide-react'
import { useAsync } from '../../hooks/useAsync'
import type { Account } from '../../../../shared/types'
import PromptModal from '../PromptModal'
import { useCurrencies } from '../../hooks/useCurrencies'
import { confirm } from '../../lib/confirm'

// Common currencies offered when creating an account. USD and MXN go first so
// they're the default visible options; the rest follow in alphabetical order.
const COMMON_CURRENCIES = ['USD', 'MXN', 'EUR', 'GBP', 'CAD', 'JPY', 'BRL', 'ARS', 'COP', 'CLP']

/** Merge the common list with whatever the user already uses, USD+MXN first. */
function currencyChoices(existing: string[]): string[] {
  const set = new Set<string>(COMMON_CURRENCIES)
  for (const c of existing) set.add(c)
  const first: string[] = []
  if (set.delete('USD')) first.push('USD')
  if (set.delete('MXN')) first.push('MXN')
  return [...first, ...[...set].sort()]
}

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
    if (
      !(await confirm({
        message: `Borrar la cuenta "${a.name}" y todas sus transacciones?`,
        confirmText: 'Borrar'
      }))
    )
      return
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
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="input"
            >
              {currencyChoices(currencies).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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
