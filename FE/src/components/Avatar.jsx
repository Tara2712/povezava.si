import { useState } from 'react'

const COLORS = ['#0891b2','#0d9488','#7c3aed','#db2777','#ea580c','#16a34a','#4f46e5','#b45309','#0369a1','#15803d']

function hashColor(str) {
  let h = 0
  for (const c of (str || 'A')) h = (h * 31 + c.charCodeAt(0)) & 0xfffff
  return COLORS[Math.abs(h) % COLORS.length]
}

function initials(name) {
  const parts = (name || '?').trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.substring(0, 2).toUpperCase()
}

export default function Avatar({ name, size = '', foto }) {
  const [imgErr, setImgErr] = useState(false)

  const cls = `avatar${size ? ' avatar-' + size : ''}`

  if (foto && !imgErr) {
    return (
      <img
        className={cls + ' avatar-foto'}
        src={foto}
        alt={name}
        onError={() => setImgErr(true)}
      />
    )
  }

  return (
    <div className={cls} style={{ background: hashColor(name) }}>
      {initials(name)}
    </div>
  )
}
