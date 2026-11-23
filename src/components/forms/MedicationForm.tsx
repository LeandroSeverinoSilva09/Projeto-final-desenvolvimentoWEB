import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Clock3, Info, Plus, Save, X } from 'lucide-react'
import { useMedications } from '../../contexts/MedicationContext'
import type { Medication } from '../../types/medication'
import { Input } from '../common/Input'
import { Button } from '../common/Button'
import { MedicationSearch } from '../medication/MedicationSearch'
export function MedicationForm({ medication }: { medication?: Medication }) {
  const { addMedication, busy, actionError } = useMedications()
  const [original] = useState(medication)
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [name, setName] = useState(medication?.name || '')
  const [dose, setDose] = useState(medication?.dose || '')
  const [quantity, setQuantity] = useState(String(medication?.current ?? ''))
  const [stockUnit, setStockUnit] = useState<Medication['stockUnit']>(medication?.stockUnit || 'unidades')
  const [units, setUnits] = useState(String(medication?.unitsPerDose || 1))
  const [times, setTimes] = useState(medication?.schedules.split(',').map(t => t.trim()) || ['08:00'])
  const [instructions, setInstructions] = useState(medication?.instructions || '')
  const [color, setColor] = useState(medication?.color || 'teal')
  const [error, setError] = useState('')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    const current = Number(quantity), unitsPerDose = Number(units)
    if (!name.trim() || !dose.trim()) return setError('Preencha o nome e a dose prescrita.')
    if (!Number.isFinite(current) || Math.abs(current * 1000 - Math.round(current * 1000)) > 1e-7 || current < 0 || current > 100000 || quantity === '') return setError('Informe uma quantidade de 0 a 100.000, com até 3 casas decimais.')
    if (!Number.isFinite(unitsPerDose) || Math.abs(unitsPerDose * 1000 - Math.round(unitsPerDose * 1000)) > 1e-7 || unitsPerDose < 0.001 || unitsPerDose > 1000) return setError('Informe quantas unidades do estoque são usadas em cada tomada.')
    if (step >= 2 && (!times.length || times.some(t => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))) return setError('Preencha todos os horários.')
    if (step >= 2 && new Set(times).size !== times.length) return setError('Os horários não podem se repetir.')
    if (step < 3) { setStep(step + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    const saved = await addMedication({ name: name.trim(), dose: dose.trim(), current, total: Math.max(original?.total || 0.001, current), schedules: [...times].sort().join(', '), frequency: 24 / times.length, unitsPerDose, stockUnit, instructions: instructions.trim(), color, createdAt: original?.createdAt }, original?.id, original)
    if (saved) navigate('/medicamentos')
  }
  return <div className="form-layout"><form onSubmit={submit} noValidate className="panel medication-form" aria-busy={busy}><div className="form-step-progress" aria-label={`Etapa ${step} de 3`}><p>Etapa {step} de 3</p><div>{[1,2,3].map(n => <span key={n} className={n <= step ? 'complete' : ''}/>)}</div></div>
    <section hidden={step !== 1}><div className="form-section-title"><span>1</span><div><h2>Sobre o medicamento</h2><p>Use as informações da sua prescrição.</p></div></div>
      <details className="medication-catalog-details"><summary>Buscar o nome do remédio na Anvisa</summary><MedicationSearch currentValue={name} onSelect={setName}/></details><div className="form-grid"><Input label="Nome do medicamento" placeholder="Nome que está na embalagem" required maxLength={100} value={name} onChange={e => setName(e.target.value)}/><Input label="Dose prescrita" placeholder="Ex.: 1 comprimido de 500 mg" required maxLength={150} value={dose} onChange={e => setDose(e.target.value)}/></div>
      <label className="field-label mt-5" htmlFor="stock-unit">Como medir o estoque</label><select id="stock-unit" value={stockUnit} onChange={e => setStockUnit(e.target.value as Medication['stockUnit'])}><option value="unidades">Unidades (comprimidos, cápsulas etc.)</option><option value="mL">Mililitros (mL)</option><option value="gotas">Gotas</option></select><div className="form-grid mt-5"><Input label="Unidades disponíveis no estoque" type="number" inputMode="decimal" min={0} max={100000} step={0.001} required value={quantity} onChange={e => setQuantity(e.target.value)}/><Input label="Unidades usadas por tomada" type="number" inputMode="decimal" min={0.001} max={1000} step={0.001} required value={units} onChange={e => setUnits(e.target.value)}/></div><p className="field-help">Use a mesma unidade no estoque e no consumo. Ex.: estoque de 100 mL e consumo de 2,5 mL por tomada. Informe os valores da prescrição.</p>
    </section><section hidden={step !== 2}><div className="form-section-title"><span>2</span><div><h2>Horários de cada dia</h2><p>Defina somente os horários orientados pelo profissional de saúde.</p></div></div>
      <div className="time-inputs">{times.map((t, i) => <div key={i}><label htmlFor={`time-${i}`}>Horário {i + 1}</label><div className="flex items-center gap-2"><input id={`time-${i}`} type="time" required value={t} onChange={e => setTimes(times.map((v, j) => j === i ? e.target.value : v))}/>{times.length > 1 && <button type="button" aria-label={`Remover horário ${i + 1}`} onClick={() => setTimes(times.filter((_, j) => j !== i))}><X size={18}/></button>}</div></div>)}</div><button type="button" className="text-link mt-4" disabled={times.length >= 24} onClick={() => setTimes([...times, ''])}><Plus size={17}/>Adicionar horário</button>
    </section><section hidden={step !== 3}><div className="form-section-title"><span>3</span><div><h2>Detalhes para facilitar</h2><p>Informações opcionais para reconhecer seu medicamento.</p></div></div><label className="field-label" htmlFor="instructions">Observações da prescrição</label><textarea id="instructions" rows={3} maxLength={500} placeholder="Anote uma orientação recebida do profissional de saúde." value={instructions} onChange={e => setInstructions(e.target.value)}/><fieldset className="color-field"><legend>Cor de identificação</legend>{['teal','blue','amber','violet'].map(c => <button type="button" className={`color-option ${c}`} key={c} aria-label={`Cor ${ { teal: 'verde', blue: 'azul', amber: 'amarela', violet: 'violeta' }[c] }`} aria-pressed={c === color} onClick={() => setColor(c)}>{c === color && <Check size={18}/>}</button>)}</fieldset><div className="medication-review"><h3>Confira antes de salvar</h3><p><strong>{name}</strong> — {dose}</p><p>Horários: {times.join(', ')}</p><p>Estoque: {Number(quantity).toLocaleString('pt-BR')} {stockUnit}. Consumo por tomada: {Number(units).toLocaleString('pt-BR')} {stockUnit}.</p></div></section>
    {(error || actionError) && <div className="notice error" role="alert">{error || actionError}</div>}<div className="form-actions">{step > 1 && <button className="btn secondary" type="button" onClick={() => { setStep(step - 1); setError('') }}>Voltar</button>}<button className="btn secondary" type="button" onClick={() => navigate('/medicamentos')}>Cancelar</button><Button type="submit" disabled={busy}><Save size={17}/>{busy ? 'Salvando…' : step === 1 ? 'Continuar para horários' : step === 2 ? 'Conferir e finalizar' : medication ? 'Salvar alterações' : 'Salvar medicamento'}</Button></div>
  </form><aside className="form-aside"><div className="care-note"><Info size={24}/><h3>Seu tratamento, do seu jeito.</h3><p>Os horários e a dose devem seguir a prescrição. O aplicativo organiza os lembretes, sem recomendar ou alterar medicamentos.</p></div><div className="panel p-6"><Clock3 className="text-primary-600" size={24}/><h3 className="font-bold mt-3">O que acontece depois?</h3><p className="muted mt-2">Os horários aparecem na sua agenda. Depois de cada tomada, você confirma a dose e o estoque é atualizado.</p></div></aside></div>
}
