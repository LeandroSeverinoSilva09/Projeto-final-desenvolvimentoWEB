import type { Medication } from '../types/medication'

export type MedicationFormat = 'solid' | 'liquid' | 'drops' | 'other'
export type MedicationFormStep = 1 | 2 | 3 | 4
export interface MedicationDraft { name: string; format: MedicationFormat | ''; units: string; quantity: string; doseText: string; times: string[]; needsDoseReview?: boolean }
export interface MedicationFormError { step: MedicationFormStep; field: 'name' | 'format' | 'units' | 'doseText' | 'times' | 'quantity'; message: string }

export const stockUnitFor = (format: MedicationFormat | ''): NonNullable<Medication['stockUnit']> => format === 'liquid' ? 'mL' : format === 'drops' ? 'gotas' : 'unidades'
export function initialMedicationFormat(medication?: Medication): MedicationFormat | '' {
  if (!medication) return ''
  if (medication.stockUnit === 'mL') return 'liquid'
  if (medication.stockUnit === 'gotas') return 'drops'
  return /comprimid|c[aá]psul/iu.test(medication.dose) ? 'solid' : 'other'
}
export function parseMedicationQuantity(value: string): number | null {
  // A dot followed by three digits can mean thousands in Portuguese. Ask for
  // an unambiguous value instead of silently turning 1.000 into one.
  if (/^[1-9]\d*\.\d{3}$/u.test(value.trim())) return null
  if (!/^\d+(?:[.,]\d{1,3})?$/u.test(value.trim())) return null
  const parsed = Number(value.trim().replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}
export function formatMedicationQuantity(value: number): string { return value.toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: 3 }) }
export function medicationAmountLabel(value: number, format: MedicationFormat | ''): string {
  const unit = format === 'liquid' ? 'mL' : format === 'drops' ? value === 1 ? 'gota' : 'gotas' : format === 'solid' ? value === 1 ? 'comprimido ou cápsula' : 'comprimidos ou cápsulas' : value === 1 ? 'item' : 'itens'
  return `${formatMedicationQuantity(value)} ${unit}`
}
export function medicationFormError(draft: MedicationDraft, step: MedicationFormStep): MedicationFormError | null {
  if (step === 1) {
    if (!draft.name.trim()) return { step, field: 'name', message: 'Escreva o nome que aparece na caixa do remédio.' }
    if (draft.name.trim().length > 100) return { step, field: 'name', message: 'Use um nome com até 100 letras e números.' }
  }
  if (step === 2) {
    if (!draft.format) return { step, field: 'format', message: 'Toque na figura que combina com o seu remédio.' }
    const units = parseMedicationQuantity(draft.units)
    if (units === null) return { step, field: 'units', message: 'Escreva só o número, sem pontos. Se for uma parte, use vírgula, como 0,5.' }
    if (units < 0.001 || units > 1000) return { step, field: 'units', message: 'Confira na receita quanto usa de cada vez. A quantidade precisa ser maior que zero e de até 1000.' }
    if (draft.format === 'other' && !draft.doseText.trim()) return { step, field: 'doseText', message: 'Copie a orientação da receita para explicar como usa esse remédio.' }
    if (draft.doseText.trim().length > 150) return { step, field: 'doseText', message: 'Use até 150 letras e números no texto da receita.' }
    if (draft.needsDoseReview && draft.doseText.trim()) return { step, field: 'doseText', message: 'Você mudou como usa o remédio. Confira a anotação com sua receita e marque a confirmação abaixo.' }
  }
  if (step === 3) {
    if (!draft.times.length || draft.times.length > 24 || draft.times.some(time => !/^([01]\d|2[0-3]):[0-5]\d$/u.test(time))) return { step, field: 'times', message: 'Escolha um horário em cada espaço antes de continuar.' }
    if (new Set(draft.times).size !== draft.times.length) return { step, field: 'times', message: 'Há dois horários iguais. Altere um deles ou remova o que se repete.' }
  }
  if (step === 4) {
    const quantity = parseMedicationQuantity(draft.quantity)
    if (quantity === null) return { step, field: 'quantity', message: 'Escreva só o número, sem pontos. Se for uma parte, use vírgula, como 0,5. Se acabou, toque em “Não tenho mais esse remédio”.' }
    if (quantity < 0 || quantity > 100000) return { step, field: 'quantity', message: 'Confira a quantidade em casa: informe um número entre 0 e 100000.' }
  }
  return null
}
