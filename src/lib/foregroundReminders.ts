import type { DoseRecord, Medication } from '../types/medication'
import { formatDate } from '../utils/dates'
import { getTodayDoseSlots } from '../utils/schedule'
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
  const current = now.getHours() * 60 + now.getMinutes()
  let background: boolean | undefined
  for (const slot of getTodayDoseSlots(medications, history)) {
    const [hour, minute] = slot.scheduleTime.split(':').map(Number)
    const delay = current - (hour * 60 + minute)
    if (slot.taken || delay < 0 || delay > 2) continue
    const key = `medcontrol-notified:${ownerId}:${formatDate(now)}:${slot.id}`
    if (sending.has(key) || sessionStorage.getItem(key)) continue
    sending.add(key)
    try {
      // Demonstration data never needs an account or a server subscription.
      background ??= localOnly ? false : await hasBackgroundNotifications(ownerId)
      if (background || !isActive()) continue
      const sent = await sendBrowserNotification('Seu cuidado tem hora', `Você tem um medicamento agendado para ${slot.scheduleTime}. Abra o MEDControl para conferir.`, key, '/', isActive)
      if (sent) sessionStorage.setItem(key, 'true')
    } finally { sending.delete(key) }
  }
}
