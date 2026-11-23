import { useEffect } from 'react'
import type { DoseRecord, Medication } from '../types/medication'
import { getTodayDoseSlots } from '../utils/schedule'
import { sendBrowserNotification, notificationsEnabled } from '../utils/notifications'
import { hasBackgroundNotifications } from '../lib/pushSubscriptions'
import { formatDate } from '../utils/dates'
export function useScheduleReminders(medications: Medication[], userId: string | undefined, history: DoseRecord[] = []) {
  useEffect(() => {
    if (!userId) return
    let stopped = false
    let checking = false
    const check = async () => {
      if (checking || stopped || !notificationsEnabled()) return
      checking = true
      try {
        const now = new Date()
        const current = now.getHours() * 60 + now.getMinutes()
        let background: boolean | undefined
        for (const slot of getTodayDoseSlots(medications, history)) {
          const [h, m] = slot.scheduleTime.split(':').map(Number)
          if (slot.taken || current - (h * 60 + m) < 0 || current - (h * 60 + m) > 2) continue
          const key = `medcontrol-notified:${formatDate(now)}:${slot.id}`
          if (sessionStorage.getItem(key)) continue
          // A subscription uses the server dispatcher; avoid duplicate foreground notices.
          background ??= await hasBackgroundNotifications(userId)
          if (background) continue
          if (stopped) return
          const sent = await sendBrowserNotification('Seu cuidado tem hora', `Você tem um medicamento agendado para ${slot.scheduleTime}. Abra o MEDControl para conferir.`, key)
          if (sent) sessionStorage.setItem(key, 'true')
        }
      } finally { checking = false }
    }
    void check()
    const interval = setInterval(() => void check(), 15000)
    document.addEventListener('visibilitychange', check)
    return () => { stopped = true; clearInterval(interval); document.removeEventListener('visibilitychange', check) }
  }, [medications, history, userId])
}
