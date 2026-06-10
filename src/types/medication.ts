export type AdherenceStatus = 'complete' | 'partial' | 'none'

export type FilterType = 'all' | 'alert' | 'ok'

export interface User {
  name: string
  joinDate: string
}

export interface Medication {
  id: string
  name: string
  dose: string
  current: number
  total: number
  frequency: number
  schedules: string
  takenCount: number
}

export interface DoseRecord {
  id: string
  medicationId: string
  name: string
  dose: string
  date: string
  time: string
  scheduleTime?: string
  timestamp: number
}

export interface DayAdherence {
  date: string
  expected: number
  taken: number
  status: AdherenceStatus
}

export interface AppStats {
  streakCount: number
  lastStreakDate: string | null
  totalDoses: number
}

export interface AppState {
  user: User | null
  medications: Medication[]
  history: DoseRecord[]
  stats: AppStats
}

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}
