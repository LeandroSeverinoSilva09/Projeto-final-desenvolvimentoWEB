import type { Medication } from '../types/medication'

export function normalizeMedicationStock(medication: Medication): Medication {
  const total = Math.max(0.001, medication.total)
  const current = Math.round(Math.min(Math.max(0, medication.current), total) * 1000) / 1000
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
