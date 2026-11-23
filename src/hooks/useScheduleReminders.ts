import { useEffect } from 'react'
import type { DoseRecord, Medication } from '../types/medication'
import { checkForegroundReminders } from '../lib/foregroundReminders'
export function useScheduleReminders(medications: Medication[], userId: string | undefined, history: DoseRecord[] = [], localOnly = false) {
  useEffect(() => {
    if (!userId) return
    let stopped = false
    let checking = false
    const check = async () => {
      if (checking || stopped) return
      checking = true
      try {
        await checkForegroundReminders({ medications, history, ownerId: userId, localOnly, isActive: () => !stopped })
      } catch (error) {
        console.warn('Não foi possível conferir os lembretes locais. A próxima verificação tentará novamente.', error)
      } finally { checking = false }
    }
    // Let React finish mounting/cleaning up its development effects first.
    queueMicrotask(() => void check())
    const interval = setInterval(() => void check(), 15000)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    window.addEventListener('medcontrol:notifications', check)
    return () => {
      stopped = true; clearInterval(interval)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
      window.removeEventListener('medcontrol:notifications', check)
    }
  }, [medications, history, userId, localOnly])
}
