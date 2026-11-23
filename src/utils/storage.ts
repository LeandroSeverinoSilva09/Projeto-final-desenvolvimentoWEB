import type { AppState } from '../types/medication'
import { formatDate } from './dates'

export const defaultState: AppState = { user: null, medications: [], history: [], stats: { streakCount: 0, lastStreakDate: null, totalDoses: 0 } }
export function generateId(): string { return crypto.randomUUID() }
export function loadState(): AppState { return defaultState }
export function saveState(state: AppState): void { sessionStorage.setItem('medcontrol_demo_data', JSON.stringify(state)) }
export function demoState(): AppState {
  const createdAt = new Date(Date.now() - 6 * 86400000).toISOString()
  const medications = [
    { id: '1', name: 'Medicamento A', dose: '1 comprimido', current: 24, total: 30, schedules: '08:00, 20:00', frequency: 12, takenCount: 0, unitsPerDose: 1, createdAt, instructions: 'Exemplo fictício para apresentação.', color: 'teal' },
    { id: '2', name: 'Medicamento B', dose: '1 cápsula', current: 3, total: 30, schedules: '12:00', frequency: 24, takenCount: 0, unitsPerDose: 1, createdAt, instructions: 'Exemplo fictício para apresentação.', color: 'amber' },
    { id: '3', name: 'Medicamento C', dose: '1 comprimido', current: 18, total: 30, schedules: '18:00', frequency: 24, takenCount: 0, unitsPerDose: 1, createdAt, color: 'blue' },
  ]
  const history = Array.from({ length: 6 }, (_, i) => {
    const day = new Date(); day.setDate(day.getDate() - i - 1); day.setHours(8, 2, 0, 0)
    return { id: `demo-${i}`, medicationId: '1', name: 'Medicamento A', dose: '1 comprimido', date: formatDate(day), time: '08:02', scheduleTime: '08:00', timestamp: day.getTime() }
  })
  return { ...defaultState, medications, history }
}
