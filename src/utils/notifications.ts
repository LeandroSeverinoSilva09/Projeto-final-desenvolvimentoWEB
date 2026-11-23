import type { Medication } from '../types/medication'
import { formatStockAlertMessage, isLowStock } from './calculations'

const preferenceKey = 'medcontrol-notifications-disabled'
export function notificationsEnabled(): boolean {
  try { return localStorage.getItem(preferenceKey) !== 'true' } catch { return true }
}
export function setNotificationsEnabled(enabled: boolean) {
  localStorage.setItem(preferenceKey, String(!enabled))
  window.dispatchEvent(new Event('medcontrol:notifications'))
}

export type PermissionStatus = NotificationPermission | 'unsupported'
export function notificationPermission(): PermissionStatus {
  return typeof window !== 'undefined' && 'Notification' in window && window.isSecureContext ? Notification.permission : 'unsupported'
}
export async function requestNotificationPermission(): Promise<boolean> {
  if (notificationPermission() === 'unsupported' || notificationPermission() === 'denied') return false
  if (Notification.permission === 'granted') return true
  return await Notification.requestPermission() === 'granted'
}
export async function sendBrowserNotification(title: string, body: string, tag = 'medcontrol-reminder', url = '/'): Promise<boolean> {
  if (!notificationsEnabled() || notificationPermission() !== 'granted') return false
  try {
    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    if (!notificationsEnabled()) return false
    if (registration?.active) await registration.showNotification(title, { body, icon: '/icons/icon-192.png', tag, data: { url } })
    else { const notice = new Notification(title, { body, icon: '/pill.svg', tag }); notice.onclick = () => { window.focus(); window.location.assign(url); notice.close() } }
    return true
  } catch { return false }
}
export function checkLowStockAlerts(medications: Medication[]) { return medications.filter(isLowStock) }
export function getLowStockAlertMessage(medication: Medication) { return formatStockAlertMessage(medication) }
