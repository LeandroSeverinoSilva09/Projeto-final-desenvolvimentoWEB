import { motion } from 'framer-motion'
import { LogOut, Pill } from 'lucide-react'
import { useMedications } from '../../contexts/MedicationContext'

interface HeaderProps {
  title: string
  subtitle?: string
  showLogout?: boolean
}

export function Header({ title, subtitle, showLogout = true }: HeaderProps) {
  const { logout } = useMedications()

  const handleLogout = () => {
    if (window.confirm('Deseja sair do MEDControl?')) {
      logout()
    }
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-b-3xl bg-gradient-to-br from-primary-600 to-primary-700 px-5 py-6 text-white shadow-lg md:px-8"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-4">
        <div className="rounded-2xl bg-white/20 p-2.5">
          <Pill size={28} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight md:text-3xl">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-blue-100">{subtitle}</p>
          )}
        </div>
        {showLogout && (
          <button
            onClick={handleLogout}
            className="flex shrink-0 flex-col items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold transition-colors hover:bg-white/20"
            aria-label="Sair do app"
          >
            <LogOut size={20} />
            Sair
          </button>
        )}
      </div>
    </motion.header>
  )
}
