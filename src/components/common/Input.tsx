import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s/g, '-')

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-2 block text-base font-semibold text-slate-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full rounded-xl border border-slate-200 bg-white px-4 py-4
          text-base text-slate-800 outline-none transition-all
          placeholder:text-slate-400
          focus:border-primary-500 focus:ring-2 focus:ring-primary-100
          ${error ? 'border-danger-500 focus:ring-red-100' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-danger-500">{error}</p>}
    </div>
  )
}
