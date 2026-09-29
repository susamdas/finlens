import { BarChart3 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/data/indicators/categories'
import type { IndicatorDefinition } from '@/data/types'
import { cn } from '@/lib/utils'

/** Indicator picker grouped by category. Pass the indicators that make sense for the view. */
export function MetricSelector({
  indicators,
  value,
  onChange,
  className,
  label = 'Metric',
}: {
  indicators: IndicatorDefinition[]
  value: string
  onChange: (id: string) => void
  className?: string
  label?: string
}) {
  const groups = CATEGORY_ORDER.map((c) => ({
    c,
    items: indicators.filter((i) => i.category === c),
  })).filter((g) => g.items.length)
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className={cn('w-64', className)} aria-label={label}>
        <BarChart3 className="size-4 text-muted-foreground" aria-hidden />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-96">
        {groups.map(({ c, items }) => (
          <SelectGroup key={c}>
            <SelectLabel>{CATEGORY_LABELS[c]}</SelectLabel>
            {items.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.shortLabel}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
