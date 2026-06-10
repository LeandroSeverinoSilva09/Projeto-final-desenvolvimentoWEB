import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Pill } from 'lucide-react'
import { useMedications } from '../../contexts/MedicationContext'
import type { FilterType } from '../../types/medication'

const filters: { key: FilterType; label: string; icon: typeof Pill }[] = [
  { key: 'all', label: 'Todos', icon: Pill },
  { key: 'alert', label: 'Alerta', icon: AlertTriangle },
  { key: 'ok', label: 'Em dia', icon: CheckCircle2 },
]

export function FilterBar() {
  const { filter, setFilter } = useMedications()

  return (
    <div className="flex gap-2 rounded-2xl bg-white p-1.5 shadow-sm">
      {filters.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => setFilter(key)}
          className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-sm font-bold transition-colors ${
            filter === key ? 'text-primary-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {filter === key && (
            <motion.div
              layoutId="filter-indicator"
              className="absolute inset-0 rounded-xl bg-primary-50"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <Icon size={18} className="relative z-10" />
          <span className="relative z-10">{label}</span>
        </button>
      ))}
    </div>
  )
}
