import { useState } from 'react'

export default function ShareBtn({ url, name, className = '', iconOnly = false }) {
  const [copied, setCopied] = useState(false)

  async function share() {
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`

    if (navigator.share) {
      try {
        await navigator.share({ title: name, url: fullUrl })
      } catch (e) {
        if (e.name !== 'AbortError') copyFallback(fullUrl)
      }
    } else {
      copyFallback(fullUrl)
    }
  }

  function copyFallback(fullUrl) {
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const checkIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
  const shareIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
      <polyline points="16 6 12 2 8 6"/>
      <line x1="12" y1="2" x2="12" y2="15"/>
    </svg>
  )

  if (iconOnly) {
    return (
      <button className={`share-btn ${className}`.trim()} onClick={share} title={copied ? 'Kopirano!' : `Deli profil: ${name}`}>
        {copied ? checkIcon : shareIcon}
      </button>
    )
  }

  return (
    <button className={`share-btn ${className}`.trim()} onClick={share} title={`Deli profil: ${name}`}>
      {copied ? <>{checkIcon} Kopirano!</> : <>{shareIcon} Deli</>}
    </button>
  )
}
