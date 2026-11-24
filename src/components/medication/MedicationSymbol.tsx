import { Droplets, FlaskConical, Pill } from 'lucide-react'
import type { Medication } from '../../types/medication'

export function MedicationSymbol({ medication, size = 24 }: { medication: Pick<Medication, 'stockUnit'>; size?: number }) {
  const format = medication.stockUnit === 'gotas' ? 'drops' : medication.stockUnit === 'mL' ? 'liquid' : 'solid'
  const Icon = format === 'drops' ? Droplets : format === 'liquid' ? FlaskConical : Pill
  return <Icon size={size} data-medication-format={format} aria-hidden="true"/>
}
