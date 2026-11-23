import { afterEach, describe, expect, it, vi } from 'vitest'

function browser(permission: NotificationPermission = 'default', secure = true) {
  const requestPermission = vi.fn().mockResolvedValue('granted')
  const NotificationMock = Object.assign(vi.fn(), { permission, requestPermission })
  vi.stubGlobal('Notification', NotificationMock)
  vi.stubGlobal('window', { Notification: NotificationMock, isSecureContext: secure })
  vi.stubGlobal('navigator', {})
  return { NotificationMock, requestPermission }
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.resetModules() })

describe('notification permission is an explicit user action', () => {
  it('does not request permission when the module is imported or status is read', async () => {
    const { requestPermission } = browser()
    const notifications = await import('./notifications')
    expect(notifications.notificationPermission()).toBe('default')
    expect(requestPermission).not.toHaveBeenCalled()
    expect(await notifications.requestNotificationPermission()).toBe(true)
    expect(requestPermission).toHaveBeenCalledTimes(1)
  })

  it.each(['granted', 'denied'] as const)('does not prompt again when permission is %s', async permission => {
    const { requestPermission } = browser(permission)
    const { requestNotificationPermission } = await import('./notifications')
    expect(await requestNotificationPermission()).toBe(permission === 'granted')
    expect(requestPermission).not.toHaveBeenCalled()
  })

  it('does not request permission in an insecure or unsupported environment', async () => {
    const { requestPermission } = browser('default', false)
    const notifications = await import('./notifications')
    expect(notifications.notificationPermission()).toBe('unsupported')
    expect(await notifications.requestNotificationPermission()).toBe(false)
    expect(requestPermission).not.toHaveBeenCalled()
    vi.stubGlobal('window', undefined)
    expect(notifications.notificationPermission()).toBe('unsupported')
  })
})

describe('browser notification delivery supports mobile service workers', () => {
  it('uses an active worker instead of constructing a desktop-only notification', async () => {
    const { NotificationMock } = browser('granted')
    NotificationMock.mockImplementation(() => { throw new TypeError('Constructor unavailable on this mobile browser') })
    const showNotification = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: vi.fn().mockResolvedValue({ active: {}, showNotification }) } })
    const { sendBrowserNotification } = await import('./notifications')
    expect(await sendBrowserNotification('Seu horário de cuidado', 'Abra o MEDControl para conferir.', 'dose-safe')).toBe(true)
    expect(showNotification).toHaveBeenCalledWith('Seu horário de cuidado', expect.objectContaining({ body: 'Abra o MEDControl para conferir.', tag: 'dose-safe' }))
    expect(NotificationMock).not.toHaveBeenCalled()
  })

  it('falls back to the browser constructor when no active worker is registered', async () => {
    const { NotificationMock } = browser('granted')
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: vi.fn().mockResolvedValue(undefined) } })
    const { sendBrowserNotification } = await import('./notifications')
    expect(await sendBrowserNotification('Lembrete', 'Abra o aplicativo.')).toBe(true)
    expect(NotificationMock).toHaveBeenCalledWith('Lembrete', expect.objectContaining({ body: 'Abra o aplicativo.' }))
  })

  it('reports delivery failure without throwing or asking for permission', async () => {
    const { requestPermission } = browser('granted')
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: vi.fn().mockRejectedValue(new Error('Worker unavailable')) } })
    const { sendBrowserNotification } = await import('./notifications')
    expect(await sendBrowserNotification('Lembrete', 'Abra o aplicativo.')).toBe(false)
    expect(requestPermission).not.toHaveBeenCalled()
  })

  it('does not send or prompt when permission was not granted', async () => {
    const { NotificationMock, requestPermission } = browser('denied')
    const { sendBrowserNotification } = await import('./notifications')
    expect(await sendBrowserNotification('Lembrete', 'Abra o aplicativo.')).toBe(false)
    expect(NotificationMock).not.toHaveBeenCalled()
    expect(requestPermission).not.toHaveBeenCalled()
  })
})

describe('device opt-out', () => {
  it('suppresses local notices after disabling even when browser permission remains granted', async () => {
    const { NotificationMock } = browser('granted')
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value) })
    window.dispatchEvent = vi.fn()
    const { setNotificationsEnabled, sendBrowserNotification, notificationPermission, notificationsEnabled } = await import('./notifications')
    setNotificationsEnabled(false)
    expect(notificationPermission()).toBe('granted')
    expect(notificationsEnabled()).toBe(false)
    expect(await sendBrowserNotification('Lembrete', 'Abra o app.')).toBe(false)
    expect(NotificationMock).not.toHaveBeenCalled()
    setNotificationsEnabled(true)
    expect(await sendBrowserNotification('Lembrete', 'Abra o app.')).toBe(true)
  })
})
