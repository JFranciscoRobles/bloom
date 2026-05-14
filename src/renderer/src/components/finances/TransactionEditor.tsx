import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import type { Account, Category, Transaction, TxType } from '../../../../shared/types'
import Modal from '../Modal'
import { useCurrencies } from '../../hooks/useCurrencies'
import { notify } from '../../lib/confirm'

interface Props {
  transaction: Transaction
  accounts: Account[]
  categories: Category[]
  onClose: () => void
  /** Called after successful save so parent reloads its list. */
  onSaved: () => void
}

/**
 * Edit modal for a single transaction. Mirrors the create form in
 * TransactionsView but for an existing row.
 */
export default function TransactionEditor({
  transaction,
  accounts,
  categories,
  onClose,
  onSaved
}: Props): JSX.Element {
  const { currencies } = useCurrencies()
  const [type, setType] = useState<TxType>(transaction.type)
  const [accountId, setAccountId] = useState<number>(transaction.account_id)
  const [categoryId, setCategoryId] = useState<number>(transaction.category_id ?? 0)
  const [amount, setAmount] = useState<string>(String(transaction.amount))
  const [currency, setCurrency] = useState<string>(transaction.currency)
  const [date, setDate] = useState<string>(transaction.date)
  const [note, setNote] = useState<string>(transaction.note ?? '')
  const [submitting, setSubmitting] = useState(false)

  // Sync currency with the account selected, unless the user just changed it.
  function handleAccountChange(id: number): void {
    setAccountId(id)
    const a = accounts.find((x) => x.id === id)
    if (a) setCurrency(a.currency)
  }

  // Reset category if the user switches between income/expense.
  useEffect(() => {
    if (categoryId !== 0) {
      const cat = categories.find((c) => c.id === categoryId)
      if (cat && cat.type !== type) setCategoryId(0)
    }
  }, [type, categoryId, categories])

  const visibleCats = categories.filter((c) => c.type === type)

  async function handleSave(): Promise<void> {
    const n = Number(amount)
    if (!accountId || !Number.isFinite(n) || n <= 0) {
      await notify('Cuenta y monto son obligatorios')
      return
    }
    setSubmitting(true)
    try {
      await window.api.transactions.update(transaction.id, {
        account_id: accountId,
        category_id: categoryId || null,
        type,
        amount: n,
        currency,
        date,
        note: note || null
      })
      onSaved()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Editar transacción" onClose={onClose} wide>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
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
        <div>
          <label className="text-xs text-ink-400">Cuenta</label>
          <select
            value={accountId}
            onChange={(e) => handleAccountChange(Number(e.target.value))}
            className="input"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-ink-400">Categoría</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(Number(e.target.value))}
            className="input"
          >
            <option value={0}>—</option>
            {visibleCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-ink-400">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="text-xs text-ink-400">Monto</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs text-ink-400">Moneda</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="input"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-ink-400">Nota</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSave()
              }
            }}
            className="input"
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-pastel-purple/20">
        <div className="text-[11px] text-ink-400">
          Creada: {dayjs(transaction.created_at).format('DD/MM/YYYY HH:mm')}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={submitting}
            className="btn btn-primary disabled:opacity-50"
          >
            Guardar cambios
          </button>
        </div>
      </div>
    </Modal>
  )
}
