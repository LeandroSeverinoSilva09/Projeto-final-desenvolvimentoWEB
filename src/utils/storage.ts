import type { AppState } from '../types/medication'
import { generateVariedSampleHistory } from './adherence'
import { normalizeMedicationStock } from './stock'

const STORAGE_KEY = 'medcontrol_app_state'

export const DEFAULT_MEDICATIONS = [
  {
    id: '1',
    name: 'Amoxicilina',
    dose: '1 comprimido',
    current: 42,
    total: 60,
    frequency: 8,
    schedules: '08:00, 16:00, 00:00',
    takenCount: 0,
  },
  {
    id: '2',
    name: 'Dipirona',
    dose: '20 gotas',
    current: 12,
    total: 60,
    frequency: 6,
    schedules: '06:00, 12:00, 18:00',
    takenCount: 0,
  },
]

const SAMPLE_HISTORY = generateVariedSampleHistory()

export const defaultState: AppState = {
  user: null,
  medications: DEFAULT_MEDICATIONS.map((m) => ({ ...m, takenCount: 2 })),
  history: SAMPLE_HISTORY,
  stats: {
    streakCount: 2,
    lastStreakDate: null,
    totalDoses: SAMPLE_HISTORY.length,
  },
}

function normalizeState(state: Partial<AppState>): AppState {
  const medications = (state.medications ?? defaultState.medications).map(normalizeMedicationStock)
  const history =
    state.history && state.history.length > 0 ? state.history : SAMPLE_HISTORY

  return {
    ...defaultState,
    ...state,
    medications,
    history,
    stats: { ...defaultState.stats, ...state.stats },
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState
    const parsed = JSON.parse(raw) as Partial<AppState>
    return normalizeState(parsed)
  } catch {
    return defaultState
  }
}

export function saveState(state: AppState): void {
  const normalized: AppState = {
    ...state,
    medications: state.medications.map(normalizeMedicationStock),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
