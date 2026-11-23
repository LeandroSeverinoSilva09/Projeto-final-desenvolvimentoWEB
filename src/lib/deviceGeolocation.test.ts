import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeviceLocationError, getDeviceLocation, radiusForDeviceLocation } from './deviceGeolocation'

const point = (accuracy = 50, latitude = -22.906123, longitude = -47.060987) => ({ coords: { latitude, longitude, accuracy } }) as GeolocationPosition
const locationApi = () => {
  const getCurrentPosition = vi.fn()
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })
  return getCurrentPosition
}
beforeEach(() => { vi.stubGlobal('isSecureContext', true) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('device geolocation lifecycle', () => {
  it('reads native inherited coordinate getters and shares only rounded values', async () => {
    const coords = Object.create({ get latitude() { return -22.906123 }, get longitude() { return -47.060987 }, get accuracy() { return 60 } })
    const api = locationApi().mockImplementation(success => success({ coords }))
    await expect(getDeviceLocation(new AbortController().signal)).resolves.toEqual({ latitude: -22.906, longitude: -47.061, accuracy: 60 })
    expect(api).toHaveBeenCalledTimes(1)
    expect(api.mock.calls[0][2]).toEqual({ enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 })
  })
  it('catches synchronous policy exceptions without leaving a pending promise or retrying denial', async () => {
    const api = locationApi().mockImplementation(() => { throw new DOMException('Policy blocked', 'SecurityError') })
    await expect(getDeviceLocation(new AbortController().signal)).rejects.toMatchObject({ reason: 'denied' })
    expect(api).toHaveBeenCalledTimes(1)
  })
  it('does not retry when the user denies permission', async () => {
    const api = locationApi().mockImplementation((_success, failure) => failure({ code: 1 }))
    await expect(getDeviceLocation(new AbortController().signal)).rejects.toMatchObject({ reason: 'denied' })
    expect(api).toHaveBeenCalledTimes(1)
  })
  it.each(['unsupported', 'insecure'])('recovers from %s contexts without calling an unavailable API', async mode => {
    const api = locationApi()
    if (mode === 'unsupported') vi.stubGlobal('navigator', { geolocation: {} })
    else vi.stubGlobal('isSecureContext', false)
    await expect(getDeviceLocation(new AbortController().signal)).rejects.toMatchObject({ reason: 'unsupported' })
    expect(api).not.toHaveBeenCalled()
  })
  it('refines a coarse fix before choosing which location to use', async () => {
    const api = locationApi().mockImplementationOnce(success => success(point(8000))).mockImplementationOnce(success => success(point(80)))
    await expect(getDeviceLocation(new AbortController().signal)).resolves.toMatchObject({ accuracy: 80 })
    expect(api.mock.calls[1][2]).toEqual({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
  })
  it('keeps a usable approximate fix if precise positioning is unavailable', async () => {
    locationApi().mockImplementationOnce(success => success(point(8000))).mockImplementationOnce((_success, failure) => failure({ code: 2 }))
    await expect(getDeviceLocation(new AbortController().signal)).resolves.toMatchObject({ accuracy: 8000 })
  })
  it('does not share a previous fix after permission is revoked', async () => {
    locationApi().mockImplementationOnce(success => success(point(8000))).mockImplementationOnce((_success, failure) => failure({ code: 1 }))
    await expect(getDeviceLocation(new AbortController().signal)).rejects.toMatchObject({ reason: 'denied' })
  })
  it('rejects coordinates that remain too inaccurate instead of claiming precise nearby results', async () => {
    locationApi().mockImplementation(success => success(point(50000)))
    await expect(getDeviceLocation(new AbortController().signal)).rejects.toThrow('muito imprecisa')
  })
  it('tries accurate positioning after a provider failure', async () => {
    locationApi().mockImplementationOnce((_success, failure) => failure({ code: 2 })).mockImplementationOnce(success => success(point(40)))
    await expect(getDeviceLocation(new AbortController().signal)).resolves.toMatchObject({ accuracy: 40 })
  })
  it('expires even if the native API never calls either callback', async () => {
    vi.useFakeTimers()
    const api = locationApi()
    const pending = getDeviceLocation(new AbortController().signal)
    const expected = expect(pending).rejects.toMatchObject({ reason: 'timeout' })
    await vi.advanceTimersByTimeAsync(19001)
    await expected
    expect(api).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('cancels a pending read and ignores late callbacks', async () => {
    vi.useFakeTimers()
    const api = locationApi()
    const controller = new AbortController()
    const pending = getDeviceLocation(controller.signal)
    const expected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort(); await expected
    api.mock.calls[0][0](point())
    expect(api).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not ask for a position after cancellation', async () => {
    const api = locationApi(), controller = new AbortController()
    controller.abort()
    await expect(getDeviceLocation(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(api).not.toHaveBeenCalled()
  })
  it('does not reduce the search radius and expands it for approximate fixes', () => {
    expect(radiusForDeviceLocation(2000, 30)).toBe(2000)
    expect(radiusForDeviceLocation(2000, 3000)).toBe(5000)
    expect(radiusForDeviceLocation(2000, 8000)).toBe(10000)
    expect(radiusForDeviceLocation(10000, 3000)).toBe(10000)
    expect(new DeviceLocationError('denied', 'Mensagem').message).toBe('Mensagem')
  })
})
