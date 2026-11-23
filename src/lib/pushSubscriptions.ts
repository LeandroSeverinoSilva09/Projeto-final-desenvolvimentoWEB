import { supabase } from './supabase'

// A browser subscription alone does not prove that the server knows this account.
export async function hasBackgroundNotifications(userId: string): Promise<boolean> {
  if (!supabase || !('serviceWorker' in navigator)) return false
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager?.getSubscription()
    if (!subscription) return false
    const { data, error } = await supabase.from('push_subscriptions').select('id')
      .eq('user_id', userId).eq('endpoint', subscription.endpoint).maybeSingle()
    return !error && !!data
  } catch { return false }
}
