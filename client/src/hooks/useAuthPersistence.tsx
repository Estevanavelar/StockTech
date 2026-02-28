import { useCallback, useEffect, useMemo, useState } from 'react'
import { trpc } from '../lib/trpc'

const TOKEN_KEY = 'avelar_token'
const USER_KEY = 'avelar_user'
const ACCOUNT_KEY = 'avelar_account'

function setCookie(name: string, value: string, maxAgeSeconds = 60 * 60 * 24 * 7) {
  document.cookie = `${name}=${encodeURIComponent(value)}; domain=.avelarcompany.com.br; path=/; secure; samesite=none; max-age=${maxAgeSeconds}`
}

function clearCookie(name: string) {
  document.cookie = `${name}=; domain=.avelarcompany.com.br; path=/; secure; samesite=none; max-age=0`
}

export function useAuthPersistence() {
  const [hasToken, setHasToken] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedToken = localStorage.getItem(TOKEN_KEY)
    const hasCookie = document.cookie.includes(`${TOKEN_KEY}=`)
    setHasToken(Boolean(storedToken || hasCookie))
  }, [])

  const queryEnabled = useMemo(() => hasToken, [hasToken])

  const { data: currentUser } = trpc.system.getCurrentUser.useQuery(undefined, {
    enabled: queryEnabled,
    retry: false,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (!currentUser?.token) return

    localStorage.setItem(TOKEN_KEY, currentUser.token)
    localStorage.setItem(USER_KEY, JSON.stringify(currentUser.user))
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(currentUser.account))

    const hasCookie = document.cookie.includes(`${TOKEN_KEY}=`)
    if (!hasCookie) {
      setCookie(TOKEN_KEY, currentUser.token)
    }
  }, [currentUser])

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY)
    if (!storedToken) return
    const hasCookie = document.cookie.includes(`${TOKEN_KEY}=`)
    if (!hasCookie) {
      setCookie(TOKEN_KEY, storedToken)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(ACCOUNT_KEY)
    clearCookie(TOKEN_KEY)
    setHasToken(false)
  }, [])

  return { logout }
}
