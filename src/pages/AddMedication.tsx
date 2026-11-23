import { useParams, Link } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { MedicationForm } from '../components/forms/MedicationForm'
import { useMedications } from '../contexts/MedicationContext'
export function AddMedication() {
  const { id } = useParams()
  const { medications, loading } = useMedications()
  const medication = medications.find(m => m.id === id)
  if (id && !medication && loading) return <p role="status">Carregando medicamento…</p>
  if (id && !medication) return <div className="empty-state"><h1>Medicamento não encontrado</h1><Link className="text-link" to="/medicamentos">Voltar para medicamentos</Link></div>
  return <><Header title={id ? 'Editar remédio' : 'Adicionar remédio'} subtitle="Um passo de cada vez, com a embalagem e a receita por perto."/><MedicationForm key={id || 'new'} medication={medication}/></>
}
