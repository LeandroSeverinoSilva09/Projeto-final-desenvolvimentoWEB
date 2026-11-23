import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { from: mocks.from } }))
import { fetchTreatment } from './medications'

type Row = Record<string, string | number | string[] | null>
const uuid = (index: number) => `00000000-0000-0000-0000-${index.toString(16).padStart(12, '0')}`
const dose = (index: number): Row => ({
  id: uuid(index), medication_id: uuid(1), name: 'Exemplo', dose: '1 unidade',
  scheduled_date: '2026-11-23', schedule_time: '08:00',
  // More than one API page shares each timestamp; retain microseconds too.
  taken_at: `2026-11-23T08:00:00.${String(Math.floor(index / 1200)).padStart(6, '0')}+00:00`,
})
const medication = (index: number): Row => ({
  id: uuid(index), name: `Exemplo ${index}`, dose: '1 unidade', current: 10, total: 10,
  schedules: ['08:00'], units_per_dose: 1, stock_unit: 'unidades',
  created_at: '2026-11-23T08:00:00.123456+00:00', instructions: '', color: 'teal', archived_at: null,
})

function mockApi(medications: Row[], records: Row[], cap = 1000, failDosePage?: number) {
  const requests: { table: string; limit: number; filter?: string }[] = []
  let dosePages = 0
  mocks.from.mockImplementation((table: string) => {
    const ordering: { column: string; ascending: boolean }[] = []
    let limit = Infinity
    let filter: string | undefined
    let activeOnly = false
    const query = {
      select: () => query,
      order: (column: string, options: { ascending: boolean }) => { ordering.push({ column, ascending: options.ascending }); return query },
      limit: (value: number) => { limit = value; return query },
      is: (column: string, value: null) => { expect([column, value]).toEqual(['archived_at', null]); activeOnly = true; return query },
      or: (value: string) => { filter = value; return query },
      returns: async () => {
        requests.push({ table, limit, filter })
        if (table === 'dose_records' && ++dosePages === failDosePage) return { data: null, error: new Error('Falha na página seguinte') }
        let rows = (table === 'medications' ? medications : records).filter(row => !activeOnly || row.archived_at === null)
        if (filter) {
          const parts = /^(created_at|taken_at)\.(lt|gt)\."([^"]+)",and\(\1\.eq\."\3",id\.\2\.([^,()]+)\)$/.exec(filter)
          if (!parts) throw new Error(`Cursor inválido: ${filter}`)
          const [, column, comparison, timestamp, id] = parts
          rows = rows.filter(row => {
            const time = String(row[column])
            return comparison === 'lt'
              ? time < timestamp || time === timestamp && String(row.id) < id
              : time > timestamp || time === timestamp && String(row.id) > id
          })
        }
        rows.sort((a, b) => {
          for (const { column, ascending } of ordering) {
            const left = String(a[column]), right = String(b[column])
            const comparison = left < right ? -1 : left > right ? 1 : 0
            if (comparison) return ascending ? comparison : -comparison
          }
          return 0
        })
        return { data: rows.slice(0, Math.min(limit, cap)), error: null }
      },
    }
    return query
  })
  return requests
}

beforeEach(() => { vi.clearAllMocks() })

describe('paginação do tratamento', () => {
  it('carrega os 5000 registros mais recentes apesar do limite remoto de 1000 e empates de timestamp', async () => {
    const records = Array.from({ length: 5501 }, (_, index) => dose(index + 1))
    const requests = mockApi([], records)
    const result = await fetchTreatment()
    expect(result.history.map(record => record.id)).toEqual(Array.from({ length: 5000 }, (_, index) => uuid(5501 - index)))
    expect(new Set(result.history.map(record => record.id)).size).toBe(5000)
    expect(requests.filter(request => request.table === 'dose_records')).toHaveLength(5)
    expect(requests.some(request => request.filter?.includes('.000003+00:00'))).toBe(true)
  })

  it('continua após páginas curtas e retorna todos os registros disponíveis', async () => {
    const requests = mockApi([], Array.from({ length: 731 }, (_, index) => dose(index + 1)), 250)
    const result = await fetchTreatment()
    expect(result.history.map(record => record.id)).toEqual(Array.from({ length: 731 }, (_, index) => uuid(731 - index)))
    expect(requests.filter(request => request.table === 'dose_records')).toHaveLength(4)
  })

  it('pagina medicamentos ativos com timestamp empatado e mantém ordem estável', async () => {
    const rows = Array.from({ length: 1101 }, (_, index) => medication(index + 1))
    rows[500].archived_at = '2026-11-23T09:00:00+00:00'
    mockApi(rows.reverse(), [])
    const result = await fetchTreatment()
    expect(result.medications.map(item => item.id)).toEqual(Array.from({ length: 1101 }, (_, index) => uuid(index + 1)).filter(id => id !== uuid(501)))
    expect(result.history).toEqual([])
  })

  it('não apresenta histórico incompleto como sucesso quando uma página falha', async () => {
    mockApi([], Array.from({ length: 1200 }, (_, index) => dose(index + 1)), 1000, 2)
    await expect(fetchTreatment()).rejects.toThrow('Falha na página seguinte')
  })
})
