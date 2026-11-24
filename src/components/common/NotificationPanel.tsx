import { Bell, BellOff, Check, Settings2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useNotifications } from '../../hooks/useNotifications'
export function NotificationPanel({ detailed = false }: { detailed?: boolean }) {
  const n = useNotifications()
  const granted = n.permission === 'granted' && n.enabled
  return <section className={`notification-panel ${granted ? 'enabled' : ''}`}>
    <div className="notification-icon">{granted ? <Bell size={22}/> : <BellOff size={22}/>}</div>
    <h3>{granted ? 'Lembretes autorizados' : 'Um lembrete para cuidar de você'}</h3>
    <p>{n.permission === 'unsupported' ? 'Este navegador não oferece notificações aqui. Use HTTPS e um navegador compatível. No iPhone, instale o app na tela de início.' : n.permission === 'denied' ? 'As notificações estão bloqueadas. Abra as configurações deste site no navegador e permita notificações.' : !n.enabled ? 'As notificações estão desativadas neste dispositivo. Você pode ativá-las novamente.' : n.subscribed ? 'Este dispositivo recebe lembretes cinco minutos antes e no horário, mesmo com o app fechado.' : granted && n.isDemo ? 'Toque em “Enviar teste agora” para receber um aviso na hora. Não precisa cadastrar um remédio. Com esta aba aberta, os lembretes chegam cinco minutos antes e no horário cadastrado.' : granted ? 'Com o aplicativo aberto, você pode receber um aviso cinco minutos antes e outro no horário cadastrado.' : n.isDemo ? 'Ative os avisos. Depois, toque em “Enviar teste agora” para testar na hora, sem cadastrar um remédio.' : 'Ative as notificações para receber um aviso cinco minutos antes e outro no horário dos seus medicamentos.'}</p>
    {!granted && (n.permission === 'default' || n.permission === 'granted') && <button className="btn" onClick={n.enable} disabled={n.busy}><Bell size={17}/>{n.busy ? 'Ativando…' : 'Ativar notificações'}</button>}
    {granted && <div className="flex flex-wrap gap-3"><button className="btn small secondary" disabled={n.testing || n.busy} onClick={n.test}>{n.testing ? 'Enviando teste…' : 'Enviar teste agora'}</button>{detailed && n.backgroundAvailable && !n.subscribed && <button className="btn small" disabled={n.busy} onClick={n.enable}>Ativar em segundo plano</button>}{detailed && granted && <button className="text-link" disabled={n.busy} onClick={n.disable}>Desativar notificações</button>}</div>}
    {n.testMessage && <p role="status">{n.testMessage}</p>}
    {n.error && <p role="alert" className="text-red-700 mt-3">{n.error}</p>}
    {detailed ? <div className="notification-details"><p><Check size={15}/> O teste local não verifica o envio pelo servidor nem o recebimento com o app fechado.</p><p><Check size={15}/> A permissão é uma escolha sua e pode ser revogada no navegador.</p><p><Check size={15}/> O aviso não mostra o nome do medicamento na tela bloqueada.</p>{!n.backgroundAvailable && <p><Settings2 size={15}/>{n.isDemo ? 'Na demonstração, os avisos são locais e param quando a aba é fechada.' : 'Avisos com o app fechado dependem da ativação do serviço de envio pelo responsável pelo projeto.'}</p>}</div> : <Link className="text-link mt-4 inline-block" to="/configuracoes">Gerenciar lembretes</Link>}
  </section>
}
