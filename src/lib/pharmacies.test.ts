import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deviceLocation, approximateCoordinates, buildOverpassQuery, distanceMeters, externalSearchUrls, formatDistance, geolocationErrorMessage, googleDirectionsUrl, normalizeLocationQuery, normalizePharmacies, normalizePlaces, normalizePublicPhone, validateCoordinates, wazeDirectionsUrl } from './pharmacies'

const origin = { latitude: -23.55, longitude: -46.633 }
const overpassFixture = { elements: [
  { type: 'node', id: 11, lat: -23.551, lon: -46.633, tags: { amenity: 'pharmacy', name: 'Farmácia Central', 'addr:street': 'Rua Pública', 'addr:housenumber': '20', 'addr:city': 'São Paulo', phone: '+55 11 3333-4444', opening_hours: 'Mo-Fr 08:00-18:00' } },
  { type: 'way', id: 12, center: { lat: -23.552, lon: -46.633 }, tags: { healthcare: 'pharmacy', name: 'Outra farmácia' } },
] }
const photonFixture = { features: [{ geometry: { type: 'Point', coordinates: [-47.0608, -22.90556] }, properties: { name: 'Campinas', city: 'Campinas', state: 'São Paulo', countrycode: 'BR' } }] }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => { vi.resetModules() })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('coordinates, distances and query boundaries', () => {
  it('rejects the zero device fix instead of searching the ocean', () => {
    expect(() => deviceLocation({ latitude: 0, longitude: 0, accuracy: 1 })).toThrow('não informou sua localização real')
    expect(() => deviceLocation({ latitude: 0.00001, longitude: -0.00001, accuracy: 1 })).toThrow('não informou sua localização real')
  })
  it.each([NaN, Infinity, -1, 2001, 50000])('rejects unusable device accuracy %s', accuracy => {
    expect(() => deviceLocation({ ...origin, accuracy })).toThrow('muito imprecisa')
  })
  it('keeps valid device fixes on the equator and rounds coordinates before sharing', () => {
    expect(deviceLocation({ latitude: 0, longitude: -51.05, accuracy: 40 })).toEqual({ latitude: 0, longitude: -51.05, accuracy: 40 })
    expect(deviceLocation({ latitude: -23.55098765, longitude: -46.63387654, accuracy: 80 })).toEqual({ latitude: -23.551, longitude: -46.634, accuracy: 80 })
  })
  it('rounds raw device coordinates before any provider query', () => {
    expect(approximateCoordinates({ latitude: -23.55098765, longitude: -46.63387654 })).toEqual({ latitude: -23.551, longitude: -46.634 })
  })
  it.each([{ latitude: NaN, longitude: 0 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: Infinity }, { latitude: 0, longitude: -181 }])('rejects invalid coordinates %j', point => {
    expect(() => validateCoordinates(point)).toThrow('localização recebida é inválida')
  })
  it('computes zero, symmetric and known Haversine distances', () => {
    expect(distanceMeters(origin, origin)).toBe(0)
    expect(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(111195.08, 1)
    expect(distanceMeters(origin, { latitude: -23.56, longitude: -46.63 })).toBeCloseTo(distanceMeters({ latitude: -23.56, longitude: -46.63 }, origin), 7)
  })
  it('stays finite for opposite points on Earth', () => {
    expect(distanceMeters({ latitude: 90, longitude: 0 }, { latitude: -90, longitude: 180 })).toBeCloseTo(20015114.44, 1)
  })
  it('builds bounded pharmacy-only queries for nodes, ways and relations', () => {
    const query = buildOverpassQuery({ latitude: -23.550987, longitude: -46.633876 }, 5000)
    expect(query).toContain('nwr["amenity"="pharmacy"](around:5000,-23.551,-46.634)')
    expect(query).toContain('nwr["healthcare"="pharmacy"]')
    expect(query).toContain('[timeout:20]')
    expect(query).not.toContain('-23.550987')
    expect(() => buildOverpassQuery(origin, 500 as 2000)).toThrow('raio de 2, 5 ou 10')
  })
  it('formats distances in Brazilian Portuguese', () => {
    expect(formatDistance(246)).toBe('250 m')
    expect(formatDistance(1250)).toBe('1,3 km')
  })
  it('accepts city/bairro input and normalizes only valid CEP formats', () => {
    expect(normalizeLocationQuery('  Cambuí,   Campinas, SP  ')).toEqual({ kind: 'place', value: 'Cambuí, Campinas, SP' })
    expect(normalizeLocationQuery('01001-000')).toEqual({ kind: 'cep', value: '01001000' })
  })
  it.each(['SP', '123', '123456789', '01001A00', 'Rua Pública, 20', '<script>alert(1)</script>', 'x'.repeat(121)])('rejects short, malformed or residential-number input %s', input => {
    expect(() => normalizeLocationQuery(input)).toThrow('Digite cidade e estado')
  })
})

describe('untrusted public map payloads', () => {
  it('normalizes pharmacy nodes and polygon centers, addresses and raw opening hours', () => {
    const results = normalizePharmacies(overpassFixture, origin, 2000)
    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({ id: 'node/11', name: 'Farmácia Central', address: 'Rua Pública, 20 · São Paulo', phone: { href: 'tel:+551133334444' }, openingHours: 'Mo-Fr 08:00-18:00', osmUrl: 'https://www.openstreetmap.org/node/11' })
    expect(results[0].distanceMeters).toBeLessThan(results[1].distanceMeters)
  })
  it('filters unrelated, invalid, duplicated and out-of-radius elements', () => {
    const results = normalizePharmacies({ elements: [...overpassFixture.elements, overpassFixture.elements[0],
      { type: 'node', id: 13, lat: -22, lon: -46, tags: { amenity: 'pharmacy' } },
      { type: 'node', id: 14, lat: -23.55, lon: -46.633, tags: { amenity: 'hospital' } },
      { type: 'node', id: 15, lat: 91, lon: 0, tags: { amenity: 'pharmacy' } },
      { type: 'way', id: 16, tags: { amenity: 'pharmacy' } },
      { type: 'malicious', id: 17, lat: -23.55, lon: -46.633, tags: { amenity: 'pharmacy' } },
      { type: 'node', id: '18/path', lat: -23.55, lon: -46.633, tags: { amenity: 'pharmacy' } },
    ] }, origin, 2000)
    expect(results.map(result => result.id)).toEqual(['node/11', 'way/12'])
  })
  it('keeps valid unnamed pharmacies without inventing address or contact', () => {
    expect(normalizePharmacies({ elements: [{ type: 'node', id: 1, lat: -23.55, lon: -46.633, tags: { amenity: 'pharmacy', phone: 'javascript:alert(1)' } }] }, origin, 2000)[0]).toMatchObject({ name: 'Farmácia sem nome no mapa', phone: null, address: null, openingHours: null })
  })
  it('does not turn an API timeout or malformed payload into zero pharmacies', () => {
    expect(() => normalizePharmacies({ elements: [], remark: 'runtime error: Query timed out' }, origin, 2000)).toThrow('não concluiu')
    expect(() => normalizePharmacies({}, origin, 2000)).toThrow('não concluiu')
  })
  it('accepts telephone numbers only and drops extra contacts', () => {
    expect(normalizePublicPhone('0800 123 4567; +55 11 99999-9999')?.href).toBe('tel:08001234567')
    expect(normalizePublicPhone('+55 (11) 3333-4444')?.href).toBe('tel:+551133334444')
    expect(normalizePublicPhone('(11) 3333-4444')?.href).toBe('tel:1133334444')
    expect(normalizePublicPhone('tel:1234')).toBeNull()
    expect(normalizePublicPhone('1234#1234')).toBeNull()
    expect(normalizePublicPhone('https://example.org')).toBeNull()
  })
  it('accepts only valid Brazilian place points and deduplicates labels', () => {
    expect(normalizePlaces({ features: [...photonFixture.features, ...photonFixture.features,
      { geometry: { type: 'Point', coordinates: [-47, -23] }, properties: { name: 'Wrong country', countrycode: 'US' } },
      { geometry: { type: 'Point', coordinates: [NaN, -23] }, properties: { name: 'Invalid', countrycode: 'BR' } },
    ] })).toEqual([{ id: '-22.90556:-47.0608:Campinas · São Paulo', label: 'Campinas · São Paulo', latitude: -22.906, longitude: -47.061 }])
  })
})

describe('links and geolocation recovery', () => {
  it('routes Google Maps only to the pharmacy without user origin or medical data', () => {
    const url = new URL(googleDirectionsUrl(origin))
    expect(url.origin).toBe('https://www.google.com')
    expect(url.pathname).toBe('/maps/dir/')
    expect(url.searchParams.get('destination')).toBe('-23.55,-46.633')
    expect(url.searchParams.has('origin')).toBe(false)
    expect([...url.searchParams.keys()]).toEqual(['api', 'destination'])
  })
  it('navigates Waze only to a known pharmacy using its HTTPS app-or-browser link', () => {
    const url = new URL(wazeDirectionsUrl(origin))
    expect(url.origin).toBe('https://waze.com')
    expect(url.pathname).toBe('/ul')
    expect(url.searchParams.get('ll')).toBe('-23.55,-46.633')
    expect(url.searchParams.get('navigate')).toBe('yes')
    expect([...url.searchParams.keys()]).toEqual(['ll', 'navigate'])
  })
  it('encodes manual locations in safe external links', () => {
    const urls = externalSearchUrls(null, 'Cambuí, Campinas, SP')
    expect(new URL(urls.google).searchParams.get('query')).toBe('farmácias Cambuí, Campinas, SP')
    const waze = new URL(urls.waze)
    expect(waze.origin).toBe('https://waze.com')
    expect(waze.searchParams.get('q')).toBe('farmácias Cambuí, Campinas, SP')
    expect([...waze.searchParams.keys()]).toEqual(['q'])
  })
  it('offers nearby searches before any location is shared with the app', () => {
    const urls = externalSearchUrls(null)
    expect(new URL(urls.google).searchParams.get('query')).toBe('farmácias perto de mim')
    const waze = new URL(urls.waze)
    expect(waze.searchParams.get('q')).toBe('farmácias perto de mim')
    expect([...waze.searchParams.keys()]).toEqual(['q'])
  })
  it('uses an approximate region as a Waze search reference without navigating to the region center', () => {
    const urls = externalSearchUrls({ latitude: -23.55098765, longitude: -46.63387654 })
    expect(new URL(urls.google).searchParams.get('query')).toBe('farmácias perto de -23.551,-46.634')
    const waze = new URL(urls.waze)
    expect(waze.searchParams.get('q')).toBe('farmácias')
    expect(waze.searchParams.get('ll')).toBe('-23.551,-46.634')
    expect([...waze.searchParams.keys()]).toEqual(['q', 'll'])
  })
  it('rejects malformed places and coordinates before producing external links', () => {
    expect(() => externalSearchUrls(null, 'Campinas&navigate=yes')).toThrow('Digite cidade')
    expect(() => externalSearchUrls({ latitude: NaN, longitude: 0 })).toThrow('localização recebida é inválida')
    expect(() => googleDirectionsUrl({ latitude: 0, longitude: 181 })).toThrow('localização recebida é inválida')
    expect(() => wazeDirectionsUrl({ latitude: 91, longitude: 0 })).toThrow('localização recebida é inválida')
  })
  it('offers a manual alternative for denied, timeout and unavailable positions', () => {
    expect(geolocationErrorMessage(1)).toContain('não foi autorizada')
    expect(geolocationErrorMessage(3)).toContain('demorou')
    expect(geolocationErrorMessage(2)).toContain('cidade, bairro ou CEP')
  })
})

describe('network privacy, cancellation and failures', () => {
  it('posts only an approximate pharmacy query without credentials and caches it in memory', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(overpassFixture))
    vi.stubGlobal('fetch', fetchMock)
    const lib = await import('./pharmacies')
    const signal = new AbortController().signal
    await lib.searchPharmacies({ latitude: -23.55001, longitude: -46.63302 }, 2000, signal)
    await lib.searchPharmacies(origin, 2000, signal)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://ovp.dresel.systems/api-sa/interpreter')
    expect(options).toMatchObject({ method: 'POST', credentials: 'omit', cache: 'no-store', referrerPolicy: 'strict-origin' })
    expect(options.body.get('data')).toBe(buildOverpassQuery(origin, 2000))
  })
  it('removes cached coordinates and results on explicit clearing', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json(overpassFixture)))
    vi.stubGlobal('fetch', fetchMock)
    const lib = await import('./pharmacies')
    await lib.searchPharmacies(origin, 2000, new AbortController().signal)
    lib.clearPharmacyCache()
    await vi.advanceTimersByTimeAsync(1001)
    await lib.searchPharmacies(origin, 2000, new AbortController().signal)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('uses ViaCEP only to derive bairro/city/state, without passing street or CEP to Photon', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ cep: '01001-000', logradouro: 'Praça da Sé', localidade: 'São Paulo', bairro: 'Sé', uf: 'SP' })).mockResolvedValueOnce(json(photonFixture))
    vi.stubGlobal('fetch', fetchMock)
    const { searchPlaces } = await import('./pharmacies')
    await searchPlaces('01001-000', new AbortController().signal)
    expect(fetchMock.mock.calls[0][0]).toBe('https://viacep.com.br/ws/01001000/json/')
    const photonUrl = new URL(fetchMock.mock.calls[1][0])
    expect(photonUrl.searchParams.get('q')).toBe('Sé, São Paulo, SP')
    expect(photonUrl.searchParams.get('countrycode')).toBe('BR')
    expect(photonUrl.searchParams.getAll('layer')).toEqual(['city', 'district', 'locality'])
    expect(photonUrl.toString()).not.toContain('01001')
    expect(photonUrl.toString()).not.toContain('Pra%C3%A7a')
  })
  it('handles a missing CEP and never sends it to the geocoder', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ erro: true }))
    vi.stubGlobal('fetch', fetchMock)
    const { searchPlaces } = await import('./pharmacies')
    await expect(searchPlaces('99999999', new AbortController().signal)).rejects.toThrow('CEP não encontrado')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('validates input before a network request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { searchPlaces } = await import('./pharmacies')
    await expect(searchPlaces('123', new AbortController().signal)).rejects.toThrow('Digite cidade')
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('does not fetch after cancellation', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { searchPharmacies } = await import('./pharmacies')
    const controller = new AbortController(); controller.abort()
    await expect(searchPharmacies(origin, 2000, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('aborts a pending request and reports timeout separately', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => { init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))) })))
    const { searchPharmacies } = await import('./pharmacies')
    const pending = searchPharmacies(origin, 2000, new AbortController().signal)
    const expected = expect(pending).rejects.toMatchObject({ code: 'timeout' })
    await vi.advanceTimersByTimeAsync(25001)
    await expected
  })
  it('propagates user cancellation to fetch', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => { init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))) })))
    const { searchPharmacies } = await import('./pharmacies')
    const controller = new AbortController()
    const pending = searchPharmacies(origin, 2000, controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
  it('pauses after a service rate limit instead of retrying immediately', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}, 429))
    vi.stubGlobal('fetch', fetchMock)
    const { searchPharmacies } = await import('./pharmacies')
    await expect(searchPharmacies(origin, 2000, new AbortController().signal)).rejects.toThrow('Aguarde 30 segundos')
    await expect(searchPharmacies(origin, 5000, new AbortController().signal)).rejects.toThrow('Aguarde alguns instantes')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
