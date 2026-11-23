import { BellRing, Download, Heart, MapPin, MonitorSmartphone, LogOut, ShieldCheck, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useMedications } from '../contexts/MedicationContext'
import { NotificationPanel } from '../components/common/NotificationPanel'
import { Header } from '../components/layout/Header'
import { exportHistory } from '../utils/export'
import { errorMessage } from '../lib/supabase'
export function Settings() {
  const { user, isDemo, logout } = useAuth()
  const [leaving, setLeaving] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const leave = async () => {
    setLeaving(true); setLogoutError('')
    try { await logout() } catch (error) { setLogoutError(errorMessage(error)) }
    finally { setLeaving(false) }
  }
  const { history } = useMedications()
  const [large, setLarge] = useState(() => localStorage.getItem('medcontrol_large_text') === 'true')
  const toggle = () => { const next = !large; setLarge(next); document.documentElement.classList.toggle('large-text', next); localStorage.setItem('medcontrol_large_text', String(next)) }
  return <><Header title="Seu espaço de cuidado" subtitle="Personalize sua experiência e entenda como seus dados são usados."/><div className="settings-grid"><div className="space-y-6"><section className="panel settings-panel"><div className="settings-title"><UserRound size={22}/><h2>Minha conta</h2></div><dl><div><dt>Nome</dt><dd>{user?.name}</dd></div><div><dt>E-mail</dt><dd>{user?.email}</dd></div><div><dt>Ambiente</dt><dd>{isDemo ? 'Demonstração com dados fictícios' : 'Conta pessoal no Supabase'}</dd></div></dl><button className="btn secondary mt-5" type="button" disabled={leaving} onClick={() => void leave()}><LogOut size={18} aria-hidden="true"/>{leaving ? 'Saindo…' : isDemo ? 'Sair da demonstração' : 'Sair da conta'}</button>{logoutError && <p className="notice error" role="alert">{logoutError}</p>}</section><section className="panel settings-panel"><div className="settings-title"><MonitorSmartphone size={22}/><h2>Acessibilidade</h2></div><div className="setting-row"><div><h3>Texto ampliado</h3><p>Uma leitura mais confortável em todo o aplicativo.</p></div><button className={`toggle ${large ? 'on' : ''}`} role="switch" aria-checked={large} aria-label="Texto ampliado" onClick={toggle}><span/></button></div><div className="install-info"><strong>Leve o MEDControl com você</strong><p>No Android, use a opção “Instalar aplicativo” do navegador. No iPhone, abra no Safari e escolha Compartilhar → Adicionar à Tela de Início.</p></div></section><section className="panel settings-panel"><div className="settings-title"><ShieldCheck size={22}/><h2>Privacidade e seus registros</h2></div><p className="muted">Seus registros são associados à sua conta. Outros usuários não têm acesso aos seus medicamentos. Na demonstração, os dados ficam apenas nesta aba.</p><p className="muted mt-3">Não vendemos dados nem exigimos informações como CPF ou endereço. Evite inserir dados de terceiros nas observações.</p><button disabled={!history.length} className="btn secondary mt-5" onClick={() => exportHistory(history)}><Download size={17}/>Baixar meu histórico</button><p className="field-help mt-4">Para exclusão da conta e dos registros, procure o responsável pelo projeto. Esta versão acadêmica ainda não oferece exclusão automática.</p></section></div><div className="space-y-6"><Link to="/farmacias" className="panel settings-pharmacy-link"><MapPin size={24}/><div><h2>Farmácias próximas</h2><p>Busque com sua localização ou por cidade.</p></div><span aria-hidden="true">↗</span></Link><section className="panel settings-panel"><div className="settings-title"><BellRing size={22}/><h2>Notificações</h2></div><NotificationPanel detailed/></section><section className="care-note"><Heart size={24}/><h3>Tecnologia com propósito social</h3><p>O MEDControl é um projeto acadêmico para apoiar pessoas que precisam organizar medicamentos de uso contínuo, com atenção à autonomia e à facilidade de uso.</p><p className="mt-3">Ele complementa sua rotina e não substitui a prescrição nem o acompanhamento de um profissional de saúde.</p></section></div></div></>
}
