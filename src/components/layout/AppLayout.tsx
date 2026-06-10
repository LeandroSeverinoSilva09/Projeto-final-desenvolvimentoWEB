import { Outlet } from 'react-router-dom'
import { ReminderManager } from '../medication/ReminderManager'
import { ToastContainer } from '../common/Toast'
import { Navbar } from './Navbar'

export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-100">
      <ReminderManager />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
      <Navbar />
      <ToastContainer />
    </div>
  )
}
