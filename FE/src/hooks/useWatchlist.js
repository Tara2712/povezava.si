import { useState, useEffect, useCallback } from 'react'
import { doc, setDoc, deleteDoc, onSnapshot, collection, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { API } from '../api'

export function useWatchlist() {
  const { user } = useAuth()
  const [following, setFollowing] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) { setFollowing([]); setNotifications([]); return }
    const ref = collection(db, 'watchlist', user.uid, 'following')
    const unsub = onSnapshot(
      ref,
      snap => {
        const list = snap.docs.map(d => d.data())
        setFollowing(list)
        checkUpdates(list)
      },
      err => console.warn('Watchlist:', err.message)
    )
    return unsub
  }, [user])

  async function checkUpdates(list) {
    if (!list.length) return
    const updates = []
    await Promise.all(list.map(async f => {
      try {
        const res = await fetch(`${API}/osebe/${f.personId}`)
        if (!res.ok) return
        const data = await res.json()
        const currentCount = data.povezave?.length ?? 0
        if (f.lastSeenCount !== undefined && currentCount > f.lastSeenCount) {
          updates.push({ ...f, currentCount, diff: currentCount - f.lastSeenCount })
        }
      } catch {}
    }))
    setNotifications(updates)
  }

  const isFollowing = useCallback((personId) =>
    following.some(f => f.personId === personId), [following])

  async function follow(oseba) {
    if (!user) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/osebe/${oseba.id}`)
      const data = res.ok ? await res.json() : {}
      const currentCount = data.povezave?.length ?? 0
      await setDoc(doc(db, 'watchlist', user.uid, 'following', String(oseba.id)), {
        personId: oseba.id,
        personName: `${oseba.ime} ${oseba.priimek}`,
        followedAt: new Date().toISOString(),
        lastSeenCount: currentCount,
      })
      // Pošlji potrditveni email
      if (user.email) {
        fetch(`${API}/api/watchlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, oseba_id: oseba.id })
        }).catch(() => {})
      }
    } finally {
      setLoading(false)
    }
  }

  async function unfollow(personId) {
    if (!user) return
    setLoading(true)
    try {
      await deleteDoc(doc(db, 'watchlist', user.uid, 'following', String(personId)))
      setNotifications(n => n.filter(x => x.personId !== personId))
    } finally {
      setLoading(false)
    }
  }

  async function dismissNotification(personId) {
    if (!user) return
    const f = following.find(x => x.personId === personId)
    if (!f) return
    const notif = notifications.find(x => x.personId === personId)
    if (notif) {
      await updateDoc(doc(db, 'watchlist', user.uid, 'following', String(personId)), {
        lastSeenCount: notif.currentCount
      })
    }
    setNotifications(n => n.filter(x => x.personId !== personId))
  }

  async function dismissAll() {
    await Promise.all(notifications.map(n => dismissNotification(n.personId)))
  }

  return { following, isFollowing, follow, unfollow, loading, notifications, dismissNotification, dismissAll }
}
