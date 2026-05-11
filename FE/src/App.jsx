import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState('')
  const [podjetja, setPodjetja] = useState([])

  const API_URL = 'https://povezava-si.onrender.com'

  useEffect(() => {
    fetch(`${API_URL}/`)
      .then(res => res.json())
      .then(data => setStatus(data.message))
      .catch(err => setStatus('BE ne odgovarja'))

    fetch(`${API_URL}/api/podjetja`)
      .then(res => res.json())
      .then(data => setPodjetja(data))
      .catch(err => console.error('Napaka:', err))
  }, [])

  return (
    <div>
      <h1>Povezava.si</h1>
      <p>Backend status: {status}</p>
      <ul>
        {podjetja.map(p => (
          <li key={p.maticna}>{p.popolno_ime} — {p.posta}</li>
        ))}
      </ul>
    </div>
  )
}

export default App