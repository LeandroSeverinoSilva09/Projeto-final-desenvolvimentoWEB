import { Component, type ReactNode } from 'react'
import { MapPin, RotateCcw } from 'lucide-react'

/** Keep the app navigation available if a pharmacy rendering error escapes. */
export class PharmacyErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error) { console.error('Falha ao exibir a busca de farmácias.', error) }
  render() {
    if (!this.state.failed) return this.props.children
    return <section className="panel empty-state pharmacy-recovery" role="alert">
      <MapPin size={32} aria-hidden="true"/><h1>Vamos tentar buscar novamente?</h1>
      <p>Não conseguimos mostrar esta busca. Você pode tentar de novo ou abrir o mapa que já usa.</p>
      <button type="button" className="btn" onClick={() => this.setState({ failed: false })}><RotateCcw size={19} aria-hidden="true"/>Tentar novamente</button>
      <a className="text-link" href="https://www.google.com/maps/search/?api=1&query=farmacias%20perto%20de%20mim" target="_blank" rel="noopener noreferrer">Abrir Google Maps</a>
    </section>
  }
}
