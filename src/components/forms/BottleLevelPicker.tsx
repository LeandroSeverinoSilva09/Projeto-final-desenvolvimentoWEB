import { useId } from 'react'
import { Check, HelpCircle } from 'lucide-react'
import type { BottleStockLevel } from '../../types/medication'
import { bottleLevels } from '../../utils/bottleStock'
import '../../styles/bottle-stock.css'

export function BottleLevelPicture({ level }: { level: BottleStockLevel }) {
  const id = useId()
  const top = { full: 27, half: 46, low: 61, empty: 72, unknown: 72 }[level]
  return <svg className="bottle-level-picture" viewBox="0 0 64 80" aria-hidden="true">
    <defs><clipPath id={id}><path d="M22 20h20v7c8 4 10 8 10 15v26a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V42c0-7 2-11 10-15Z"/></clipPath></defs>
    <path d="M22 20h20v7c8 4 10 8 10 15v26a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V42c0-7 2-11 10-15Z" fill="#fff" stroke="currentColor" strokeWidth="2.5"/>
    {level !== 'unknown' && level !== 'empty' && <rect x="10" y={top} width="44" height={76 - top} fill={level === 'low' ? '#dba544' : '#78bdb0'} clipPath={`url(#${id})`}/>}
    <rect x="20" y="7" width="24" height="13" rx="3" fill="currentColor"/>
    {level === 'unknown' ? <text x="32" y="56" textAnchor="middle" fill="currentColor" fontSize="27" fontWeight="700">?</text> : <path d="M32 37c-4 6-7 9-7 13a7 7 0 0 0 14 0c0-4-3-7-7-13Z" fill="none" stroke="currentColor" strokeWidth="2"/>}
  </svg>
}

export function BottleLevelPicker({ value, onChange, error }: { value: BottleStockLevel | ''; onChange: (level: BottleStockLevel) => void; error?: string }) {
  const id = useId()
  return <fieldset id="med-stockLevel" className="bottle-level-field" tabIndex={-1} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}>
    <legend>Como está o frasco?</legend>
    <p id={`${id}-help`} className="bottle-level-help">Olhe o frasco e toque na figura mais parecida. Se não conseguir ver, escolha “Não sei dizer”.</p>
    <div className="bottle-level-options">{bottleLevels.map(level => <label key={level.value} className={`bottle-level-option ${value === level.value ? 'selected' : ''}`}>
      <input type="radio" name={`bottle-level-${id}`} value={level.value} checked={value === level.value} onChange={() => onChange(level.value)}/>
      <BottleLevelPicture level={level.value}/><strong>{level.label}</strong>{value === level.value && <Check className="bottle-level-check" size={20} aria-hidden="true"/>}
    </label>)}</div>
    <p className="bottle-level-help"><HelpCircle size={17} aria-hidden="true"/> O nível é informado por você. Atualize quando perceber que mudou; o aplicativo não calcula quantas gotas restam.</p>
    {error && <p id={`${id}-error`} role="alert" className="med-field-error">{error}</p>}
  </fieldset>
}
