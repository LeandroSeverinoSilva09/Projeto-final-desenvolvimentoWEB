import type { Medication } from '../types/medication'
import { formatStockAlertMessage, isLowStock } from './calculations'
import { parseScheduleTimes } from './dates'

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

export function sendBrowserNotification(title: string, body: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  new Notification(title, {
    body,
    icon: '/pill.svg',
    tag: 'medcontrol-reminder',
  })
}

export function checkLowStockAlerts(medications: Medication[]): Medication[] {
  return medications.filter(isLowStock)
}

export function getLowStockAlertMessage(medication: Medication): string {
  return formatStockAlertMessage(medication)
}

export function getUpcomingSchedules(medications: Medication[]): string[] {
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const upcoming: string[] = []

  medications.forEach((med) => {
    parseScheduleTimes(med.schedules).forEach((time) => {
      const [hours, minutes] = time.split(':').map(Number)
      const scheduleMinutes = hours * 60 + minutes
      if (scheduleMinutes >= currentMinutes) {
        upcoming.push(`${med.name} às ${time}`)
      }
    })
  })

  return upcoming.slice(0, 3)
}
