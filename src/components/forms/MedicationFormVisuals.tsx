import { Moon, Sun, Sunrise, Package } from 'lucide-react'
import type { MedicationFormat } from '../../utils/medicationForm'
import { MedIcon3D } from '../medication/MedIcon3D'

export function MedicationPackageGuide() {
  return <div className="med-name-guide">
    <figure>
      <svg viewBox="0 0 240 140" aria-hidden="true">
        <path d="M18 25 46 10h168l-25 15Z" fill="#d3e8e1" stroke="#276b60" strokeWidth="2"/>
        <path d="m189 25 25-15v106l-25 15Z" fill="#bfdbd4" stroke="#276b60" strokeWidth="2"/>
        <rect x="18" y="25" width="171" height="106" rx="4" fill="#fff" stroke="#276b60" strokeWidth="2"/>
        <path d="M19 105h169v22a3 3 0 0 1-3 3H22a3 3 0 0 1-3-3Z" fill="#167a70"/>
        <rect x="29" y="38" width="148" height="35" rx="5" fill="#e5f4ef" stroke="#167a70" strokeWidth="2" strokeDasharray="4 3"/>
        <text x="40" y="62" fill="#164f48" fontSize="22" fontWeight="800">NOME</text>
        <text x="38" y="94" fill="#294c58" fontSize="20" fontWeight="700">NÚMERO</text>
      </svg>
      <figcaption>Desenho de exemplo</figcaption>
    </figure>
    <div><strong>Olhe a sua embalagem</strong><p id="med-name-hint">Copie o nome do remédio. Se houver um número junto do nome, copie também.</p></div>
  </div>
}

export function MedicationFormatPicture({ format }: { format: MedicationFormat }) {
  if (format === 'solid') return <MedIcon3D type="pill" size="xl"/>
  if (format === 'drops') return <MedIcon3D type="droplet" size="xl"/>
  if (format === 'liquid') return <svg className="med-measuring-cup" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M12 10h34v37a9 9 0 0 1-9 9H21a9 9 0 0 1-9-9Z" fill="#e5f5fc" stroke="#21809c" strokeWidth="3"/>
    <path d="M46 18h6a8 8 0 0 1 0 16h-6" fill="none" stroke="#21809c" strokeWidth="3"/>
    <path d="M15 34h28v13a6 6 0 0 1-6 6H21a6 6 0 0 1-6-6Z" fill="#66b9e5"/>
    <path d="M14 20h7m-7 7h7" stroke="#21809c" strokeWidth="2"/>
    <text x="28" y="46" textAnchor="middle" fill="#114e67" fontSize="13" fontWeight="700">mL</text>
  </svg>
  return <span className="med-other-icon"><Package size={48} aria-hidden="true"/></span>
}

export function MedicationTimePeriod({ time }: { time: string }) {
  if (!time) return null
  const hour = Number(time.slice(0, 2))
  const period = hour < 6 ? 'Madrugada' : hour < 12 ? 'Manhã' : hour < 18 ? 'Tarde' : 'Noite'
  const Icon = hour < 6 || hour >= 18 ? Moon : hour < 12 ? Sunrise : Sun
  return <span className="med-time-period"><Icon size={23} aria-hidden="true"/>{period}</span>
}
