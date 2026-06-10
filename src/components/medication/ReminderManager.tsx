import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMedications } from '../../contexts/MedicationContext'
import { isLowStock } from '../../utils/calculations'
import {
  getDueNowSlots,
  getTodayDoseSlots,
  type TodayDoseSlot,
} from '../../utils/schedule'
import { DoseReminderModal } from './DoseReminderModal'
import { LowStockModal } from './LowStockModal'

const DISMISSED_DOSE_KEY = 'medcontrol_dismissed_doses'
const LOW_STOCK_SHOWN_KEY = 'medcontrol_lowstock_shown_date'

function getDismissedDoses(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISSED_DOSE_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function dismissDose(slotId: string) {
  const dismissed = getDismissedDoses()
  dismissed.add(slotId)
  sessionStorage.setItem(DISMISSED_DOSE_KEY, JSON.stringify([...dismissed]))
}

function wasLowStockShownToday(): boolean {
  return sessionStorage.getItem(LOW_STOCK_SHOWN_KEY) === new Date().toDateString()
}

function markLowStockShown() {
  sessionStorage.setItem(LOW_STOCK_SHOWN_KEY, new Date().toDateString())
}

export function ReminderManager() {
  const { user, medications, history, takeMedication, restockMedication } = useMedications()
  const [activeDoseSlot, setActiveDoseSlot] = useState<TodayDoseSlot | null>(null)
  const [dueQueue, setDueQueue] = useState<TodayDoseSlot[]>([])
  const [showLowStock, setShowLowStock] = useState(false)
  const [checked, setChecked] = useState(false)

  const lowStockMeds = useMemo(
    () => medications.filter(isLowStock),
    [medications]
  )

  const checkReminders = useCallback(() => {
    if (!user) return

    const slots = getTodayDoseSlots(medications, history)
    const due = getDueNowSlots(slots)
    const dismissed = getDismissedDoses()
    const pending = due.filter((s) => !dismissed.has(s.id))

    if (pending.length > 0) {
      setDueQueue(pending)
      setActiveDoseSlot(pending[0])
      setShowLowStock(false)
      return
    }

    setDueQueue([])
    setActiveDoseSlot(null)

    if (lowStockMeds.length > 0 && !wasLowStockShownToday()) {
      setShowLowStock(true)
    }
  }, [user, medications, history, lowStockMeds.length])

  useEffect(() => {
    if (!user) {
      setChecked(false)
      setActiveDoseSlot(null)
      setShowLowStock(false)
      return
    }

    const timer = setTimeout(() => {
      checkReminders()
      setChecked(true)
    }, 600)

    return () => clearTimeout(timer)
  }, [user, checkReminders])

  useEffect(() => {
    if (!user || !checked) return

    const interval = setInterval(checkReminders, 60_000)
    return () => clearInterval(interval)
  }, [user, checked, checkReminders])

  const handleDoseConfirm = () => {
    if (!activeDoseSlot) return
    takeMedication(activeDoseSlot.medicationId, activeDoseSlot.scheduleTime)
    advanceDoseQueue()
  }

  const handleDoseDismiss = () => {
    if (!activeDoseSlot) return
    dismissDose(activeDoseSlot.id)
    advanceDoseQueue()
  }

  const advanceDoseQueue = () => {
    const remaining = dueQueue.slice(1)
    setDueQueue(remaining)
    if (remaining.length > 0) {
      setActiveDoseSlot(remaining[0])
    } else {
      setActiveDoseSlot(null)
      if (lowStockMeds.length > 0 && !wasLowStockShownToday()) {
        setTimeout(() => setShowLowStock(true), 400)
      }
    }
  }

  const handleLowStockDismiss = () => {
    markLowStockShown()
    setShowLowStock(false)
  }

  const handleRestock = (id: string) => {
    restockMedication(id)
  }

  useEffect(() => {
    if (showLowStock && lowStockMeds.length === 0) {
      markLowStockShown()
      setShowLowStock(false)
    }
  }, [showLowStock, lowStockMeds.length])

  return (
    <>
      <DoseReminderModal
        slot={activeDoseSlot}
        open={!!activeDoseSlot}
        onConfirm={handleDoseConfirm}
        onDismiss={handleDoseDismiss}
        remaining={dueQueue.length - 1}
      />
      <LowStockModal
        medications={lowStockMeds}
        open={showLowStock && !activeDoseSlot}
        onRestock={handleRestock}
        onDismiss={handleLowStockDismiss}
      />
    </>
  )
}
