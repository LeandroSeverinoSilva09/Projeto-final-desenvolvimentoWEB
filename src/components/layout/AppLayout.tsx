import { BrandMark } from '../common/BrandMark'
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { Activity, CalendarDays, CircleHelp, Heart, History, LayoutDashboard, LogOut, MapPin, Pill, Settings, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useMedications } from '../../contexts/MedicationContext'
import { ToastContainer } from '../common/Toast'
import { errorMessage } from '../../lib/supabase'
const navigation = [{ to: '/', label: 'Minha rotina', icon: LayoutDashboard }, { to: '/medicamentos', label: 'Medicamentos', icon: Pill }, { to: '/status', label: 'Acompanhamento', icon: Activity }, { to: '/historico', label: 'Histórico', icon: History }]
const mobileNavigation = [navigation[0], navigation[1], { to: '/farmacias', label: 'Farmácias', icon: MapPin }, navigation[3]]
export function AppLayout() {
  const { pathname } = useLocation()
  const main = useRef<HTMLElement>(null)
  useEffect(() => {
    const title = ({ '/': 'Minha rotina', '/medicamentos': 'Meus remédios', '/adicionar': 'Adicionar medicamento', '/status': 'Acompanhamento', '/historico': 'Histórico', '/farmacias': 'Farmácias próximas', '/configuracoes': 'Configurações', '/ajuda': 'Como usar' } as Record<string,string>)[pathname] || 'Editar medicamento'
    document.title = `${title} | MEDControl`
    main.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0 })
  }, [pathname])
  const { user, isDemo, logout } = useAuth()
  const { dataError, loading, refresh, addToast } = useMedications()
  const exit = async () => { try { await logout() } catch(e) { addToast('error', errorMessage(e)) } }
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Ir para o conteúdo</a>
    <aside className="sidebar"><Link className="brand" to="/"><span className="brand-symbol"><BrandMark size={29}/></span><span>MED<span className="brand-light">Control</span></span></Link>
      <p className="sidebar-intro">Cada cuidado conta.</p>
      <nav aria-label="Navegação principal">{navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}><Icon size={21}/><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-help"><div className="heart-icon"><Heart size={24}/></div><h3>Uma rotina mais leve</h3><p>Pequenos lembretes.<br/>Mais autonomia no seu dia.</p><Link to="/configuracoes">Conheça os lembretes <span>↗</span></Link></div>
      <div className="sidebar-bottom"><NavLink to="/farmacias" className="sidebar-link"><MapPin size={20}/>Farmácias próximas</NavLink><NavLink to="/configuracoes" className="sidebar-link"><Settings size={20}/>Configurações</NavLink><button className="sidebar-link" onClick={exit}><LogOut size={20}/>{isDemo ? 'Sair da demonstração' : 'Sair da conta'}</button><div className="sidebar-signature"><ShieldCheck size={15}/> Cuidado acessível a todos</div></div>
    </aside>
    <div className="workspace"><header className="topbar"><Link to="/" className="brand mobile-brand"><span className="brand-symbol"><BrandMark size={28}/></span><span>MED<span className="brand-light">Control</span></span></Link><div className="topbar-project"><span className="status-dot"/> Seu espaço de cuidado</div><div className="topbar-actions"><Link className="help-link" to="/ajuda"><CircleHelp size={18}/>Como usar</Link><span className="topbar-date"><CalendarDays size={17}/>{new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</span><Link className="avatar" to="/configuracoes" aria-label={`Ver minha conta (${user?.name.slice(0, 2).toUpperCase()})`}><span aria-hidden="true">{user?.name.slice(0, 2).toUpperCase()}</span></Link></div></header>
      {isDemo && <section className="demo-banner" aria-label="Modo demonstração"><span className="demo-desktop-label"><strong>Modo demonstração</strong> Dados fictícios para conhecer o projeto.</span><span className="demo-mobile-label"><strong>Demonstração</strong> · Dados fictícios</span><button onClick={exit}><span className="demo-desktop-label">Entrar na minha conta</span><span className="demo-mobile-label">Entrar</span> <span aria-hidden="true">↗</span></button></section>}
      <main ref={main} tabIndex={-1} id="main-content" className="main-content">{dataError && <div role="alert" className="notice error mb-6"><strong>Não foi possível carregar seus dados.</strong><p>{dataError}</p><button className="text-link mt-2" onClick={refresh}>Tentar novamente</button></div>}{loading && <div className="sync-status" role="status">Atualizando seus registros…</div>}<Outlet/></main>
      <footer className="app-footer"><span>MEDControl <span className="footer-dot">•</span> Tecnologia a serviço do cuidado</span><span><Link className="text-link" to="/privacidade">Privacidade</Link> · <Link className="text-link" to="/termos">Condições de uso</Link></span></footer>
    </div>
    <nav className="mobile-nav" aria-label="Navegação no celular">{mobileNavigation.map(({ to, label, icon: Icon }) => <NavLink end={to === '/'} key={to} to={to}><Icon size={21}/><span>{label === 'Acompanhamento' ? 'Progresso' : label === 'Medicamentos' ? 'Remédios' : label === 'Minha rotina' ? 'Rotina' : label}</span></NavLink>)}<NavLink to="/configuracoes"><Settings size={21}/><span>Ajustes</span></NavLink></nav>
    <ToastContainer/>
  </div>
}
