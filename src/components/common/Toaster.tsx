import { useEffect } from 'react'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToasts, type Toast } from './toast'

/** Polite, auto-dismissing notifications (downloads, copied links, errors). */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-[80] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 print:hidden"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} onDone={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ t, onDone }: { t: Toast; onDone: () => void }) {
  useEffect(() => {
    const h = window.setTimeout(onDone, t.tone === 'error' ? 7000 : 3500)
    return () => window.clearTimeout(h)
  }, [t, onDone])
  const Icon = t.tone === 'error' ? AlertTriangle : CheckCircle2
  return (
    <div
      role={t.tone === 'error' ? 'alert' : 'status'}
      className="glass pointer-events-auto flex items-start gap-2.5 rounded-xl border p-3 text-sm shadow-overlay"
    >
      <Icon
        className={cn(
          'mt-0.5 size-4 shrink-0',
          t.tone === 'error' ? 'text-negative' : 'text-positive',
        )}
        aria-hidden
      />
      <p className="min-w-0 flex-1">{t.message}</p>
      <button
        type="button"
        onClick={onDone}
        aria-label="Dismiss"
        className="rounded text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
