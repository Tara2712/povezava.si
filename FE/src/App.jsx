import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState('')

  const API_URL = 'https://povezava-si.onrender.com'

  useEffect(() => {
    fetch(`${API_URL}/`)
      .then(res => res.json())
      .then(data => setStatus(data.message))
      .catch(err => setStatus('BE ne odgovarja'))
  }, [])

  return (
    <ul>
  {podjetja.map(p => (
    <li key={p.maticna}>{p.popolno_ime} — {p.posta}</li>
  ))}
</ul>
  )
}

export default App