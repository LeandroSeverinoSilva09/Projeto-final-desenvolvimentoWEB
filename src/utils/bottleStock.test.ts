import { describe, expect, it } from 'vitest'
import type { BottleStockLevel, Medication } from '../types/medication'
import { bottleLevel, hasDoseStock, stockAfterDose, stockSummary } from './bottleStock'
import { getStockStatus } from './calculations'
import { medicationFormError } from './medicationForm'

const drops: Medication = { id: 'drops', name: 'Fictício', dose: '20 gotas', current: 0, total: 0.001, unitsPerDose: 20, stockUnit: 'gotas', stockLevel: 'half', schedules: '08:00, 20:00', frequency: 12, takenCount: 0 }
describe('user-reported bottle stock stays separate from prescribed drop doses', () => {
  it.each(['full', 'half', 'low', 'empty', 'unknown'] as BottleStockLevel[])('never estimates days or subtracts drops from the %s observation', level => {
    const med = { ...drops, stockLevel: level, current: 777, total: 1000 }
    expect(getStockStatus(med).daysRemaining).toBeNull()
    expect(stockAfterDose(med)).toBe(777)
    expect(stockSummary(med)).not.toContain('777')
    expect(hasDoseStock(med)).toBe(level !== 'empty')
  })
  it.each(['low', 'empty'] as BottleStockLevel[])('uses the %s observation to flag replenishment', stockLevel => {
    expect(getStockStatus({ ...drops, current: 10000, total: 10000, stockLevel }).needsReplenish).toBe(true)
  })
  it.each(['full', 'half', 'unknown'] as BottleStockLevel[])('does not send a false numeric stock alert for %s with zero legacy balance', stockLevel => {
    expect(getStockStatus({ ...drops, stockLevel }).needsReplenish).toBe(false)
  })
  it('does not guess a legacy bottle level from its old numeric drop balance', () => {
    const med = { ...drops, current: 0, stockLevel: undefined }
    expect(bottleLevel(med)).toBe('unknown')
    expect(hasDoseStock(med)).toBe(true)
    expect(stockSummary(med)).toBe('Nível não informado')
  })
  it('keeps exact numeric consumption for measured liquids and tablets', () => {
    expect(stockAfterDose({ ...drops, stockUnit: 'mL', current: 8.5, unitsPerDose: 2.5 })).toBe(6)
    expect(hasDoseStock({ ...drops, stockUnit: 'unidades', current: 0 })).toBe(false)
  })
  it('requires an observation instead of a hidden numeric quantity for drops', () => {
    const draft = { name: 'Fictício', format: 'drops' as const, units: '20', quantity: '', times: ['08:00'], doseText: '' }
    expect(medicationFormError(draft, 4)?.field).toBe('stockLevel')
    expect(medicationFormError({ ...draft, stockLevel: 'unknown' }, 4)).toBeNull()
    expect(medicationFormError({ ...draft, stockLevel: 'half' }, 4)).toBeNull()
  })
})
