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
    <div>
      <h1>Povezava.si</h1>
      <p>Backend status: {status}</p>
    </div>
  )
}

export default App