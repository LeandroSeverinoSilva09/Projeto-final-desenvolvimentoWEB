import { subDays } from 'date-fns'
import type { AdherenceStatus, DoseRecord, Medication } from '../types/medication'
import {
  formatDate,
  getAdherenceStatus,
  getExpectedDosesForDay,
  getLast7Days,
  getTakenDosesForDay,
} from './dates'

export interface DayAdherenceInfo {
  date: Date
  fullDate: string
  dayLabel: string
  expected: number
  taken: number
  status: AdherenceStatus
  isToday: boolean
  isExample: boolean
}

export interface WeeklyAdherenceSummary {
  totalExpected: number
  totalTaken: number
  percentage: number
  completeDays: number
  partialDays: number
  missedDays: number
  days: DayAdherenceInfo[]
}

export const ADHERENCE_LABELS: Record<AdherenceStatus, { short: string }> = {
  complete: { short: 'Tomou tudo' },
  partial: { short: 'Tomou alguns' },
  none: { short: 'Esqueceu' },
}

export function getWeeklyAdherence(
  medications: Medication[],
  history: DoseRecord[]
): WeeklyAdherenceSummary {
  const expectedPerDay = getExpectedDosesForDay(medications)
  const today = formatDate(new Date())

  const days: DayAdherenceInfo[] = getLast7Days().map((date) => {
    const taken = getTakenDosesForDay(history, date)
    const fullDate = formatDate(date)
    const dayRecords = history.filter((h) => h.date === fullDate)
    const isExample = dayRecords.some((r) => r.id.startsWith('sample-'))

    return {
      date,
      fullDate,
      dayLabel: formatDate(date).slice(0, 5),
      expected: expectedPerDay,
      taken,
      status: getAdherenceStatus(expectedPerDay, taken),
      isToday: fullDate === today,
      isExample,
    }
  })

  const totalExpected = days.reduce((s, d) => s + d.expected, 0)
  const totalTaken = days.reduce((s, d) => s + d.taken, 0)
  const percentage = totalExpected > 0 ? Math.round((totalTaken / totalExpected) * 100) : 0

  return {
    totalExpected,
    totalTaken,
    percentage,
    completeDays: days.filter((d) => d.status === 'complete').length,
    partialDays: days.filter((d) => d.status === 'partial').length,
    missedDays: days.filter((d) => d.status === 'none').length,
    days,
  }
}

export function generateVariedSampleHistory(): DoseRecord[] {
  const records: DoseRecord[] = []
  const meds = [
    { id: '1', name: 'Amoxicilina', dose: '1 comprimido', times: ['08:00', '16:00', '00:00'] },
    { id: '2', name: 'Dipirona', dose: '20 gotas', times: ['06:00', '12:00', '18:00'] },
  ]

  const allSlots = meds.flatMap((med) =>
    med.times.map((time) => ({ ...med, time }))
  )

  const dayPatterns: { offset: number; dosesToTake: number }[] = [
    { offset: 6, dosesToTake: 6 },
    { offset: 5, dosesToTake: 6 },
    { offset: 4, dosesToTake: 3 },
    { offset: 3, dosesToTake: 0 },
    { offset: 2, dosesToTake: 4 },
    { offset: 1, dosesToTake: 6 },
    { offset: 0, dosesToTake: 2 },
  ]

  dayPatterns.forEach(({ offset, dosesToTake }) => {
    const date = subDays(new Date(), offset)
    const dateStr = formatDate(date)

    allSlots.slice(0, dosesToTake).forEach((slot, i) => {
      const [h, m] = slot.time.split(':').map(Number)
      const ts = new Date(date)
      ts.setHours(h, m + i, 0, 0)

      records.push({
        id: `sample-${offset}-${slot.id}-${slot.time}`,
        medicationId: slot.id,
        name: slot.name,
        dose: slot.dose,
        date: dateStr,
        time: slot.time,
        scheduleTime: slot.time,
        timestamp: ts.getTime(),
      })
    })
  })

  return records
}
