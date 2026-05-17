import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import Mapa from './pages/Mapa'
import Iskanje from './pages/Home'
import Oseba from './pages/Oseba'
import Podjetje from './pages/Podjetje'
import Omrezje from './pages/Omrezje'
import Lobisti from './pages/Lobisti'
import Ovadeni from './pages/Ovadeni'
import Mediji from './pages/Mediji'
import Asistent from './pages/Asistent'

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
        <Route path="/mediji" element={<Mediji />} />
        <Route path="/asistent" element={<Asistent />} />
      </Routes>
    </BrowserRouter>
  )
}
