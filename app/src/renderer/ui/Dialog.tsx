import { useEffect, useRef, type FormEvent, type ReactNode } from 'react'
import './dialog.css'

interface DialogProps {
  title: string
  children?: ReactNode
  /** Primary button label; Enter triggers it. */
  confirmLabel?: string
  onConfirm: () => void
  /** If given, shows a Cancel button; Esc triggers it. */
  onCancel?: () => void
  /** Optional third button between Cancel and the primary one. */
  secondaryLabel?: string
  onSecondary?: () => void
  /** Style the primary button as a destructive action. */
  danger?: boolean
}

export function Dialog({
  title,
  children,
  confirmLabel = 'OK',
  onConfirm,
  onCancel,
  secondaryLabel,
  onSecondary,
  danger
}: DialogProps) {
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    // Focus the first input if there is one, otherwise the primary button.
    const form = formRef.current
    const target = form?.querySelector<HTMLElement>('input, textarea') ?? form?.querySelector<HTMLElement>('button.primary')
    target?.focus()
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onConfirm()
  }

  return (
    <div className="dialog-backdrop">
      <form
        ref={formRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={submit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            ;(onCancel ?? onConfirm)()
          }
        }}
      >
        <h2>{title}</h2>
        {children}
        <div className="dialog-actions">
          {onCancel && (
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button type="button" onClick={onSecondary}>
              {secondaryLabel}
            </button>
          )}
          <button type="submit" className={danger ? 'primary danger' : 'primary'}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
