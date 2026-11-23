import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DoseRecord, Medication } from '../types/medication'
import { getWeeklyAdherence } from './adherence'

function medication(overrides: Partial<Medication> = {}): Medication {
  return { id: 'med-a', name: 'Medicamento A', dose: 'Conforme prescrição', current: 30, total: 30,
    frequency: 12, schedules: '08:00, 20:00', takenCount: 0, unitsPerDose: 1,
    createdAt: new Date(2026, 10, 21, 9).toISOString(), ...overrides }
}

function record(date: number, hour: number, overrides: Partial<DoseRecord> = {}): DoseRecord {
  return { id: `dose-${date}-${hour}`, medicationId: 'med-a', name: 'Medicamento A', dose: 'Conforme prescrição',
    date: `${date}/11/2026`, time: `${String(hour).padStart(2, '0')}:00`,
    scheduleTime: `${String(hour).padStart(2, '0')}:00`, timestamp: new Date(2026, 10, date, hour).getTime(), ...overrides }
}

describe('weekly adherence reports only the applicable past period', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 23, 12, 0)) })
  afterEach(() => { vi.useRealTimers() })

  it('does not count days or historical records before a medication was registered', () => {
    const summary = getWeeklyAdherence([medication()], [record(20, 8), record(22, 8)])
    expect(summary.days.filter(d => d.fullDate < '21/11/2026').map(d => [d.expected, d.taken]))
      .toEqual([[0, 0], [0, 0], [0, 0], [0, 0]])
    expect(summary.totalExpected).toBe(5)
    expect(summary.totalTaken).toBe(1)
    expect(summary.missedDays).toBe(2)
  })

  it('counts today only through the current time and ignores future records today', () => {
    const summary = getWeeklyAdherence([medication()], [record(23, 8), record(23, 20)])
    const today = summary.days.find(d => d.isToday)!
    expect(today.expected).toBe(1)
    expect(today.taken).toBe(1)
    expect(summary.totalTaken).toBe(1)
  })

  it('keeps a future scheduled slot out of today numerator even if its confirmation timestamp is earlier', () => {
    const summary = getWeeklyAdherence([medication()], [record(23, 8), record(23, 10, { scheduleTime: '20:00' })])
    expect(summary.days.find(d => d.isToday)!.taken).toBe(1)
  })

  it('uses validated unique schedule times when counting expected doses today', () => {
    const summary = getWeeklyAdherence([medication({ schedules: '08:00, 08:00, , 07:99, 20:00' })], [])
    expect(summary.days.find(d => d.isToday)!.expected).toBe(1)
    expect(summary.days.find(d => d.fullDate === '22/11/2026')!.expected).toBe(2)
  })

  it('does not treat another medication history as adherence for the current treatment', () => {
    const summary = getWeeklyAdherence([medication()], [record(23, 8, { medicationId: 'archived-or-other-med' })])
    expect(summary.totalTaken).toBe(0)
    expect(summary.percentage).toBe(0)
  })
})
