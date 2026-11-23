import type { DoseRecord } from '../types/medication'
export function csvCell(value: string) {
  const safe = /^[\s]*[=+\-@]|^[\t\r\n]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}
export function exportHistory(records: DoseRecord[]) {
  const rows = [['Data', 'Medicamento', 'Dose', 'Horário agendado', 'Horário confirmado'], ...records.map(r => [r.date, r.name, r.dose, r.scheduleTime || '', r.time])]
  const blob = new Blob(['\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob), a = document.createElement('a')
  a.href = url; a.download = `medcontrol-historico-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
