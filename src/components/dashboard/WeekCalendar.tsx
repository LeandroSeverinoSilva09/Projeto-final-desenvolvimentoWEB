import { motion } from 'framer-motion'
import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMedications } from '../../contexts/MedicationContext'
import type { AdherenceStatus } from '../../types/medication'
import { ADHERENCE_LABELS, getWeeklyAdherence } from '../../utils/adherence'
import { getDayLabel } from '../../utils/dates'
import { Card } from '../common/Card'
import { MedIcon3D } from '../medication/MedIcon3D'

const statusConfig: Record<
  AdherenceStatus,
  { bg: string; Icon: typeof CheckCircle2 }
> = {
  complete: { bg: 'bg-emerald-500', Icon: CheckCircle2 },
  partial: { bg: 'bg-amber-500', Icon: MinusCircle },
  none: { bg: 'bg-red-500', Icon: XCircle },
}

export function WeekCalendar() {
  const { medications, history } = useMedications()
  const summary = useMemo(
    () => getWeeklyAdherence(medications, history),
    [medications, history]
  )
  const { days } = summary

  const todayIndex = days.findIndex((d) => d.isToday)
  const [selectedIndex, setSelectedIndex] = useState(todayIndex >= 0 ? todayIndex : days.length - 1)

  const selectedDay = days[selectedIndex]
  const selectedRecords = useMemo(() => {
    if (!selectedDay) return []
    return history
      .filter((h) => h.date === selectedDay.fullDate)
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [history, selectedDay])

  if (medications.length === 0) return null

  return (
    <Card>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, index) => {
          const config = statusConfig[day.status]
          const StatusIcon = config.Icon
          const label = ADHERENCE_LABELS[day.status]
          const isSelected = index === selectedIndex

          return (
            <button
              key={day.fullDate}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className="flex flex-col items-center gap-1 rounded-xl p-0.5 transition-colors hover:bg-slate-50"
              title={`${day.fullDate}: ${day.taken} de ${day.expected}, ${label.short}`}
            >
              <span className="text-[10px] font-bold uppercase text-slate-400">
                {getDayLabel(day.date)}
              </span>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-2xl text-white ${config.bg} ${
                  day.isToday ? 'ring-2 ring-primary-500 ring-offset-1' : ''
                } ${isSelected ? 'ring-2 ring-slate-800 ring-offset-1' : ''}`}
              >
                <StatusIcon size={18} strokeWidth={2.5} />
                <span className="text-sm font-extrabold">{day.date.getDate()}</span>
              </motion.div>

              <span className="text-[11px] font-bold text-slate-500">
                {day.taken}/{day.expected}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex justify-center gap-6">
        {(['complete', 'partial', 'none'] as AdherenceStatus[]).map((status) => {
          const config = statusConfig[status]
          const StatusIcon = config.Icon
          return (
            <div key={status} className="flex items-center gap-1.5" title={ADHERENCE_LABELS[status].short}>
              <div className={`rounded-lg p-1 ${config.bg} text-white`}>
                <StatusIcon size={14} />
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {ADHERENCE_LABELS[status].short}
              </span>
            </div>
          )
        })}
      </div>

      {selectedDay && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-slate-800">
                {selectedDay.fullDate}
                {selectedDay.isToday && (
                  <span className="ml-2 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-700">
                    Hoje
                  </span>
                )}
              </h4>
              <p className="text-sm text-slate-500">
                Tomou {selectedDay.taken} de {selectedDay.expected} doses
                {selectedDay.isExample && (
                  <span className="ml-1 text-xs text-amber-600">(exemplo)</span>
                )}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold text-white ${statusConfig[selectedDay.status].bg}`}
            >
              {ADHERENCE_LABELS[selectedDay.status].short}
            </span>
          </div>

          {selectedRecords.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma dose registrada neste dia.</p>
          ) : (
            <ul className="space-y-2">
              {selectedRecords.map((record) => (
                <li
                  key={record.id}
                  className="flex items-center gap-3 rounded-xl bg-white px-3 py-2"
                >
                  <MedIcon3D dose={record.dose} size="xs" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800">{record.name}</p>
                    <p className="text-xs text-slate-500">{record.dose}</p>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-bold text-emerald-600">
                    <CheckCircle2 size={14} />
                    {record.scheduleTime ?? record.time}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}
