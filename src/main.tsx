import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { MedicationProvider } from './contexts/MedicationContext'
import './styles/globals.css'
import './styles/responsive.css'
document.documentElement.classList.toggle('large-text', localStorage.getItem('medcontrol_large_text') === 'true')
createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><AuthProvider><MedicationProvider><App/></MedicationProvider></AuthProvider></BrowserRouter></StrictMode>)
