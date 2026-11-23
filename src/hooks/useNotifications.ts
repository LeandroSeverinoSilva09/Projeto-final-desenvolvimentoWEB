import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, errorMessage } from '../lib/supabase'
import { hasBackgroundNotifications } from '../lib/pushSubscriptions'
import { notificationPermission, notificationsEnabled, setNotificationsEnabled, requestNotificationPermission, sendBrowserNotification } from '../utils/notifications'
function applicationKey(value: string) {
  const bytes = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bytes, c => c.charCodeAt(0))
}
export function useNotifications() {
  const { user, isDemo } = useAuth()
  const [permission, setPermission] = useState(notificationPermission)
  const [enabled, setEnabled] = useState(notificationsEnabled)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [testing, setTesting] = useState(false)
  const [testMessage, setTestMessage] = useState('')
  const testInFlight = useRef(false)
  const refreshVersion = useRef(0)
  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current
    setPermission(notificationPermission())
    setEnabled(notificationsEnabled())
    const active = !isDemo && !!user?.id && await hasBackgroundNotifications(user.id)
    if (version === refreshVersion.current) setSubscribed(active)
  }, [isDemo, user?.id])
  useEffect(() => { void refresh(); window.addEventListener('focus', refresh); window.addEventListener('medcontrol:notifications', refresh); return () => { refreshVersion.current++; window.removeEventListener('focus', refresh); window.removeEventListener('medcontrol:notifications', refresh) } }, [refresh])
  const enable = async () => {
    setBusy(true); setError('')
    try {
      // This call must run directly from the user's click before any other await.
      const granted = await requestNotificationPermission()
      setPermission(notificationPermission())
      if (!granted) return
      setNotificationsEnabled(true)
      if (!isDemo && user?.id && supabase && 'serviceWorker' in navigator && 'PushManager' in window) {
        const config = await supabase.functions.invoke('dispatch-reminders', { method: 'GET' })
        if (config.error || !config.data?.publicKey) throw new Error('Os avisos com o app aberto foram autorizados. Não foi possível conectar o envio em segundo plano; tente novamente em Ajustes.')
        const registration = await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Recarregue o aplicativo para concluir a ativação.')), 10000))])
        let subscription = await registration.pushManager.getSubscription()
        if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(config.data.publicKey) })
        const { error } = await supabase.from('push_subscriptions').upsert({ user_id: user!.id, endpoint: subscription.endpoint,
          subscription: subscription.toJSON(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }, { onConflict: 'endpoint' })
        if (error) { await subscription.unsubscribe(); throw error }
        setSubscribed(true)
      }
    } catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false); window.dispatchEvent(new Event('medcontrol:notifications')) }
  }
  const disable = async () => {
    setBusy(true); setError(''); setTestMessage('')
    try {
      setNotificationsEnabled(false)
      // Demo controls only local preferences, never a real account's push subscription.
      const registration = !isDemo && user?.id ? await navigator.serviceWorker?.getRegistration() : undefined
      const subscription = await registration?.pushManager?.getSubscription()
      if (subscription) {
        const result = await supabase?.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
        await subscription.unsubscribe()
        if (result?.error) throw result.error
      }
      setSubscribed(false)
    } catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false); window.dispatchEvent(new Event('medcontrol:notifications')) }
  }
  const test = async () => {
    if (testInFlight.current) return
    testInFlight.current = true
    setError(''); setTestMessage(''); setTesting(true)
    try {
      // Send directly from this click: no medicine, schedule, polling or server required.
      // A new tag prevents the OS from silently replacing an earlier manual test.
      const sent = await sendBrowserNotification('Teste de aviso local', 'Seu aviso de teste chegou. Você não precisa cadastrar um remédio nem esperar um horário para fazer este teste.', `medcontrol-test-${crypto.randomUUID()}`)
      if (sent) setTestMessage('Teste enviado agora e aceito pelo navegador. Se o banner não aparecer, confira as notificações do navegador nos ajustes do computador e o modo Não Perturbe.')
      else setError('O navegador não confirmou o aviso. Confira as permissões deste site e as notificações do navegador nos ajustes do computador. Depois, tente novamente.')
    } catch (e) { setError(errorMessage(e)) }
    finally { testInFlight.current = false; setTesting(false) }
  }
  return { permission, enabled, subscribed, busy, error, testing, testMessage, isDemo, enable, disable, test, backgroundAvailable: !!supabase && !isDemo && 'serviceWorker' in navigator && 'PushManager' in window }
}
