import { motion } from 'framer-motion'
import { CheckCircle2, Clock } from 'lucide-react'
import type { TodayDoseSlot } from '../../utils/schedule'
import { Button } from '../common/Button'
import { Modal } from '../common/Modal'
import { MedIcon3D } from './MedIcon3D'

interface DoseReminderModalProps {
  slot: TodayDoseSlot | null
  open: boolean
  onConfirm: () => void
  onDismiss: () => void
  remaining?: number
}

export function DoseReminderModal({
  slot,
  open,
  onConfirm,
  onDismiss,
  remaining = 0,
}: DoseReminderModalProps) {
  if (!slot) return null

  return (
    <Modal
      open={open}
      onClose={onDismiss}
      title={slot.isPast ? 'Remédio atrasado' : 'Hora do remédio'}
      size="lg"
      icon={
        <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
          <Clock size={24} className="text-primary-600" />
        </motion.div>
      }
    >
      <div className="flex flex-col items-center text-center">
        <MedIcon3D dose={slot.dose} size="xl" />
        <h3 className="mt-4 text-2xl font-extrabold text-slate-800">{slot.name}</h3>
        <p className="text-lg text-slate-600">{slot.dose}</p>
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-primary-50 px-5 py-3 text-xl font-bold text-primary-700">
          <Clock size={20} />
          {slot.scheduleTime}
        </div>
        {remaining > 0 && (
          <p className="mt-3 text-sm text-slate-500">
            Mais {remaining} {remaining === 1 ? 'remédio' : 'remédios'} no horário
          </p>
        )}
      </div>

      <div className="mt-6 space-y-3">
        <Button variant="secondary" fullWidth className="!py-5 !text-lg" onClick={onConfirm}>
          <CheckCircle2 size={22} />
          Já tomei
        </Button>
        <Button variant="ghost" fullWidth onClick={onDismiss}>
          Depois
        </Button>
      </div>
    </Modal>
  )
}
