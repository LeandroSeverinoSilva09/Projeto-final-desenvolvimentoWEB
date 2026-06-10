import { Header } from '../components/layout/Header'
import { MedicationForm } from '../components/forms/MedicationForm'

export function AddMedication() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Adicionar remédio"
        subtitle="Preencha os dados para receber lembretes"
      />
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <MedicationForm />
      </div>
    </div>
  )
}
