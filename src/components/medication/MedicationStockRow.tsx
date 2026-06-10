import { Clock, Package } from 'lucide-react'
import { useMedications } from '../../contexts/MedicationContext'
import type { Medication } from '../../types/medication'
import { getStockStatus } from '../../utils/calculations'
import { parseScheduleTimes } from '../../utils/dates'
import { getDisplayStock } from '../../utils/stock'
import { Button } from '../common/Button'
import { MedIcon3D } from './MedIcon3D'

interface MedicationStockRowProps {
  medication: Medication
}

export function MedicationStockRow({ medication }: MedicationStockRowProps) {
  const { restockMedication } = useMedications()
  const stock = getStockStatus(medication)
  const display = getDisplayStock(medication)
  const schedules = parseScheduleTimes(medication.schedules)
  const needsRestock = stock.needsReplenish

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border-2 bg-white p-4 ${
        needsRestock ? 'border-amber-200' : 'border-slate-100'
      }`}
    >
      <MedIcon3D dose={medication.dose} size="sm" />

      <div className="min-w-0 flex-1">
        <p className="text-base font-bold text-slate-800">{medication.name}</p>
        <p className="text-sm text-slate-500">{medication.dose}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {schedules.map((time) => (
            <span
              key={time}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600"
            >
              <Clock size={12} />
              {time}
            </span>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <div className="text-right">
          <p className={`text-lg font-extrabold ${needsRestock ? 'text-amber-600' : 'text-emerald-600'}`}>
            {display.current}
          </p>
          <p className="text-[10px] font-semibold text-slate-400">de {display.total}</p>
        </div>
        {needsRestock && (
          <Button
            variant="success"
            className="!py-1.5 !px-2.5 !text-xs"
            onClick={() => restockMedication(medication.id)}
          >
            <Package size={14} />
            Repor
          </Button>
        )}
      </div>
    </div>
  )
}
