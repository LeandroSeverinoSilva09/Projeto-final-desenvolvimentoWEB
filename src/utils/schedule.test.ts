import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DoseRecord, Medication } from '../types/medication'
import { getTodayKey } from './dates'
import { getTodayDoseSlots } from './schedule'

const medication: Medication = {
  id: 'med-a', name: 'Medicamento A', dose: 'Dose prescrita', current: 30, total: 30,
  frequency: 8, schedules: '08:00, 16:00, 20:00', takenCount: 0, unitsPerDose: 1,
}

function record(overrides: Partial<DoseRecord> = {}): DoseRecord {
  return { id: 'dose-a', medicationId: medication.id, name: medication.name, dose: medication.dose,
    date: getTodayKey(), time: '08:00', timestamp: Date.now(), ...overrides }
}

describe('today dose slot mapping', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 23, 17, 0)) })
  afterEach(() => { vi.useRealTimers() })

  it('uses the explicit scheduled time even when confirmation time matches a different slot', () => {
    const slots = getTodayDoseSlots([medication], [record({ scheduleTime: '16:00', time: '08:00' })])
    expect(slots.map(s => [s.scheduleTime, s.taken])).toEqual([
      ['08:00', false], ['16:00', true], ['20:00', false],
    ])
    expect(slots[1].takenAt).toBe('08:00')
  })

  it('never reassigns a record whose scheduled time is no longer in the current plan', () => {
    const slots = getTodayDoseSlots([medication], [record({ scheduleTime: '07:00', time: '08:00' })])
    expect(slots.every(s => !s.taken)).toBe(true)
  })

  it('matches legacy records only to the exact confirmation time and only once', () => {
    const slots = getTodayDoseSlots([{ ...medication, schedules: '08:00, 08:00, 16:00' }], [record()])
    expect(slots).toHaveLength(2)
    expect(slots.filter(s => s.taken).map(s => s.scheduleTime)).toEqual(['08:00'])
    expect(getTodayDoseSlots([medication], [record({ time: '08:05' })]).every(s => !s.taken)).toBe(true)
  })

  it('keeps other medications and dates out of today confirmations', () => {
    const slots = getTodayDoseSlots([medication], [
      record({ id: 'other-med', medicationId: 'med-b', scheduleTime: '08:00' }),
      record({ id: 'yesterday', date: '22/11/2026', scheduleTime: '16:00' }),
    ])
    expect(slots.every(s => !s.taken)).toBe(true)
    expect(slots.map(s => s.isPast)).toEqual([true, true, false])
  })
})
