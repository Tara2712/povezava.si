import { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

function App() {
  const [status, setStatus] = useState('')

 const API_URL = 'https://povezava-si.onrender.com/'

  return (
    <div>
      <h1>Povezava.si</h1>
      <p>Backend status: {status}</p>
    </div>
  )
}

export default App


