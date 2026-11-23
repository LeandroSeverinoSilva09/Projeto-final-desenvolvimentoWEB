import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Check, LoaderCircle, Search } from 'lucide-react'
import { DRUG_CATALOG_DOCUMENTATION_URL, loadDrugCatalog, MAX_DRUG_QUERY_LENGTH, MIN_DRUG_QUERY_LENGTH, normalizeDrugText, searchDrugCatalog } from '../../lib/drugCatalog'
import type { DrugCatalog, DrugCatalogEntry, DrugSearchResult } from '../../lib/drugCatalog'

interface MedicationSearchProps {
  onSelect: (name: string) => void
  currentValue?: string
}

const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(value))

/** Can be nested inside the medication form: never renders a nested <form>. */
export function MedicationSearch({ onSelect, currentValue }: MedicationSearchProps) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'results' | 'error'>('idle')
  const [catalog, setCatalog] = useState<DrugCatalog | null>(null)
  const [result, setResult] = useState<DrugSearchResult>({ items: [], total: 0 })
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<DrugCatalogEntry | null>(null)
  const request = useRef(0)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current++ } }, [])

  const search = async () => {
    const term = query.trim()
    const currentRequest = ++request.current
    setSelected(null)
    if (normalizeDrugText(term).length < MIN_DRUG_QUERY_LENGTH) {
      setStatus('idle'); setResult({ items: [], total: 0 }); setMessage('Digite pelo menos 2 letras do nome ou do princípio ativo.'); return
    }
    setStatus('loading'); setMessage('Carregando o catálogo da Anvisa…')
    try {
      const data = catalog ?? await loadDrugCatalog()
      if (!mounted.current || request.current !== currentRequest) return
      setCatalog(data); setResult(searchDrugCatalog(data, term)); setStatus('results'); setMessage('')
    } catch {
      if (!mounted.current || request.current !== currentRequest) return
      setStatus('error'); setResult({ items: [], total: 0 }); setMessage('Não foi possível abrir o catálogo. Tente buscar novamente ou preencha o nome manualmente abaixo.')
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); if (status !== 'loading') void search() }
  }
  const choose = (entry: DrugCatalogEntry) => {
    onSelect(entry.name)
    setSelected(entry)
    setResult({ items: [], total: 0 })
    setStatus('idle')
    setMessage('')
  }
  const hasSelection = selected && (currentValue === undefined || selected.name === currentValue)
  const showStatus = Boolean(message || status === 'results' || hasSelection)
  const sourceDate = catalog && (catalog.sourceLastModified ?? catalog.generatedAt)

  return <section className="catalog-search" aria-labelledby={`${id}-title`}>
    <div className="catalog-heading"><Search size={20} aria-hidden="true"/><div><h3 id={`${id}-title`}>Encontrar na base da Anvisa</h3><p>Busque para conferir o nome na embalagem. Você também pode preencher manualmente abaixo.</p></div></div>
    <label className="catalog-label" htmlFor={`${id}-query`}>Nome ou princípio ativo</label>
    <div className="catalog-controls"><input id={`${id}-query`} className="catalog-input" type="search" autoComplete="off" maxLength={MAX_DRUG_QUERY_LENGTH} value={query} placeholder="Digite o nome da embalagem" aria-describedby={`${id}-privacy ${id}-status`} onKeyDown={onKeyDown} onChange={event => { request.current++; setQuery(event.target.value); setStatus('idle'); setResult({ items: [], total: 0 }); setMessage(''); setSelected(null) }}/><button className="catalog-submit" type="button" disabled={status === 'loading'} onClick={() => void search()}>{status === 'loading' ? <LoaderCircle size={19} className="animate-spin" aria-hidden="true"/> : <Search size={19} aria-hidden="true"/>}{status === 'loading' ? 'Buscando…' : 'Buscar'}</button></div>
    <p className="catalog-privacy" id={`${id}-privacy`}>A busca acontece neste aparelho. O texto digitado não é enviado à Anvisa.</p>
    <div id={`${id}-status`} className={showStatus ? `catalog-status${status === 'error' ? ' catalog-error' : ''}` : undefined} role="status" aria-live="polite" aria-atomic="true">
      {message && <p>{message}</p>}
      {status === 'results' && <p>{result.total ? `${result.total} ${result.total === 1 ? 'registro encontrado' : 'registros encontrados'}. Confira o nome, o princípio ativo e o detentor do registro antes de escolher.${result.total > result.items.length ? ` Mostrando ${result.items.length}. Digite um nome mais completo para refinar.` : ''}` : 'Nenhum registro encontrado nesta cópia da base. Confira a escrita ou preencha o nome manualmente abaixo.'}</p>}
      {hasSelection && <p className="catalog-selected"><Check size={18} aria-hidden="true"/>Nome preenchido: {selected.name}. Informe a dose conforme a prescrição.</p>}
    </div>
    {status === 'results' && result.items.length > 0 && <ul className="catalog-results" aria-label="Medicamentos encontrados">{result.items.map(entry => <li className="catalog-result" key={entry.registration}><div className="catalog-result-info"><strong className="catalog-name">{entry.name}</strong><span className="catalog-ingredient">Princípio ativo: {entry.activeIngredient}</span><span className="catalog-holder">Detentor do registro: {entry.registrationHolder}</span><span className="catalog-registration">Registro Anvisa: {entry.registration}</span></div><button className="catalog-select" type="button" onClick={() => choose(entry)} aria-label={`Usar nome ${entry.name}, de ${entry.registrationHolder}, registro ${entry.registration}`}>Usar este nome</button></li>)}</ul>}
    <p className="catalog-source">Fonte: <a href={DRUG_CATALOG_DOCUMENTATION_URL} target="_blank" rel="noreferrer">dados abertos da Anvisa</a>. {sourceDate ? `Cópia da base de ${formatDate(sourceDate)}. ` : 'Cópia local da base pública. '}A situação do registro pode mudar; esta busca não é uma consulta em tempo real.</p>
    <p className="catalog-note">A escolha preenche somente o nome. Dose, horários e uso devem seguir a prescrição do profissional de saúde.</p>
  </section>
}
