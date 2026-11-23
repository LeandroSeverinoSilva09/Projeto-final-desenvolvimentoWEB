import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { useAuth } from './contexts/AuthContext'
import { AddMedication } from './pages/AddMedication'
import { History } from './pages/History'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Progress } from './pages/Progress'
import { Medications } from './pages/Medications'
import { Settings } from './pages/Settings'
import { Help } from './pages/Help'
import { Pharmacies } from './pages/Pharmacies'
import { PublicInformation } from './pages/PublicInformation'
export default function App() {
  const { user, loading, recovering } = useAuth()
  if (loading) return <div className="loading-screen" role="status">Conectando ao MEDControl…</div>
  if (recovering) return <Login/>
  return <Routes>
    <Route path="/privacidade" element={<PublicInformation kind="privacy"/>}/>
    <Route path="/termos" element={<PublicInformation kind="terms"/>}/>
    <Route path="/login" element={user ? <Navigate to="/" replace/> : <Login/>}/>
    <Route path="/recuperar-senha" element={<Login/>}/>
    <Route element={user ? <AppLayout/> : <Navigate to="/login" replace/>}>
      <Route index element={<Home/>}/><Route path="/medicamentos" element={<Medications/>}/>
      <Route path="/adicionar" element={<AddMedication/>}/><Route path="/editar/:id" element={<AddMedication/>}/>
      <Route path="/status" element={<Progress/>}/><Route path="/historico" element={<History/>}/>
      <Route path="/configuracoes" element={<Settings/>}/><Route path="/farmacias" element={<Pharmacies/>}/><Route path="/ajuda" element={<Help/>}/>
    </Route><Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>
}
