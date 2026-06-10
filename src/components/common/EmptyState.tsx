import type { LucideIcon } from 'lucide-react'
import { MedIcon3D } from '../medication/MedIcon3D'
import type { MedIconType } from '../../utils/medIcon'

interface EmptyStateProps {
  icon?: LucideIcon
  medIcon?: MedIconType
  title: string
  description?: string
}

export function EmptyState({ icon: Icon, medIcon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      {medIcon ? (
        <MedIcon3D type={medIcon} size="xl" />
      ) : Icon ? (
        <div className="rounded-full bg-primary-50 p-4 text-primary-600">
          <Icon size={32} />
        </div>
      ) : null}
      {title && <h3 className="mt-4 text-lg font-semibold text-slate-800">{title}</h3>}
      {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
    </div>
  )
}
