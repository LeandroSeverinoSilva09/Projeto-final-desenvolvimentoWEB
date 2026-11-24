/** Public map data only. Never pass medication, account or address data to this module. */
export interface Coordinates {
  latitude: number
  longitude: number
}

export type PharmacyRadius = 2000 | 5000 | 10000

export interface PlaceOption extends Coordinates {
  id: string
  label: string
}

export interface Pharmacy extends Coordinates {
  provider: 'osm'
  id: string
  name: string
  address: string | null
  phone: { label: string; href: string } | null
  openingHours: string | null
  distanceMeters: number
  osmUrl: string
}

type ErrorCode = 'validation' | 'network' | 'timeout' | 'unavailable' | 'invalid-response' | 'not-found'

export class PharmacyError extends Error {
  code: ErrorCode
  constructor(code: ErrorCode, message: string) {
    super(message)
    this.name = 'PharmacyError'
    this.code = code
  }
}

export const PHARMACY_RADII: readonly PharmacyRadius[] = [2000, 5000, 10000]
const PHOTON_URL = import.meta.env.VITE_PHOTON_URL || 'https://photon.komoot.io/api/'
const OVERPASS_URL = import.meta.env.VITE_OVERPASS_URL || 'https://ovp.dresel.systems/api-sa/interpreter'
const CACHE_TTL_MS = 5 * 60 * 1000
const REQUEST_TIMEOUT_MS = 25000
const cache = new Map<string, { expires: number; value: unknown }>()
const nextRequest = new Map<string, number>()

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function text(value: unknown, limit = 220): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim().slice(0, limit) : ''
}

function readCache<T>(key: string): T | undefined {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (entry.expires <= Date.now()) { cache.delete(key); return undefined }
  return entry.value as T
}

function writeCache(key: string, value: unknown) {
  if (cache.size >= 20) cache.delete(cache.keys().next().value!)
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS })
}

/** Called on removal, cancellation and page exit. No persistent storage is used. */
export function clearPharmacyCache() { cache.clear() }

export function validateCoordinates(point: Coordinates): Coordinates {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) {
    throw new PharmacyError('validation', 'A localização recebida é inválida. Busque por cidade ou bairro.')
  }
  return point
}

/** Roughly a 100 m grid in Brazil; raw browser GPS never reaches a map provider. */
export function approximateCoordinates(point: Coordinates): Coordinates {
  validateCoordinates(point)
  return { latitude: Number(point.latitude.toFixed(3)), longitude: Number(point.longitude.toFixed(3)) }
}

/** Validate device fixes separately: (0, 0) is a common unavailable/emulated fix,
 * but zero latitude/longitude remain valid for generic distance calculations. */
export function deviceLocation(coords: Pick<GeolocationCoordinates, 'latitude' | 'longitude' | 'accuracy'>): Coordinates & { accuracy: number } {
  const point = approximateCoordinates(coords)
  if (point.latitude === 0 && point.longitude === 0) {
    throw new PharmacyError('validation', 'O navegador não informou sua localização real. Tente localizar novamente ou digite sua cidade, bairro ou CEP abaixo.')
  }
  if (!Number.isFinite(coords.accuracy) || coords.accuracy < 0 || coords.accuracy > 10000) {
    throw new PharmacyError('validation', 'A localização recebida está muito imprecisa para encontrar farmácias próximas. Tente novamente com a localização precisa ativada ou busque por cidade, bairro ou CEP.')
  }
  return { ...point, accuracy: coords.accuracy }
}

export const DEVICE_LOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false, timeout: 8000, maximumAge: 30000,
}

export function distanceMeters(from: Coordinates, to: Coordinates): number {
  validateCoordinates(from); validateCoordinates(to)
  const rad = Math.PI / 180
  const latitudeDelta = (to.latitude - from.latitude) * rad
  const longitudeDelta = (to.longitude - from.longitude) * rad
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(from.latitude * rad) * Math.cos(to.latitude * rad) * Math.sin(longitudeDelta / 2) ** 2
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)))
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(0, Math.round(meters / 10) * 10)} m`
  return `${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
}

export function normalizeLocationQuery(value: string): { kind: 'cep' | 'place'; value: string } {
  const query = value.trim().replace(/\s+/g, ' ')
  if (/^\d{5}-?\d{3}$/.test(query)) return { kind: 'cep', value: query.replace('-', '') }
  if (query.length < 3 || query.length > 120 || !/^[\p{L}\p{M}\s,.'’()\/-]+$/u.test(query)) {
    throw new PharmacyError('validation', 'Digite cidade e estado, bairro e cidade, ou um CEP com 8 dígitos. Não informe endereço residencial ou dados de saúde.')
  }
  return { kind: 'place', value: query }
}

export function buildOverpassQuery(point: Coordinates, radius: PharmacyRadius): string {
  const approximate = approximateCoordinates(point)
  if (!PHARMACY_RADII.includes(radius)) throw new PharmacyError('validation', 'Escolha um raio de 2, 5 ou 10 km.')
  const around = `around:${radius},${approximate.latitude},${approximate.longitude}`
  return `[out:json][timeout:20][maxsize:16777216];(nwr["amenity"="pharmacy"](${around});nwr["healthcare"="pharmacy"](${around}););out center tags;`
}

export function normalizePublicPhone(value: unknown): Pharmacy['phone'] {
  const label = text(value, 60).split(';')[0].trim()
  if (!/^(?:\+?\d|\(\d{2,3}\))[\d ().-]{5,28}\d$/.test(label)) return null
  const digits = label.replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) return null
  return { label, href: `tel:${label.startsWith('+') ? '+' : ''}${digits}` }
}

export function normalizePharmacies(payload: unknown, origin: Coordinates, radius: PharmacyRadius): Pharmacy[] {
  validateCoordinates(origin)
  const data = record(payload)
  if (!data || !Array.isArray(data.elements) || data.remark) throw new PharmacyError('invalid-response', 'O serviço de mapas não concluiu a consulta. Tente novamente mais tarde.')
  const pharmacies: Pharmacy[] = []
  const ids = new Set<string>()
  for (const raw of data.elements) {
    const item = record(raw)
    const tags = record(item?.tags)
    if (!item || !tags || (tags.amenity !== 'pharmacy' && tags.healthcare !== 'pharmacy')) continue
    if (!['node', 'way', 'relation'].includes(String(item.type)) || !Number.isSafeInteger(item.id) || Number(item.id) < 1) continue
    const center = record(item.center)
    const latitude = item.type === 'node' ? item.lat : center?.lat
    const longitude = item.type === 'node' ? item.lon : center?.lon
    if (typeof latitude !== 'number' || typeof longitude !== 'number') continue
    const point = { latitude, longitude }
    try { validateCoordinates(point) } catch { continue }
    const distance = distanceMeters(origin, point)
    if (distance > radius) continue
    const id = `${item.type}/${item.id}`
    if (ids.has(id)) continue
    ids.add(id)
    const street = [text(tags['addr:street']), text(tags['addr:housenumber'], 30)].filter(Boolean).join(', ')
    const address = [street || text(tags['addr:full']), text(tags['addr:suburb']), text(tags['addr:city']), text(tags['addr:state'], 40), text(tags['addr:postcode'], 12)].filter(Boolean).join(' · ')
    pharmacies.push({ provider: 'osm', id, ...point, name: text(tags.name) || text(tags.brand) || 'Farmácia sem nome no mapa', address: address || null,
      phone: normalizePublicPhone(tags['contact:phone']) || normalizePublicPhone(tags.phone), openingHours: text(tags.opening_hours, 300) || null,
      distanceMeters: distance, osmUrl: `https://www.openstreetmap.org/${id}` })
  }
  return pharmacies.sort((a, b) => a.distanceMeters - b.distanceMeters || a.name.localeCompare(b.name, 'pt-BR'))
}

export function normalizePlaces(payload: unknown): PlaceOption[] {
  const data = record(payload)
  if (!data || !Array.isArray(data.features)) throw new PharmacyError('invalid-response', 'O serviço de localização retornou uma resposta inválida.')
  const places: PlaceOption[] = []
  for (const raw of data.features) {
    const item = record(raw); const geometry = record(item?.geometry); const props = record(item?.properties)
    if (!geometry || !props || geometry.type !== 'Point' || !Array.isArray(geometry.coordinates) || text(props.countrycode).toUpperCase() !== 'BR') continue
    const [longitude, latitude] = geometry.coordinates
    if (typeof latitude !== 'number' || typeof longitude !== 'number') continue
    try { validateCoordinates({ latitude, longitude }) } catch { continue }
    const parts = [text(props.name), text(props.district), text(props.city), text(props.state)].filter(Boolean)
    const label = [...new Set(parts)].join(' · ')
    if (!label) continue
    const id = `${latitude}:${longitude}:${label}`
    if (!places.some(place => place.id === id)) places.push({ id, label, ...approximateCoordinates({ latitude, longitude }) })
  }
  return places.slice(0, 5)
}

function abortError() { return new DOMException('Consulta cancelada.', 'AbortError') }

async function requestJson(url: string, signal: AbortSignal, service: string, init: RequestInit = {}): Promise<unknown> {
  if (signal.aborted) throw abortError()
  const now = Date.now()
  if ((nextRequest.get(service) || 0) > now) throw new PharmacyError('unavailable', 'Aguarde alguns instantes antes de tentar novamente. Você também pode consultar a região no Google Maps.')
  nextRequest.set(service, now + 1000)
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  let timedOut = false
  const timeout = setTimeout(() => { timedOut = true; controller.abort() }, REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...init, headers: { Accept: 'application/json', ...init.headers }, signal: controller.signal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'strict-origin' })
    if (!response.ok) {
      if (response.status === 429 || response.status === 406 || response.status === 503) nextRequest.set(service, Date.now() + 30000)
      throw new PharmacyError('unavailable', 'A busca está indisponível ou ocupada. Aguarde 30 segundos ou use “Ver região no Google Maps”.')
    }
    return await response.json()
  } catch (error) {
    if (signal.aborted) throw abortError()
    if (timedOut) throw new PharmacyError('timeout', 'A consulta demorou mais que o esperado. Tente novamente ou use “Ver região no Google Maps”.')
    if (error instanceof PharmacyError) throw error
    throw new PharmacyError('network', 'Não foi possível consultar as farmácias. Confira sua conexão ou use “Ver região no Google Maps”.')
  } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort) }
}

export async function searchPlaces(input: string, signal: AbortSignal): Promise<PlaceOption[]> {
  if (signal.aborted) throw abortError()
  const query = normalizeLocationQuery(input)
  const key = `places:${query.value.toLocaleLowerCase('pt-BR')}`
  const cached = readCache<PlaceOption[]>(key)
  if (cached) return cached
  let placeQuery = query.value
  if (query.kind === 'cep') {
    const data = record(await requestJson(`https://viacep.com.br/ws/${query.value}/json/`, signal, 'viacep'))
    if (!data || data.erro || !text(data.localidade) || !/^[A-Z]{2}$/.test(text(data.uf))) throw new PharmacyError('not-found', 'CEP não encontrado. Tente buscar pela cidade e pelo estado.')
    // Deliberately discard street, number and CEP before contacting the geocoder.
    placeQuery = [text(data.bairro), text(data.localidade), text(data.uf)].filter(Boolean).join(', ')
  }
  const url = new URL(PHOTON_URL, typeof window === 'undefined' ? 'https://medcontrol.invalid' : window.location.origin)
  url.searchParams.set('q', placeQuery)
  url.searchParams.set('countrycode', 'BR')
  url.searchParams.set('limit', '5')
  for (const layer of ['city', 'district', 'locality']) url.searchParams.append('layer', layer)
  const results = normalizePlaces(await requestJson(url.toString(), signal, 'photon'))
  if (signal.aborted) throw abortError()
  writeCache(key, results)
  return results
}

export async function searchPharmacies(point: Coordinates, radius: PharmacyRadius, signal: AbortSignal): Promise<Pharmacy[]> {
  if (signal.aborted) throw abortError()
  const origin = approximateCoordinates(point)
  const query = buildOverpassQuery(origin, radius)
  const key = `pharmacies:${origin.latitude}:${origin.longitude}:${radius}`
  const cached = readCache<Pharmacy[]>(key)
  if (cached) return cached
  const payload = await requestJson(OVERPASS_URL, signal, 'overpass', { method: 'POST', body: new URLSearchParams({ data: query }) })
  const results = normalizePharmacies(payload, origin, radius)
  if (signal.aborted) throw abortError()
  writeCache(key, results)
  return results
}

export function googleDirectionsUrl(destination: Coordinates): string {
  validateCoordinates(destination)
  // Origin is chosen in Maps; neither the user's position nor a medication is embedded.
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${destination.latitude},${destination.longitude}`)}`
}

export function wazeDirectionsUrl(destination: Coordinates): string {
  validateCoordinates(destination)
  const url = new URL('https://waze.com/ul')
  url.searchParams.set('ll', `${destination.latitude},${destination.longitude}`)
  url.searchParams.set('navigate', 'yes')
  return url.toString()
}

export function googleSearchUrl(point: Coordinates | null, place = ''): string {
  if (point) {
    const origin = approximateCoordinates(point)
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`farmácias perto de ${origin.latitude},${origin.longitude}`)}`
  }
  const region = place ? normalizeLocationQuery(place).value : 'perto de mim'
  const query = `farmácias ${region}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function geolocationErrorMessage(code: number): string {
  if (code === 1) return 'A localização não foi autorizada. Você pode permitir no navegador ou buscar por cidade, bairro ou CEP.'
  if (code === 3) return 'O aparelho demorou para localizar você. Tente novamente ou busque por cidade, bairro ou CEP.'
  return 'Não foi possível obter sua localização. Confira o sinal do aparelho ou busque por cidade, bairro ou CEP.'
}
