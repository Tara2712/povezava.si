import { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

function App() {
  const [status, setStatus] = useState('')

  useEffect(() => {
    fetch('http://localhost:3000')
      .then(res => res.json())
      .then(data => setStatus(data.message))
  }, [])

  return (
    <div>
      <h1>Povezava.si</h1>
      <p>Backend status: {status}</p>
    </div>
  )
}

export default App


