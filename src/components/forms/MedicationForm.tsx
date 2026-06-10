import { Save } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMedications } from '../../contexts/MedicationContext'
import { Button } from '../common/Button'
import { Input } from '../common/Input'

const SCHEDULE_PRESETS = [
  { label: '1x ao dia (08:00)', value: '08:00' },
  { label: '2x ao dia (08:00, 20:00)', value: '08:00, 20:00' },
  { label: '3x ao dia (08:00, 14:00, 20:00)', value: '08:00, 14:00, 20:00' },
]

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function validateSchedules(value: string): string | null {
  if (!value.trim()) return 'Informe pelo menos um horário'
  const times = value.split(',').map((t) => t.trim())
  const invalid = times.find((t) => !TIME_PATTERN.test(t))
  if (invalid) return `Horário inválido: "${invalid}". Use o formato HH:MM`
  return null
}

export function MedicationForm() {
  const { addMedication } = useMedications()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [quantity, setQuantity] = useState('')
  const [schedules, setSchedules] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'Informe o nome do remédio'
    if (!quantity || parseInt(quantity) <= 0) {
      newErrors.quantity = 'Informe quantas unidades tem na caixa'
    }
    const scheduleError = validateSchedules(schedules)
    if (scheduleError) newErrors.schedules = scheduleError
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    addMedication({
      name: name.trim(),
      dose: dose.trim() || 'Não informada',
      current: parseInt(quantity),
      total: parseInt(quantity),
      schedules: schedules.trim(),
      frequency: 8,
    })

    navigate('/')
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-4">
      <div className="rounded-2xl bg-primary-50 px-4 py-3 text-sm text-primary-800">
        Cadastre seu remédio para receber lembretes diários no horário certo.
      </div>

      <Input
        label="Nome do remédio"
        placeholder="Amoxicilina"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
      />
      <Input
        label="Como tomar (dose)"
        placeholder="1 comprimido"
        value={dose}
        onChange={(e) => setDose(e.target.value)}
      />
      <Input
        label="Quantidade na caixa"
        type="number"
        min="1"
        placeholder="60"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        error={errors.quantity}
      />

      <div>
        <Input
          label="Horários do dia"
          placeholder="08:00, 14:00, 20:00"
          value={schedules}
          onChange={(e) => setSchedules(e.target.value)}
          error={errors.schedules}
        />
        <p className="mt-1 text-sm text-slate-500">
          Separe os horários por vírgula. Exemplo: 08:00, 20:00
        </p>

        <div className="mt-3 flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Atalhos rápidos
          </p>
          {SCHEDULE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setSchedules(preset.value)}
              className={`rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition-colors ${
                schedules === preset.value
                  ? 'border-primary-400 bg-primary-50 text-primary-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-primary-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" fullWidth className="!py-4 !text-base">
        <Save size={18} />
        Salvar remédio
      </Button>
    </form>
  )
}
