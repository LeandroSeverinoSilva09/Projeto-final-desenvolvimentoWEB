import { motion } from 'framer-motion'
import { Bell, CheckCircle2, LogIn, Package } from 'lucide-react'
import { useState } from 'react'
import { useMedications } from '../contexts/MedicationContext'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { MedIcon3D } from '../components/medication/MedIcon3D'

const features = [
  { icon: Bell, text: 'Lembra você de tomar cada remédio no horário' },
  { icon: Package, text: 'Avisa quando o estoque está acabando' },
  { icon: CheckCircle2, text: 'Acompanha sua adesão ao tratamento' },
]

export function Login() {
  const { login } = useMedications()
  const [name, setName] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'Informe seu nome para continuar'

    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    login(name.trim())
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-blue-50 via-white to-slate-100 p-5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <MedIcon3D type="pill" size="xl" alt="MEDControl" />
          <h1 className="mt-4 text-2xl font-bold text-slate-800">MEDControl</h1>
          <p className="mt-2 text-base text-slate-500">
            Seu lembrete de medicamentos no celular
          </p>
        </div>

        <ul className="mb-6 space-y-3">
          {features.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm text-slate-600">
              <div className="mt-0.5 rounded-lg bg-primary-50 p-1.5 text-primary-600">
                <Icon size={16} />
              </div>
              {text}
            </li>
          ))}
        </ul>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Como podemos te chamar?"
            placeholder="Maria Silva"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            autoComplete="name"
          />
          <Button type="submit" fullWidth className="!py-4 !text-lg">
            <LogIn size={20} />
            Entrar
          </Button>
        </form>
      </motion.div>
    </div>
  )
}
