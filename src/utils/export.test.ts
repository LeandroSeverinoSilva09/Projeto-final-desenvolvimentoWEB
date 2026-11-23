import { afterEach, describe, expect, it, vi } from 'vitest'
import { csvCell, exportHistory } from './export'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('CSV export treats user-entered text as literal spreadsheet cells', () => {
  it.each(['=1+1', '+1+1', '-1+1', '@SUM(A1)', '\t=1+1', '\r=1+1', '\n=1+1', '  =1+1', ' \t@SUM(A1)'])(
    'neutralizes a formula or control prefix in %j', value => {
      expect(csvCell(value)).toBe(`"'${value}"`)
    },
  )

  it('preserves Portuguese text, delimiters, quotes and multiline instructions as one quoted cell', () => {
    expect(csvCell('Ácido fólico; "dose"\nObservação')).toBe('"Ácido fólico; ""dose""\nObservação"')
    expect(csvCell('  Medicamento')).toBe('"  Medicamento"')
    expect(csvCell('')).toBe('""')
  })

  it('exports a UTF-8 CSV with protected user fields and releases the download URL', async () => {
    vi.useFakeTimers()
    let downloaded: Blob | undefined
    const createObjectURL = vi.fn((blob: Blob) => { downloaded = blob; return 'blob:medcontrol-history' })
    const revokeObjectURL = vi.fn()
    const anchor = { href: '', download: '', click: vi.fn() }
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    vi.stubGlobal('document', { createElement: vi.fn().mockReturnValue(anchor) })
    exportHistory([{ id: 'dose-safe', medicationId: 'med-safe', name: '  =1+1', dose: 'Dose; "prescrita"',
      date: '23/11/2026', time: '08:05', scheduleTime: '08:00', timestamp: 1 }])
    expect(anchor.click).toHaveBeenCalledOnce()
    expect(anchor.href).toBe('blob:medcontrol-history')
    expect(anchor.download).toMatch(/^medcontrol-historico-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(downloaded!.type).toBe('text/csv;charset=utf-8')
    expect(Array.from(new Uint8Array(await downloaded!.arrayBuffer()).slice(0, 3))).toEqual([239, 187, 191])
    const text = await downloaded!.text()
    expect(text).toContain('"Horário agendado";"Horário confirmado"\r\n')
    expect(text).toContain('"23/11/2026";"\'  =1+1";"Dose; ""prescrita""";"08:00";"08:05"')
    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:medcontrol-history')
  })
})
