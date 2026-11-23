/** Public product identification only. Queries never leave the browser. */
export const DRUG_CATALOG_SOURCE_URL = 'https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_MEDICAMENTOS.csv'
export const DRUG_CATALOG_DOCUMENTATION_URL = 'https://www.gov.br/anvisa/pt-br/assuntos/fiscalizacao-e-monitoramento/farmacovigilancia/relatorios-periodicos-de-avaliacao-beneficio-risco-rpbr-1'
export const MIN_DRUG_QUERY_LENGTH = 2
export const MAX_DRUG_QUERY_LENGTH = 120

export interface DrugCatalogEntry {
  name: string
  activeIngredient: string
  registrationHolder: string
  registration: string
}

interface IndexedDrugCatalogEntry extends DrugCatalogEntry {
  normalizedName: string
  normalizedIngredient: string
}

export interface DrugCatalog {
  generatedAt: string
  sourceLastModified: string | null
  sourceSha256: string
  entries: IndexedDrugCatalogEntry[]
}

export interface DrugSearchResult {
  items: DrugCatalogEntry[]
  total: number
}

export function normalizeDrugText(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim()
}

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const validDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/u.test(value) && Number.isFinite(Date.parse(value))
const validText = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f\ufffd]/u.test(value)

/** Reject stale formats, incomplete metadata and malformed rows as a whole. */
export function parseDrugCatalog(value: unknown): DrugCatalog {
  const invalid = () => new Error('O catálogo de medicamentos está indisponível. Preencha o nome manualmente.')
  if (!isObject(value) || value.schemaVersion !== 1 || !isObject(value.source) || value.source.url !== DRUG_CATALOG_SOURCE_URL
    || !validDate(value.generatedAt) || !(value.sourceLastModified === null || validDate(value.sourceLastModified))
    || typeof value.sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(value.sourceSha256)
    || !isObject(value.filters) || value.filters.productType !== 'MEDICAMENTO' || value.filters.registrationStatus !== 'Ativo'
    || JSON.stringify(value.fields) !== JSON.stringify(['name', 'activeIngredient', 'registrationHolder', 'registration'])
    || !Array.isArray(value.medications) || !value.medications.length || value.medications.length > 100_000
    || !isObject(value.counts) || value.counts.included !== value.medications.length) throw invalid()
  const registrations = new Set<string>()
  const entries = value.medications.map((row: unknown): IndexedDrugCatalogEntry => {
    if (!Array.isArray(row) || row.length !== 4 || !validText(row[0], 100) || !validText(row[1], 1000)
      || !validText(row[2], 200) || typeof row[3] !== 'string' || !/^\d{9}$/u.test(row[3]) || registrations.has(row[3])) throw invalid()
    registrations.add(row[3])
    return { name: row[0], activeIngredient: row[1], registrationHolder: row[2], registration: row[3], normalizedName: normalizeDrugText(row[0]), normalizedIngredient: normalizeDrugText(row[1]) }
  })
  return { generatedAt: value.generatedAt, sourceLastModified: value.sourceLastModified, sourceSha256: value.sourceSha256, entries }
}

export async function fetchDrugCatalog(fetcher: typeof fetch = fetch): Promise<DrugCatalog> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    // No query, account data, cookies or referrer is sent in this static request.
    const response = await fetcher(`${import.meta.env.BASE_URL}data/medications.json`, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-cache' })
    if (!response.ok) throw new Error('Não foi possível carregar o catálogo. Tente novamente ou preencha o nome manualmente.')
    return parseDrugCatalog(await response.json())
  } finally { clearTimeout(timeout) }
}

let catalogPromise: Promise<DrugCatalog> | undefined
export function loadDrugCatalog(): Promise<DrugCatalog> {
  catalogPromise ??= fetchDrugCatalog().catch(error => { catalogPromise = undefined; throw error })
  return catalogPromise
}

/** Accent-insensitive tokens, with exact names first; no fuzzy clinical matching. */
export function searchDrugCatalog(catalog: DrugCatalog, query: string, limit = 8): DrugSearchResult {
  const normalized = normalizeDrugText(query)
  if (normalized.length < MIN_DRUG_QUERY_LENGTH || query.length > MAX_DRUG_QUERY_LENGTH) return { items: [], total: 0 }
  const tokens = normalized.split(' ')
  const matches = catalog.entries.filter(entry => tokens.every(token => `${entry.normalizedName} ${entry.normalizedIngredient}`.includes(token)))
  const rank = (entry: IndexedDrugCatalogEntry) => entry.normalizedName === normalized ? 0 : entry.normalizedName.startsWith(normalized) ? 1 : entry.normalizedName.includes(normalized) ? 2 : entry.normalizedIngredient === normalized ? 3 : 4
  matches.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'pt-BR') || a.registrationHolder.localeCompare(b.registrationHolder, 'pt-BR') || a.registration.localeCompare(b.registration))
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(50, Math.floor(limit))) : 8
  return { items: matches.slice(0, safeLimit).map(({ name, activeIngredient, registrationHolder, registration }) => ({ name, activeIngredient, registrationHolder, registration })), total: matches.length }
}
