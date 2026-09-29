import { useState } from 'react'
import { cn } from '@/lib/utils'
import { EconomyBadge } from './EconomyBadge'

/**
 * Country flag (SVG from flag-icons, bundled locally in /public/flags). Decorative: the
 * country name is always shown next to it. Falls back to the ISO badge if missing.
 */
export function Flag({
  iso2,
  code,
  className,
}: {
  iso2: string | null
  code: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  if (!iso2 || failed) return <EconomyBadge iso2={iso2} code={code} className={className} />
  return (
    <img
      src={`${import.meta.env.BASE_URL}flags/${iso2.toLowerCase()}.svg`}
      alt=""
      aria-hidden
      loading="lazy"
      decoding="async"
      width={32}
      height={24}
      onError={() => setFailed(true)}
      className={cn(
        'h-6 w-8 shrink-0 rounded-[4px] object-cover shadow-[0_0_0_1px_var(--border)]',
        className,
      )}
    />
  )
}
