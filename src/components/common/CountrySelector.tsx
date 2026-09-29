import { useState } from 'react'
import { Check, ChevronsUpDown, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { CountryOption } from '@/hooks/useReferenceData'
import { cn } from '@/lib/utils'

/** Searchable single-country combobox. Disabled with an explanation when no options exist. */
export function CountrySelector({
  options,
  value,
  onChange,
  placeholder = 'Select country',
  disabledReason,
  className,
}: {
  options: CountryOption[]
  value?: string
  onChange: (code: string | null) => void
  placeholder?: string
  disabledReason?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.code === value)
  const disabled = options.length === 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label={selected ? `Country: ${selected.name}` : 'Select country'}
          disabled={disabled}
          title={disabled ? disabledReason : undefined}
          className={cn('w-44 justify-between font-normal', className)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Flag className="text-muted-foreground" aria-hidden />
            <span className={cn('truncate', !selected && 'text-muted-foreground')}>
              {selected?.name ?? placeholder}
            </span>
          </span>
          <ChevronsUpDown className="text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <Command>
          <CommandInput placeholder="Search countries…" />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.code}
                  value={`${o.name} ${o.code}`}
                  onSelect={() => {
                    onChange(o.code === value ? null : o.code)
                    setOpen(false)
                  }}
                >
                  <span className="flex-1 truncate">{o.name}</span>
                  {o.region && (
                    <span className="truncate text-xs text-muted-foreground">{o.region}</span>
                  )}
                  <Check
                    className={cn(
                      'size-4 text-primary',
                      o.code === value ? 'opacity-100' : 'opacity-0',
                    )}
                    aria-hidden
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
