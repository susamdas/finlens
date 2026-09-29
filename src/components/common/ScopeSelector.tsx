import { Globe2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Region, IncomeGroup } from '@/data/types'
import { cn } from '@/lib/utils'

/** Encodes the scope as "world" | "developing" | "region:<slug>" | "income:<slug>". */
export type ScopeValue = string

export function ScopeSelector({
  regions,
  incomeGroups,
  value,
  onChange,
  className,
}: {
  regions: Region[]
  incomeGroups: IncomeGroup[]
  value: ScopeValue
  onChange: (v: ScopeValue) => void
  className?: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        className={cn('w-60', className)}
        aria-label="Scope: world, region or income group"
      >
        <Globe2 className="size-4 text-muted-foreground" aria-hidden />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="world">World</SelectItem>
        <SelectItem value="developing">Developing economies</SelectItem>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Regions (excluding high income)</SelectLabel>
          {regions
            .filter((r) => r.excludesHighIncome)
            .map((r) => (
              <SelectItem key={r.id} value={`region:${r.slug}`}>
                {r.name}
              </SelectItem>
            ))}
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Income groups</SelectLabel>
          {[...incomeGroups]
            .sort((a, b) => a.order - b.order)
            .map((g) => (
              <SelectItem key={g.id} value={`income:${g.slug}`}>
                {g.name}
              </SelectItem>
            ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
