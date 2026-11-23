import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowUpRight, Clock3, ExternalLink, LocateFixed, Map, MapPin, Navigation, Phone, Search, ShieldCheck, X } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { useMedications } from '../contexts/MedicationContext'
import { getStockStatus } from '../utils/calculations'
import { deviceLocation, DEVICE_LOCATION_OPTIONS, clearPharmacyCache, externalSearchUrls, formatDistance, geolocationErrorMessage, googleDirectionsUrl, normalizeLocationQuery, osmEmbedUrl, PharmacyError, searchPharmacies, searchPlaces, type Coordinates, type Pharmacy, type PharmacyRadius, type PlaceOption } from '../lib/pharmacies'

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
  const [status, setStatus] = useState('Escolha como deseja encontrar farmácias.')
  const [showMap, setShowMap] = useState(false)
  const request = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const resultsHeading = useRef<HTMLHeadingElement>(null)

  useEffect(() => () => { generation.current += 1; request.current?.abort(); clearPharmacyCache() }, [])

  const begin = (kind: NonNullable<typeof pending>) => {
    request.current?.abort()
    generation.current += 1
    const controller = new AbortController()
    request.current = controller
    setPending(kind); setError(''); setPlaces([]); setShowMap(false)
    return { controller, id: generation.current }
  }

  const reportError = (cause: unknown) => {
    if (cause instanceof DOMException && cause.name === 'AbortError') return
    setError(cause instanceof PharmacyError ? cause.message : 'Não foi possível concluir a busca. Tente novamente ou abra um dos mapas abaixo.')
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
      setStatus(`${results.length} ${results.length === 1 ? 'farmácia encontrada' : 'farmácias encontradas'} no OpenStreetMap.`)
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
        void loadPharmacies({ ...approximate, source: 'device', label: 'Localização aproximada do aparelho' }, radius)
      } catch (cause) { reportError(cause); setStatus('Localização não obtida. Nenhuma busca de farmácias foi enviada.'); setPending(null) }
    }, cause => {
      if (generation.current !== id) return
      setError(geolocationErrorMessage(cause.code)); setStatus('Localização não obtida. A busca manual continua disponível.'); setPending(null)
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
      setStatus(results.length ? 'Confira os locais encontrados e escolha um para buscar farmácias.' : 'Local não encontrado. Tente cidade e estado ou outro bairro.')
      if (!results.length) setError('Não encontramos esse local. Tente “Campinas, SP” ou um bairro com a cidade e o estado.')
    } catch (cause) { if (generation.current === id) reportError(cause) }
    finally { if (generation.current === id) setPending(null) }
  }

  const removeLocation = () => {
    generation.current += 1; request.current?.abort(); request.current = null
    clearPharmacyCache(); setPending(null); setLocation(null); setPlaces([]); setPharmacies([]); setSearched(false); setShowMap(false); setQuery(''); setFallbackPlace(''); setError('')
    setStatus('Busca cancelada e localização removida desta página. Você pode fazer uma nova busca.')
  }

  const changeRadius = (value: PharmacyRadius) => {
    setRadius(value)
    if (location) void loadPharmacies(location, value)
  }

  const external = externalSearchUrls(location, fallbackPlace)
  const searchDisabled = !!pending
  return <div className="pharmacy-page">
    <Header title="Farmácias próximas" subtitle="Encontre um lugar para consultar a reposição dos seus medicamentos." />

    <section className="panel pharmacy-google-shortcut" aria-label="Buscar no Google Maps">
      <div><h2>Encontre farmácias no Google Maps</h2><p>Abra o mapa para ver farmácias, telefones e trajetos. A busca é gratuita e abre em outra aba ou no aplicativo.</p></div>
      <a className="btn" href={external.google} target="_blank" rel="noopener noreferrer"><MapPin size={20} aria-hidden="true" />Abrir Google Maps<ExternalLink size={17} aria-hidden="true" /></a>
      <p className="muted">O Google recebe somente a região escolhida. Sem uma região, o próprio Maps pode pedir sua localização. Seus medicamentos não são enviados.</p>
    </section>

    {lowStock.length > 0 && <aside className="pharmacy-stock-alert notice" aria-label="Lembrete de reposição">
      <AlertTriangle size={23} aria-hidden="true" />
      <div><strong>{lowStock.length === 1 ? 'Um medicamento precisa de reposição' : `${lowStock.length} medicamentos precisam de reposição`}</strong>
        <p>Confira sua lista antes de sair. Os nomes dos medicamentos ficam no MEDControl e não são enviados aos mapas.</p>
        <Link className="text-link" to="/medicamentos">Conferir meu estoque <ArrowUpRight size={17} aria-hidden="true" /></Link>
      </div>
    </aside>}

    <div className="pharmacy-layout">
      <section className="panel pharmacy-search-panel" aria-labelledby="pharmacy-search-title">
        <h2 id="pharmacy-search-title"><MapPin size={22} aria-hidden="true" /> Buscar sem sair desta página</h2>
        <p className="muted">Encontre farmácias pelo mapa público OpenStreetMap. Escolha uma região para ver a lista.</p>
        <div className="pharmacy-privacy" id="pharmacy-privacy-note">
          <ShieldCheck size={21} aria-hidden="true" />
          <p>Para encontrar farmácias, enviamos sua região aproximada ou o local informado a um serviço de mapas. O MEDControl não salva sua localização na conta nem envia seus medicamentos.</p>
        </div>
        <details className="pharmacy-privacy-details"><summary>Como usamos sua localização</summary><p>A localização do aparelho é arredondada para um ponto aproximado antes de ser enviada ao OpenStreetMap via Overpass Dresel. O Overpass Dresel pode guardar a consulta e o IP por até 14 dias. Cidade ou bairro digitados são enviados ao Photon/Komoot; CEP é consultado no ViaCEP e indica apenas uma região. Não informe seu endereço residencial nem dados de saúde.</p><p>Você pode cancelar ou remover a localização desta página. Isso não apaga consultas já recebidas pelos serviços nem muda a permissão do navegador. Os links das políticas estão no final da página.</p></details>
        <button type="button" className="btn" onClick={locate} disabled={searchDisabled} aria-describedby="pharmacy-privacy-note"><LocateFixed size={19} aria-hidden="true" />{pending === 'location' ? 'Localizando…' : error && !location ? 'Tentar minha localização novamente' : 'Usar minha localização'}</button>
        <form className="pharmacy-search-form" onSubmit={submitPlace}>
          <label htmlFor="pharmacy-place">Ou busque por cidade, bairro ou CEP</label>
          <div className="pharmacy-input-row"><input id="pharmacy-place" value={query} maxLength={120} onChange={event => setQuery(event.target.value)} placeholder="Ex.: Campinas, SP ou 13010-111" autoComplete="off" aria-describedby="pharmacy-place-hint pharmacy-privacy-note" required disabled={!!pending} />
            <button className="btn secondary" type="submit" disabled={searchDisabled}><Search size={18} aria-hidden="true" />Buscar local</button>
          </div>
          <p id="pharmacy-place-hint" className="muted">Para bairro, inclua cidade e estado. O CEP indica uma região aproximada.</p>
        </form>
        <fieldset className="pharmacy-radius" disabled={searchDisabled}>
          <legend>Distância da busca</legend>
          {([2000, 5000, 10000] as const).map(value => <label key={value}><input type="radio" name="pharmacy-radius" value={value} checked={radius === value} onChange={() => changeRadius(value)} />{value / 1000} km</label>)}
        </fieldset>
        <div className="pharmacy-status" role="status" aria-live="polite"><p>{status}</p></div>
        {error && <div className="notice error" role="alert">{error}</div>}
        {pending && <div className="pharmacy-actions"><button type="button" className="btn secondary" onClick={removeLocation}><X size={18} aria-hidden="true" />Cancelar busca</button></div>}
        {places.length > 0 && <div className="pharmacy-place-options"><h3>Escolha o local da busca</h3><ul>{places.map(place => <li key={place.id}><button type="button" className="pharmacy-place-option btn secondary" onClick={() => void loadPharmacies({ ...place, source: 'manual' }, radius)}><MapPin size={18} aria-hidden="true" /><span>{place.label}</span><ArrowUpRight size={18} aria-hidden="true" /></button></li>)}</ul></div>}
      </section>

      <section className="pharmacy-results" aria-labelledby="pharmacy-results-title" aria-busy={pending === 'pharmacies'}>
        <div className="pharmacy-results-header"><div><h2 id="pharmacy-results-title" ref={resultsHeading} tabIndex={-1}>{searched ? `${pharmacies.length} ${pharmacies.length === 1 ? 'farmácia' : 'farmácias'} · OpenStreetMap` : 'Sua busca começa por aqui'}</h2>
          <p className="muted">Confirme com o estabelecimento o medicamento, o preço e o atendimento antes de ir. O mapa não informa estoque nem participação no SUS ou Farmácia Popular.</p></div></div>
        {location && <div className="panel pharmacy-location"><div><strong><MapPin size={18} aria-hidden="true" />{location.label}</strong><p>Raio de {radius / 1000} km · distâncias em linha reta a partir do ponto aproximado, sem cálculo de trajeto.</p>
          {location.source === 'manual' && <p>A referência é o centro do local escolhido, não a sua posição.</p>}
          {location.source === 'device' && Number.isFinite(location.accuracy) && <p>Precisão informada pelo aparelho: cerca de {Math.max(1, Math.round(location.accuracy!))} m. O ponto enviado ao mapa é arredondado.</p>}
          </div><button className="btn secondary" type="button" onClick={removeLocation}><X size={17} aria-hidden="true" />Remover localização</button></div>}
        {!location && !pending && <div className="panel pharmacy-empty"><MapPin size={38} aria-hidden="true" /><h3>Escolha uma região para começar</h3><p>Você pode usar a localização do aparelho ou buscar manualmente. Nenhum mapa é carregado antes da sua escolha.</p></div>}
        {searched && !pharmacies.length && <div className="panel pharmacy-empty"><Search size={34} aria-hidden="true" /><h3>Não encontramos farmácias neste raio</h3><p>Amplie para 5 ou 10 km, escolha outro bairro ou consulte os mapas abaixo. A base pública pode não ter todos os estabelecimentos da região.</p>{radius < 10000 && <button className="btn secondary" type="button" onClick={() => changeRadius(radius === 2000 ? 5000 : 10000)}>Buscar em até {radius === 2000 ? 5 : 10} km</button>}</div>}
        {pharmacies.length > 0 && <ol className="pharmacy-list">{pharmacies.map((pharmacy, index) => <li key={pharmacy.id}><article className="panel pharmacy-card">
          <div className="pharmacy-card-heading"><div><span className="muted">{index + 1}. OpenStreetMap</span><h3>{pharmacy.name}</h3></div><span className="pharmacy-distance"><MapPin size={16} aria-hidden="true" />≈ {formatDistance(pharmacy.distanceMeters)}</span></div>
          <p className="pharmacy-address">{pharmacy.address || 'Endereço não informado. Confira no mapa ou por telefone.'}</p>
          {pharmacy.phone && <p className="pharmacy-contact"><Phone size={17} aria-hidden="true" /><a className="text-link" href={pharmacy.phone.href}>Ligar: {pharmacy.phone.label}</a></p>}
          {pharmacy.openingHours && <p className="pharmacy-hours"><Clock3 size={17} aria-hidden="true" /><span>Horário cadastrado no OSM: <span lang="en">{pharmacy.openingHours}</span>. Confirme por telefone.</span></p>}
          <div className="pharmacy-card-actions"><a className="btn" href={googleDirectionsUrl(pharmacy)} target="_blank" rel="noopener noreferrer"><Navigation size={17} aria-hidden="true" />Ver trajeto no Google Maps<ExternalLink size={14} aria-hidden="true" /></a><a className="btn secondary" href={pharmacy.osmUrl} target="_blank" rel="noopener noreferrer">Ver no OpenStreetMap<ExternalLink size={14} aria-hidden="true" /></a></div>
        </article></li>)}</ol>}
        {location && <div className="pharmacy-map"><button className="btn secondary" type="button" onClick={() => setShowMap(!showMap)} aria-expanded={showMap} aria-controls="pharmacy-map-content"><Map size={19} aria-hidden="true" />{showMap ? 'Ocultar mapa da região' : 'Mostrar mapa da região'}</button>
          {showMap && <div id="pharmacy-map-content"><p className="muted">Mapa de referência da região; o marcador indica o centro da busca. As farmácias estão na lista acima. Ao abrir, o OpenStreetMap recebe esse ponto aproximado.</p><iframe title="Mapa da região escolhida para buscar farmácias" src={osmEmbedUrl(location, radius)} loading="lazy" referrerPolicy="no-referrer" width="100%" height="320" /></div>}
        </div>}
        <aside className="panel pharmacy-external-links"><h3>Continuar a busca em outro mapa</h3><p>Se os resultados não aparecerem, você também pode buscar diretamente. Os links abrem um serviço externo, que recebe somente a região de busca.</p><div className="pharmacy-actions"><a className="text-link" href={external.google} target="_blank" rel="noopener noreferrer">Buscar farmácias no Google Maps<ExternalLink size={15} aria-hidden="true" /></a><a className="text-link" href={external.osm} target="_blank" rel="noopener noreferrer">{location ? 'Abrir a região no OpenStreetMap' : 'Buscar local no OpenStreetMap'}<ExternalLink size={15} aria-hidden="true" /></a></div></aside>
      </section>
    </div>
    <footer className="pharmacy-sources"><p><Link className="text-link" to="/privacidade">Privacidade do MEDControl</Link> · <Link className="text-link" to="/termos">Termos de uso</Link></p><p>Fonte da lista: <strong>OpenStreetMap</strong>. Os botões Google Maps abrem a busca ou o trajeto no serviço externo.</p><p>Dados colaborativos © <a className="text-link" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">colaboradores do OpenStreetMap</a> (ODbL). Consulta de farmácias: <a className="text-link" href="https://ovp.dresel.systems/impressum.html" target="_blank" rel="noopener noreferrer">Overpass Dresel e sua política de privacidade</a>. Busca de locais: <a className="text-link" href="https://photon.komoot.io/" target="_blank" rel="noopener noreferrer">Photon/Komoot</a>. CEP: <a className="text-link" href="https://viacep.com.br/" target="_blank" rel="noopener noreferrer">ViaCEP</a>.</p><p>Cadastros podem estar incompletos ou desatualizados. As distâncias são estimativas e não confirmam estoque, preço, horário atual ou disponibilidade de serviços.</p></footer>
  </div>
}
