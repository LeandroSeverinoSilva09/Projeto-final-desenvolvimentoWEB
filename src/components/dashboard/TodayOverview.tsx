import { ArrowRight, CheckCircle2, Clock } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useMedications } from '../../contexts/MedicationContext'
import {
  getNextPendingSlot,
  getPendingTodayCount,
  getTakenTodayCount,
  getTodayDoseSlots,
  isSlotDueNow,
} from '../../utils/schedule'
import { Card } from '../common/Card'

export function TodayOverview() {
  const { medications, history } = useMedications()

  const { taken, total, pending, nextSlot } = useMemo(() => {
    const slots = getTodayDoseSlots(medications, history)
    return {
      taken: getTakenTodayCount(slots),
      total: slots.length,
      pending: getPendingTodayCount(slots),
      nextSlot: getNextPendingSlot(slots),
    }
  }, [medications, history])

  if (medications.length === 0 || total === 0) return null

  const allDone = pending === 0
  const dueNow = nextSlot ? isSlotDueNow(nextSlot) : false

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="grid grid-cols-2 divide-x divide-slate-100">
        <div className="p-4 text-center">
          <p className="text-3xl font-extrabold text-primary-600">
            {taken}/{total}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">doses hoje</p>
        </div>
        <div className="flex flex-col items-center justify-center p-4 text-center">
          {allDone ? (
            <>
              <CheckCircle2 size={28} className="text-emerald-500" />
              <p className="mt-1 text-sm font-bold text-emerald-700">Tudo tomado!</p>
            </>
          ) : (
            <>
              <p className="text-3xl font-extrabold text-amber-600">{pending}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">ainda faltam</p>
            </>
          )}
        </div>
      </div>

      {!allDone && nextSlot && (
        <div
          className={`border-t px-4 py-3 ${
            dueNow ? 'border-primary-200 bg-primary-50' : 'border-slate-100 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock size={18} className={dueNow ? 'text-primary-600' : 'text-slate-500'} />
            <p className="text-sm text-slate-700">
              {dueNow ? (
                <>
                  <strong className="text-primary-700">Agora:</strong> {nextSlot.name} às{' '}
                  {nextSlot.scheduleTime}
                </>
              ) : (
                <>
                  <strong>Próximo:</strong> {nextSlot.name} às {nextSlot.scheduleTime}
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <Link
        to="/status"
        className="flex items-center justify-center gap-2 border-t border-slate-100 py-3 text-sm font-bold text-primary-600 hover:bg-primary-50"
      >
        Ver relatório da semana
        <ArrowRight size={16} />
      </Link>
    </Card>
  )
}
