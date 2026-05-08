import type { ExchangeRate } from '../../../shared/types'

export function buildRateLookup(rates: ExchangeRate[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const r of rates) {
    map.set(`${r.from_currency}-${r.to_currency}`, r.rate)
    if (!map.has(`${r.to_currency}-${r.from_currency}`)) {
      map.set(`${r.to_currency}-${r.from_currency}`, 1 / r.rate)
    }
  }
  return map
}

export function convert(amount: number, from: string, to: string, rates: Map<string, number>): number | null {
  if (from === to) return amount
  const direct = rates.get(`${from}-${to}`)
  if (direct !== undefined) return amount * direct
  return null
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}
