import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import Mapa from './pages/Mapa'
import Iskanje from './pages/Home'
import Oseba from './pages/Oseba'
import Podjetje from './pages/Podjetje'
import Omrezje from './pages/Omrezje'
import Lobisti from './pages/Lobisti'
import Ovadeni from './pages/Ovadeni'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Iskanje />} />
        <Route path="/mapa" element={<Mapa />} />
        <Route path="/oseba/:id" element={<Oseba />} />
        <Route path="/podjetje/:id" element={<Podjetje />} />
        <Route path="/omrezje/:id" element={<Omrezje />} />
        <Route path="/lobisti" element={<Lobisti />} />
        <Route path="/ovadeni" element={<Ovadeni />} />
      </Routes>
    </BrowserRouter>
  )
}
