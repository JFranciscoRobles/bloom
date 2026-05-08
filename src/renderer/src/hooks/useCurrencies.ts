import { useEffect, useState } from 'react'

/**
 * Returns the unique currency codes present across the user's accounts and
 * exchange rates. The list reflects what the user is actually using; if it's
 * empty (fresh install), we fall back to ['MXN'] so selectors are never empty.
 *
 * Call `reload()` after creating/editing accounts or rates to refresh.
 */
export function useCurrencies(): { currencies: string[]; reload: () => void } {
  const [currencies, setCurrencies] = useState<string[]>(['MXN'])
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    void Promise.all([window.api.accounts.list(), window.api.rates.list()]).then(
      ([accounts, rates]) => {
        if (cancelled) return
        const set = new Set<string>()
        for (const a of accounts) if (a.currency) set.add(a.currency.toUpperCase())
        for (const r of rates) {
          if (r.from_currency) set.add(r.from_currency.toUpperCase())
          if (r.to_currency) set.add(r.to_currency.toUpperCase())
        }
        const arr = [...set].sort()
        setCurrencies(arr.length > 0 ? arr : ['MXN'])
      }
    )
    return () => {
      cancelled = true
    }
  }, [version])

  return { currencies, reload: () => setVersion((v) => v + 1) }
}
