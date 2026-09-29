import { cn } from '@/lib/utils'

/**
 * Compact ISO code mark for an economy. (Emoji flags don't render on Windows; a flag asset
 * set is evaluated with the map in Phase 6.)
 */
export function EconomyBadge({
  iso2,
  code,
  className,
}: {
  iso2: string | null
  code: string
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-grid h-6 w-8 shrink-0 place-items-center rounded-md border bg-muted text-[11px] font-semibold tracking-wide text-muted-foreground',
        className,
      )}
    >
      {iso2 ?? code.slice(0, 2)}
    </span>
  )
}
