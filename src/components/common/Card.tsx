import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  variant?: 'default' | 'critical' | 'success'
}

const variantStyles = {
  default: 'border-l-primary-500 bg-white',
  critical: 'border-l-danger-500 bg-red-50/60',
  success: 'border-l-success-500 bg-white',
}

export function Card({ children, className = '', variant = 'default' }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`
        rounded-2xl border border-slate-100 border-l-4 p-5 shadow-sm
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </motion.div>
  )
}
