import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { PlusIcon, Trash2Icon, PencilIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import type { Account, Category, Transaction, TxType } from '../../../../shared/types'
import { formatMoney } from '../../lib/currency'
import { useCurrencies } from '../../hooks/useCurrencies'
import { useNavStore } from '../../lib/navStore'
import { confirm, notify } from '../../lib/confirm'
import TransactionEditor from './TransactionEditor'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

export default function TransactionsView(): JSX.Element {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const { currencies } = useCurrencies()
  const pendingTransactionId = useNavStore((s) => s.pendingTransactionId)
  const consumePendingTransaction = useNavStore((s) => s.consumePendingTransaction)
  const [highlightedId, setHighlightedId] = useState<number | null>(null)
  const [pageSize, setPageSize] = useState<number>(25)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Transaction | null>(null)

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

  useEffect(() => {
    if (pendingTransactionId == null || transactions.length === 0) return
    const idx = transactions.findIndex((t) => t.id === pendingTransactionId)
    if (idx < 0) return
    const targetPage = Math.floor(idx / pageSize) + 1
    setPage(targetPage)
    setHighlightedId(pendingTransactionId)
    consumePendingTransaction()
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-tx-id="${pendingTransactionId}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    const t = setTimeout(() => setHighlightedId(null), 2500)
    return () => clearTimeout(t)
  }, [pendingTransactionId, transactions, pageSize, consumePendingTransaction])

  // Reset page to 1 when the underlying list shrinks below the current page,
  // or when page size changes.
  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize))
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pagedTransactions = useMemo(() => {
    const start = (page - 1) * pageSize
    return transactions.slice(start, start + pageSize)
  }, [transactions, page, pageSize])

  function handleAccountChange(id: number): void {
    const a = accounts.find((x) => x.id === id)
    setForm((f) => ({ ...f, account_id: id, currency: a?.currency ?? f.currency }))
  }

  async function handleCreate(): Promise<void> {
    const amount = Number(form.amount)
    if (!form.account_id || !Number.isFinite(amount) || amount <= 0) {
      await notify('Cuenta y monto son obligatorios')
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
    if (!(await confirm({ message: 'Borrar esta transacción?', confirmText: 'Borrar' }))) return
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

      <div className="rounded-2xl bg-white border border-pastel-purple/40 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] text-ink-300 uppercase tracking-wide bg-pastel-purple/15 border-b border-pastel-purple/40">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Fecha</th>
                <th className="text-left px-3 py-2 font-semibold">Tipo</th>
                <th className="text-left px-3 py-2 font-semibold">Cuenta</th>
                <th className="text-left px-3 py-2 font-semibold">Categoría</th>
                <th className="text-right px-3 py-2 font-semibold">Monto</th>
                <th className="text-left px-3 py-2 font-semibold">Nota</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pastel-purple/15">
              {pagedTransactions.map((t, i) => {
                const acc = accountById.get(t.account_id)
                const cat = t.category_id ? catById.get(t.category_id) : null
                return (
                  <tr
                    key={t.id}
                    data-tx-id={t.id}
                    onClick={() => setEditing(t)}
                    className={`transition-colors cursor-pointer ${
                      highlightedId === t.id
                        ? 'bg-pastel-purple/25'
                        : i % 2 === 0
                          ? 'bg-white'
                          : 'bg-pastel-purple/5'
                    } hover:bg-pastel-purple/15`}
                    title="Click para editar"
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-ink-200">
                      {dayjs(t.date).format('DD/MM/YYYY')}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs text-ink-50 ${
                          t.type === 'income' ? 'bg-pastel-mint' : 'bg-pastel-pink'
                        }`}
                      >
                        {t.type === 'income' ? 'Ingreso' : 'Gasto'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-ink-200">{acc?.name ?? '?'}</td>
                    <td className="px-3 py-2">
                      {cat ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="text-ink-200">{cat.name}</span>
                        </span>
                      ) : (
                        <span className="text-ink-500">—</span>
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono whitespace-nowrap ${
                        t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {t.type === 'income' ? '+' : '−'}
                      {formatMoney(t.amount, t.currency)}
                    </td>
                    <td className="px-3 py-2 text-ink-300 max-w-[280px] truncate">
                      {t.note}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditing(t)
                          }}
                          className="p-1 rounded-full hover:bg-pastel-purple/30 text-ink-400 hover:text-ink-100 transition-colors"
                          title="Editar"
                        >
                          <PencilIcon size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemove(t)
                          }}
                          className="p-1 rounded-full hover:bg-pastel-pink/40 text-ink-400 hover:text-rose-400 transition-colors"
                          title="Borrar"
                        >
                          <Trash2Icon size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-ink-400">
                    Sin transacciones todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {transactions.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-pastel-purple/30 bg-pastel-purple/5 text-xs text-ink-300">
            <div className="flex items-center gap-2">
              <span>Filas por página:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                className="bg-white border border-pastel-purple/40 rounded-md px-2 py-1 text-xs text-ink-100 focus:outline-none focus:ring-2 focus:ring-pastel-purple"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-ink-400">
              {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, transactions.length)} de {transactions.length}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 rounded-md hover:bg-pastel-purple/15 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Anterior"
              >
                <ChevronLeftIcon size={16} />
              </button>
              <span className="px-2 tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1 rounded-md hover:bg-pastel-purple/15 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Siguiente"
              >
                <ChevronRightIcon size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <TransactionEditor
          transaction={editing}
          accounts={accounts}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
