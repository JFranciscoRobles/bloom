import { useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts'
import dayjs from 'dayjs'
import type {
  Account,
  Category,
  ExchangeRate,
  Transaction
} from '../../../../shared/types'
import { buildRateLookup, convert, formatMoney } from '../../lib/currency'
import { useCurrencies } from '../../hooks/useCurrencies'

const ALL_WALLETS = 0 as const

export default function SummaryView(): JSX.Element {
  const [year, setYear] = useState(dayjs().year())
  const [baseCurrency, setBaseCurrency] = useState('MXN')
  const [walletId, setWalletId] = useState<number>(ALL_WALLETS)
  const { currencies } = useCurrencies()

  useEffect(() => {
    if (currencies.length > 0 && !currencies.includes(baseCurrency)) {
      setBaseCurrency(currencies[0])
    }
  }, [currencies, baseCurrency])

  const [accounts, setAccounts] = useState<Account[]>([])
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [allTxs, setAllTxs] = useState<Transaction[]>([])
  const [yearTxs, setYearTxs] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  async function load(): Promise<void> {
    const [a, r, ytx, atx, c] = await Promise.all([
      window.api.accounts.list(),
      window.api.rates.list(),
      window.api.transactions.list({ from: `${year}-01-01`, to: `${year}-12-31` }),
      window.api.transactions.list(), // for total balance (all time)
      window.api.categories.list()
    ])
    setAccounts(a)
    setRates(r)
    setYearTxs(ytx)
    setAllTxs(atx)
    setCategories(c)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])

  const rateMap = useMemo(() => buildRateLookup(rates), [rates])

  // Active set of transactions, filtered by the wallet selector.
  const txs = useMemo(
    () => (walletId === ALL_WALLETS ? yearTxs : yearTxs.filter((t) => t.account_id === walletId)),
    [yearTxs, walletId]
  )
  const activeWallet = useMemo(
    () => (walletId === ALL_WALLETS ? null : accounts.find((a) => a.id === walletId) ?? null),
    [accounts, walletId]
  )

  // Per-wallet running balance from initial_balance + lifetime transactions.
  const walletBalances = useMemo(() => {
    const m = new Map<number, number>()
    for (const a of accounts) m.set(a.id, a.initial_balance)
    for (const t of allTxs) {
      const delta = t.type === 'income' ? t.amount : -t.amount
      m.set(t.account_id, (m.get(t.account_id) ?? 0) + delta)
    }
    return m
  }, [accounts, allTxs])

  // Build monthly aggregate from filtered txs (works for any wallet selection).
  const monthly = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
    return months.map((m) => {
      let income = 0
      let expense = 0
      for (const t of txs) {
        if (!t.date.startsWith(m)) continue
        const v = convert(t.amount, t.currency, baseCurrency, rateMap) ?? t.amount
        if (t.type === 'income') income += v
        else expense += v
      }
      return {
        month: dayjs(m + '-01').format('MMM'),
        ingresos: Math.round(income * 100) / 100,
        gastos: Math.round(expense * 100) / 100
      }
    })
  }, [txs, baseCurrency, rateMap, year])

  const expenseByCategory = useMemo(() => {
    const map = new Map<number, number>()
    for (const t of txs.filter((x) => x.type === 'expense')) {
      const conv = convert(t.amount, t.currency, baseCurrency, rateMap) ?? t.amount
      map.set(t.category_id ?? 0, (map.get(t.category_id ?? 0) ?? 0) + conv)
    }
    return [...map.entries()].map(([catId, value]) => {
      const cat = categories.find((c) => c.id === catId)
      return {
        name: cat?.name ?? 'Sin categoría',
        value: Math.round(value * 100) / 100,
        color: cat?.color ?? '#cbd5e1'
      }
    })
  }, [txs, categories, baseCurrency, rateMap])

  const byCurrency = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>()
    for (const t of txs) {
      const cur = map.get(t.currency) ?? { income: 0, expense: 0 }
      if (t.type === 'income') cur.income += t.amount
      else cur.expense += t.amount
      map.set(t.currency, cur)
    }
    return [...map.entries()].map(([currency, v]) => ({ currency, ...v }))
  }, [txs])

  const yearTotals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of txs) {
      const v = convert(t.amount, t.currency, baseCurrency, rateMap) ?? t.amount
      if (t.type === 'income') income += v
      else expense += v
    }
    return { income, expense, net: income - expense }
  }, [txs, baseCurrency, rateMap])

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-semibold">Resumen</h2>
        <div>
          <label className="text-xs text-ink-400 mr-1">Wallet</label>
          <select
            value={walletId}
            onChange={(e) => setWalletId(Number(e.target.value))}
            className="input w-48 inline-block"
          >
            <option value={ALL_WALLETS}>Todas las cuentas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-ink-400 mr-1">Año</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || dayjs().year())}
            className="input w-24 inline-block"
          />
        </div>
        <div>
          <label className="text-xs text-ink-400 mr-1">Moneda base</label>
          <select
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value)}
            className="input w-24 inline-block"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Wallet balance cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {accounts.map((a) => {
          const balance = walletBalances.get(a.id) ?? a.initial_balance
          const isActive = walletId === a.id
          return (
            <button
              key={a.id}
              onClick={() => setWalletId(isActive ? ALL_WALLETS : a.id)}
              className={`text-left rounded-2xl border bg-white p-3 transition-all ${
                isActive
                  ? 'border-pastel-purple ring-2 ring-pastel-purple/40 shadow-md -translate-y-0.5'
                  : 'border-pastel-purple/30 hover:border-pastel-purple/60 hover:shadow-sm'
              }`}
              title={isActive ? 'Click para ver todas' : `Filtrar por ${a.name}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-300 truncate">{a.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-ink-400 px-1.5 py-0.5 rounded-full bg-pastel-purple/15">
                  {a.currency}
                </span>
              </div>
              <div
                className={`text-lg font-semibold font-mono mt-1 ${
                  balance < 0 ? 'text-rose-400' : 'text-ink-100'
                }`}
              >
                {formatMoney(balance, a.currency)}
              </div>
            </button>
          )
        })}
        {accounts.length === 0 && (
          <div className="col-span-full text-sm text-ink-400 text-center py-4">
            No hay cuentas. Crea una en la pestaña Cuentas.
          </div>
        )}
      </div>

      {/* Year totals */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryStat
          label={activeWallet ? `Ingresos ${year}` : `Ingresos ${year} (total)`}
          value={formatMoney(yearTotals.income, baseCurrency)}
          tone="good"
        />
        <SummaryStat
          label={activeWallet ? `Gastos ${year}` : `Gastos ${year} (total)`}
          value={formatMoney(yearTotals.expense, baseCurrency)}
          tone="bad"
        />
        <SummaryStat
          label={activeWallet ? `Neto ${year}` : `Neto ${year} (total)`}
          value={formatMoney(yearTotals.net, baseCurrency)}
          tone={yearTotals.net >= 0 ? 'good' : 'bad'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm text-ink-400 mb-2">
            Mensual{activeWallet ? ` · ${activeWallet.name}` : ''} ({baseCurrency})
          </h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0d7ee" />
                <XAxis dataKey="month" stroke="#7a6aa0" />
                <YAxis stroke="#7a6aa0" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #c4b5fd',
                    borderRadius: 12
                  }}
                />
                <Legend />
                <Bar dataKey="ingresos" fill="#86efac" radius={[6, 6, 0, 0]} />
                <Bar dataKey="gastos" fill="#f9a8d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm text-ink-400 mb-2">
            Gastos por categoría{activeWallet ? ` · ${activeWallet.name}` : ''} ({baseCurrency})
          </h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={expenseByCategory}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(e) => `${e.name}: ${e.value}`}
                >
                  {expenseByCategory.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #c4b5fd',
                    borderRadius: 12
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm text-ink-400 mb-2">
          Totales por moneda (sin convertir){activeWallet ? ` · ${activeWallet.name}` : ''}
        </h3>
        <table className="w-full text-sm">
          <thead className="text-xs text-ink-400 uppercase">
            <tr>
              <th className="text-left p-2">Moneda</th>
              <th className="text-right p-2">Ingresos</th>
              <th className="text-right p-2">Gastos</th>
              <th className="text-right p-2">Neto</th>
            </tr>
          </thead>
          <tbody>
            {byCurrency.map((c) => (
              <tr key={c.currency} className="border-t border-pastel-purple/20">
                <td className="p-2 font-medium">{c.currency}</td>
                <td className="p-2 text-right text-emerald-400 font-mono">
                  {formatMoney(c.income, c.currency)}
                </td>
                <td className="p-2 text-right text-rose-400 font-mono">
                  {formatMoney(c.expense, c.currency)}
                </td>
                <td className="p-2 text-right font-mono">
                  {formatMoney(c.income - c.expense, c.currency)}
                </td>
              </tr>
            ))}
            {byCurrency.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-ink-400">
                  Sin datos para este año.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SummaryStat({
  label,
  value,
  tone
}: {
  label: string
  value: string
  tone: 'good' | 'bad'
}): JSX.Element {
  const color = tone === 'good' ? 'text-emerald-400' : 'text-rose-400'
  return (
    <div className="rounded-2xl bg-white border border-pastel-purple/30 p-3 shadow-sm">
      <div className="text-[11px] uppercase tracking-wide text-ink-400">{label}</div>
      <div className={`text-xl font-semibold font-mono mt-0.5 ${color}`}>{value}</div>
    </div>
  )
}
