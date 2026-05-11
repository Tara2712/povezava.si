import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Oseba from './pages/Oseba'
import Podjetje from './pages/Podjetje'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/oseba/:id" element={<Oseba />} />
        <Route path="/podjetje/:id" element={<Podjetje />} />
      </Routes>
    </BrowserRouter>
  )
}
