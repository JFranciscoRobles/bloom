import { useEffect, useState, useCallback } from 'react'

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): {
  data: T | null
  loading: boolean
  error: Error | null
  reload: () => void
} {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fn()
      .then((r) => {
        if (!cancelled) {
          setData(r)
          setError(null)
        }
      })
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { data, loading, error, reload }
}
