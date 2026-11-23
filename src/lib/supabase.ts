import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = url && key && !key.startsWith('your_')
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null

export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String((error as { message?: string })?.message || error)
  if (/Invalid login credentials/i.test(message)) return 'E-mail ou senha incorretos. Verifique os dados e tente novamente.'
  if (/Email not confirmed/i.test(message)) return 'Confirme seu e-mail antes de entrar. Confira também a caixa de spam.'
  if (/email.*not authorized|email.*not allowed|Email address.*invalid/i.test(message)) return 'Este e-mail não foi aceito pelo serviço de cadastro. Confira o endereço; se persistir, o responsável pelo projeto precisa revisar o envio de e-mails.'
  if (/Error sending|SMTP|email.*delivery/i.test(message)) return 'Não foi possível enviar o e-mail de acesso. Tente novamente mais tarde ou informe o responsável pelo projeto.'
  if (/rate limit|too many requests/i.test(message)) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  if (/Failed to fetch|NetworkError|fetch failed/i.test(message)) return 'Não foi possível conectar. Verifique sua internet e tente novamente.'
  if (/schema cache|does not exist|PGRST/i.test(message)) return 'O banco de dados ainda precisa ser configurado. Consulte a etapa Supabase no README.'
  return message || 'Não foi possível concluir a ação. Tente novamente.'
}
