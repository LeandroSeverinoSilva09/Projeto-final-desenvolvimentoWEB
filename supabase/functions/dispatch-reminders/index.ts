import { createClient } from 'npm:@supabase/supabase-js@2.119.2'
import * as webpush from 'npm:web-push@4.0.0'
import { dispatchReminders } from './dispatch.ts'

// GET returns a public VAPID key; POST is cron-only and authenticates its own random secret.
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
const env = (name: string) => { const value = Deno.env.get(name); if (!value) throw new Error(`Missing environment variable: ${name}`); return value }
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (!['GET', 'POST'].includes(req.method)) return new Response('Method not allowed', { status: 405, headers: cors })
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
  let { data: config, error: configError } = await db.from('push_server_config').select('*').eq('id', true).maybeSingle()
  if (configError) return Response.json({ error: 'Push configuration unavailable' }, { status: 503, headers: cors })
  if (!config) {
    const pair = webpush.generateVAPIDKeys()
    const cronSecret = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
    const { error } = await db.from('push_server_config').insert({ id: true, public_key: pair.publicKey, private_key: pair.privateKey, cron_secret: cronSecret })
    if (error && error.code !== '23505') return Response.json({ error: 'Unable to initialize push' }, { status: 503, headers: cors })
    const result = await db.from('push_server_config').select('*').eq('id', true).single()
    config = result.data; configError = result.error
  }
  if (configError || !config) return Response.json({ error: 'Push configuration unavailable' }, { status: 503, headers: cors })
  if (req.method === 'GET') return Response.json({ publicKey: config.public_key }, { headers: cors })
  if (req.headers.get('authorization') !== `Bearer ${config.cron_secret}`) return new Response('Unauthorized', { status: 401, headers: cors })
  webpush.setVapidDetails(env('SUPABASE_URL'), config.public_key, config.private_key)
  try {
    const result = await dispatchReminders(db, (subscription, payload, options) => webpush.sendNotification(subscription, payload, options))
    return Response.json(result, { headers: cors })
  } catch {
    return Response.json({ error: 'Unable to dispatch reminders' }, { status: 500, headers: cors })
  }
})
