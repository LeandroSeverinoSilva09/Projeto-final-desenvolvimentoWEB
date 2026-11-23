import { describe, expect, it } from 'vitest'
import { initialMedicationFormat, medicationAmountLabel, medicationFormError, parseMedicationQuantity, stockUnitFor, type MedicationDraft } from './medicationForm'
import type { Medication } from '../types/medication'

const blank: MedicationDraft = { name: '', format: '', units: '', quantity: '', doseText: '', times: [''] }
const draft: MedicationDraft = { name: 'Nome completo da caixa 500 mg', format: 'solid', units: '0,5', quantity: '10', doseText: '', times: ['08:00', '20:00'] }
describe('visual medication registration boundaries', () => {
  it('lets the name step advance without requiring hidden quantities or times', () => {
    expect(medicationFormError({ ...blank, name: 'Remédio de teste' }, 1)).toBeNull()
    expect(medicationFormError(blank, 1)?.field).toBe('name')
  })
  it('requires an explicit format and amount rather than silently choosing one', () => {
    expect(initialMedicationFormat()).toBe('')
    expect(medicationFormError({ ...draft, format: '' }, 2)?.field).toBe('format')
    expect(medicationFormError({ ...draft, units: '' }, 2)?.field).toBe('units')
    expect(medicationFormError({ ...draft, times: [''] }, 3)?.field).toBe('times')
  })
  it.each([['0,5', 0.5], ['2.5', 2.5], ['0,001', 0.001], ['0', 0], ['100000', 100000]])('reads the literal decimal %s', (input, expected) => {
    expect(parseMedicationQuantity(input)).toBe(expected)
  })
  it.each(['', '-1', '1,000.5', '1.000,5', '1.000', '12.345', '0,0001', '1e3', 'NaN', 'Infinity', '1 comprimido'])('rejects an ambiguous or invalid amount %s', input => {
    expect(parseMedicationQuantity(input)).toBeNull()
  })
  it('keeps drops, liquid and unit counts separate without any conversion', () => {
    expect(stockUnitFor('drops')).toBe('gotas'); expect(stockUnitFor('liquid')).toBe('mL')
    expect(stockUnitFor('solid')).toBe('unidades'); expect(stockUnitFor('other')).toBe('unidades')
    expect(medicationAmountLabel(2.5, 'liquid')).toBe('2,5 mL')
    expect(medicationAmountLabel(1, 'drops')).toBe('1 gota')
    expect(medicationAmountLabel(2, 'solid')).toBe('2 comprimidos ou cápsulas')
  })
  it('requires review of an existing recipe after changing the amount or form', () => {
    expect(medicationFormError({ ...draft, doseText: '1 comprimido', units: '2', needsDoseReview: true }, 2)?.field).toBe('doseText')
    expect(medicationFormError({ ...draft, doseText: '2 comprimidos', units: '2', needsDoseReview: false }, 2)).toBeNull()
    expect(medicationFormError({ ...draft, doseText: '', needsDoseReview: true }, 2)).toBeNull()
  })
  it('accepts empty stock, but never a zero amount per use', () => {
    expect(medicationFormError({ ...draft, quantity: '0' }, 4)).toBeNull()
    expect(medicationFormError({ ...draft, units: '0' }, 2)?.field).toBe('units')
    expect(medicationFormError({ ...draft, quantity: '100001' }, 4)?.field).toBe('quantity')
    expect(medicationFormError({ ...draft, units: '1001' }, 2)?.field).toBe('units')
  })
  it('rejects missing and duplicated times and asks for an explanation for other forms', () => {
    expect(medicationFormError({ ...draft, times: ['08:00', '08:00'] }, 3)?.field).toBe('times')
    expect(medicationFormError({ ...draft, format: 'other' }, 2)?.field).toBe('doseText')
    expect(medicationFormError({ ...draft, format: 'other', doseText: 'Orientação literal da receita' }, 2)).toBeNull()
  })
  it('uses saved units on editing, without inferring a form from the medicine name', () => {
    const med: Medication = { id: '1', name: 'Nome que contém Gotas', dose: 'Texto preservado', current: 2.5, total: 10, schedules: '10:30', frequency: 24, takenCount: 0, stockUnit: 'mL', unitsPerDose: 0.5 }
    expect(initialMedicationFormat(med)).toBe('liquid')
    expect(med.dose).toBe('Texto preservado')
  })
})
