import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useScheduleReminders } from '../hooks/useScheduleReminders'
import type {
  AppState,
  DoseRecord,
  FilterType,
  Medication,
  ToastMessage,
  User,
} from '../types/medication'
import {
  formatStockAlertMessage,
  getStockStatus,
  isLowStock,
  updateStreak,
} from '../utils/calculations'
import { formatDate, formatTime } from '../utils/dates'
import {
  checkLowStockAlerts,
  getLowStockAlertMessage,
  requestNotificationPermission,
  sendBrowserNotification,
} from '../utils/notifications'
import { normalizeMedicationStock } from '../utils/stock'
import { defaultState, generateId, loadState, saveState } from '../utils/storage'

interface MedicationContextValue extends AppState {
  filter: FilterType
  toasts: ToastMessage[]
  filteredMedications: Medication[]
  lowStockCount: number
  login: (name: string) => void
  logout: () => void
  setFilter: (filter: FilterType) => void
  addMedication: (data: Omit<Medication, 'id' | 'takenCount'>) => void
  takeMedication: (id: string, scheduleTime?: string) => void
  restockMedication: (id: string) => void
  deleteMedication: (id: string) => void
  addToast: (type: ToastMessage['type'], message: string) => void
  removeToast: (id: string) => void
}

const MedicationContext = createContext<MedicationContextValue | null>(null)

export function MedicationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState)
  const [filter, setFilter] = useState<FilterType>('all')
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const lowStockNotifiedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    requestNotificationPermission()
  }, [])

  const addToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = generateId()
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const login = useCallback((name: string) => {
    const user: User = {
      name,
      joinDate: formatDate(new Date()),
    }
    setState((prev) => ({ ...prev, user }))
    addToast('success', `Bem-vindo, ${name}!`)
  }, [addToast])

  const logout = useCallback(() => {
    setState((prev) => ({ ...prev, user: null }))
  }, [])

  const addMedication = useCallback((data: Omit<Medication, 'id' | 'takenCount'>) => {
    const medication = normalizeMedicationStock({
      ...data,
      id: generateId(),
      takenCount: 0,
    })
    setState((prev) => ({
      ...prev,
      medications: [...prev.medications, medication],
    }))
    addToast('success', `${medication.name} cadastrado com sucesso!`)
  }, [addToast])

  const takeMedication = useCallback((id: string, scheduleTime?: string) => {
    let updatedMed: Medication | null = null

    setState((prev) => {
      const medication = prev.medications.find((m) => m.id === id)
      if (!medication) return prev

      if (medication.current <= 0) {
        addToast('error', 'Estoque vazio. Reponha o medicamento antes de registrar outra dose.')
        return prev
      }

      const now = new Date()
      const record: DoseRecord = {
        id: generateId(),
        medicationId: id,
        name: medication.name,
        dose: medication.dose,
        date: formatDate(now),
        time: formatTime(now),
        scheduleTime,
        timestamp: now.getTime(),
      }

      const medications = prev.medications.map((m) =>
        m.id === id
          ? normalizeMedicationStock({
              ...m,
              current: m.current - 1,
              takenCount: m.takenCount + 1,
            })
          : m
      )

      updatedMed = medications.find((m) => m.id === id) ?? null

      const history = [...prev.history, record]
      const stats = updateStreak(
        { ...prev.stats, totalDoses: prev.stats.totalDoses + 1 },
        history,
        medications
      )

      const toastMsg = scheduleTime
        ? `${medication.name} (${scheduleTime}) confirmada!`
        : `Dose de ${medication.name} confirmada!`
      addToast('success', toastMsg)

      return { ...prev, medications, history, stats }
    })

    if (updatedMed) {
      const status = getStockStatus(updatedMed)
      if (status.urgency === 'empty') {
        addToast('warning', formatStockAlertMessage(updatedMed))
        sendBrowserNotification('Remédio acabou!', formatStockAlertMessage(updatedMed))
      } else if (status.needsReplenish) {
        addToast('warning', formatStockAlertMessage(updatedMed))
      }
    }
  }, [addToast])

  const restockMedication = useCallback((id: string) => {
    setState((prev) => {
      const medication = prev.medications.find((m) => m.id === id)
      if (!medication) return prev

      const medications = prev.medications.map((m) =>
        m.id === id ? normalizeMedicationStock({ ...m, current: m.total }) : m
      )

      addToast('success', `Estoque de ${medication.name} renovado!`)
      return { ...prev, medications }
    })
  }, [addToast])

  const deleteMedication = useCallback((id: string) => {
    setState((prev) => {
      const medication = prev.medications.find((m) => m.id === id)
      if (!medication) return prev

      addToast('info', `${medication.name} removido da lista.`)
      return {
        ...prev,
        medications: prev.medications.filter((m) => m.id !== id),
      }
    })
  }, [addToast])

  useScheduleReminders(state.medications, !!state.user)

  useEffect(() => {
    if (!state.user) return

    const lowStock = checkLowStockAlerts(state.medications)
    lowStock.forEach((med) => {
      if (!lowStockNotifiedRef.current.has(med.id)) {
        lowStockNotifiedRef.current.add(med.id)
        const message = getLowStockAlertMessage(med)
        sendBrowserNotification('Hora de repor', message)
        addToast('warning', message)
      }
    })

    state.medications
      .filter((m) => !isLowStock(m))
      .forEach((m) => lowStockNotifiedRef.current.delete(m.id))
  }, [state.medications, state.user, addToast])

  const filteredMedications = useMemo(() => {
    switch (filter) {
      case 'alert':
        return state.medications.filter(isLowStock)
      case 'ok':
        return state.medications.filter((m) => !isLowStock(m))
      default:
        return state.medications
    }
  }, [state.medications, filter])

  const lowStockCount = useMemo(
    () => state.medications.filter(isLowStock).length,
    [state.medications]
  )

  const value: MedicationContextValue = {
    ...state,
    filter,
    toasts,
    filteredMedications,
    lowStockCount,
    login,
    logout,
    setFilter,
    addMedication,
    takeMedication,
    restockMedication,
    deleteMedication,
    addToast,
    removeToast,
  }

  return (
    <MedicationContext.Provider value={value}>
      {children}
    </MedicationContext.Provider>
  )
}

export function useMedications() {
  const context = useContext(MedicationContext)
  if (!context) {
    throw new Error('useMedications deve ser usado dentro de MedicationProvider')
  }
  return context
}

export function useAppReset() {
  return () => {
    saveState(defaultState)
    window.location.reload()
  }
}
