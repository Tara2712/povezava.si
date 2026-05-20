import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Iskanje from './pages/Home'
import Oseba from './pages/Oseba'
import Podjetje from './pages/Podjetje'
import Omrezje from './pages/Omrezje'
import Lobisti from './pages/Lobisti'
import Ovadeni from './pages/Ovadeni'
import Mediji from './pages/Mediji'
import Pot from './pages/Pot'
import Asistent from './pages/Asistent'
import OsebeList from './pages/Osebe'
import Login from './pages/Login'
import Register from './pages/Register'

function PrivateRoutes() {
  return (
    <PrivateRoute>
      <Routes>
        <Route path="/" element={<Iskanje />} />
        <Route path="/oseba/:id" element={<Oseba />} />
        <Route path="/osebe" element={<OsebeList />} />
        <Route path="/podjetje/:id" element={<Podjetje />} />
        <Route path="/omrezje/:id" element={<Omrezje />} />
        <Route path="/lobisti" element={<Lobisti />} />
        <Route path="/ovadeni" element={<Ovadeni />} />
        <Route path="/mediji" element={<Mediji />} />
        <Route path="/pot" element={<Pot />} />
        <Route path="/asistent" element={<Asistent />} />
      </Routes>
    </PrivateRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/*" element={<PrivateRoutes />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
