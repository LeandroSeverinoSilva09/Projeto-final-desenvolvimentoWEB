import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, Clock3, ExternalLink, LocateFixed, MapPin, Navigation, Package, Phone, Search, X } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { useMedications } from '../contexts/MedicationContext'
import { getStockStatus } from '../utils/calculations'
import { deviceLocation, DEVICE_LOCATION_OPTIONS, clearPharmacyCache, externalSearchUrls, formatDistance, geolocationErrorMessage, googleDirectionsUrl, normalizeLocationQuery, PharmacyError, searchPharmacies, searchPlaces, wazeDirectionsUrl, type Coordinates, type Pharmacy, type PharmacyRadius, type PlaceOption } from '../lib/pharmacies'
import '../styles/pharmacies.css'

interface SelectedLocation extends Coordinates {
  label: string
  source: 'device' | 'manual'
  accuracy?: number
}

export function Pharmacies() {
  const { medications } = useMedications()
  const lowStock = medications.filter(medication => getStockStatus(medication).needsReplenish)
  const [query, setQuery] = useState('')
  const [fallbackPlace, setFallbackPlace] = useState('')
  const [radius, setRadius] = useState<PharmacyRadius>(2000)
  const [places, setPlaces] = useState<PlaceOption[]>([])
  const [location, setLocation] = useState<SelectedLocation | null>(null)
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([])
  const [searched, setSearched] = useState(false)
  const [pending, setPending] = useState<'location' | 'places' | 'pharmacies' | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Use sua localização ou informe uma cidade, bairro ou CEP.')
  const request = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const resultsHeading = useRef<HTMLHeadingElement>(null)

  useEffect(() => () => { generation.current += 1; request.current?.abort(); clearPharmacyCache() }, [])

  const begin = (kind: NonNullable<typeof pending>) => {
    request.current?.abort()
    generation.current += 1
    const controller = new AbortController()
    request.current = controller
    setPending(kind); setError(''); setPlaces([])
    return { controller, id: generation.current }
  }

  const reportError = (cause: unknown) => {
    if (cause instanceof DOMException && cause.name === 'AbortError') return
    setError(cause instanceof PharmacyError ? cause.message : 'Não foi possível concluir a busca. Tente novamente ou abra Google Maps ou Waze no início da página.')
    setStatus('Busca não concluída.')
  }

  const loadPharmacies = async (selected: SelectedLocation, selectedRadius: PharmacyRadius) => {
    const { controller, id } = begin('pharmacies')
    setLocation(selected); setPharmacies([]); setSearched(false)
    setStatus(`Buscando farmácias em até ${selectedRadius / 1000} km…`)
    try {
      const results = await searchPharmacies(selected, selectedRadius, controller.signal)
      if (generation.current !== id) return
      setPharmacies(results); setSearched(true)
      setStatus(`${results.length} ${results.length === 1 ? 'farmácia encontrada' : 'farmácias encontradas'}.`)
      requestAnimationFrame(() => { if (generation.current === id) resultsHeading.current?.focus() })
    } catch (cause) { if (generation.current === id) reportError(cause) }
    finally { if (generation.current === id) setPending(null) }
  }

  const locate = () => {
    const { id } = begin('location')
    setLocation(null); setPharmacies([]); setSearched(false); setFallbackPlace('')
    clearPharmacyCache()
    if (!window.isSecureContext || !navigator.geolocation) {
      setError('Seu navegador não oferece localização nesta página. Busque por cidade, bairro ou CEP.'); setPending(null)
      return
    }
    setStatus('Aguardando a localização do aparelho…')
    navigator.geolocation.getCurrentPosition(position => {
      if (generation.current !== id) return
      try {
        const approximate = deviceLocation(position.coords)
        void loadPharmacies({ ...approximate, source: 'device', label: 'Perto de você' }, radius)
      } catch (cause) { reportError(cause); setStatus('Localização não obtida. Nenhuma busca de farmácias foi enviada.'); setPending(null) }
    }, cause => {
      if (generation.current !== id) return
      setError(geolocationErrorMessage(cause.code)); setStatus('Localização não obtida. Você pode buscar por cidade, bairro ou CEP.'); setPending(null)
    }, DEVICE_LOCATION_OPTIONS)
  }

  const submitPlace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    let normalized: ReturnType<typeof normalizeLocationQuery>
    try { normalized = normalizeLocationQuery(query) }
    catch (cause) { reportError(cause); return }
    const { controller, id } = begin('places')
    setLocation(null); setPharmacies([]); setSearched(false)
    setFallbackPlace(normalized.kind === 'place' ? normalized.value : '')
    setStatus('Procurando a cidade ou o bairro…')
    try {
      const results = await searchPlaces(normalized.value, controller.signal)
      if (generation.current !== id) return
      setPlaces(results)
      setStatus(results.length ? 'Escolha o local para ver as farmácias próximas.' : 'Local não encontrado. Tente cidade e estado ou outro bairro.')
      if (!results.length) setError('Não encontramos esse local. Tente “Campinas, SP” ou um bairro com a cidade e o estado.')
    } catch (cause) { if (generation.current === id) reportError(cause) }
    finally { if (generation.current === id) setPending(null) }
  }

  const removeLocation = () => {
    generation.current += 1; request.current?.abort(); request.current = null
    clearPharmacyCache(); setPending(null); setLocation(null); setPlaces([]); setPharmacies([]); setSearched(false); setQuery(''); setFallbackPlace(''); setError('')
    setStatus('Localização removida. Você pode fazer uma nova busca.')
  }

  const changeRadius = (value: PharmacyRadius) => {
    setRadius(value)
    if (location) void loadPharmacies(location, value)
  }

  const external = externalSearchUrls(location, fallbackPlace)
  const searchDisabled = !!pending
  return <div className="pharmacy-page">
    <Header title="Farmácias próximas" subtitle="Encontre uma farmácia e escolha como chegar." />
    <section className="panel pharmacy-map-choice" aria-labelledby="pharmacy-map-choice-title">
      <div className="pharmacy-map-choice-heading"><span className="pharmacy-choice-icon"><MapPin size={24} aria-hidden="true" /></span><div><h2 id="pharmacy-map-choice-title">Abra o mapa que você já usa</h2><p>Veja farmácias, contatos e trajetos no Google Maps ou no Waze.</p></div></div>
      <div className="pharmacy-map-options">
        <a className="pharmacy-map-option google" href={external.google} target="_blank" rel="noopener noreferrer"><MapPin size={25} aria-hidden="true" /><span><strong>Google Maps</strong><small>Buscar farmácias</small></span><ExternalLink size={18} aria-hidden="true" /></a>
        <a className="pharmacy-map-option waze" href={external.waze} target="_blank" rel="noopener noreferrer"><Navigation size={25} aria-hidden="true" /><span><strong>Waze</strong><small>Buscar farmácias</small></span><ExternalLink size={18} aria-hidden="true" /></a>
      </div>
      <p className="pharmacy-map-hint">Abre no aplicativo ou em outra aba. Seus medicamentos não são enviados ao mapa.</p>
      {location && <p className="pharmacy-map-region">Região da busca: <strong>{location.label}</strong></p>}
    </section>

    {lowStock.length > 0 && <details className="pharmacy-restock-list"><summary><Package size={21} aria-hidden="true" /><span>O que preciso repor?</span><span className="count-badge">{lowStock.length}</span><ChevronDown size={19} aria-hidden="true" /></summary><div><p>Confira sua lista antes de sair. A disponibilidade deve ser confirmada com a farmácia.</p><ul>{lowStock.map(medication => <li key={medication.id}><strong>{medication.name}</strong><span>{medication.current.toLocaleString('pt-BR')} {medication.stockUnit || 'unidades'} no estoque</span></li>)}</ul><Link className="text-link" to="/medicamentos">Ver meus medicamentos <ArrowRight size={17} aria-hidden="true" /></Link></div></details>}

    <details className="pharmacy-in-app" onToggle={event => { if (event.target === event.currentTarget && !event.currentTarget.open) removeLocation() }}>
      <summary><Search size={22} aria-hidden="true" /><span><strong>Ver farmácias nesta página</strong><small>Busque uma região e consulte a lista aqui.</small></span><ChevronDown size={20} aria-hidden="true" /></summary>
      <div className="pharmacy-layout">
        <section className="panel pharmacy-search-panel" aria-labelledby="pharmacy-search-title">
          <h2 id="pharmacy-search-title">Onde você quer buscar?</h2>
          <p className="pharmacy-privacy" id="pharmacy-privacy-note">Sua região aproximada é enviada a um serviço de mapas para encontrar farmácias. Ela não é salva na conta. <a href="#pharmacy-sources">Saiba mais sobre a busca</a>.</p>
          <button type="button" className="btn" onClick={locate} disabled={searchDisabled} aria-describedby="pharmacy-privacy-note"><LocateFixed size={19} aria-hidden="true" />{pending === 'location' ? 'Localizando…' : 'Usar minha localização'}</button>
          <form className="pharmacy-search-form" onSubmit={submitPlace}><label htmlFor="pharmacy-place">Ou digite cidade, bairro ou CEP</label><div className="pharmacy-input-row"><input id="pharmacy-place" value={query} maxLength={120} onChange={event => setQuery(event.target.value)} placeholder="Ex.: Campinas, SP" autoComplete="off" aria-describedby="pharmacy-place-hint pharmacy-privacy-note" required disabled={!!pending} /><button className="btn secondary" type="submit" disabled={searchDisabled}><Search size={18} aria-hidden="true" />Buscar</button></div><p id="pharmacy-place-hint" className="field-help">Para um bairro, inclua a cidade e o estado.</p></form>
          <fieldset className="pharmacy-radius" disabled={searchDisabled}><legend>Buscar em até</legend>{([2000, 5000, 10000] as const).map(value => <label key={value}><input type="radio" name="pharmacy-radius" value={value} checked={radius === value} onChange={() => changeRadius(value)} />{value / 1000} km</label>)}</fieldset>
          <div className="pharmacy-status" role="status" aria-live="polite"><p>{status}</p></div>
          {error && <div className="notice error" role="alert">{error}</div>}
          {pending && <button type="button" className="btn secondary pharmacy-cancel" onClick={removeLocation}><X size={18} aria-hidden="true" />Cancelar busca</button>}
          {places.length > 0 && <div className="pharmacy-place-options"><h3>Escolha o local</h3><ul>{places.map(place => <li key={place.id}><button type="button" className="pharmacy-place-option btn secondary" onClick={() => void loadPharmacies({ ...place, source: 'manual' }, radius)}><MapPin size={18} aria-hidden="true" /><span>{place.label}</span><ArrowRight size={18} aria-hidden="true" /></button></li>)}</ul></div>}
        </section>
        <section className="pharmacy-results" aria-labelledby="pharmacy-results-title" aria-busy={pending === 'pharmacies'}>
          <div className="pharmacy-results-header"><div><h2 id="pharmacy-results-title" ref={resultsHeading} tabIndex={-1}>{searched ? `${pharmacies.length} ${pharmacies.length === 1 ? 'farmácia encontrada' : 'farmácias encontradas'}` : 'Farmácias da região'}</h2><p>Confirme disponibilidade, preço e atendimento antes de sair.</p></div></div>
          {location && <div className="pharmacy-location"><div><strong><MapPin size={17} aria-hidden="true" />{location.label}</strong><p>Até {radius / 1000} km · distância aproximada em linha reta.</p>{location.source === 'manual' && <p>As distâncias partem do centro da região escolhida.</p>}</div><button className="text-link" type="button" onClick={removeLocation}><X size={16} aria-hidden="true" />Remover localização</button></div>}
          {!location && !pending && <div className="pharmacy-empty"><MapPin size={32} aria-hidden="true" /><h3>Escolha uma região</h3><p>Use a localização do aparelho ou informe uma cidade, bairro ou CEP.</p></div>}
          {searched && !pharmacies.length && <div className="pharmacy-empty"><Search size={30} aria-hidden="true" /><h3>Nenhuma farmácia encontrada neste raio</h3><p>Tente uma distância maior ou outro bairro. Você também pode abrir Google Maps ou Waze no início da página.</p>{radius < 10000 && <button className="btn secondary" type="button" onClick={() => changeRadius(radius === 2000 ? 5000 : 10000)}>Ampliar para {radius === 2000 ? 5 : 10} km</button>}</div>}
          {pharmacies.length > 0 && <ol className="pharmacy-list">{pharmacies.map(pharmacy => <li key={pharmacy.id}><article className="panel pharmacy-card">
            <div className="pharmacy-card-heading"><h3>{pharmacy.name}</h3><span className="pharmacy-distance">≈ {formatDistance(pharmacy.distanceMeters)}</span></div>
            <p className="pharmacy-address">{pharmacy.address || 'Endereço não informado. Confira no mapa ou por telefone.'}</p>
            {pharmacy.phone && <a className="pharmacy-call text-link" href={pharmacy.phone.href} aria-label={`Ligar para ${pharmacy.name}`}><Phone size={18} aria-hidden="true" />Ligar <span>{pharmacy.phone.label}</span></a>}
            <div className="pharmacy-route-options"><p>Como chegar</p><a className="btn" href={googleDirectionsUrl(pharmacy)} target="_blank" rel="noopener noreferrer" aria-label={`Google Maps: como chegar a ${pharmacy.name}`}><Navigation size={16} aria-hidden="true" />Google Maps<ExternalLink size={14} aria-hidden="true" /></a><a className="btn secondary" href={wazeDirectionsUrl(pharmacy)} target="_blank" rel="noopener noreferrer" aria-label={`Waze: como chegar a ${pharmacy.name}`}><Navigation size={16} aria-hidden="true" />Waze<ExternalLink size={14} aria-hidden="true" /></a></div>
            {pharmacy.openingHours && <details className="pharmacy-hours-details"><summary><Clock3 size={16} aria-hidden="true" />Horário informado</summary><p lang="en">{pharmacy.openingHours}</p><p>Confirme o horário com a farmácia.</p></details>}
          </article></li>)}</ol>}
        </section>
      </div>
    </details>
    <footer className="pharmacy-sources" id="pharmacy-sources"><p>Dados da lista © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">colaboradores do OpenStreetMap</a> (ODbL).</p><details><summary>Sobre a busca e sua privacidade</summary><div><p>Google Maps e Waze são aplicativos externos. Eles recebem a região ou o destino escolhido, além dos dados técnicos da conexão, conforme suas políticas. Os nomes dos seus medicamentos não fazem parte desses links.</p><p>A lista nesta página usa dados públicos do OpenStreetMap, consultados por Overpass Dresel, e pode estar incompleta. As distâncias não são trajetos e a lista não confirma estoque, preço, horário atual ou participação na Farmácia Popular.</p><p>A localização do aparelho é aproximada antes de ser enviada. O Overpass Dresel informa retenção de consulta e IP por até 14 dias. Cidade e bairro são pesquisados em Photon/Komoot; CEP é consultado no ViaCEP. Não informe endereço residencial ou dados de saúde no campo de busca.</p><p>Remover a localização ou recolher a busca limpa os dados desta página e cancela os pedidos pendentes. Isso não apaga consultas já recebidas pelos serviços nem muda a permissão do navegador.</p><p><Link to="/privacidade">Privacidade do MEDControl</Link> · <Link to="/termos">Condições de uso</Link></p><p><a href="https://ovp.dresel.systems/impressum.html" target="_blank" rel="noopener noreferrer">Overpass Dresel</a> · <a href="https://photon.komoot.io/" target="_blank" rel="noopener noreferrer">Photon/Komoot</a> · <a href="https://viacep.com.br/" target="_blank" rel="noopener noreferrer">ViaCEP</a></p></div></details></footer>
  </div>
}
