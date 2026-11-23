import type { DoseRecord, Medication } from '../types/medication'
import { getTodayKey, parseScheduleTimes } from './dates'

export interface TodayDoseSlot {
  id: string
  medicationId: string
  name: string
  dose: string
  scheduleTime: string
  taken: boolean
  takenAt?: string
  isPast: boolean
}

export const DOSE_WINDOW_BEFORE_MINUTES = 15
export const DOSE_WINDOW_AFTER_MINUTES = 90

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function findTakenRecord(todayHistory: DoseRecord[], scheduleTime: string, usedIds: Set<string>): DoseRecord | undefined {
  return todayHistory.find(h => !usedIds.has(h.id) && (h.scheduleTime ? h.scheduleTime === scheduleTime : h.time === scheduleTime))
}

export function isSlotDueNow(slot: TodayDoseSlot): boolean {
  if (slot.taken) return false

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const scheduleMinutes = timeToMinutes(slot.scheduleTime)
  const diff = currentMinutes - scheduleMinutes

  if (diff >= 0 && diff <= DOSE_WINDOW_AFTER_MINUTES) return true
  if (diff < 0 && Math.abs(diff) <= DOSE_WINDOW_BEFORE_MINUTES) return true

  return false
}

export function getDueNowSlots(slots: TodayDoseSlot[]): TodayDoseSlot[] {
  return slots.filter(isSlotDueNow)
}

export function getTodayDoseSlots(
  medications: Medication[],
  history: DoseRecord[]
): TodayDoseSlot[] {
  const today = getTodayKey()
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const slots: TodayDoseSlot[] = []

  medications.forEach((med) => {
    const times = parseScheduleTimes(med.schedules)
    const todayHistory = history
      .filter((h) => h.medicationId === med.id && h.date === today)
      .sort((a, b) => a.timestamp - b.timestamp)

    const usedRecordIds = new Set<string>()

    times.forEach((scheduleTime) => {
      const takenRecord = findTakenRecord(todayHistory, scheduleTime, usedRecordIds)
      if (takenRecord) usedRecordIds.add(takenRecord.id)
      slots.push({
        id: `${today}-${med.id}-${scheduleTime}`,
        medicationId: med.id,
        name: med.name,
        dose: med.dose,
        scheduleTime,
        taken: !!takenRecord,
        takenAt: takenRecord?.time,
        isPast: timeToMinutes(scheduleTime) <= currentMinutes,
      })
    })
  })

  return slots.sort((a, b) => timeToMinutes(a.scheduleTime) - timeToMinutes(b.scheduleTime))
}

export function getPendingTodayCount(slots: TodayDoseSlot[]): number {
  return slots.filter((s) => !s.taken).length
}

export function getTakenTodayCount(slots: TodayDoseSlot[]): number {
  return slots.filter((s) => s.taken).length
}

export function getNextPendingSlot(slots: TodayDoseSlot[]): TodayDoseSlot | null {
  const pending = slots.filter((s) => !s.taken)
  if (pending.length === 0) return null

  const upcoming = pending.find(s => !s.isPast)
  if (upcoming) return upcoming

  return pending.sort((a, b) => timeToMinutes(a.scheduleTime) - timeToMinutes(b.scheduleTime))[0]
}

export function groupHistoryByDate(
  history: DoseRecord[]
): { date: string; records: DoseRecord[] }[] {
  const groups = new Map<string, DoseRecord[]>()

  history.forEach((record) => {
    const existing = groups.get(record.date) || []
    existing.push(record)
    groups.set(record.date, existing)
  })

  return Array.from(groups.entries())
    .map(([date, records]) => ({
      date,
      records: records.sort((a, b) => b.timestamp - a.timestamp),
    }))
    .sort((a, b) => {
      const [da, ma, ya] = a.date.split('/').map(Number)
      const [db, mb, yb] = b.date.split('/').map(Number)
      return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime()
    })
}
