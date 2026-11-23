#!/usr/bin/env node
/** Build a small, attributed snapshot from Anvisa's official open dataset. */
import { createHash } from 'node:crypto'
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const SOURCE_URL = 'https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_MEDICAMENTOS.csv'
const DOCUMENTATION_URL = 'https://www.gov.br/anvisa/pt-br/assuntos/fiscalizacao-e-monitoramento/farmacovigilancia/relatorios-periodicos-de-avaliacao-beneficio-risco-rpbr-1'
const DICTIONARY_URL = 'https://dados.anvisa.gov.br/dados/Documentacao_e_Dicionario_de_Dados_Registros_Validos_Medicamento_V1.pdf'
const outputPath = fileURLToPath(new URL('../public/data/medications.json', import.meta.url))
const requiredColumns = ['TIPO_PRODUTO', 'NOME_PRODUTO', 'PRINCIPIO_ATIVO', 'NUMERO_REGISTRO_PRODUTO', 'EMPRESA_DETENTORA_REGISTRO', 'SITUACAO_REGISTRO']

/** Semicolon CSV, including escaped quotes, CRLF and quoted newlines. */
export function* parseCsv(text) {
  let row = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++ }
      else if (quoted || field === '') quoted = !quoted
      else throw new Error('Aspas inesperadas no CSV da Anvisa.')
    } else if (!quoted && (char === ';' || char === '\n' || char === '\r')) {
      row.push(field); field = ''
      if (char !== ';') {
        if (char === '\r' && text[i + 1] === '\n') i++
        if (row.some(value => value !== '')) yield row
        row = []
      }
    } else field += char
  }
  if (quoted) throw new Error('Campo sem fechamento no CSV da Anvisa.')
  if (field || row.length) { row.push(field); yield row }
}

const clean = value => value.trim().replace(/\s+/gu, ' ')
const validText = (value, max) => value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f\ufffd]/u.test(value)

export function buildCatalog(bytes, lastModified = null, generatedAt = new Date().toISOString()) {
  let text
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch { text = new TextDecoder('windows-1252').decode(bytes) }
  const iterator = parseCsv(text.replace(/^\uFEFF/u, ''))
  const headers = iterator.next().value
  if (!headers || requiredColumns.some(name => !headers.includes(name))) throw new Error('Colunas obrigatórias ausentes no CSV da Anvisa; catálogo anterior preservado.')
  const columns = Object.fromEntries(requiredColumns.map(name => [name, headers.indexOf(name)]))
  const records = new Map()
  let inputRows = 0, activeRows = 0, excludedIncompleteRows = 0, duplicatesRemoved = 0
  for (const row of iterator) {
    inputRows++
    if (row.length !== headers.length) throw new Error(`Linha ${inputRows + 1} tem número inesperado de colunas.`)
    const get = name => clean(row[columns[name]])
    if (get('TIPO_PRODUTO') !== 'MEDICAMENTO' || get('SITUACAO_REGISTRO') !== 'Ativo') continue
    activeRows++
    const record = [get('NOME_PRODUTO'), get('PRINCIPIO_ATIVO'), get('EMPRESA_DETENTORA_REGISTRO').replace(/^\d{14}\s*-\s*/u, ''), get('NUMERO_REGISTRO_PRODUTO')]
    if (!validText(record[0], 100) || !validText(record[1], 1000) || !validText(record[2], 200) || !/^\d{9}$/u.test(record[3])) {
      excludedIncompleteRows++
      continue
    }
    const previous = records.get(record[3])
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(record)) throw new Error(`Dados conflitantes para o registro ${record[3]}; revisão manual necessária.`)
      duplicatesRemoved++
    } else records.set(record[3], record)
  }
  const medications = [...records.values()].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[3].localeCompare(b[3], 'en'))
  // Refuse empty/truncated responses instead of replacing a working snapshot.
  if (medications.length < 1000) throw new Error('Menos de 1.000 registros encontrados; catálogo anterior preservado para revisão.')
  const modifiedDate = lastModified ? new Date(lastModified) : null
  if (modifiedDate && !Number.isFinite(modifiedDate.getTime())) throw new Error('Data Last-Modified inválida.')
  return {
    schemaVersion: 1,
    source: { name: 'Anvisa — Medicamentos Registrados no Brasil', url: SOURCE_URL, documentationUrl: DOCUMENTATION_URL, dictionaryUrl: DICTIONARY_URL },
    generatedAt,
    sourceLastModified: modifiedDate?.toISOString() ?? null,
    sourceSha256: createHash('sha256').update(bytes).digest('hex'),
    filters: { productType: 'MEDICAMENTO', registrationStatus: 'Ativo', requiredFields: ['name', 'activeIngredient', 'registrationHolder', 'registration'] },
    counts: { inputRows, activeRows, excludedIncompleteRows, duplicatesRemoved, included: medications.length },
    // Tuple order avoids repeating object keys in ~10k records.
    fields: ['name', 'activeIngredient', 'registrationHolder', 'registration'],
    medications,
  }
}

async function main() {
  const args = process.argv.slice(2)
  let input, lastModified
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) input = args[++i]
    else if (args[i] === '--last-modified' && args[i + 1]) lastModified = args[++i]
    else throw new Error('Uso: node scripts/update-drug-catalog.mjs [--input arquivo.csv] [--last-modified data-HTTP]')
  }
  let bytes
  if (input) bytes = await readFile(resolve(input))
  else {
    const response = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(120000), redirect: 'error' })
    if (!response.ok) throw new Error(`Download oficial falhou: HTTP ${response.status}.`)
    const length = Number(response.headers.get('content-length'))
    if (length > 100_000_000) throw new Error('CSV oficial maior que o limite de 100 MB.')
    bytes = new Uint8Array(await response.arrayBuffer())
    lastModified = response.headers.get('last-modified') ?? undefined
  }
  if (bytes.byteLength > 100_000_000) throw new Error('CSV maior que o limite de 100 MB.')
  const catalog = buildCatalog(bytes, lastModified)
  await mkdir(new URL('../public/data/', import.meta.url), { recursive: true })
  const temporaryPath = `${outputPath}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(catalog)}\n`, 'utf8')
  await rename(temporaryPath, outputPath)
  console.log(`Catálogo Anvisa: ${catalog.counts.included} registros em ${outputPath}. SHA-256 da fonte: ${catalog.sourceSha256}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
