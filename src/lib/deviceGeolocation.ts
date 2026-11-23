import { DEVICE_LOCATION_OPTIONS, deviceLocation, geolocationErrorMessage, type PharmacyRadius } from './pharmacies'

export class DeviceLocationError extends Error {
  readonly reason: 'denied' | 'unavailable' | 'timeout' | 'unsupported'
  constructor(reason: DeviceLocationError['reason'], message: string) {
    super(message)
    this.name = 'DeviceLocationError'
    this.reason = reason
  }
}

const preciseOptions: PositionOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
const abortError = () => new DOMException('Localização cancelada.', 'AbortError')
const isAborted = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'
const isDenied = (error: unknown) => error instanceof DeviceLocationError && error.reason === 'denied'

function locationError(error: unknown): DeviceLocationError {
  const value = error as { code?: number; name?: string } | null
  const code = value?.name === 'SecurityError' || value?.name === 'NotAllowedError' ? 1 : value?.code
  return new DeviceLocationError(code === 1 ? 'denied' : code === 3 ? 'timeout' : 'unavailable', geolocationErrorMessage(code ?? 2))
}

function position(signal: AbortSignal, options: PositionOptions): Promise<GeolocationPosition> {
  if (signal.aborted) return Promise.reject(abortError())
  if (!globalThis.isSecureContext || typeof navigator === 'undefined' || typeof navigator.geolocation?.getCurrentPosition !== 'function') {
    return Promise.reject(new DeviceLocationError('unsupported', 'A localização não está disponível nesta página. Busque por cidade, bairro ou CEP. Para usar a localização no celular, abra o aplicativo em HTTPS.'))
  }
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (action: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      action()
    }
    const abort = () => finish(() => reject(abortError()))
    // Native timeouts do not cover every permission prompt/provider failure.
    const timer = setTimeout(() => finish(() => reject(locationError({ code: 3 }))), Number(options.timeout) + 500)
    signal.addEventListener('abort', abort, { once: true })
    try {
      navigator.geolocation.getCurrentPosition(
        value => finish(() => resolve(value)),
        error => finish(() => reject(locationError(error))),
        options,
      )
    } catch (error) { finish(() => reject(locationError(error))) }
  })
}

/** Read real coordinate getters explicitly; never spread a native Coordinates object. */
export async function getDeviceLocation(signal: AbortSignal): Promise<ReturnType<typeof deviceLocation>> {
  let approximate: ReturnType<typeof deviceLocation> | undefined
  try {
    approximate = deviceLocation((await position(signal, DEVICE_LOCATION_OPTIONS)).coords)
    if (approximate.accuracy <= 2000) return approximate
  } catch (error) {
    if (isAborted(error) || isDenied(error) || error instanceof DeviceLocationError && error.reason === 'unsupported') throw error
  }
  try {
    const precise = deviceLocation((await position(signal, preciseOptions)).coords)
    return !approximate || precise.accuracy < approximate.accuracy ? precise : approximate
  } catch (error) {
    if (isAborted(error) || isDenied(error) || !approximate) throw error
    return approximate
  }
}

export function radiusForDeviceLocation(radius: PharmacyRadius, accuracy: number): PharmacyRadius {
  return accuracy > 5000 ? 10000 : accuracy > 2000 && radius === 2000 ? 5000 : radius
}
