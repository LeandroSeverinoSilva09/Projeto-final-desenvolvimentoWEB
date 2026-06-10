import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import type { Medication } from '../../types/medication'
import {
  formatDaysRemainingLabel,
  getStockStatus,
} from '../../utils/calculations'
import { getDisplayStock } from '../../utils/stock'
import { MedIcon3D } from './MedIcon3D'

interface PillBoxProps {
  medication: Medication
  size?: 'sm' | 'md'
}

const SEGMENTS = 10

const urgencyStyles = {
  ok: { segment: 'bg-emerald-400', text: 'text-emerald-600' },
  warning: { segment: 'bg-amber-400', text: 'text-amber-600' },
  critical: { segment: 'bg-red-400', text: 'text-red-600' },
  empty: { segment: 'bg-red-300', text: 'text-red-700' },
}

export function PillBox({ medication, size = 'md' }: PillBoxProps) {
  const status = getStockStatus(medication)
  const styles = urgencyStyles[status.urgency]
  const { current, total } = getDisplayStock(medication)
  const filledSegments = Math.round((status.fillPercentage / 100) * SEGMENTS)
  const iconSize = size === 'sm' ? 'sm' : 'md'

  return (
    <div
      className={`rounded-2xl border-2 p-4 ${
        status.needsReplenish ? 'border-amber-200 bg-amber-50/80' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MedIcon3D dose={medication.dose} size={iconSize} />
          <div>
            <p className={`text-2xl font-extrabold ${styles.text}`}>
              {current}
              <span className="text-base text-slate-400"> de {total}</span>
            </p>
            <p className="text-xs font-semibold text-slate-500">unidades na caixa</p>
          </div>
        </div>
        {status.needsReplenish && (
          <AlertTriangle size={18} className="text-amber-600" />
        )}
      </div>

      <div className="mb-2 rounded-xl border-2 border-slate-200 bg-white p-2">
        <div className="flex gap-1">
          {Array.from({ length: SEGMENTS }).map((_, i) => (
            <motion.div
              key={i}
              initial={false}
              animate={{ opacity: i < filledSegments ? 1 : 0.15 }}
              className={`h-5 flex-1 rounded-md ${i < filledSegments ? styles.segment : 'bg-slate-100'}`}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{medication.dose}</span>
        <span>{formatDaysRemainingLabel(status.daysRemaining)}</span>
      </div>
    </div>
  )
}
