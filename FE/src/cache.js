const TTL = 5 * 60 * 1000 // 5 minut

export function cacheGet(key) {
  try {
    const item = sessionStorage.getItem('pov_' + key)
    if (!item) return null
    const { data, ts } = JSON.parse(item)
    if (Date.now() - ts > TTL) { sessionStorage.removeItem('pov_' + key); return null }
    return data
  } catch { return null }
}

export function cacheSet(key, data) {
  try { sessionStorage.setItem('pov_' + key, JSON.stringify({ data, ts: Date.now() })) } catch {}
}

export async function cachedFetch(key, url) {
  const hit = cacheGet(key)
  if (hit !== null) return hit
  const data = await fetch(url).then(r => r.json())
  cacheSet(key, data)
  return data
}
