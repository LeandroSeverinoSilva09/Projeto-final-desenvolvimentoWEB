import { useEffect, useRef } from 'react'
import type { Medication } from '../types/medication'
import { parseScheduleTimes } from '../utils/dates'
import { sendBrowserNotification } from '../utils/notifications'

export function useScheduleReminders(medications: Medication[], enabled: boolean) {
  const notifiedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!enabled) return

    const checkSchedules = () => {
      const now = new Date()
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

      medications.forEach((med) => {
        parseScheduleTimes(med.schedules).forEach((time) => {
          const key = `${med.id}-${time}-${now.toDateString()}`
          if (time === currentTime && !notifiedRef.current.has(key)) {
            notifiedRef.current.add(key)
            sendBrowserNotification(
              'Hora do medicamento!',
              `Está na hora de tomar ${med.name} (${med.dose}).`
            )
          }
        })
      })
    }

    checkSchedules()
    const interval = setInterval(checkSchedules, 30_000)
    return () => clearInterval(interval)
  }, [medications, enabled])
}
