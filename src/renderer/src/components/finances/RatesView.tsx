import { useState } from 'react'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { useAsync } from '../../hooks/useAsync'
import dayjs from 'dayjs'
import { useCurrencies } from '../../hooks/useCurrencies'
import { confirm, notify } from '../../lib/confirm'

export default function RatesView(): JSX.Element {
  const q = useAsync(() => window.api.rates.list(), [])
  const { currencies, reload: reloadCurrencies } = useCurrencies()
  const [from, setFrom] = useState('USD')
  const [to, setTo] = useState('MXN')
  const [rate, setRate] = useState('1')

  async function handleSave(): Promise<void> {
    const n = Number(rate)
    if (!from.trim() || !to.trim() || !Number.isFinite(n) || n <= 0) return
    if (from.trim().toUpperCase() === to.trim().toUpperCase()) {
      await notify('La moneda de origen y destino deben ser diferentes')
      return
    }
    await window.api.rates.upsert({
      from_currency: from.trim().toUpperCase(),
      to_currency: to.trim().toUpperCase(),
      rate: n,
      updated_at: ''
    })
    q.reload()
    reloadCurrencies()
  }

  async function handleRemove(f: string, t: string): Promise<void> {
    if (!(await confirm({ message: `Borrar la tasa ${f} → ${t}?`, confirmText: 'Borrar' })))
      return
    await window.api.rates.remove(f, t)
    q.reload()
  }

  return (
    <div className="p-4 space-y-3 max-w-3xl">
      <h2 className="font-semibold">Tasas de conversión (manuales)</h2>
      <p className="text-sm text-ink-400">
        Define cuántas unidades de la moneda destino equivalen a 1 unidad de la moneda origen. Ejemplo:
        USD → MXN = 17.0 significa que 1 USD = 17 MXN.
      </p>
      <div className="card flex items-end gap-2 flex-wrap">
        <div className="w-28">
          <label className="text-xs text-ink-400">De</label>
          <select
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="input"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="w-28">
          <label className="text-xs text-ink-400">A</label>
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="input"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="w-32">
          <label className="text-xs text-ink-400">Tasa</label>
          <input
            type="number"
            step="0.0001"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="input"
          />
        </div>
        <button onClick={handleSave} className="btn btn-primary">
          <PlusIcon size={14} /> Guardar
        </button>
      </div>
      <div className="space-y-1">
        {q.data?.map((r) => (
          <div
            key={`${r.from_currency}-${r.to_currency}`}
            className="card flex items-center justify-between"
          >
            <div>
              <span className="font-medium">
                {r.from_currency} → {r.to_currency}
              </span>{' '}
              <span className="text-ink-300">= {r.rate}</span>
              <span className="text-xs text-ink-500 ml-2">
                {dayjs(r.updated_at).format('DD/MM/YYYY HH:mm')}
              </span>
            </div>
            <button
              onClick={() => handleRemove(r.from_currency, r.to_currency)}
              className="btn btn-danger"
            >
              <Trash2Icon size={14} />
            </button>
          </div>
        ))}
        {q.data?.length === 0 && <p className="text-sm text-ink-400">Sin tasas configuradas.</p>}
      </div>
    </div>
  )
}
