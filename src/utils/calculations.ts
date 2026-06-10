import type { AppStats, DoseRecord, Medication } from '../types/medication'
import { normalizeMedicationStock } from './stock'
import {
  formatDate,
  getAdherenceStatus,
  getExpectedDosesForDay,
  getTakenDosesForDay,
  getTodayKey,
  parseScheduleTimes,
} from './dates'

export const REPLENISH_ALERT_DAYS = 3

export type StockUrgency = 'ok' | 'warning' | 'critical' | 'empty'

export interface StockStatus {
  dailyConsumption: number
  daysRemaining: number
  replenishThreshold: number
  needsReplenish: boolean
  urgency: StockUrgency
  fillPercentage: number
}

export function getDailyConsumption(medication: Medication): number {
  const times = parseScheduleTimes(medication.schedules)
  return times.length > 0 ? times.length : 1
}

export function getStockStatus(medication: Medication): StockStatus {
  const dailyConsumption = getDailyConsumption(medication)
  const { current, total } = normalizeMedicationStock(medication)

  const daysRemaining =
    current > 0 ? Math.floor(current / dailyConsumption) : 0
  const replenishThreshold = dailyConsumption * REPLENISH_ALERT_DAYS
  const needsReplenish = current > 0 && current <= replenishThreshold
  const fillPercentage =
    total > 0 ? Math.max(0, Math.min(100, (current / total) * 100)) : 0

  let urgency: StockUrgency = 'ok'
  if (current === 0) urgency = 'empty'
  else if (daysRemaining <= 1) urgency = 'critical'
  else if (needsReplenish) urgency = 'warning'

  return {
    dailyConsumption,
    daysRemaining,
    replenishThreshold,
    needsReplenish: current === 0 || needsReplenish,
    urgency,
    fillPercentage,
  }
}

export function isLowStock(medication: Medication): boolean {
  return getStockStatus(medication).needsReplenish
}

export function getStockPercentage(medication: Medication): number {
  return getStockStatus(medication).fillPercentage
}

export function formatStockAlertMessage(medication: Medication): string {
  const status = getStockStatus(medication)
  const unitLabel = status.daysRemaining === 1 ? 'dia' : 'dias'

  if (status.urgency === 'empty') {
    return `${medication.name} acabou! Reponha o estoque.`
  }

  return `${medication.name}: restam ${medication.current} unidades (${status.daysRemaining} ${unitLabel}). Hora de repor!`
}

export function formatDaysRemainingLabel(days: number): string {
  if (days === 0) return 'acaba hoje'
  if (days === 1) return 'acaba em 1 dia'
  return `dura cerca de ${days} dias`
}

export function updateStreak(stats: AppStats, history: DoseRecord[], medications: Medication[]): AppStats {
  const today = getTodayKey()
  const expected = getExpectedDosesForDay(medications)
  const taken = getTakenDosesForDay(history, new Date())
  const status = getAdherenceStatus(expected, taken)

  if (expected === 0) return stats

  if (status === 'complete') {
    if (stats.lastStreakDate === today) {
      return stats
    }

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayKey = formatDate(yesterday)

    const newStreak =
      stats.lastStreakDate === yesterdayKey ? stats.streakCount + 1 : 1

    return {
      ...stats,
      streakCount: newStreak,
      lastStreakDate: today,
    }
  }

  if (stats.lastStreakDate && stats.lastStreakDate !== today) {
    return stats
  }

  return {
    ...stats,
    streakCount: 0,
    lastStreakDate: null,
  }
}
