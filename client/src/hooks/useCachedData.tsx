import { useCallback, useEffect, useState } from 'react'

interface CacheOptions {
  ttlMs?: number
}

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
) {
  const ttlMs = options.ttlMs ?? 5 * 60 * 1000
  const storageKey = `cache:${key}`
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const readCache = useCallback(() => {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    try {
      const entry = JSON.parse(raw) as CacheEntry<T>
      if (Date.now() > entry.expiresAt) return null
      return entry.data
    } catch {
      return null
    }
  }, [storageKey])

  const writeCache = useCallback(
    (value: T) => {
      const entry: CacheEntry<T> = { data: value, expiresAt: Date.now() + ttlMs }
      localStorage.setItem(storageKey, JSON.stringify(entry))
    },
    [storageKey, ttlMs]
  )

  const clearCache = useCallback(() => {
    localStorage.removeItem(storageKey)
  }, [storageKey])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await fetcher()
      setData(result)
      writeCache(result)
    } catch (err) {
      const fallback = readCache()
      if (fallback) {
        setData(fallback)
      } else {
        setError(err as Error)
      }
    } finally {
      setIsLoading(false)
    }
  }, [fetcher, readCache, writeCache])

  useEffect(() => {
    const cached = readCache()
    if (cached) {
      setData(cached)
      setIsLoading(false)
      return
    }
    refresh()
  }, [readCache, refresh])

  return { data, isLoading, error, refresh, clearCache }
}
