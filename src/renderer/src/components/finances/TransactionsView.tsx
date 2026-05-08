import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import type { Account, Category, Transaction, TxType } from '../../../../shared/types'
import { formatMoney } from '../../lib/currency'
import { useCurrencies } from '../../hooks/useCurrencies'

export default function TransactionsView(): JSX.Element {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const { currencies } = useCurrencies()

  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    type: 'expense' as TxType,
    account_id: 0,
    category_id: 0,
    amount: '',
    currency: 'MXN',
    date: dayjs().format('YYYY-MM-DD'),
    note: ''
  })

  async function load(): Promise<void> {
    const [a, c, t] = await Promise.all([
      window.api.accounts.list(),
      window.api.categories.list(),
      window.api.transactions.list()
    ])
    setAccounts(a)
    setCategories(c)
    setTransactions(t)
    if (a.length > 0 && form.account_id === 0) {
      setForm((f) => ({ ...f, account_id: a[0].id, currency: a[0].currency }))
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleAccountChange(id: number): void {
    const a = accounts.find((x) => x.id === id)
    setForm((f) => ({ ...f, account_id: id, currency: a?.currency ?? f.currency }))
  }

  async function handleCreate(): Promise<void> {
    const amount = Number(form.amount)
    if (!form.account_id || !Number.isFinite(amount) || amount <= 0) {
      alert('Cuenta y monto son obligatorios')
      return
    }
    await window.api.transactions.create({
      account_id: form.account_id,
      category_id: form.category_id || null,
      type: form.type,
      amount,
      currency: form.currency,
      date: form.date,
      note: form.note || null
    })
    setForm((f) => ({ ...f, amount: '', note: '' }))
    setAdding(false)
    load()
  }

  async function handleRemove(t: Transaction): Promise<void> {
    if (!confirm('Borrar transacción?')) return
    await window.api.transactions.remove(t.id)
    load()
  }

  const accountById = new Map(accounts.map((a) => [a.id, a]))
  const catById = new Map(categories.map((c) => [c.id, c]))
  const visibleCats = categories.filter((c) => c.type === form.type)

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Transacciones</h2>
        <button onClick={() => setAdding((v) => !v)} className="btn btn-primary">
          <PlusIcon size={14} /> Nueva
        </button>
      </div>

      {accounts.length === 0 && (
        <p className="text-sm text-ink-400">
          Crea al menos una cuenta antes de registrar transacciones.
        </p>
      )}

      {adding && accounts.length > 0 && (
        <div className="card grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <label className="text-xs text-ink-400">Tipo</label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as TxType, category_id: 0 })
              }
              className="input"
            >
              <option value="expense">Gasto</option>
              <option value="income">Ingreso</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-ink-400">Cuenta</label>
            <select
              value={form.account_id}
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
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) })}
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
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="text-xs text-ink-400">Monto</label>
            <input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="text-xs text-ink-400">Moneda</label>
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
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
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="input"
            />
          </div>
          <div className="md:col-span-4 flex justify-end">
            <button onClick={handleCreate} className="btn btn-primary">
              Guardar transacción
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-ink-400 uppercase">
            <tr className="border-b border-pastel-purple/30">
              <th className="text-left p-2">Fecha</th>
              <th className="text-left p-2">Tipo</th>
              <th className="text-left p-2">Cuenta</th>
              <th className="text-left p-2">Categoría</th>
              <th className="text-right p-2">Monto</th>
              <th className="text-left p-2">Nota</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const acc = accountById.get(t.account_id)
              const cat = t.category_id ? catById.get(t.category_id) : null
              return (
                <tr key={t.id} className="border-b border-pastel-purple/20 hover:bg-pastel-purple/10">
                  <td className="p-2">{dayjs(t.date).format('DD/MM/YYYY')}</td>
                  <td className="p-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs text-ink-50 ${
                        t.type === 'income' ? 'bg-pastel-mint' : 'bg-pastel-pink'
                      }`}
                    >
                      {t.type === 'income' ? 'Ingreso' : 'Gasto'}
                    </span>
                  </td>
                  <td className="p-2">{acc?.name ?? '?'}</td>
                  <td className="p-2">
                    {cat ? (
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </span>
                    ) : (
                      <span className="text-ink-500">—</span>
                    )}
                  </td>
                  <td
                    className={`p-2 text-right font-mono ${
                      t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {t.type === 'income' ? '+' : '-'}
                    {formatMoney(t.amount, t.currency)}
                  </td>
                  <td className="p-2 text-ink-300">{t.note}</td>
                  <td className="p-2 text-right">
                    <button onClick={() => handleRemove(t)} className="btn btn-danger">
                      <Trash2Icon size={12} />
                    </button>
                  </td>
                </tr>
              )
            })}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-ink-400">
                  Sin transacciones todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
