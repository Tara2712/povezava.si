import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState('')
  const [podjetja, setPodjetja] = useState([])
  const [loading, setLoading] = useState(true)

  const API_URL = import.meta.env.VITE_API_URL
  console.log('API_URL:', API_URL)

  useEffect(() => {
    if (!API_URL) {
      setStatus('VITE_API_URL ni nastavljen')
      setLoading(false)
      return
    }

    async function fetchData() {
      try {
        const statusResponse = await fetch(`${API_URL}/`)
        const statusData = await statusResponse.json()
        setStatus(statusData.message)

        const podjetjaResponse = await fetch(`${API_URL}/api/podjetja`)
        const podjetjaData = await podjetjaResponse.json()
        setPodjetja(podjetjaData)
      } catch (err) {
        console.error('Napaka:', err)
        setStatus('BE ne odgovarja')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [API_URL])

  return (
    <div>
      <h1>Povezava.si</h1>

      <p>Backend status: {status}</p>

      {loading && <p>Nalaganje podatkov...</p>}

      {!loading && podjetja.length === 0 && (
        <p>Ni podatkov o podjetjih.</p>
      )}

      <ul>
        {podjetja.map(p => (
          <li key={p.maticna}>
            {p.popolno_ime} — {p.posta}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App