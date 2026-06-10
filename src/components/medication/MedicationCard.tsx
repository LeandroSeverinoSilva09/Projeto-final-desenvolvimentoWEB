import { Check, Clock, Package, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useMedications } from '../../contexts/MedicationContext'
import type { Medication } from '../../types/medication'
import { getStockStatus } from '../../utils/calculations'
import { parseScheduleTimes } from '../../utils/dates'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { MedIcon3D } from './MedIcon3D'
import { PillBox } from './PillBox'

interface MedicationCardProps {
  medication: Medication
  compact?: boolean
}

export function MedicationCard({ medication, compact = false }: MedicationCardProps) {
  const { takeMedication, restockMedication, deleteMedication } = useMedications()
  const [isConfirming, setIsConfirming] = useState(false)
  const stockStatus = getStockStatus(medication)
  const critical = stockStatus.needsReplenish
  const schedules = parseScheduleTimes(medication.schedules)

  const handleDelete = () => {
    if (window.confirm(`Excluir ${medication.name} da lista?`)) {
      deleteMedication(medication.id)
    }
  }

  const handleTake = () => {
    setIsConfirming(true)
    takeMedication(medication.id)
    setTimeout(() => setIsConfirming(false), 600)
  }

  return (
    <Card variant={critical ? 'critical' : 'default'}>
      <div className="flex items-start gap-4">
        <MedIcon3D dose={medication.dose} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-slate-800">{medication.name}</h3>
              <p className="text-base text-slate-600">{medication.dose}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                critical
                  ? 'bg-red-100 text-danger-600'
                  : 'bg-emerald-100 text-success-600'
              }`}
            >
              {critical ? 'Repor' : 'Em dia'}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {schedules.map((time) => (
              <span
                key={time}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700"
              >
                <Clock size={14} />
                {time}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <PillBox medication={medication} size={compact ? 'sm' : 'md'} />
      </div>

      {!compact && (
        <>
          <Button
            variant="secondary"
            fullWidth
            className="mt-4 !py-4 !text-base"
            disabled={isConfirming}
            onClick={handleTake}
          >
            <Check size={20} />
            {isConfirming ? 'Confirmando...' : 'Já tomei'}
          </Button>
          <div className="mt-2 flex gap-2">
            <Button variant="success" className="flex-1" onClick={() => restockMedication(medication.id)}>
              <Package size={18} />
              Repor
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleDelete}>
              <Trash2 size={18} />
              Excluir
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}
