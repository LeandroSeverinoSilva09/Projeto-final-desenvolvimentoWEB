import type { DoseRecord, Medication } from '../types/medication'
import { parseScheduleTimes } from '../utils/dates'
import { reminderCandidates, reminderMessage } from '../../supabase/functions/_shared/reminderTiming'
import { notificationPermission, notificationsEnabled, sendBrowserNotification } from '../utils/notifications'
import { hasBackgroundNotifications } from './pushSubscriptions'

interface ForegroundReminderOptions {
  medications: Medication[]
  history: DoseRecord[]
  ownerId: string
  localOnly?: boolean
  isActive?: () => boolean
}

// Effects can overlap after a data refresh. Reserve each dose before any await.
const sending = new Set<string>()

export async function checkForegroundReminders({ medications, history, ownerId, localOnly = false, isActive = () => true }: ForegroundReminderOptions) {
  if (!isActive() || !notificationsEnabled() || notificationPermission() !== 'granted') return
  const now = new Date()
  const candidates = reminderCandidates(now, Intl.DateTimeFormat().resolvedOptions().timeZone)
  let background: boolean | undefined
  for (const medication of medications) {
    const schedules = parseScheduleTimes(medication.schedules)
    for (const candidate of candidates) {
      if (!schedules.includes(candidate.time)) continue
      const [year, month, day] = candidate.day.split('-')
      const date = `${day}/${month}/${year}`
      if (history.some(record => record.medicationId === medication.id && record.date === date && (record.scheduleTime || record.time) === candidate.time)) continue
      const slotId = `${date}-${medication.id}-${candidate.time}`
      const baseKey = `medcontrol-notified:${ownerId}:${date}:${slotId}`
      const key = candidate.kind === 'advance' ? `${baseKey}:advance` : baseKey
      if (sending.has(key) || sessionStorage.getItem(key)) continue
      sending.add(key)
      try {
        // Demonstration data never needs an account or a server subscription.
        background ??= localOnly ? false : await hasBackgroundNotifications(ownerId)
        if (background || !isActive()) continue
        const message = reminderMessage(candidate.kind, candidate.time)
        const sent = await sendBrowserNotification(message.title, message.body, key, '/', isActive)
        if (sent) sessionStorage.setItem(key, 'true')
      } finally { sending.delete(key) }
    }
  }
}
