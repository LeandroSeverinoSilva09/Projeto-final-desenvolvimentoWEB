import {
  format,
  subDays,
  startOfDay,
  isSameDay,
  parse,
  isValid,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { AdherenceStatus, DoseRecord, Medication } from '../types/medication'

export function formatDate(date: Date): string {
  return format(date, 'dd/MM/yyyy')
}

export function formatTime(date: Date): string {
  return format(date, 'HH:mm')
}

export function formatDateLong(date: Date): string {
  return format(date, "EEEE, d 'de' MMMM", { locale: ptBR })
}

export function getTodayKey(): string {
  return formatDate(new Date())
}

export function parseScheduleTimes(schedules: string): string[] {
  return schedules
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function getExpectedDosesForDay(medications: Medication[]): number {
  return medications.reduce((total, med) => {
    const times = parseScheduleTimes(med.schedules)
    return total + (times.length > 0 ? times.length : 1)
  }, 0)
}

export function getTakenDosesForDay(history: DoseRecord[], date: Date): number {
  return history.filter((record) => {
    const recordDate = parse(record.date, 'dd/MM/yyyy', new Date())
    return isValid(recordDate) && isSameDay(recordDate, date)
  }).length
}

export function getAdherenceStatus(expected: number, taken: number): AdherenceStatus {
  if (expected === 0) return 'none'
  if (taken >= expected) return 'complete'
  if (taken > 0) return 'partial'
  return 'none'
}

export function getLast7Days(): Date[] {
  const today = startOfDay(new Date())
  return Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i))
}

export function getDayLabel(date: Date): string {
  return format(date, 'EEE', { locale: ptBR })
}
