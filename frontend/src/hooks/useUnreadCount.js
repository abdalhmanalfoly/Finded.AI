import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { unreadCount, subscribeNotifications } from '../services/itemsService.js'
import { translate } from '../i18n/core.js'

// Refreshes on every page change, instantly through Supabase Realtime, and every 2 minutes as a fallback.
export default function useUnreadCount(enabled) {
  const [count, setCount] = useState(0)
  const [problem, setProblem] = useState('')
  const { pathname } = useLocation()

  useEffect(() => {
    if (!enabled) { setCount(0); setProblem(''); return undefined }
    let alive = true
    const offline = () => translate('Live updates are unavailable. Refresh this page to see new activity.')
    const load = () => unreadCount()
      .then((n) => { if (alive) { setCount(n); setProblem('') } })
      .catch(() => { if (alive) setProblem(offline()) })
    load()
    const t = setInterval(load, 120000) // fallback if the realtime connection drops
    let stop = () => {}
    subscribeNotifications(load)
      .then((unsub) => { if (alive) stop = unsub; else unsub() })
      .catch(() => { if (alive) setProblem(offline()) })
    return () => { alive = false; clearInterval(t); stop() }
  }, [enabled, pathname])

  return { count, problem }
}
