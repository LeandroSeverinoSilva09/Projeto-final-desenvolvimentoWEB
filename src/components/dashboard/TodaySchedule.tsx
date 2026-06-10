import { motion } from 'framer-motion'
import {
  CheckCircle2,
  Circle,
  Clock,
  Moon,
  PartyPopper,
  Sun,
  Sunset,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMedications } from '../../contexts/MedicationContext'
import {
  getPendingTodayCount,
  getTakenTodayCount,
  getTodayDoseSlots,
  isSlotDueNow,
} from '../../utils/schedule'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { MedIcon3D } from '../medication/MedIcon3D'

function getPeriodIcon(time: string) {
  const hour = parseInt(time.split(':')[0])
  if (hour >= 5 && hour < 12) return Sun
  if (hour >= 12 && hour < 18) return Sunset
  return Moon
}

export function TodaySchedule() {
  const { medications, history, takeMedication } = useMedications()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const slots = useMemo(
    () => getTodayDoseSlots(medications, history),
    [medications, history]
  )

  const pending = getPendingTodayCount(slots)
  const taken = getTakenTodayCount(slots)
  const total = slots.length
  const allTaken = total > 0 && pending === 0

  const handleTake = async (medicationId: string, scheduleTime: string, slotId: string) => {
    setConfirmingId(slotId)
    takeMedication(medicationId, scheduleTime)
    setTimeout(() => setConfirmingId(null), 600)
  }

  if (medications.length === 0) {
    return (
      <Card className="flex flex-col items-center py-8 text-center">
        <MedIcon3D type="pill" size="lg" />
        <h2 className="mt-4 text-xl font-bold text-slate-800">Nenhum remédio cadastrado</h2>
        <p className="mt-2 text-base text-slate-500">
          Adicione seus medicamentos para ver o que tomar hoje.
        </p>
        <Link to="/adicionar" className="mt-4">
          <Button>Adicionar remédio</Button>
        </Link>
      </Card>
    )
  }

  if (total === 0) {
    return (
      <Card className="flex flex-col items-center py-8 text-center">
        <MedIcon3D type="pill" size="lg" />
        <h2 className="mt-4 text-xl font-bold text-slate-800">Sem horários hoje</h2>
        <p className="mt-2 text-base text-slate-500">
          Cadastre os horários de cada remédio para receber lembretes.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {allTaken && (
        <Card variant="success" className="flex items-center gap-4">
          <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600">
            <PartyPopper size={28} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-emerald-800">Parabéns!</h2>
            <p className="text-base text-emerald-700">
              Você tomou todos os remédios de hoje.
            </p>
          </div>
        </Card>
      )}

      <Card className="!p-0 overflow-hidden">
        <div className="bg-primary-600 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <Clock size={28} />
            <div>
              <h2 className="text-xl font-bold">O que tomar hoje</h2>
              <p className="text-sm text-blue-100">
                Tomou {taken} de {total}
                {pending > 0 && `. Faltam ${pending}`}
              </p>
            </div>
          </div>
          {total > 0 && (
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/20">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(taken / total) * 100}%` }}
                transition={{ duration: 0.5 }}
                className="h-full rounded-full bg-emerald-400"
              />
            </div>
          )}
        </div>

        <p className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-sm text-slate-600">
          Toque em <strong>Já tomei</strong> depois de tomar cada remédio no horário.
        </p>

        <div className="space-y-3 p-4">
          {slots.map((slot, index) => {
            const PeriodIcon = getPeriodIcon(slot.scheduleTime)
            const dueNow = isSlotDueNow(slot)
            const isLate = slot.isPast && !slot.taken && !dueNow
            const isConfirming = confirmingId === slot.id

            return (
              <motion.div
                key={slot.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className={`rounded-2xl border-2 p-4 ${
                  slot.taken
                    ? 'border-emerald-200 bg-emerald-50'
                    : dueNow
                      ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-200'
                      : isLate
                        ? 'border-red-300 bg-red-50'
                        : slot.isPast
                          ? 'border-amber-300 bg-amber-50'
                          : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-4">
                  <MedIcon3D dose={slot.dose} size="md" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-800">{slot.name}</h3>
                      {slot.taken && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 400 }}
                        >
                          <CheckCircle2 size={18} className="text-emerald-600" />
                        </motion.div>
                      )}
                      {dueNow && !slot.taken && (
                        <Circle size={14} className="fill-primary-500 text-primary-500" />
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-base font-semibold text-primary-600">
                      <PeriodIcon size={18} />
                      <span>{slot.scheduleTime}</span>
                      <span className="text-sm font-normal text-slate-500">{slot.dose}</span>
                    </div>
                    {slot.taken && slot.takenAt && (
                      <p className="mt-1 text-sm font-semibold text-emerald-600">
                        Confirmado às {slot.takenAt}
                      </p>
                    )}
                    {isLate && (
                      <p className="mt-1 text-sm font-bold text-red-600">
                        Atrasado. Você ainda não tomou
                      </p>
                    )}
                    {dueNow && !slot.taken && (
                      <p className="mt-1 text-sm font-bold text-primary-600">
                        Agora é a hora de tomar
                      </p>
                    )}
                  </div>
                </div>

                {!slot.taken && (
                  <Button
                    variant="secondary"
                    fullWidth
                    className="mt-3 !py-4 !text-base"
                    disabled={isConfirming}
                    onClick={() => handleTake(slot.medicationId, slot.scheduleTime, slot.id)}
                    aria-label={`Confirmar ${slot.name} às ${slot.scheduleTime}`}
                  >
                    <CheckCircle2 size={20} />
                    {isConfirming ? 'Confirmando...' : 'Já tomei'}
                  </Button>
                )}
              </motion.div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
