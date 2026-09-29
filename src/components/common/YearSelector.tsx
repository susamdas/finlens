import { CalendarDays } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

/** Survey-wave selector. Only years present in the dataset are offered. */
export function YearSelector({
  years,
  value,
  onChange,
  disabledReason,
  className,
}: {
  years: number[]
  value?: number
  onChange: (year: number) => void
  disabledReason?: string
  className?: string
}) {
  const disabled = years.length === 0
  const sorted = [...years].sort((a, b) => b - a)
  return (
    <Select
      {...(value !== undefined ? { value: String(value) } : { value: undefined })}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
    >
      <SelectTrigger
        size="sm"
        aria-label="Survey year"
        title={disabled ? disabledReason : undefined}
        className={cn('w-[108px]', className)}
      >
        <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
        <SelectValue placeholder="Year" />
      </SelectTrigger>
      <SelectContent align="end">
        {sorted.map((y) => (
          <SelectItem key={y} value={String(y)}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
