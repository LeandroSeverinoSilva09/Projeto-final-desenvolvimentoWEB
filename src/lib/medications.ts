import { supabase } from './supabase'
import type { DoseRecord, Medication } from '../types/medication'

interface MedicationRow {
  id: string; name: string; dose: string; current: number; total: number
  schedules: string[]; units_per_dose: number; stock_unit: Medication['stockUnit']
  created_at: string; instructions: string; color: Medication['color']
}
interface DoseRow {
  id: string; medication_id: string; name: string; dose: string
  scheduled_date: string; schedule_time: string; taken_at: string
}

const PAGE_SIZE = 1000
const HISTORY_LIMIT = 5000

async function fetchRows<T extends { id: string }>(
  table: 'medications' | 'dose_records', timeColumn: keyof T & ('created_at' | 'taken_at'),
  ascending: boolean, maximum = Infinity,
): Promise<T[]> {
  if (!supabase) throw new Error('Configure a conexão com o Supabase.')
  const rows: T[] = []
  let cursor: T | undefined
  while (rows.length < maximum) {
    let query = supabase.from(table).select('*')
      .order(timeColumn, { ascending }).order('id', { ascending })
      .limit(Math.min(PAGE_SIZE, maximum - rows.length))
    if (table === 'medications') query = query.is('archived_at', null)
    if (cursor) {
      const comparison = ascending ? 'gt' : 'lt'
      // Keep PostgreSQL's timestamp precision; the UUID breaks timestamp ties.
      const timestamp = cursor[timeColumn]
      query = query.or(`${timeColumn}.${comparison}."${timestamp}",and(${timeColumn}.eq."${timestamp}",id.${comparison}.${cursor.id})`)
    }
    const { data, error } = await query.returns<T[]>()
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    cursor = data[data.length - 1]
    // A short page can be the API's configured cap, not the end of the data.
  }
  return rows
}

export function medicationRow(med: Omit<Medication, 'id' | 'takenCount'>) {
  return { name: med.name, dose: med.dose, current: med.current, total: med.total,
    schedules: med.schedules.split(',').map(t => t.trim()), units_per_dose: med.unitsPerDose ?? 1,
    stock_unit: med.stockUnit || 'unidades', instructions: med.instructions || '', color: med.color || 'teal' }
}
export async function fetchTreatment(): Promise<{ medications: Medication[]; history: DoseRecord[] }> {
  if (!supabase) throw new Error('Configure a conexão com o Supabase.')
  const [meds, records] = await Promise.all([
    fetchRows<MedicationRow>('medications', 'created_at', true),
    fetchRows<DoseRow>('dose_records', 'taken_at', false, HISTORY_LIMIT),
  ])
  return {
    medications: meds.map(m => ({ id: m.id, name: m.name, dose: m.dose, current: m.current, total: m.total,
      frequency: 24 / m.schedules.length, schedules: m.schedules.join(', '), takenCount: 0,
      unitsPerDose: m.units_per_dose, stockUnit: m.stock_unit, createdAt: m.created_at, instructions: m.instructions, color: m.color })),
    history: records.map(r => { const d = new Date(r.taken_at); const [year, month, day] = r.scheduled_date.split('-'); return {
      id: r.id, medicationId: r.medication_id, name: r.name, dose: r.dose,
      date: `${day}/${month}/${year}`, time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      scheduleTime: r.schedule_time, timestamp: d.getTime(),
    } }),
  }
}
