import { AlertTriangle, Package } from 'lucide-react'
import type { Medication } from '../../types/medication'
import { Button } from '../common/Button'
import { Modal } from '../common/Modal'
import { PillBox } from './PillBox'

interface LowStockModalProps {
  medications: Medication[]
  open: boolean
  onRestock: (id: string) => void
  onDismiss: () => void
}

export function LowStockModal({
  medications,
  open,
  onRestock,
  onDismiss,
}: LowStockModalProps) {
  if (medications.length === 0) return null

  return (
    <Modal
      open={open}
      onClose={onDismiss}
      title="Repor estoque"
      size="lg"
      icon={<AlertTriangle size={24} className="text-amber-600" />}
    >
      <div className="max-h-[50vh] space-y-4 overflow-y-auto">
        {medications.map((med) => (
          <div key={med.id} className="space-y-3">
            <h3 className="text-lg font-bold text-slate-800">{med.name}</h3>
            <PillBox medication={med} size="sm" />
            <Button variant="success" fullWidth onClick={() => onRestock(med.id)}>
              <Package size={18} />
              Repor
            </Button>
          </div>
        ))}
      </div>

      <Button variant="ghost" fullWidth className="mt-4" onClick={onDismiss}>
        Depois
      </Button>
    </Modal>
  )
}
