import { useEffect, useRef } from 'react'

export function useAutoRefresh(refresh, intervalMs = 30000) {
  const refreshRef = useRef(refresh)
  const running = useRef(false)
  refreshRef.current = refresh

  useEffect(() => {
    let active = true
    const run = async () => {
      if (!active || running.current || document.visibilityState === 'hidden') return
      running.current = true
      try { await refreshRef.current() }
      finally { running.current = false }
    }
    const timer = window.setInterval(run, intervalMs)
    window.addEventListener('focus', run)
    document.addEventListener('visibilitychange', run)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', run)
      document.removeEventListener('visibilitychange', run)
    }
  }, [intervalMs])
}