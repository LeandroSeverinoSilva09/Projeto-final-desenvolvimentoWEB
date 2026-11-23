import { describe, expect, it } from 'vitest'
import type { Medication } from '../types/medication'
import { getDailyConsumption, getStockStatus } from './calculations'
import { normalizeMedicationStock } from './stock'

function medication(overrides: Partial<Medication> = {}): Medication {
  return { id: 'stock-med', name: 'Medicamento', dose: 'Conforme prescrição', current: 30, total: 30,
    frequency: 8, schedules: '08:00, 16:00, 23:00', takenCount: 0, unitsPerDose: 2, ...overrides }
}

describe('stock consumption follows the prescribed units per dose', () => {
  it('multiplies valid daily slots by units per dose rather than counting one unit per confirmation', () => {
    const status = getStockStatus(medication())
    expect(status.dailyConsumption).toBe(6)
    expect(status.daysRemaining).toBe(5)
    expect(status.replenishThreshold).toBe(18)
    expect(getDailyConsumption(medication({ schedules: '08:00, 08:00, bad, 20:00' }))).toBe(4)
  })

  it('supports half units and liquid amounts in the same stock unit', () => {
    expect(getDailyConsumption(medication({ unitsPerDose: 0.5 }))).toBe(1.5)
    const status = getStockStatus(medication({ current: 100, total: 100, unitsPerDose: 2.5, schedules: '08:00, 20:00' }))
    expect(status.dailyConsumption).toBe(5)
    expect(status.daysRemaining).toBe(20)
  })

  it('does not lose a full day through binary decimal rounding', () => {
    const status = getStockStatus(medication({ current: 0.3, total: 1, unitsPerDose: 0.1, schedules: '08:00' }))
    expect(status.dailyConsumption).toBe(0.1)
    expect(status.daysRemaining).toBe(3)
    expect(getDailyConsumption(medication({ unitsPerDose: 0.1 }))).toBe(0.3)
    expect(getStockStatus(medication({ current: 0.299, total: 1, unitsPerDose: 0.1, schedules: '08:00' })).daysRemaining).toBe(2)
  })

  it('defaults legacy medication consumption to one unit and flags empty or insufficient stock', () => {
    expect(getDailyConsumption(medication({ unitsPerDose: undefined, schedules: '08:00, 20:00' }))).toBe(2)
    expect(getStockStatus(medication({ current: 0 })).urgency).toBe('empty')
    const status = getStockStatus(medication({ current: 1 }))
    expect(status.daysRemaining).toBe(0)
    expect(status.needsReplenish).toBe(true)
    expect(status.urgency).toBe('critical')
  })

  it('clamps a negative or over-capacity current stock without mutating the input', () => {
    const original = medication({ current: -2 })
    expect(normalizeMedicationStock(original).current).toBe(0)
    expect(original.current).toBe(-2)
    expect(normalizeMedicationStock(medication({ current: 40 })).current).toBe(30)
    expect(normalizeMedicationStock(medication({ current: 1.2000000000000002 })).current).toBe(1.2)
  })
})
