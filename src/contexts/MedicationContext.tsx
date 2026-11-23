import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { supabase, errorMessage } from '../lib/supabase'
import { fetchTreatment, medicationRow } from '../lib/medications'
import { useScheduleReminders } from '../hooks/useScheduleReminders'
import type { AppState, FilterType, Medication, ToastMessage } from '../types/medication'
import { sendBrowserNotification } from '../utils/notifications'
import { hasBackgroundNotifications } from '../lib/pushSubscriptions'
import { isLowStock } from '../utils/calculations'
import { formatDate, formatTime } from '../utils/dates'
import { getTodayDoseSlots } from '../utils/schedule'
import { defaultState, demoState, generateId, saveState } from '../utils/storage'

export type MedicationInput = Omit<Medication, 'id' | 'takenCount'>
interface MedicationContextValue extends AppState {
  loading: boolean
  actionError: string
  dataError: string
  busy: boolean
  filter: FilterType
  toasts: ToastMessage[]
  filteredMedications: Medication[]
  lowStockCount: number
  logout: () => Promise<void>
  setFilter: (filter: FilterType) => void
  refresh: () => Promise<void>
  addMedication: (data: MedicationInput, id?: string, original?: Medication) => Promise<boolean>
  takeMedication: (id: string, scheduleTime?: string) => Promise<boolean>
  restockMedication: (id: string, quantity?: number) => Promise<boolean>
  deleteMedication: (id: string) => Promise<boolean>
  addToast: (type: ToastMessage['type'], message: string) => void
  removeToast: (id: string) => void
}
const MedicationContext = createContext<MedicationContextValue | null>(null)
export function MedicationProvider({ children }: { children: ReactNode }) {
  const { user, isDemo, logout } = useAuth()
  const userId = user?.id
  const [state, setState] = useState<AppState>(defaultState)
  const [dataOwner, setDataOwner] = useState<string | undefined>()
  const stateRef = useRef(state); stateRef.current = state
  const currentOwner = useRef(userId); currentOwner.current = userId
  const locked = useRef(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [dataError, setDataError] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const addToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = generateId(); setToasts(t => [...t, { id, type, message }])
    window.setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 6000)
  }, [])
  const refresh = useCallback(async () => {
    if (!userId || isDemo) return
    setLoading(true)
    try {
      const data = await fetchTreatment()
      if (currentOwner.current !== userId) return
      setState({ ...defaultState, ...data }); setDataError('')
    } catch (e) { if (currentOwner.current === userId) setDataError(errorMessage(e)) }
    finally { if (currentOwner.current === userId) setLoading(false) }
  }, [userId, isDemo])
  useEffect(() => {
    setDataOwner(userId); setState(defaultState); setToasts([]); setDataError(''); setFilter('all')
    if (isDemo) {
      try { setState(JSON.parse(sessionStorage.getItem('medcontrol_demo_data') || 'null') || demoState()) }
      catch { setState(demoState()) }
    } else if (userId) { void refresh() }
  }, [userId, isDemo, refresh])
  useEffect(() => { if (isDemo && dataOwner === userId) saveState(state) }, [state, isDemo, dataOwner, userId])
  useEffect(() => {
    const onFocus = () => { if (!locked.current) void refresh() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])
  const mutate = async (action: () => Promise<void>, message: string) => {
    if (locked.current || !userId) return false
    const owner = userId
    locked.current = true; setBusy(true); setActionError('')
    try {
      await action()
      if (currentOwner.current !== owner) return false
      if (!isDemo) {
        // A successful mutation remains successful even if refreshing fails.
        await refresh()
      }
      addToast('success', message); return true
    } catch (e) { const message = errorMessage(e); setActionError(message); addToast('error', message); return false }
    finally { locked.current = false; setBusy(false) }
  }
  const addMedication = (data: MedicationInput, id?: string, original?: Medication) => mutate(async () => {
    if (id && !original) throw new Error('Reabra o medicamento antes de salvar a edição.')
    if (isDemo) {
      const item = { ...data, id: id || generateId(), takenCount: 0, createdAt: data.createdAt || new Date().toISOString() }
      setState(s => ({ ...s, medications: id ? s.medications.map(m => m.id === id ? { ...item, takenCount: m.takenCount } : m) : [...s.medications, item] }))
    } else {
      const result = id
        ? await supabase!.from('medications').update(medicationRow(data)).eq('id', id)
          .eq('current', original!.current).eq('total', original!.total)
          .eq('stock_unit', original!.stockUnit || 'unidades').is('archived_at', null).select('id').maybeSingle()
        : await supabase!.from('medications').insert({ ...medicationRow(data), user_id: userId })
      if (result.error) throw result.error
      if (id && !result.data) {
        await refresh()
        throw new Error('O estoque mudou enquanto você editava. Seus dados não foram sobrescritos. Volte à lista e reabra o medicamento para conferir a quantidade atual.')
      }
    }
  }, id ? 'Medicamento atualizado.' : 'Medicamento cadastrado. Sua agenda já está atualizada.')
  const takeMedication = (id: string, scheduleTime?: string) => mutate(async () => {
    const s = stateRef.current
    const med = s.medications.find(m => m.id === id)
    const slot = getTodayDoseSlots(s.medications, s.history).find(x => x.medicationId === id && (!scheduleTime || x.scheduleTime === scheduleTime) && !x.taken && x.isPast)
    if (!med || !slot) throw new Error('Esta dose já foi registrada ou o horário ainda não chegou.')
    const units = med.unitsPerDose ?? 1
    if (med.current < units) throw new Error('Estoque insuficiente. Confira a quantidade disponível.')
    if (isDemo) {
      const now = new Date()
      setState(prev => ({ ...prev, medications: prev.medications.map(m => m.id === id ? { ...m, current: Math.round((m.current - units) * 1000) / 1000, takenCount: m.takenCount + 1 } : m),
        history: [...prev.history, { id: generateId(), medicationId: id, name: med.name, dose: med.dose, date: formatDate(now), time: formatTime(now), scheduleTime: slot.scheduleTime, timestamp: now.getTime() }] }))
    } else {
      const { error } = await supabase!.rpc('confirm_medication_dose', { p_medication_id: id, p_schedule_time: slot.scheduleTime, p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      if (error) throw error
    }
  }, 'Dose registrada. O estoque foi atualizado.')
  const restockMedication = (id: string, quantity?: number) => mutate(async () => {
    const med = stateRef.current.medications.find(m => m.id === id)
    if (!med) return
    const amount = quantity ?? med.total
    if (!Number.isFinite(amount) || Math.abs(amount * 1000 - Math.round(amount * 1000)) > 1e-7 || amount < 0.001 || amount > 100000) throw new Error('Informe uma quantidade válida para reposição.')
    if (med.current + amount > 100000) throw new Error('A quantidade excede o limite de estoque.')
    if (isDemo) setState(s => ({ ...s, medications: s.medications.map(m => m.id === id ? { ...m, current: Math.round((m.current + amount) * 1000) / 1000, total: Math.max(m.total, Math.round((m.current + amount) * 1000) / 1000) } : m) }))
    else {
      const { error } = await supabase!.rpc('restock_medication', { p_medication_id: id, p_quantity: amount })
      if (error) throw error
    }
  }, 'Reposição adicionada ao estoque.')
  const deleteMedication = (id: string) => mutate(async () => {
    if (isDemo) setState(s => ({ ...s, medications: s.medications.filter(m => m.id !== id) }))
    else { const { error } = await supabase!.from('medications').update({ archived_at: new Date().toISOString() }).eq('id', id); if (error) throw error }
  }, 'Medicamento arquivado. As doses registradas continuam no histórico.')
  useScheduleReminders(state.medications, dataOwner === userId ? userId : undefined, state.history, isDemo)
  useEffect(() => {
    if (!userId || isDemo || loading || dataOwner !== userId) return
    const low = state.medications.filter(isLowStock)
    if (!low.length) return
    const key = `medcontrol-stock:${userId}:${formatDate(new Date())}:${low.map(m => m.id).sort().join(':')}`
    if (sessionStorage.getItem(key)) return
    let stopped = false
    void (async () => {
      if (await hasBackgroundNotifications(userId) || stopped) return
      const sent = await sendBrowserNotification('Vamos planejar sua reposição?', 'Há medicamento com estoque baixo. Veja farmácias próximas no MEDControl.', key, '/farmacias')
      if (sent) sessionStorage.setItem(key, 'true')
    })()
    return () => { stopped = true }
  }, [state.medications, userId, isDemo, loading, dataOwner])
  const filteredMedications = useMemo(() => state.medications.filter(m => filter === 'all' || (filter === 'alert' ? isLowStock(m) : !isLowStock(m))), [state.medications, filter])
  return <MedicationContext.Provider value={{ ...(dataOwner === userId ? state : defaultState), user, stats: { ...state.stats, totalDoses: state.history.length }, loading, dataError, actionError, busy, filter, toasts, filteredMedications: dataOwner === userId ? filteredMedications : [],
    lowStockCount: dataOwner === userId ? state.medications.filter(isLowStock).length : 0, logout, setFilter, refresh, addMedication, takeMedication, restockMedication, deleteMedication, addToast,
    removeToast: id => setToasts(t => t.filter(x => x.id !== id)),
  }}>{children}</MedicationContext.Provider>
}
export function useMedications() { const c = useContext(MedicationContext); if (!c) throw new Error('MedicationProvider ausente'); return c }
export function useAppReset() { return () => { sessionStorage.removeItem('medcontrol_demo_data'); window.location.reload() } }
