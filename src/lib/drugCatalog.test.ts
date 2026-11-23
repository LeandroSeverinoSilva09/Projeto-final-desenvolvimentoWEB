import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DRUG_CATALOG_SOURCE_URL, fetchDrugCatalog, loadDrugCatalog, normalizeDrugText, parseDrugCatalog, searchDrugCatalog } from './drugCatalog'

const fixture = () => ({
  schemaVersion: 1,
  source: { url: DRUG_CATALOG_SOURCE_URL },
  generatedAt: '2026-11-23T15:00:00.000Z',
  sourceLastModified: '2026-11-23T14:54:37.000Z',
  sourceSha256: 'a'.repeat(64),
  filters: { productType: 'MEDICAMENTO', registrationStatus: 'Ativo' },
  counts: { included: 4 },
  fields: ['name', 'activeIngredient', 'registrationHolder', 'registration'],
  // Artificial records exercise search ordering without making clinical claims.
  medications: [
    ['MARCA TESTE', 'ácido de teste', 'Empresa B', '100000001'],
    ['ÁCIDO DE TESTE', 'ácido de teste', 'Empresa A', '100000002'],
    ['ÁCIDO DE TESTE COMPOSTO', 'ácido de teste, composto', 'Empresa C', '100000003'],
    ['OUTRO EXEMPLO', 'outra substância', 'Empresa D', '100000004'],
  ],
})

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('Anvisa catalog validation', () => {
  it('loads the shipped snapshot with verifiable official provenance and unique registrations', () => {
    const data = JSON.parse(readFileSync(new URL('../../public/data/medications.json', import.meta.url), 'utf8'))
    const catalog = parseDrugCatalog(data)
    expect(catalog.entries.length).toBeGreaterThan(1000)
    expect(catalog.entries).toHaveLength(data.counts.included)
    expect(new Set(catalog.entries.map(entry => entry.registration)).size).toBe(catalog.entries.length)
    expect(data.counts.activeRows).toBe(data.counts.included + data.counts.excludedIncompleteRows + data.counts.duplicatesRemoved)
    expect(catalog.entries.some(entry => normalizeDrugText(entry.name) === 'paracetamol')).toBe(true)
    expect(catalog.entries.some(entry => normalizeDrugText(entry.activeIngredient).includes('dipirona'))).toBe(true)
  })

  it.each([
    ['unknown source', (data: ReturnType<typeof fixture>) => { data.source.url = 'https://untrusted.example/catalog' }],
    ['inactive filter', (data: ReturnType<typeof fixture>) => { data.filters.registrationStatus = 'Inativo' }],
    ['invalid date', (data: ReturnType<typeof fixture>) => { data.generatedAt = 'unknown' }],
    ['missing ingredient', (data: ReturnType<typeof fixture>) => { data.medications[0][1] = '' }],
    ['invalid registration', (data: ReturnType<typeof fixture>) => { data.medications[0][3] = '123' }],
    ['duplicate registration', (data: ReturnType<typeof fixture>) => { data.medications[1][3] = data.medications[0][3] }],
    ['incomplete download', (data: ReturnType<typeof fixture>) => { data.counts.included = 5 }],
    ['unrecognized schema', (data: ReturnType<typeof fixture>) => { data.schemaVersion = 2 }],
  ])('rejects %s rather than showing unreliable product data', (_label, mutate) => {
    const data = fixture(); mutate(data)
    expect(() => parseDrugCatalog(data)).toThrow('Preencha o nome manualmente')
  })
})

describe('local medication search', () => {
  const catalog = parseDrugCatalog(fixture())

  it('matches accent-insensitive tokens across names and ingredients, ranking exact names first', () => {
    const result = searchDrugCatalog(catalog, 'acido DE teste')
    expect(result.total).toBe(3)
    expect(result.items.map(entry => entry.name)).toEqual(['ÁCIDO DE TESTE', 'ÁCIDO DE TESTE COMPOSTO', 'MARCA TESTE'])
    expect(searchDrugCatalog(catalog, 'marca ácido').items[0].name).toBe('MARCA TESTE')
  })

  it('bounds result sizes and requires a useful query', () => {
    expect(searchDrugCatalog(catalog, 'teste', 1).items).toHaveLength(1)
    expect(searchDrugCatalog(catalog, 'teste', 1).total).toBe(3)
    expect(searchDrugCatalog(catalog, 'a')).toEqual({ items: [], total: 0 })
    expect(searchDrugCatalog(catalog, ' '.repeat(4))).toEqual({ items: [], total: 0 })
    expect(searchDrugCatalog(catalog, 'a'.repeat(121))).toEqual({ items: [], total: 0 })
    expect(searchDrugCatalog(catalog, 'zzzzzz')).toEqual({ items: [], total: 0 })
  })

  it('does not expose search internals or imply a prescribed dose in selection data', () => {
    expect(Object.keys(searchDrugCatalog(catalog, 'marca').items[0]).sort()).toEqual(['activeIngredient', 'name', 'registration', 'registrationHolder'])
    expect(searchDrugCatalog(catalog, 'substancia').items[0].name).toBe('OUTRO EXEMPLO')
  })
})

describe('static catalog loading', () => {
  it('requests only the same-origin snapshot, without terms, cookies or referrer', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(fixture()), { status: 200 }))
    const catalog = await fetchDrugCatalog(fetcher)
    expect(catalog.entries).toHaveLength(4)
    expect(fetcher).toHaveBeenCalledOnce()
    const [url, options] = fetcher.mock.calls[0]
    expect(url).toBe(`${import.meta.env.BASE_URL}data/medications.json`)
    expect(options).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-cache' })
    expect(String(url)).not.toContain('?')
  })

  it('returns an actionable fallback when the static download fails', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 }))
    await expect(fetchDrugCatalog(fetcher)).rejects.toThrow('preencha o nome manualmente')
  })

  it('rejects an HTML fallback response instead of treating it as a catalog', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('<!doctype html>', { status: 200 }))
    await expect(fetchDrugCatalog(fetcher)).rejects.toThrow()
  })

  it('aborts a stalled download after 15 seconds', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new Error('download aborted')), { once: true })
    }))
    const assertion = expect(fetchDrugCatalog(fetcher)).rejects.toThrow('download aborted')
    await vi.advanceTimersByTimeAsync(15000)
    await assertion
  })

  it('allows retry after failure and shares only successful catalog loading', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(new Response(JSON.stringify(fixture()), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(loadDrugCatalog()).rejects.toThrow('offline')
    const first = loadDrugCatalog(), second = loadDrugCatalog()
    expect(first).toBe(second)
    await expect(first).resolves.toMatchObject({ entries: expect.any(Array) })
    await loadDrugCatalog()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})

describe('official CSV transformation', () => {
  // Import the standalone Node script without adding it to the browser bundle.
  const scriptPath = '../../scripts/update-drug-catalog.mjs'
  const headers = 'TIPO_PRODUTO;NOME_PRODUTO;PRINCIPIO_ATIVO;NUMERO_REGISTRO_PRODUTO;EMPRESA_DETENTORA_REGISTRO;SITUACAO_REGISTRO'
  const activeRows = Array.from({ length: 1000 }, (_, index) => `MEDICAMENTO;EXEMPLO ${index};substância exemplo;${100000000 + index};12345678000199 - EMPRESA EXEMPLO;Ativo`)

  it('parses quoted delimiters, escaped quotes and multiline fields', async () => {
    const { parseCsv } = await import(/* @vite-ignore */ scriptPath)
    expect([...parseCsv('A;B\r\n"nome; texto";"linha\n""aspas"""\r\n')]).toEqual([['A', 'B'], ['nome; texto', 'linha\n"aspas"']])
    expect(() => [...parseCsv('A;"sem fim')]).toThrow()
  })

  it('includes only complete active registrations, deduplicates and preserves source accents', async () => {
    const { buildCatalog } = await import(/* @vite-ignore */ scriptPath)
    const csv = [headers, ...activeRows, activeRows[0], 'MEDICAMENTO;INATIVO;substância;200000001;EMPRESA;Inativo', 'MEDICAMENTO;SEM REGISTRO;substância;;EMPRESA;Ativo'].join('\n')
    const result = buildCatalog(new TextEncoder().encode(csv), 'Mon, 23 Nov 2026 14:54:37 GMT', '2026-11-23T15:00:00.000Z')
    expect(result.counts).toEqual({ inputRows: 1003, activeRows: 1002, excludedIncompleteRows: 1, duplicatesRemoved: 1, included: 1000 })
    expect(result.sourceLastModified).toBe('2026-11-23T14:54:37.000Z')
    const parsed = parseDrugCatalog(result)
    expect(parsed.entries[0].activeIngredient).toBe('substância exemplo')
    expect(parsed.entries[0].registrationHolder).toBe('EMPRESA EXEMPLO')
    expect(parsed.entries.some(entry => entry.name === 'INATIVO')).toBe(false)
  })

  it('rejects truncated or conflicting data before replacing the current snapshot', async () => {
    const { buildCatalog } = await import(/* @vite-ignore */ scriptPath)
    expect(() => buildCatalog(new TextEncoder().encode([headers, activeRows[0]].join('\n')))).toThrow('catálogo anterior preservado')
    const conflicting = activeRows[0].replace('EXEMPLO 0', 'NOME ALTERADO')
    expect(() => buildCatalog(new TextEncoder().encode([headers, ...activeRows, conflicting].join('\n')))).toThrow('Dados conflitantes')
  })

  it('decodes the Windows-1252 encoding used by the official snapshot', async () => {
    const { buildCatalog } = await import(/* @vite-ignore */ scriptPath)
    const csv = [headers, ...activeRows].join('\r\n')
    const windows1252 = Uint8Array.from(csv, character => character.charCodeAt(0))
    expect(parseDrugCatalog(buildCatalog(windows1252)).entries[0].activeIngredient).toBe('substância exemplo')
  })
})
