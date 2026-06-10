import type { Medication } from '../types/medication'

export function normalizeMedicationStock(medication: Medication): Medication {
  const total = Math.max(1, medication.total)
  const current = Math.min(Math.max(0, medication.current), total)
  return { ...medication, total, current }
}

export function getDisplayStock(medication: Medication) {
  const normalized = normalizeMedicationStock(medication)
  return {
    current: normalized.current,
    total: normalized.total,
    label: `${normalized.current} de ${normalized.total} na caixa`,
  }
}
