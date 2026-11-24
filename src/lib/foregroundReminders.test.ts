import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DoseRecord, Medication } from '../types/medication'

const mocks = vi.hoisted(() => ({ permission: vi.fn(), enabled: vi.fn(), send: vi.fn(), background: vi.fn() }))
vi.mock('../utils/notifications', () => ({ notificationPermission: mocks.permission, notificationsEnabled: mocks.enabled, sendBrowserNotification: mocks.send }))
vi.mock('./pushSubscriptions', () => ({ hasBackgroundNotifications: mocks.background }))
import { checkForegroundReminders } from './foregroundReminders'

const medication: Medication = { id: 'demo-dose', name: 'Exemplo fictício', dose: 'Teste', current: 10, total: 10, schedules: '10:00', frequency: 24, takenCount: 0 }
const options = { medications: [medication], history: [] as DoseRecord[], ownerId: 'demo', localOnly: true }

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 23, 10, 0))
  const saved = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => saved.get(key), setItem: (key: string, value: string) => saved.set(key, value) })
  mocks.permission.mockReturnValue('granted'); mocks.enabled.mockReturnValue(true)
  mocks.send.mockResolvedValue(true); mocks.background.mockResolvedValue(false)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetAllMocks() })

describe('foreground medication reminders', () => {
  it('sends once five minutes before and once at the scheduled time', async () => {
    vi.setSystemTime(new Date(2026,10,23,9,54))
    await checkForegroundReminders(options)
    expect(mocks.send).not.toHaveBeenCalled()
    vi.setSystemTime(new Date(2026,10,23,9,55))
    await Promise.all([checkForegroundReminders(options),checkForegroundReminders(options)])
    await checkForegroundReminders(options)
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(mocks.send.mock.calls[0][0]).toBe('Prepare-se para seu cuidado')
    expect(mocks.send.mock.calls[0][2]).toMatch(/:advance$/)
    vi.setSystemTime(new Date(2026,10,23,10,0))
    await checkForegroundReminders(options)
    await checkForegroundReminders(options)
    expect(mocks.send).toHaveBeenCalledTimes(2)
    expect(mocks.send.mock.calls[1][0]).toBe('Seu cuidado tem hora')
    expect(mocks.send.mock.calls[1][2]).not.toBe(mocks.send.mock.calls[0][2])
  })
  it('tracks a midnight dose on its own date and suppresses the on-time notice after confirmation', async () => {
    const midnight = { ...options, medications: [{ ...medication, schedules: '00:00' }] }
    vi.setSystemTime(new Date(2026,10,23,23,55))
    await checkForegroundReminders(midnight)
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(mocks.send.mock.calls[0][2]).toContain('24/11/2026')
    vi.setSystemTime(new Date(2026,10,24,0,0))
    await checkForegroundReminders({ ...midnight, history: [{ id:'confirmed', medicationId:medication.id, name:medication.name, dose:medication.dose, date:'24/11/2026', time:'00:00', scheduleTime:'00:00', timestamp:Date.now() }] })
    expect(mocks.send).toHaveBeenCalledTimes(1)
  })
  it('retries a failed advance delivery without consuming the due-stage notification', async () => {
    vi.setSystemTime(new Date(2026,10,23,9,55))
    mocks.send.mockResolvedValueOnce(false)
    await checkForegroundReminders(options);await checkForegroundReminders(options)
    vi.setSystemTime(new Date(2026,10,23,10,0))
    await checkForegroundReminders(options)
    expect(mocks.send).toHaveBeenCalledTimes(3)
    expect(mocks.send.mock.calls[2][0]).toBe('Seu cuidado tem hora')
  })
  it('delivers a demonstration dose locally without looking for a server subscription', async () => {
    await checkForegroundReminders(options)
    expect(mocks.send).toHaveBeenCalledWith('Seu cuidado tem hora', expect.stringContaining('10:00'), expect.stringContaining(':demo:'), '/', expect.any(Function))
    expect(mocks.background).not.toHaveBeenCalled()
  })

  it('does not duplicate a dose after a refresh or concurrent checks', async () => {
    await Promise.all([checkForegroundReminders(options), checkForegroundReminders(options)])
    await checkForegroundReminders(options)
    expect(mocks.send).toHaveBeenCalledTimes(1)
  })

  it('retries failed delivery rather than saving the dose as notified', async () => {
    mocks.send.mockResolvedValueOnce(false)
    await checkForegroundReminders(options)
    await checkForegroundReminders(options)
    expect(mocks.send).toHaveBeenCalledTimes(2)
  })

  it('keeps different accounts independent', async () => {
    await checkForegroundReminders(options)
    await checkForegroundReminders({ ...options, ownerId: 'other-account' })
    expect(mocks.send).toHaveBeenCalledTimes(2)
  })

  it('leaves account reminders to an active server subscription', async () => {
    mocks.background.mockResolvedValue(true)
    await checkForegroundReminders({ ...options, localOnly: false })
    expect(mocks.background).toHaveBeenCalledWith('demo')
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it.each(['default', 'denied', 'unsupported'])('does not send with permission %s', async permission => {
    mocks.permission.mockReturnValue(permission)
    await checkForegroundReminders(options)
    expect(mocks.send).not.toHaveBeenCalled()
    expect(mocks.background).not.toHaveBeenCalled()
  })

  it('respects disabling notifications and effect cleanup', async () => {
    mocks.enabled.mockReturnValue(false)
    await checkForegroundReminders(options)
    mocks.enabled.mockReturnValue(true)
    await checkForegroundReminders({ ...options, isActive: () => false })
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('skips confirmed doses, future slots and slots over two minutes old', async () => {
    const history: DoseRecord[] = [{ id: 'taken', medicationId: medication.id, name: medication.name, dose: medication.dose, date: '23/11/2026', time: '10:00', scheduleTime: '10:00', timestamp: Date.now() }]
    await checkForegroundReminders({ ...options, history })
    await checkForegroundReminders({ ...options, medications: [{ ...medication, schedules: '10:01, 09:57' }] })
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('cancels a pending account check when its owner changes', async () => {
    let active = true
    let release: (value: boolean) => void = () => {}
    mocks.background.mockReturnValue(new Promise<boolean>(resolve => { release = resolve }))
    const check = checkForegroundReminders({ ...options, localOnly: false, isActive: () => active })
    active = false; release(false)
    await check
    expect(mocks.send).not.toHaveBeenCalled()
  })
})
