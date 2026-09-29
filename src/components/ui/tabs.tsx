import * as React from 'react'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

/**
 * `panels={false}` marks tabs used as a segmented control that switches content outside
 * `TabsContent`. Triggers then omit `aria-controls`, which would otherwise point at panels that
 * do not exist (an invalid ARIA reference).
 */
const PanelsContext = React.createContext(true)

function Tabs({
  className,
  panels = true,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root> & { panels?: boolean }) {
  return (
    <PanelsContext.Provider value={panels}>
      <TabsPrimitive.Root
        data-slot="tabs"
        className={cn('flex flex-col gap-3', className)}
        {...props}
      />
    </PanelsContext.Provider>
  )
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'inline-flex h-9 w-fit items-center rounded-lg bg-muted p-1 text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const panels = React.useContext(PanelsContext)
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'inline-flex h-full min-h-7 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-card',
        className,
      )}
      {...props}
      {...(panels ? {} : { 'aria-controls': undefined })}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
