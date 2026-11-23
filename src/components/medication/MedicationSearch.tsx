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
      setStatus('idle'); setResult({ items: [], total: 0 }); setMessage('Escreva pelo menos 2 letras do nome que aparece na caixa.'); return
    }
    setStatus('loading'); setMessage('Procurando o nome…')
    try {
      const data = catalog ?? await loadDrugCatalog()
      if (!mounted.current || request.current !== currentRequest) return
      setCatalog(data); setResult(searchDrugCatalog(data, term)); setStatus('results'); setMessage('')
    } catch {
      if (!mounted.current || request.current !== currentRequest) return
      setStatus('error'); setResult({ items: [], total: 0 }); setMessage('Não conseguimos procurar agora. Você pode escrever o nome da caixa no cadastro.')
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
    <div className="catalog-heading"><Search size={20} aria-hidden="true"/><div><h3 id={`${id}-title`}>Procurar pelo nome da caixa</h3><p>Escreva uma parte do nome e compare as opções com sua embalagem.</p></div></div>
    <label className="catalog-label" htmlFor={`${id}-query`}>Procurar nome da caixa</label>
    <div className="catalog-controls"><input id={`${id}-query`} className="catalog-input" type="search" autoComplete="off" maxLength={MAX_DRUG_QUERY_LENGTH} value={query} placeholder="Digite o nome da embalagem" aria-describedby={`${id}-privacy ${id}-status`} onKeyDown={onKeyDown} onChange={event => { request.current++; setQuery(event.target.value); setStatus('idle'); setResult({ items: [], total: 0 }); setMessage(''); setSelected(null) }}/><button className="catalog-submit" type="button" disabled={status === 'loading'} onClick={() => void search()}>{status === 'loading' ? <LoaderCircle size={19} className="animate-spin" aria-hidden="true"/> : <Search size={19} aria-hidden="true"/>}{status === 'loading' ? 'Buscando…' : 'Buscar'}</button></div>
    <p className="catalog-privacy" id={`${id}-privacy`}>A busca acontece neste aparelho. O texto digitado não é enviado à Anvisa.</p>
    <div id={`${id}-status`} className={showStatus ? `catalog-status${status === 'error' ? ' catalog-error' : ''}` : undefined} role="status" aria-live="polite" aria-atomic="true">
      {message && <p>{message}</p>}
      {status === 'results' && <p>{result.total ? `${result.total} ${result.total === 1 ? 'opção encontrada' : 'opções encontradas'}. Confira qual nome aparece na sua caixa.${result.total > result.items.length ? ` Mostrando ${result.items.length}. Escreva mais uma parte do nome se precisar.` : ''}` : 'Não encontramos esse nome. Você pode copiá-lo da embalagem e continuar o cadastro.'}</p>}
      {hasSelection && <p className="catalog-selected"><Check size={18} aria-hidden="true"/>Nome colocado no cadastro: {selected.name}. Confira com sua caixa e acrescente o número escrito nela, como 500 mg, se houver.</p>}
    </div>
    {status === 'results' && result.items.length > 0 && <ul className="catalog-results" aria-label="Medicamentos encontrados">{result.items.map(entry => <li className="catalog-result" key={entry.registration}><div className="catalog-result-info"><strong className="catalog-name">{entry.name}</strong><span className="catalog-holder">Empresa responsável: {entry.registrationHolder}</span><details className="catalog-more"><summary>Mais informações</summary><span className="catalog-ingredient">Composição informada: {entry.activeIngredient}</span><span className="catalog-registration">Registro Anvisa: {entry.registration}</span></details></div><button className="catalog-select" type="button" onClick={() => choose(entry)} aria-label={`Usar este nome: ${entry.name}, empresa responsável ${entry.registrationHolder}`}>Usar este nome</button></li>)}</ul>}
    <details className="catalog-source"><summary>De onde vêm os nomes?</summary><p>Fonte: <a href={DRUG_CATALOG_DOCUMENTATION_URL} target="_blank" rel="noreferrer">dados abertos da Anvisa</a>. {sourceDate ? `Cópia da base de ${formatDate(sourceDate)}. ` : 'Cópia local da base pública. '}Esta busca não consulta a situação do registro em tempo real.</p></details>
    <p className="catalog-note">A busca ajuda com o nome. A quantidade e os horários serão informados nas próximas etapas, conforme a sua receita.</p>
  </section>
}
