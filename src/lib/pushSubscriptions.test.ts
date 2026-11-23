import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), from: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { from: mocks.from } }))
import { hasBackgroundNotifications } from './pushSubscriptions'
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks() })
function subscription(data: { id: string } | null, error: unknown = null) {
  const query = { select: mocks.select, eq: mocks.eq, maybeSingle: mocks.maybeSingle }
  mocks.from.mockReturnValue(query); mocks.select.mockReturnValue(query); mocks.eq.mockReturnValue(query)
  mocks.maybeSingle.mockResolvedValue({ data, error })
  vi.stubGlobal('navigator', { serviceWorker: { getRegistration: vi.fn().mockResolvedValue({ pushManager: { getSubscription: vi.fn().mockResolvedValue({ endpoint: 'https://push.example/device' }) } }) } })
}
describe('server-backed subscription status', () => {
  it('requires a saved subscription for the current account', async () => {
    subscription({ id: 'saved' })
    expect(await hasBackgroundNotifications('account')).toBe(true)
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'account')
    expect(mocks.eq).toHaveBeenCalledWith('endpoint', 'https://push.example/device')
  })
  it('keeps local reminders available for an orphan browser subscription', async () => {
    subscription(null)
    expect(await hasBackgroundNotifications('account')).toBe(false)
  })
  it('keeps local reminders available if the lookup fails', async () => {
    subscription(null, { message: 'offline' })
    expect(await hasBackgroundNotifications('account')).toBe(false)
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: vi.fn().mockRejectedValue(new Error('Unavailable')) } })
    expect(await hasBackgroundNotifications('account')).toBe(false)
  })
})
