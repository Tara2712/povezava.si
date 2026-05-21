import { useState, useCallback } from 'react'

function readLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback }
  catch { return fallback }
}

export function useSavedPersons() {
  const KEY = 'saved_persons'
  const [saved, setSaved] = useState(() => readLS(KEY, []))

  const toggle = useCallback((oseba) => {
    setSaved(prev => {
      const exists = prev.some(p => p.id === oseba.id)
      const next = exists
        ? prev.filter(p => p.id !== oseba.id)
        : [{ id: oseba.id, ime: oseba.ime, priimek: oseba.priimek, fotografija_url: oseba.fotografija_url, institucija: oseba.institucija }, ...prev]
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const isSaved = useCallback((id) => saved.some(p => p.id === id), [saved])

  return { saved, toggle, isSaved }
}

export function useComparison() {
  const KEY = 'compare_candidate'
  const [candidate, setCandidate] = useState(() => readLS(KEY, null))

  const select = useCallback((oseba) => {
    const data = { id: oseba.id, ime: oseba.ime, priimek: oseba.priimek, fotografija_url: oseba.fotografija_url }
    setCandidate(data)
    localStorage.setItem(KEY, JSON.stringify(data))
  }, [])

  const clear = useCallback(() => {
    setCandidate(null)
    localStorage.removeItem(KEY)
  }, [])

  return { candidate, select, clear }
}

export function useSearchHistory() {
  const KEY = 'search_history'
  const MAX = 20
  const [history, setHistory] = useState(() => readLS(KEY, []))

  const track = useCallback((q) => {
    if (!q || q.trim().length < 2) return
    const term = q.trim()
    setHistory(prev => {
      const filtered = prev.filter(e => e.q.toLowerCase() !== term.toLowerCase())
      const next = [{ q: term, ts: Date.now() }, ...filtered].slice(0, MAX)
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const remove = useCallback((q) => {
    setHistory(prev => {
      const next = prev.filter(e => e.q !== q)
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setHistory([])
    localStorage.removeItem(KEY)
  }, [])

  return { history, track, remove, clear }
}

export function useRecentlyViewed() {
  const KEY = 'recently_viewed'
  const MAX = 10
  const [recent, setRecent] = useState(() => readLS(KEY, []))

  const track = useCallback((oseba) => {
    setRecent(prev => {
      const filtered = prev.filter(p => p.id !== oseba.id)
      const next = [
        { id: oseba.id, ime: oseba.ime, priimek: oseba.priimek, fotografija_url: oseba.fotografija_url, institucija: oseba.institucija, ts: Date.now() },
        ...filtered
      ].slice(0, MAX)
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { recent, track }
}
