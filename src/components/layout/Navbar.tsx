import { motion } from 'framer-motion'
import { BarChart3, Clock, Home, PlusCircle } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Início', icon: Home },
  { to: '/adicionar', label: 'Adicionar', icon: PlusCircle },
  { to: '/status', label: 'Status', icon: BarChart3 },
  { to: '/historico', label: 'Histórico', icon: Clock },
]

export function Navbar() {
  return (
    <nav className="shrink-0 border-t border-slate-200 bg-white px-2 py-2 safe-area-bottom md:py-3">
      <div className="mx-auto flex max-w-lg items-center justify-around gap-1 md:max-w-2xl">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-xs font-bold transition-colors ${
                isActive ? 'text-primary-600' : 'text-slate-400 hover:text-slate-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 rounded-xl bg-primary-50"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon size={24} className="relative z-10" strokeWidth={isActive ? 2.5 : 2} />
                <span className="relative z-10">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
