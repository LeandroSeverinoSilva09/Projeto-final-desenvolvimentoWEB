import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Package,
  Pill,
} from 'lucide-react'
import { useMemo } from 'react'
import { useMedications } from '../../contexts/MedicationContext'
import { getStockStatus, isLowStock } from '../../utils/calculations'
import { getDisplayStock } from '../../utils/stock'
import { formatDate, getLast7Days } from '../../utils/dates'
import { Card } from '../common/Card'
import { MedIcon3D } from '../medication/MedIcon3D'

export function MedicationProgressList() {
  const { medications, history } = useMedications()

  const medProgress = useMemo(() => {
    const weekDays = getLast7Days()
    return medications.map((med) => {
      const stock = getStockStatus(med)
      const schedules = med.schedules.split(',').filter(Boolean).length || 1
      const weekExpected = schedules * 7
      const weekTaken = weekDays.reduce((total, day) => {
        const dayKey = formatDate(day)
        return total + history.filter((h) => h.medicationId === med.id && h.date === dayKey).length
      }, 0)

      return { med, stock, weekTaken, weekExpected, needsRestock: isLowStock(med) }
    })
  }, [medications, history])

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Pill size={22} className="text-primary-600" />
        <h3 className="text-lg font-bold text-slate-800">Seus remédios</h3>
      </div>

      <div className="space-y-3">
        {medProgress.map(({ med, weekTaken, weekExpected, needsRestock }) => {
          const displayStock = getDisplayStock(med)
          return (
          <div
            key={med.id}
            className={`rounded-2xl border-2 p-4 ${
              needsRestock ? 'border-amber-200 bg-amber-50/50' : 'border-slate-100 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <MedIcon3D dose={med.dose} size="sm" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-bold text-slate-800">{med.name}</h4>
                  {needsRestock ? (
                    <AlertTriangle size={16} className="text-amber-600" />
                  ) : (
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  )}
                </div>
                <p className="text-sm text-slate-500">{med.dose}</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center rounded-xl bg-slate-50 p-3">
                <Calendar size={16} className="text-primary-600" />
                <p className="mt-1 text-xl font-extrabold text-primary-600">
                  {weekTaken}/{weekExpected}
                </p>
                <p className="text-xs font-semibold text-slate-500">doses na semana</p>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-slate-50 p-3">
                <Package size={16} className="text-slate-500" />
                <p className={`mt-1 text-xl font-extrabold ${needsRestock ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {displayStock.current}/{displayStock.total}
                </p>
                <p className="text-xs font-semibold text-slate-500">na caixa</p>
              </div>
            </div>
          </div>
        )})}
      </div>
    </Card>
  )
}
