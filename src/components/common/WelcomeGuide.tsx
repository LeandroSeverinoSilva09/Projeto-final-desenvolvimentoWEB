import { Bell, CheckCircle2, PlusCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from './Button'
import { Card } from './Card'

const steps = [
  {
    step: 1,
    icon: PlusCircle,
    title: 'Cadastre seus remédios',
    description: 'Informe nome, dose, horários e quantidade na caixa.',
  },
  {
    step: 2,
    icon: Bell,
    title: 'Receba lembretes',
    description: 'O app avisa no horário certo e quando o estoque está acabando.',
  },
  {
    step: 3,
    icon: CheckCircle2,
    title: 'Confirme que tomou',
    description: 'Toque em Já tomei para registrar e acompanhar seu tratamento.',
  },
]

export function WelcomeGuide() {
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="bg-primary-600 px-5 py-4 text-white">
        <h2 className="text-xl font-bold">Bem-vindo ao MEDControl</h2>
        <p className="mt-1 text-sm text-blue-100">Siga estes 3 passos para começar</p>
      </div>

      <div className="space-y-4 p-5">
        {steps.map(({ step, icon: Icon, title, description }) => (
          <div key={step} className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600">
              <Icon size={20} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Passo {step}
              </p>
              <h3 className="text-base font-bold text-slate-800">{title}</h3>
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            </div>
          </div>
        ))}

        <Link to="/adicionar" className="block pt-2">
          <Button fullWidth className="!py-4 !text-base">
            <PlusCircle size={20} />
            Cadastrar meu primeiro remédio
          </Button>
        </Link>
      </div>
    </Card>
  )
}
