import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
interface ModalProps { open: boolean; onClose: () => void; title: string; children: ReactNode; icon?: ReactNode; size?: 'md' | 'lg' }
export function Modal({ open, onClose, title, children, icon, size = 'md' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog?.open) dialog?.showModal()
    if (!open && dialog?.open) dialog.close()
  }, [open])
  return <dialog ref={ref} className={`app-dialog ${size === 'lg' ? 'large' : ''}`} aria-labelledby={id} onKeyDown={event => {
    if (event.key !== 'Tab') return
    const targets = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]')]
      .filter(element => element.tabIndex >= 0 && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden')
    const first = targets[0], last = targets.at(-1)
    if (first && last && (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
      event.preventDefault()
      const target = event.shiftKey ? last : first
      target.focus()
    }
  }} onCancel={e => { e.preventDefault(); onClose() }} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose() } }}>
    <div className="dialog-heading"><div>{icon}<h2 id={id}>{title}</h2></div><button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X size={21}/></button></div><div className="dialog-body">{children}</div>
  </dialog>
}
