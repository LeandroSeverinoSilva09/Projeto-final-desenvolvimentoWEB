import { Droplets, Pill } from 'lucide-react'
import { useState } from 'react'
import type { MedIconType } from '../../utils/medIcon'
import { getMedIconType } from '../../utils/medIcon'

const ICON_SRC: Record<MedIconType, string> = {
  pill: '/icons/pill-3d.png',
  droplet: '/icons/droplet-3d.png',
}

const SIZES = {
  xs: 'h-6 w-6',
  sm: 'h-9 w-9',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
  xl: 'h-20 w-20',
} as const

const LUCIDE_SIZES = {
  xs: 16,
  sm: 22,
  md: 28,
  lg: 36,
  xl: 44,
} as const

interface MedIcon3DProps {
  dose?: string
  type?: MedIconType
  size?: keyof typeof SIZES
  className?: string
  alt?: string
}

export function MedIcon3D({
  dose,
  type,
  size = 'md',
  className = '',
  alt = '',
}: MedIcon3DProps) {
  const [failed, setFailed] = useState(false)
  const iconType = type ?? (dose ? getMedIconType(dose) : 'pill')

  if (failed) {
    const LucideIcon = iconType === 'droplet' ? Droplets : Pill
    return (
      <LucideIcon
        size={LUCIDE_SIZES[size]}
        className={`text-primary-600 ${className}`}
        aria-hidden={!alt}
        aria-label={alt || undefined}
      />
    )
  }

  return (
    <img
      src={ICON_SRC[iconType]}
      alt={alt}
      draggable={false}
      onError={() => setFailed(true)}
      className={`${SIZES[size]} object-contain drop-shadow-md ${className}`}
    />
  )
}
