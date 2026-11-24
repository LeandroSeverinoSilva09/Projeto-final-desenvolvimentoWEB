import { describe, expect, it, vi } from 'vitest'
import { allowedEndpoint, dispatchReminders, localParts } from './dispatch'

const now = new Date('2026-11-23T15:00:00Z')
const device = (id: string) => ({ id, user_id: id, endpoint: `https://fcm.googleapis.com/${id}`, subscription: { endpoint: `https://fcm.googleapis.com/${id}` }, timezone: 'America/Sao_Paulo' })
function database(ids = ['a']) {
  const devices = ids.map(device)
  const claims = new Map<string, { token: string; delivered_at?: string }>()
  const operations: { table: string; action: string; filters: Record<string, unknown> }[] = []
  let sequence = 0
  let confirmed = false
  let stock = false
  let bottle: { stock_unit: string; stock_level: string; current: number } | undefined
  let schedules = ['12:00']
  let failClaims = false
  let failRelease = false
  const db = {
    rpc: vi.fn(async (_name: string, args: Record<string, string>) => {
      if (failClaims) return { data: null, error: { code: 'XX000' } }
      const key = [args.p_subscription_id, args.p_medication_id, args.p_scheduled_date, args.p_schedule_time].join(':')
      if (claims.has(key)) return { data: null, error: null }
      const token = `token-${++sequence}`
      claims.set(key, { token })
      return { data: token, error: null }
    }),
    from(table: string) {
      let action = 'select', limit = Infinity, cursor = '', patch: Record<string, unknown> = {}
      const filters: Record<string, unknown> = {}
      const query = {
        select() { return query }, order() { return query }, limit(n: number) { limit = n; return query },
        gt(_key: string, value: string) { cursor = value; return query },
        eq(key: string, value: unknown) { filters[key] = value; return query },
        is() { return query }, maybeSingle() { return query },
        lt() { action = 'cleanup'; return query },
        match(values: Record<string, unknown>) { Object.assign(filters, values); return query },
        delete() { action = 'delete'; return query },
        update(values: Record<string, unknown>) { action = 'update'; patch = values; return query },
        then(resolve: (value: unknown) => unknown) {
          operations.push({ table, action, filters: { ...filters } })
          let data: unknown = null, error: unknown = null
          if (table === 'push_subscriptions' && action === 'select') data = devices.filter(row => row.id > cursor).slice(0, limit)
          if (table === 'push_subscriptions' && action === 'delete') devices.splice(devices.findIndex(row => row.id === filters.id), 1)
          if (table === 'medications') data = [{ id: 'med', schedules, current: stock ? 1 : 99, units_per_dose: 1, ...bottle }]
          if (table === 'dose_records') data = confirmed ? { id: 'dose' } : null
          if (table === 'notification_deliveries' && ['delete', 'update'].includes(action)) {
            const key = [filters.subscription_id, filters.medication_id, filters.scheduled_date, filters.schedule_time].join(':')
            const claim = claims.get(key)
            if (action === 'delete' && failRelease) error = { code: 'XX000' }
            else if (claim?.token === filters.claim_token) {
              if (action === 'delete') claims.delete(key)
              else Object.assign(claim, patch)
            }
          }
          return Promise.resolve(resolve({ data, error }))
        },
      }
      return query
    },
  }
  return { db: db as unknown as Parameters<typeof dispatchReminders>[0], devices, claims, operations,
    confirm: () => { confirmed = true }, lowStock: () => { stock = true },
    bottle: (level: string, current = 0) => { bottle = { stock_unit: 'gotas', stock_level: level, current } },
    schedules: (value: string[]) => { schedules = value },
    failClaims: () => { failClaims = true }, failRelease: () => { failRelease = true } }
}

describe('server dispatcher', () => {
  it('delivers five minutes before and at the time with separate claims and tags', async () => {
    const state = database(), send = vi.fn().mockResolvedValue({})
    const before = new Date(now.getTime()-5*60000)
    expect(await dispatchReminders(state.db,send,new Date(before.getTime()-60000))).toEqual({ sent:0,failed:0 })
    const early = await Promise.all([dispatchReminders(state.db,send,before),dispatchReminders(state.db,send,before)])
    expect(early.reduce((sum,r)=>sum+r.sent,0)).toBe(1)
    expect(await dispatchReminders(state.db,send,now)).toEqual({ sent:1,failed:0 })
    expect(await dispatchReminders(state.db,send,now)).toEqual({ sent:0,failed:0 })
    const notices=send.mock.calls.map(call=>JSON.parse(call[1]))
    expect(notices.map(n=>n.kind)).toEqual(['advance','due'])
    expect(notices[0].time).toBe('12:00');expect(notices[0].tag).not.toBe(notices[1].tag)
    expect([...state.claims.keys()]).toContain('a:med:2026-11-23:before:12:00')
    expect([...state.claims.keys()]).toContain('a:med:2026-11-23:12:00')
  })
  it('uses tomorrow for a midnight advance and queries the real schedule time when checking history', async () => {
    const state=database(),send=vi.fn().mockResolvedValue({});state.schedules(['00:00'])
    await dispatchReminders(state.db,send,new Date('2026-11-24T02:55:00Z'))
    expect([...state.claims.keys()]).toEqual(['a:med:2026-11-24:before:00:00'])
    expect(state.operations.find(op=>op.table==='dose_records')?.filters).toMatchObject({scheduled_date:'2026-11-24',schedule_time:'00:00'})
    await dispatchReminders(state.db,send,new Date('2026-11-24T03:00:00Z'))
    expect(send).toHaveBeenCalledTimes(2)
  })
  it('skips both notifications for confirmed doses and retries a transient advance failure', async () => {
    const state=database(),send=vi.fn().mockRejectedValueOnce({statusCode:503}).mockResolvedValue({})
    const before=new Date(now.getTime()-5*60000)
    expect(await dispatchReminders(state.db,send,before)).toEqual({sent:0,failed:1})
    expect(await dispatchReminders(state.db,send,before)).toEqual({sent:1,failed:0})
    state.confirm()
    expect(await dispatchReminders(state.db,send,now)).toEqual({sent:0,failed:0})
    expect(send).toHaveBeenCalledTimes(2)
  })
  it.each(['full','half','unknown'])('does not infer low drop stock from a numeric zero when the bottle is %s', async level => {
    const state = database(); state.confirm(); state.bottle(level)
    const send = vi.fn().mockResolvedValue({})
    expect(await dispatchReminders(state.db, send, now)).toEqual({ sent: 0, failed: 0 })
    expect(send).not.toHaveBeenCalled()
  })
  it.each(['low','empty'])('alerts for a %s bottle regardless of legacy drop balances', async level => {
    const state = database(); state.confirm(); state.bottle(level, 10000)
    const send = vi.fn().mockResolvedValue({})
    expect(await dispatchReminders(state.db, send, now)).toEqual({ sent: 1, failed: 0 })
    expect(JSON.parse(send.mock.calls[0][1]).kind).toBe('stock')
  })
  it('does not send the same dose from concurrent workers or repeated runs', async () => {
    const { db, claims } = database()
    const send = vi.fn().mockResolvedValue({})
    const runs = await Promise.all([dispatchReminders(db, send, now), dispatchReminders(db, send, now)])
    expect(runs.reduce((sum, value) => sum + value.sent, 0)).toBe(1)
    expect(send).toHaveBeenCalledTimes(1)
    expect([...claims.values()][0].delivered_at).toBeDefined()
    expect(await dispatchReminders(db, send, now)).toEqual({ sent: 0, failed: 0 })
  })
  it('releases transient failures with their ownership token and retries', async () => {
    const { db, claims, operations } = database()
    const send = vi.fn().mockRejectedValueOnce({ statusCode: 503 }).mockResolvedValue({})
    expect(await dispatchReminders(db, send, now)).toEqual({ sent: 0, failed: 1 })
    expect(claims.size).toBe(0)
    expect(operations.find(op => op.table === 'notification_deliveries' && op.action === 'delete')?.filters.claim_token).toBe('token-1')
    expect(await dispatchReminders(db, send, now)).toEqual({ sent: 1, failed: 0 })
  })
  it('does not skip the next page when an expired subscription is removed', async () => {
    const { db, devices } = database(['a', 'b', 'c'])
    const send = vi.fn().mockRejectedValueOnce({ statusCode: 410 }).mockResolvedValue({})
    expect(await dispatchReminders(db, send, now, 1)).toEqual({ sent: 2, failed: 1 })
    expect(send).toHaveBeenCalledTimes(3)
    expect(devices.map(row => row.id)).toEqual(['b', 'c'])
  })
  it('skips a confirmed dose but still permits the daily stock notice', async () => {
    const state = database(); state.confirm(); state.lowStock()
    const send = vi.fn().mockResolvedValue({})
    expect(await dispatchReminders(state.db, send, now)).toEqual({ sent: 1, failed: 0 })
    expect(JSON.parse(send.mock.calls[0][1])).toMatchObject({ kind: 'stock' })
    expect(send.mock.calls[0][1]).not.toContain('medicationName')
  })
  it('counts stock claim errors and never sends without acquiring a claim', async () => {
    const state = database(); state.confirm(); state.lowStock(); state.failClaims()
    const send = vi.fn()
    expect(await dispatchReminders(state.db, send, now)).toEqual({ sent: 0, failed: 1 })
    expect(send).not.toHaveBeenCalled()
  })
  it('reports a failed release instead of hiding an abandoned claim', async () => {
    const state = database(); state.failRelease()
    const send = vi.fn().mockRejectedValue({ statusCode: 503 })
    expect(await dispatchReminders(state.db, send, now)).toEqual({ sent: 0, failed: 2 })
  })
})

describe('push boundaries', () => {
  it('calculates the prior day across local midnight', () => {
    expect(localParts(new Date('2026-11-23T03:00:00Z'), 'America/Sao_Paulo')).toEqual({ day: '2026-11-23', time: '00:00' })
    expect(localParts(new Date('2026-11-23T02:59:00Z'), 'America/Sao_Paulo')).toEqual({ day: '2026-11-22', time: '23:59' })
  })
  it.each(['http://fcm.googleapis.com/a', 'https://fcm.googleapis.com.attacker.test/a', 'https://fcm.googleapis.com@127.0.0.1/a', 'https://fcm.googleapis.com:444/a'])('rejects an untrusted endpoint %s', endpoint => expect(allowedEndpoint(endpoint)).toBe(false))
})
