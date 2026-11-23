import { createClient } from '@supabase/supabase-js'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
process.loadEnvFile('.env.local')
const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const secret = process.env.SUPABASE_TEST_ADMIN_KEY
if (!secret) throw new Error('Set SUPABASE_TEST_ADMIN_KEY only for this process; never use it in the frontend.')
const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, secret, opts)
const users = []
const must = result => { if (result.error) throw result.error; return result.data }
try {
  const clients = []
  for (let i = 0; i < 2; i++) {
    const email = `medcontrol-test-${randomUUID()}@example.test`, password = randomUUID() + '!'
    const created = must(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'Teste automatizado descartável' } }))
    users.push(created.user.id)
    const client = createClient(url, key, opts)
    must(await client.auth.signInWithPassword({ email, password }))
    clients.push(client)
  }
  console.log('PASS: autenticação real de duas contas isoladas')
  const [a, b] = clients
  const medication = must(await a.from('medications').insert({ user_id: users[0], name: 'Medicamento de teste descartável', dose: '2 unidades de teste', current: 10, total: 10, schedules: ['00:00', '23:59'], units_per_dose: 2 }).select().single())
  assert.equal(must(await b.from('medications').select('*').eq('id', medication.id)).length, 0)
  const malicious = await b.from('medications').insert({ user_id: users[0], name: 'Tentativa de teste', dose: 'teste', current: 1, total: 1, schedules: ['00:00'] })
  assert(malicious.error)
  const otherRpc = await b.rpc('confirm_medication_dose', { p_medication_id: medication.id, p_schedule_time: '00:00', p_timezone: 'America/Sao_Paulo' })
  assert(otherRpc.error)
  console.log('PASS: RLS bloqueia leitura, escrita e confirmação entre contas')
  const concurrent = await Promise.all([0, 1].map(() => a.rpc('confirm_medication_dose', { p_medication_id: medication.id, p_schedule_time: '00:00', p_timezone: 'America/Sao_Paulo' })))
  assert.equal(concurrent.filter(r => !r.error).length, 1)
  assert.equal(must(await a.from('medications').select('current').eq('id', medication.id).single()).current, 8)
  assert.equal(must(await a.from('dose_records').select('*').eq('medication_id', medication.id)).length, 1)
  console.log('PASS: confirmações concorrentes geram uma dose e um único desconto de 2 unidades')
  const staleEdit = must(await a.from('medications').update({ name: 'Edição obsoleta', current: medication.current, total: medication.total })
    .eq('id', medication.id).eq('current', medication.current).eq('total', medication.total)
    .eq('stock_unit', medication.stock_unit).is('archived_at', null).select('id').maybeSingle())
  assert.equal(staleEdit, null)
  assert.equal(must(await a.from('medications').select('current').eq('id', medication.id).single()).current, 8)
  const freshEdit = must(await a.from('medications').update({ name: 'Edição atualizada de teste', current: 8, total: 10 })
    .eq('id', medication.id).eq('current', 8).eq('total', 10).eq('stock_unit', medication.stock_unit)
    .is('archived_at', null).select('id').maybeSingle())
  assert.equal(freshEdit.id, medication.id)
  console.log('PASS: edição obsoleta é recusada atomicamente; edição com saldo atual funciona')
  const future = await a.rpc('confirm_medication_dose', { p_medication_id: medication.id, p_schedule_time: '23:59', p_timezone: 'America/Sao_Paulo' })
  assert(future.error)
  const wrongTime = await a.rpc('confirm_medication_dose', { p_medication_id: medication.id, p_schedule_time: '01:23', p_timezone: 'America/Sao_Paulo' })
  assert(wrongTime.error)
  console.log('PASS: horário futuro e horário não cadastrado são recusados no servidor')
  const invalid = await a.from('medications').insert({ user_id: users[0], name: 'Inválido', dose: 'teste', current: 10, total: 10, schedules: ['08:00', '08:00'] })
  assert(invalid.error)
  const direct = await a.from('dose_records').insert({ user_id: users[0], medication_id: medication.id, name: 'Inválido', dose: 'teste', scheduled_date: '2026-11-23', schedule_time: '00:00' })
  assert(direct.error)
  console.log('PASS: horários duplicados e registros de dose fora da transação são bloqueados')
  must(await a.rpc('restock_medication', { p_medication_id: medication.id, p_quantity: 5 }))
  const stocked = must(await a.from('medications').select('*').eq('id', medication.id).single())
  assert.equal(stocked.current, 13); assert.equal(stocked.total, 13)
  must(await a.from('medications').update({ archived_at: new Date().toISOString() }).eq('id', medication.id))
  assert.equal(must(await a.from('dose_records').select('*').eq('medication_id', medication.id)).length, 1)
  console.log('PASS: reposição soma ao estoque e arquivamento preserva o histórico')
  // Invalid provider domain is rejected by the dispatcher; this fixture never sends a push.
  const endpoint = `https://example.invalid/medcontrol-test/${randomUUID()}`
  const subscription = must(await admin.from('push_subscriptions').insert({ user_id: users[0], endpoint, subscription: { endpoint }, timezone: 'America/Sao_Paulo' }).select('id').single())
  try {
    const claim = { p_subscription_id: subscription.id, p_medication_id: medication.id, p_scheduled_date: new Date().toISOString().slice(0, 10), p_schedule_time: 'stock' }
    assert((await a.rpc('claim_notification_delivery', claim)).error)
    const tokens = await Promise.all([0, 1].map(async () => must(await admin.rpc('claim_notification_delivery', claim))))
    assert.equal(tokens.filter(Boolean).length, 1)
    const firstToken = tokens.find(Boolean)
    must(await admin.from('notification_deliveries').update({ claimed_at: new Date(Date.now() - 60000).toISOString() }).eq('subscription_id', subscription.id))
    const retryToken = must(await admin.rpc('claim_notification_delivery', claim))
    assert(retryToken && retryToken !== firstToken)
    must(await admin.from('notification_deliveries').delete().eq('subscription_id', subscription.id).eq('claim_token', firstToken))
    assert.equal(must(await admin.from('notification_deliveries').select('claim_token').eq('subscription_id', subscription.id).single()).claim_token, retryToken)
    must(await admin.from('notification_deliveries').update({ delivered_at: new Date().toISOString(), claimed_at: new Date(Date.now() - 60000).toISOString() }).eq('subscription_id', subscription.id).eq('claim_token', retryToken))
    assert.equal(must(await admin.rpc('claim_notification_delivery', claim)), null)
    console.log('PASS: fila push restringe cliente, serializa claims, recupera tentativa expirada e protege token atual; sem envio externo')
  } finally {
    must(await admin.from('push_subscriptions').delete().eq('id', subscription.id))
  }
  const fractional = must(await a.from('medications').insert({ user_id: users[0], name: 'Teste fracionado descartável', dose: '0,1 mL de teste', current: 0.3, total: 0.3, schedules: ['00:00'], units_per_dose: 0.1, stock_unit: 'mL' }).select().single())
  must(await a.rpc('confirm_medication_dose', { p_medication_id: fractional.id, p_schedule_time: '00:00', p_timezone: 'America/Sao_Paulo' }))
  assert.equal(must(await a.from('medications').select('current').eq('id', fractional.id).single()).current, 0.2)
  must(await a.rpc('restock_medication', { p_medication_id: fractional.id, p_quantity: 2.5 }))
  assert.equal(must(await a.from('medications').select('current').eq('id', fractional.id).single()).current, 2.7)
  console.log('PASS: consumo e reposição fracionados preservam precisão decimal no banco')
} finally {
  for (const id of users) {
    must(await admin.from('dose_records').delete().eq('user_id', id))
    must(await admin.from('medications').delete().eq('user_id', id))
    must(await admin.auth.admin.deleteUser(id))
  }
  console.log('CLEANUP: contas e dados descartáveis removidos')
}
