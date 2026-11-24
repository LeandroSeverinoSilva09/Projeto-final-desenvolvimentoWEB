import type { BottleStockLevel, Medication } from '../types/medication'

export const bottleLevels: { value: BottleStockLevel; label: string }[] = [
  { value: 'full', label: 'Cheio' }, { value: 'half', label: 'Pela metade' },
  { value: 'low', label: 'Está acabando' }, { value: 'empty', label: 'Vazio' },
  { value: 'unknown', label: 'Não sei dizer' },
]
export const isDropMedication = (medication: Pick<Medication, 'stockUnit'>) => medication.stockUnit === 'gotas'
export const isBottleStockLevel = (value: unknown): value is BottleStockLevel => bottleLevels.some(level => level.value === value)
export function bottleLevel(medication: Pick<Medication, 'stockLevel'>): BottleStockLevel {
  return isBottleStockLevel(medication.stockLevel) ? medication.stockLevel : 'unknown'
}
export function bottleStockLabel(medication: Pick<Medication, 'stockLevel'>): string {
  return { full: 'Frasco cheio', half: 'Frasco pela metade', low: 'Está acabando', empty: 'Frasco vazio', unknown: 'Nível não informado' }[bottleLevel(medication)]
}
export function hasDoseStock(medication: Medication): boolean {
  return isDropMedication(medication) ? bottleLevel(medication) !== 'empty' : medication.current >= (medication.unitsPerDose ?? 1)
}
export function stockAfterDose(medication: Medication): number {
  return isDropMedication(medication) ? medication.current : Math.round((medication.current - (medication.unitsPerDose ?? 1)) * 1000) / 1000
}
export function stockSummary(medication: Medication): string {
  return isDropMedication(medication) ? bottleStockLabel(medication) : `${medication.current.toLocaleString('pt-BR')} ${medication.stockUnit || 'unidades'}`
}
