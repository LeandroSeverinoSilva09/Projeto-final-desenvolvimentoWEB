import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Clock3, Droplets, HelpCircle, Package, PackageOpen, Pencil, Pill, Plus, Save, Search, Type, X } from 'lucide-react'
import { useMedications } from '../../contexts/MedicationContext'
import type { Medication } from '../../types/medication'
import { formatMedicationQuantity, initialMedicationFormat, medicationAmountLabel, medicationFormError, parseMedicationQuantity, stockUnitFor, type MedicationDraft, type MedicationFormat, type MedicationFormError, type MedicationFormStep } from '../../utils/medicationForm'
import { Input } from '../common/Input'
import { MedicationSearch } from '../medication/MedicationSearch'
import { MedicationFormatPicture, MedicationPackageGuide, MedicationTimePeriod } from './MedicationFormVisuals'
import '../../styles/medication-form.css'

const steps = [
  { number: 1, label: 'Nome', icon: Pill }, { number: 2, label: 'Como usar', icon: Droplets },
  { number: 3, label: 'Horários', icon: Clock3 }, { number: 4, label: 'Em casa', icon: Package },
] as const
const formats: { value: MedicationFormat; label: string; hint: string }[] = [
  { value: 'solid', label: 'Comprimido ou cápsula', hint: 'Conte um por um' },
  { value: 'liquid', label: 'Líquido', hint: 'Medido em mL no copinho ou na seringa' },
  { value: 'drops', label: 'Gotas', hint: 'Conte as gotas' },
  { value: 'other', label: 'Outro tipo', hint: 'Itens que você conta um por um' },
]

export function MedicationForm({ medication }: { medication?: Medication }) {
  const { addMedication, busy, actionError } = useMedications()
  const [original] = useState(medication)
  const navigate = useNavigate()
  const [step, setStep] = useState<MedicationFormStep>(1)
  const [name, setName] = useState(medication?.name || '')
  const [format, setFormat] = useState<MedicationFormat | ''>(() => initialMedicationFormat(medication))
  const [units, setUnits] = useState(medication ? formatMedicationQuantity(medication.unitsPerDose ?? 1) : '')
  const [quantity, setQuantity] = useState(medication ? formatMedicationQuantity(medication.current) : '')
  const [doseText, setDoseText] = useState(medication?.dose || '')
  const [times, setTimes] = useState(medication?.schedules.split(',').map(time => time.trim()) || [''])
  const [instructions, setInstructions] = useState(medication?.instructions || '')
  const [color, setColor] = useState(medication?.color || 'teal')
  const [error, setError] = useState<MedicationFormError | null>(null)
  const [unitNotice, setUnitNotice] = useState('')
  const [needsDoseReview, setNeedsDoseReview] = useState(false)
  const [doseReviewRequested, setDoseReviewRequested] = useState(false)
  const [largeText, setLargeText] = useState(() => document.documentElement.classList.contains('large-text'))
  const changeTextSize = () => {
    const next = !largeText
    document.documentElement.classList.toggle('large-text', next)
    try { localStorage.setItem('medcontrol_large_text', String(next)) } catch { /* The size still changes when storage is unavailable. */ }
    setLargeText(next)
  }
  const [recipeOpen, setRecipeOpen] = useState(Boolean(medication))
  const form = useRef<HTMLFormElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    heading.current?.focus({ preventScroll: true })
    form.current?.scrollIntoView({ block: 'start' })
  }, [step])
  const stockUnit = stockUnitFor(format)
  const numericUnits = parseMedicationQuantity(units)
  const numericQuantity = parseMedicationQuantity(quantity)
  const amount = numericUnits === null ? 'Quantidade ainda não informada' : medicationAmountLabel(numericUnits, format)
  const dose = doseText.trim() || amount
  const draft: MedicationDraft = { name, format, units, quantity, doseText, times, needsDoseReview }
  const unitHint = format === 'solid' ? 'Conte comprimidos ou cápsulas.' : format === 'liquid' ? 'Use a medida em mL da sua receita.' : format === 'drops' ? 'Use a quantidade de gotas da sua receita.' : 'Conte os itens, e não as caixas. Use a mesma forma de contar aqui e no que ainda tem em casa.'
  const unitsQuestion = format === 'liquid' ? 'Quantos mL você usa de cada vez?' : format === 'drops' ? 'Quantas gotas você usa de cada vez?' : format === 'solid' ? 'Quantos comprimidos ou cápsulas você usa de cada vez?' : 'Quantos itens você usa de cada vez?'
  const quantityQuestion = format === 'liquid' ? 'Quantos mL ainda tem em casa?' : format === 'drops' ? 'Quantas gotas ainda tem em casa?' : format === 'solid' ? 'Quantos comprimidos ou cápsulas ainda tem?' : 'Quantos desses itens ainda tem em casa?'
  const questions = ['Qual é o nome do remédio?', 'Como é o seu remédio?', 'Que horas você usa o remédio?', 'Quanto remédio ainda tem em casa?']
  const chooseFormat = (next: MedicationFormat) => {
    if (next !== format && doseText.trim()) { setNeedsDoseReview(true); setDoseReviewRequested(true); setRecipeOpen(true) }
    if (next === 'other') setRecipeOpen(true)
    if (stockUnitFor(next) !== stockUnit && (units || quantity)) {
      setUnits(''); setQuantity('')
      setUnitNotice('A medida mudou. Confira e informe novamente quanto usa e quanto tem em casa.')
    }
    setFormat(next); setError(null)
  }
  const goTo = (next: MedicationFormStep) => { setError(null); setStep(next) }
  const showError = (failure: MedicationFormError) => {
    setError(failure); setStep(failure.step)
    if (failure.field === 'doseText') setRecipeOpen(true)
    requestAnimationFrame(() => document.getElementById(`med-${failure.field}`)?.focus())
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(null)
    if (step < 4) {
      const failure = medicationFormError(draft, step)
      if (failure) return showError(failure)
      setStep((step + 1) as MedicationFormStep); return
    }
    for (const currentStep of [1, 2, 3, 4] as const) {
      const failure = medicationFormError(draft, currentStep)
      if (failure) return showError(failure)
    }
    const current = numericQuantity!, unitsPerDose = numericUnits!
    const saved = await addMedication({ name: name.trim(), dose, current, total: Math.max(original && (original.stockUnit || 'unidades') === stockUnit ? original.total : 0.001, current), schedules: [...times].sort().join(', '), frequency: 24 / times.length, unitsPerDose, stockUnit, instructions: instructions.trim(), color, createdAt: original?.createdAt }, original?.id, original)
    if (saved) navigate('/medicamentos')
  }
  return <form ref={form} onSubmit={submit} noValidate className="panel medication-form visual-medication-form" data-step={step} aria-busy={busy}><fieldset disabled={busy} className="med-form-content">
    <div className="med-form-progress"><div className="med-form-tools"><p>Passo <strong>{step}</strong> de 4</p><button type="button" className="med-text-size" aria-pressed={largeText} onClick={changeTextSize}><Type size={22} aria-hidden="true"/>Letras maiores{largeText && <Check size={20} aria-hidden="true"/>}</button></div><ol aria-label="Etapas do cadastro">{steps.map(({ number, label, icon: Icon }) => <li key={number} aria-current={number === step ? 'step' : undefined} className={number < step ? 'complete' : ''}><span>{number < step ? <Check size={19} aria-hidden="true"/> : <Icon size={19} aria-hidden="true"/>}</span><span>{label}</span></li>)}</ol></div>
    <header className="med-form-question"><h2 ref={heading} tabIndex={-1}>{questions[step - 1]}</h2><p>{step === 1 ? 'Tenha a embalagem por perto para copiar o nome.' : step === 2 ? 'Toque na figura que combina com o seu remédio. Depois, informe quanto usa.' : step === 3 ? 'Coloque os horários que estão na sua receita.' : 'Conte o que ainda tem. Assim, podemos lembrar você de comprar mais.'}</p></header>
    {step === 1 && <section aria-label="Nome do remédio" className="med-form-step">
      <Input id="med-name" aria-describedby={`med-name-hint${error?.field === 'name' ? ' med-name-error' : ''}`} label="Nome na embalagem" placeholder="Nome e número" autoComplete="off" required maxLength={100} value={name} error={error?.field === 'name' ? error.message : undefined} onChange={event => { setName(event.target.value); setError(null) }}/>
      <details className="med-name-search med-name-help"><summary><Search size={18} aria-hidden="true"/>Ajuda com o nome</summary><MedicationPackageGuide/><MedicationSearch currentValue={name} onSelect={value => { setName(value); setError(null); requestAnimationFrame(() => document.getElementById('med-name')?.focus()) }}/></details>
    </section>}
    {step === 2 && <section aria-label="Quantidade usada por vez" className="med-form-step">
      <fieldset id="med-format" tabIndex={-1} className="med-format-field" aria-describedby={error?.field === 'format' ? 'med-format-error' : undefined}>
        <legend>Escolha uma das figuras</legend>
        <div className="med-format-grid">{formats.map(option => <label key={option.value} className={`med-format-option ${format === option.value ? 'selected' : ''}`}>
          <input type="radio" name="medication-format" value={option.value} checked={format === option.value} onChange={() => chooseFormat(option.value)}/>
          <MedicationFormatPicture format={option.value}/>
          <span className="med-format-copy"><strong>{option.label}</strong><span className="med-format-hint">{option.hint}</span><span className="med-format-state" aria-hidden="true">{format === option.value ? <><Check size={19}/>Escolhido</> : 'Toque para escolher'}</span></span>
        </label>)}</div>
        {error?.field === 'format' && <p id="med-format-error" className="med-field-error" role="alert">{error.message}</p>}
      </fieldset>
      {format && <div className="med-amount-field"><Input id="med-units" aria-describedby={`med-units-help${error?.field === 'units' ? ' med-units-error' : ''}`} label={unitsQuestion} type="text" inputMode="decimal" autoComplete="off" required value={units} onBlur={() => { if (numericUnits !== null) setUnits(formatMedicationQuantity(numericUnits)) }} placeholder="Escreva a quantidade que usa" error={error?.field === 'units' ? error.message : undefined} onChange={event => { if (doseText.trim() && parseMedicationQuantity(event.target.value) !== numericUnits) { setNeedsDoseReview(true); setDoseReviewRequested(true); setRecipeOpen(true) }; setUnits(event.target.value); setError(null) }}/><p id="med-units-help" className="field-help">{unitHint} Se precisar escrever uma parte, use vírgula, como 0,5.</p>{numericUnits !== null && numericUnits > 0 && numericUnits <= 1000 && <div className="med-amount-confirmation"><MedicationFormatPicture format={format}/><div><span>Você informou que usa de cada vez:</span><strong>{amount}</strong></div></div>}</div>}
      {unitNotice && <p className="notice" role="status">{unitNotice}</p>}
      {format && <details className="med-optional" open={recipeOpen} onToggle={event => { if (event.target === event.currentTarget) setRecipeOpen(event.currentTarget.open) }}><summary>{format === 'other' ? 'O que está escrito na receita?' : 'Anotar uma orientação da receita (opcional)'}</summary><Input id="med-doseText" label="Copie a orientação da receita" placeholder="Escreva a orientação recebida" maxLength={150} value={doseText} error={error?.field === 'doseText' ? error.message : undefined} onChange={event => { setDoseText(event.target.value); setError(null) }}/><p className="field-help">A anotação aparecerá junto do remédio. Confira se ela combina com a quantidade que você escreveu.</p>{doseReviewRequested && doseText.trim() && <label className="med-recipe-confirm"><input type="checkbox" checked={!needsDoseReview} onChange={event => { setNeedsDoseReview(!event.target.checked); setError(null) }}/><span>Conferi a receita. A anotação e a quantidade acima estão certas.</span></label>}</details>}
    </section>}
    {step === 3 && <section aria-label="Horários do remédio" className="med-form-step">
      <div className="med-time-list" id="med-times" tabIndex={-1}>{times.map((time, index) => <div className="med-time-row" key={index}><span className="med-time-icon"><Clock3 size={24} aria-hidden="true"/></span><div><label htmlFor={`med-time-${index}`}>{index === 0 ? 'Primeiro horário' : `Horário ${index + 1}`}</label><input id={`med-time-${index}`} type="time" required value={time} aria-invalid={error?.field === 'times' || undefined} aria-describedby={error?.field === 'times' ? 'med-times-error' : undefined} onChange={event => { setTimes(times.map((value, position) => position === index ? event.target.value : value)); setError(null) }}/><MedicationTimePeriod time={time}/></div>{times.length > 1 && <button type="button" className="med-remove-time" aria-label={`Tirar horário ${index + 1}`} onClick={() => setTimes(times.filter((_, position) => position !== index))}><X size={20} aria-hidden="true"/>Tirar este horário</button>}</div>)}</div>
      {error?.field === 'times' && <p id="med-times-error" className="med-field-error" role="alert">{error.message}</p>}
      <button type="button" className="btn secondary med-add-time" disabled={times.length >= 24} onClick={() => setTimes([...times, ''])}><Plus size={19} aria-hidden="true"/>Adicionar outro horário</button><p className="field-help">Use os horários combinados com o profissional que acompanha você.</p>
    </section>}
    {step === 4 && <section aria-label="Quantidade em casa e conferência" className="med-form-step">
      <div className="med-stock-guide"><Package size={30} aria-hidden="true"/><p>{unitHint} Conte o que ainda tem disponível.</p></div>
      <Input id="med-quantity" aria-describedby={`med-quantity-help${error?.field === 'quantity' ? ' med-quantity-error' : ''}`} label={quantityQuestion} type="text" inputMode="decimal" autoComplete="off" required value={quantity} onBlur={() => { if (numericQuantity !== null) setQuantity(formatMedicationQuantity(numericQuantity)) }} placeholder="Digite quanto ainda tem" error={error?.field === 'quantity' ? error.message : undefined} onChange={event => { setQuantity(event.target.value); setError(null) }}/><p id="med-quantity-help" className="field-help">Se acabou, toque no botão abaixo. Para escrever uma parte, use vírgula, como 0,5.</p><button type="button" className="med-empty-stock" aria-pressed={numericQuantity === 0} onClick={() => { setQuantity('0'); setError(null) }}><PackageOpen size={25} aria-hidden="true"/><span>Não tenho mais esse remédio</span>{numericQuantity === 0 && <Check size={22} aria-hidden="true"/>}</button>
      <section className="med-check-summary" aria-labelledby="med-check-title"><h3 id="med-check-title"><Check size={20} aria-hidden="true"/>Está tudo certo?</h3><div className="med-check-rows">
        <div><Pill size={21} aria-hidden="true"/><dl><dt>Nome na embalagem</dt><dd>{name}</dd></dl><button type="button" onClick={() => goTo(1)} aria-label="Corrigir nome do remédio"><Pencil size={16} aria-hidden="true"/>Corrigir</button></div>
        <div><Droplets size={21} aria-hidden="true"/><dl><dt>Quanto uso de cada vez</dt><dd>{amount}{doseText.trim() && <span className="med-recipe-text">Receita: {doseText.trim()}</span>}</dd></dl><button type="button" onClick={() => goTo(2)} aria-label="Corrigir quantidade por vez"><Pencil size={16} aria-hidden="true"/>Corrigir</button></div>
        <div><Clock3 size={21} aria-hidden="true"/><dl><dt>Horas de usar</dt><dd>{[...times].sort().join(' · ')}</dd></dl><button type="button" onClick={() => goTo(3)} aria-label="Corrigir horários"><Pencil size={16} aria-hidden="true"/>Corrigir</button></div>
        <div><Package size={21} aria-hidden="true"/><dl><dt>Quanto ainda tenho</dt><dd>{numericQuantity === null ? 'Informe a quantidade acima' : medicationAmountLabel(numericQuantity, format)}</dd></dl></div>
      </div></section>
      <details className="med-optional"><summary>Quer anotar mais alguma coisa? (opcional)</summary><label className="field-label" htmlFor="med-instructions">Alguma orientação para lembrar?</label><textarea id="med-instructions" rows={3} maxLength={500} placeholder="Copie uma orientação recebida." value={instructions} onChange={event => setInstructions(event.target.value)}/><fieldset className="color-field"><legend>Escolha uma cor para ajudar a reconhecer</legend>{([['teal', 'Verde'], ['blue', 'Azul'], ['amber', 'Amarela'], ['violet', 'Violeta']] as const).map(([value, label]) => <button type="button" className={`color-option ${value}`} key={value} aria-pressed={value === color} onClick={() => setColor(value)}>{value === color && <Check size={15} aria-hidden="true"/>}{label}</button>)}</fieldset></details>
    </section>}
    {actionError && <p className="notice error" role="alert">{actionError}</p>}
    <div className="med-form-actions">{step > 1 && <button className="btn secondary" type="button" disabled={busy} onClick={() => goTo((step - 1) as MedicationFormStep)}><ArrowLeft size={18} aria-hidden="true"/>Voltar</button>}<button className="btn med-form-continue" type="submit" disabled={busy}>{busy ? 'Salvando…' : step === 4 ? <><Save size={19} aria-hidden="true"/>{medication ? 'Salvar mudanças' : 'Salvar remédio'}</> : <>Próximo passo<ArrowRight size={19} aria-hidden="true"/></>}</button></div>
    <div className="med-form-support"><button type="button" disabled={busy} onClick={() => navigate('/medicamentos')}>Sair sem salvar</button><Link to="/ajuda"><HelpCircle size={17} aria-hidden="true"/>Preciso de ajuda</Link></div>
  </fieldset></form>
}
