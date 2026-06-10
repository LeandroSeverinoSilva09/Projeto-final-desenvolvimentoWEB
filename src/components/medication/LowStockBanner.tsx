import { AlertTriangle, Package } from 'lucide-react'
import { useMedications } from '../../contexts/MedicationContext'
import { formatDaysRemainingLabel, getStockStatus, isLowStock } from '../../utils/calculations'
import { getDisplayStock } from '../../utils/stock'
import { Button } from '../common/Button'

export function LowStockBanner() {
  const { medications, restockMedication } = useMedications()
  const lowStock = medications.filter(isLowStock)

  if (lowStock.length === 0) return null

  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle size={22} className="text-amber-600" />
        <h2 className="text-base font-bold text-amber-900">Hora de repor o estoque</h2>
      </div>
      <ul className="space-y-2">
        {lowStock.map((med) => {
          const { daysRemaining } = getStockStatus(med)
          const stock = getDisplayStock(med)
          return (
            <li
              key={med.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2"
            >
              <span className="text-sm font-bold text-slate-800">
                {med.name}, {stock.current} de {stock.total} na caixa, {formatDaysRemainingLabel(daysRemaining)}
              </span>
              <Button
                variant="success"
                className="!py-2 !px-3"
                onClick={() => restockMedication(med.id)}
                aria-label={`Repor ${med.name}`}
              >
                <Package size={16} />
                Repor
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
