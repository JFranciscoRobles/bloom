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
import type { Category, ExchangeRate, MonthlySummary, Transaction } from '../../../../shared/types'
import { buildRateLookup, convert, formatMoney } from '../../lib/currency'
import { useCurrencies } from '../../hooks/useCurrencies'

export default function SummaryView(): JSX.Element {
  const [year, setYear] = useState(dayjs().year())
  const [baseCurrency, setBaseCurrency] = useState('MXN')
  const { currencies } = useCurrencies()

  useEffect(() => {
    if (currencies.length > 0 && !currencies.includes(baseCurrency)) {
      setBaseCurrency(currencies[0])
    }
  }, [currencies, baseCurrency])

  const [summary, setSummary] = useState<MonthlySummary[]>([])
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [txs, setTxs] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  async function load(): Promise<void> {
    const [s, r, t, c] = await Promise.all([
      window.api.transactions.monthlySummary(year),
      window.api.rates.list(),
      window.api.transactions.list({ from: `${year}-01-01`, to: `${year}-12-31` }),
      window.api.categories.list()
    ])
    setSummary(s)
    setRates(r)
    setTxs(t)
    setCategories(c)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])

  const rateMap = useMemo(() => buildRateLookup(rates), [rates])

  const monthly = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
    return months.map((m) => {
      let income = 0
      let expense = 0
      let unconverted = false
      for (const row of summary.filter((s) => s.month === m)) {
        const inc = convert(row.income, row.currency, baseCurrency, rateMap)
        const exp = convert(row.expense, row.currency, baseCurrency, rateMap)
        if (inc === null || exp === null) unconverted = true
        income += inc ?? row.income
        expense += exp ?? row.expense
      }
      return {
        month: dayjs(m + '-01').format('MMM'),
        ingresos: Math.round(income * 100) / 100,
        gastos: Math.round(expense * 100) / 100,
        unconverted
      }
    })
  }, [summary, baseCurrency, rateMap, year])

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

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-semibold">Resumen</h2>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm text-ink-400 mb-2">Mensual ({baseCurrency})</h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0d7ee" />
                <XAxis dataKey="month" stroke="#7a6aa0" />
                <YAxis stroke="#7a6aa0" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #c4b5fd', borderRadius: 12 }}
                />
                <Legend />
                <Bar dataKey="ingresos" fill="#86efac" radius={[6, 6, 0, 0]} />
                <Bar dataKey="gastos" fill="#f9a8d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm text-ink-400 mb-2">Gastos por categoría ({baseCurrency})</h3>
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
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #c4b5fd', borderRadius: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm text-ink-400 mb-2">Totales por moneda (sin convertir)</h3>
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
