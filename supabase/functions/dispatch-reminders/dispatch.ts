import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.119.2'
import type { PushSubscription, RequestOptions } from 'npm:web-push@4.0.0'
import { localParts, reminderCandidates, reminderClaimTime, type ReminderCandidate, type ReminderKind } from '../_shared/reminderTiming.ts'
export { localParts } from '../_shared/reminderTiming.ts'

export const allowedEndpoint = (endpoint: string) => {
  try {
    const u = new URL(endpoint)
    return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') && (u.hostname === 'fcm.googleapis.com' || u.hostname === 'web.push.apple.com' || u.hostname.endsWith('.push.services.mozilla.com') || u.hostname === 'updates.push.services.mozilla.com' || u.hostname.endsWith('.notify.windows.com'))
  } catch { return false }
}
type Send = (subscription: PushSubscription, payload: string, options: RequestOptions) => Promise<unknown>
type Claim = { subscription_id: string; medication_id: string; scheduled_date: string; schedule_time: string }

export async function dispatchReminders(db: SupabaseClient, send: Send, now = new Date(), pageSize = 500) {
  let sent = 0, failed = 0
  let cursor: string | undefined
  for (;;) {
    let query = db.from('push_subscriptions').select('id,user_id,endpoint,subscription,timezone').order('id').limit(pageSize)
    if (cursor) query = query.gt('id', cursor)
    const { data: subscriptions, error } = await query
    if (error) throw new Error('Unable to load subscriptions')
    for (const sub of subscriptions || []) {
      if (!allowedEndpoint(sub.endpoint) || sub.subscription?.endpoint !== sub.endpoint) { failed++; continue }
      let candidates: ReminderCandidate[], today: string
      try { candidates = reminderCandidates(now, sub.timezone); today = localParts(now, sub.timezone).day } catch { failed++; continue }
      const { data: meds, error: medError } = await db.from('medications').select('id,schedules,current,units_per_dose,stock_unit,stock_level').eq('user_id', sub.user_id).is('archived_at', null)
      if (medError) { failed++; continue }
      let expired = false
      const deliver = async (claim: Claim, kind: ReminderKind | 'stock' = 'due', time?: string) => {
        const { data: token, error: claimError } = await db.rpc('claim_notification_delivery', {
          p_subscription_id: claim.subscription_id, p_medication_id: claim.medication_id,
          p_scheduled_date: claim.scheduled_date, p_schedule_time: claim.schedule_time,
        })
        if (claimError) { failed++; return }
        if (!token) return
        try {
          const stock = kind === 'stock'
          await send(sub.subscription, JSON.stringify({ kind, ...(time ? { time } : {}), tag: `medcontrol${stock ? '-stock' : kind === 'advance' ? '-advance' : ''}:${claim.medication_id}:${claim.scheduled_date}${stock ? '' : `:${time || claim.schedule_time}`}` }), { TTL: stock ? 3600 : 120, urgency: 'high', timeout: 10000 })
        } catch (error) {
          failed++
          const status = (error as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) {
            expired = true
            const { error: deleteError } = await db.from('push_subscriptions').delete().eq('id', sub.id)
            if (deleteError) failed++
          } else {
            const { error: releaseError } = await db.from('notification_deliveries').delete().match(claim).eq('claim_token', token)
            if (releaseError) failed++
          }
          return
        }
        sent++
        // Provider acceptance is recorded separately from a temporary claim.
        const { error: completionError } = await db.from('notification_deliveries').update({ delivered_at: new Date().toISOString() }).match(claim).eq('claim_token', token)
        if (completionError) failed++
      }
      for (const med of meds || []) {
        if (expired) break
        if (!Array.isArray(med.schedules)) { failed++; continue }
        for (const candidate of candidates) {
          if (expired) break
          if (!med.schedules.includes(candidate.time)) continue
          const { data: dose, error: doseError } = await db.from('dose_records').select('id').eq('user_id', sub.user_id).eq('medication_id', med.id).eq('scheduled_date', candidate.day).eq('schedule_time', candidate.time).maybeSingle()
          if (doseError) { failed++; continue }
          if (dose) continue
          await deliver({ subscription_id: sub.id, medication_id: med.id, scheduled_date: candidate.day, schedule_time: reminderClaimTime(candidate) }, candidate.kind, candidate.time)
        }
        const needsStock = med.stock_unit === 'gotas' ? med.stock_level === 'low' || med.stock_level === 'empty' : med.current <= med.schedules.length * med.units_per_dose * 3
        if (!expired && needsStock) {
          await deliver({ subscription_id: sub.id, medication_id: med.id, scheduled_date: today, schedule_time: 'stock' }, 'stock')
        }
      }
    }
    if (!subscriptions?.length || subscriptions.length < pageSize) break
    cursor = subscriptions[subscriptions.length - 1].id
  }
  const { error: cleanupError } = await db.from('notification_deliveries').delete().lt('claimed_at', new Date(now.getTime() - 30 * 86400000).toISOString())
  if (cleanupError) failed++
  return { sent, failed }
}
