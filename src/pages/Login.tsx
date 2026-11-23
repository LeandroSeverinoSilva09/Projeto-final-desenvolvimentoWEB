import { BrandMark } from '../components/common/BrandMark'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, BellRing, Check, Eye, EyeOff, Heart, ShieldCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, errorMessage } from '../lib/supabase'
import { Input } from '../components/common/Input'
import { Button } from '../components/common/Button'

type Mode = 'login' | 'signup' | 'reset' | 'recover'
export function Login() {
  const { startDemo, recovering, finishRecovery } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>(recovering ? 'recover' : 'login')
  useEffect(() => { if (recovering) setMode('recover') }, [recovering])
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false); const [busy, setBusy] = useState(false)
  const [error, setError] = useState(() => window.location.hash.includes('error=') ? 'Este link de acesso expirou ou não é válido. Use Esqueci minha senha para receber um novo link.' : ''); const [message, setMessage] = useState('')
  const changeMode = (next: Mode) => { setMode(next); setError(''); setMessage(''); setPassword('') }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setMessage('')
    if (!supabase) { setError('A conexão ainda não foi configurada. Você pode explorar a demonstração.'); return }
    setBusy(true)
    try {
      if (mode === 'signup') {
        if (!name.trim()) throw new Error('Informe seu nome para criar a conta.')
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: `${window.location.origin}/` } })
        if (error) throw error
        if (!data.session) setMessage('Confira seu e-mail para confirmar o cadastro. Depois, entre com sua senha.')
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/recuperar-senha` })
        if (error) throw error
        setMessage('Se houver uma conta com esse e-mail, você receberá um link para criar uma nova senha.')
      } else if (mode === 'recover') {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        finishRecovery()
        navigate('/', { replace: true })
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        navigate('/', { replace: true })
      }
    } catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false) }
  }
  const title = { login: 'Que bom ter você aqui.', signup: 'Comece a cuidar da sua rotina.', reset: 'Vamos recuperar seu acesso.', recover: 'Crie uma nova senha.' }[mode]
  return <main className="auth-page">
    <section className="auth-story">
      <a className="brand" href="/login"><span className="brand-symbol"><BrandMark size={29}/></span><span>MED<span className="brand-light">Control</span></span></a>
      <div className="auth-story-content"><span className="soft-label"><Heart size={16}/> Mais tranquilidade no seu dia</span>
        <h1>Seu cuidado.<br/>Uma dose de cada vez.</h1>
        <p>Organize seus medicamentos, acompanhe seus horários e tenha mais autonomia para cuidar de você.</p>
        <div className="medicine-art" aria-hidden="true"><div className="art-orbit"/><div className="art-box"><span className="art-cross">+</span><strong>Seu cuidado<br/>em dia.</strong><div className="art-box-line"/></div><div className="art-pill"/><div className="art-notice"><span><BellRing size={20}/></span><div><strong>Um lembrete faz a diferença</strong><small>Seu próximo cuidado, no horário.</small></div><Check size={17}/></div></div>
      </div>
      <div className="auth-caption"><ShieldCheck size={17}/> Desenvolvido para apoiar a rotina de cuidado.</div>
    </section>
    <section className="auth-form-side"><div className="auth-form-wrap">
      <span className="auth-welcome">Bem-vindo ao MEDControl</span><h2>{title}</h2>
      <p className="muted">{mode === 'login' ? 'Entre na sua conta para acompanhar seu tratamento.' : mode === 'signup' ? 'Crie sua conta gratuita. Seus registros ficam separados dos de outros usuários.' : 'Use uma senha com pelo menos 8 caracteres.'}</p>
      {(mode === 'login' || mode === 'signup') && <div className="auth-tabs"><button type="button" aria-pressed={mode === 'login'} onClick={() => changeMode('login')}>Entrar</button><button type="button" aria-pressed={mode === 'signup'} onClick={() => changeMode('signup')}>Criar conta</button></div>}
      <form onSubmit={submit} className="space-y-5">
        {mode === 'signup' && <Input label="Seu nome" autoComplete="name" required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Como podemos chamar você?"/>}
        {mode !== 'recover' && <Input label="E-mail" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@exemplo.com"/>}
        {mode !== 'reset' && <div className="password-field"><Input label={mode === 'recover' ? 'Nova senha' : 'Senha'} type={visible ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Pelo menos 8 caracteres"/><button type="button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div>}
        {mode === 'login' && <button type="button" className="text-link forgot-link" onClick={() => changeMode('reset')}>Esqueci minha senha</button>}
        {error && <div className="notice error" role="alert">{error}</div>}
        {message && <div className="notice success" role="status">{message}</div>}
        <Button fullWidth type="submit" disabled={busy}>{busy ? 'Aguarde…' : { login: 'Entrar na minha conta', signup: 'Criar minha conta', reset: 'Enviar link de recuperação', recover: 'Salvar nova senha' }[mode]}<ArrowRight size={18}/></Button>
      </form>
      {mode === 'recover' && <button className="text-link mt-5" type="button" onClick={() => { finishRecovery(); changeMode('login'); navigate('/login', { replace: true }) }}>Voltar para entrar</button>}
      {mode === 'reset' && <button className="text-link mt-5" onClick={() => changeMode('login')}>Voltar para entrar</button>}
      {mode !== 'recover' && <><div className="auth-divider"><span>Conheça antes de criar sua conta</span></div><button className="demo-button" onClick={startDemo}>Explorar demonstração <ArrowRight size={17}/></button><p className="auth-demo-note">Um ambiente com dados fictícios para conhecer o projeto.</p></>}
      <p className="auth-privacy"><ShieldCheck size={15}/> Seus dados de saúde merecem cuidado e privacidade.</p><p className="auth-privacy"><Link className="text-link" to="/privacidade">Privacidade</Link> · <Link className="text-link" to="/termos">Condições de uso</Link></p>
    </div><p className="auth-footer">Projeto acadêmico de impacto social · Acesso gratuito</p></section>
  </main>
}
