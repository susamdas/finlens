import { Link } from 'react-router'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/store/ui'

export default function NotFoundPage() {
  const setCommandOpen = useUIStore((s) => s.setCommandOpen)
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
          <Compass className="size-7" aria-hidden />
        </span>
        <p className="text-sm font-semibold text-primary">404</p>
        <h1
          id="page-title"
          tabIndex={-1}
          className="text-2xl font-semibold tracking-tight outline-none"
        >
          This page isn’t on the map
        </h1>
        <p className="text-sm text-muted-foreground">
          The link may be outdated, or the country or region name may be misspelled.
        </p>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/overview">Go to overview</Link>
          </Button>
          <Button variant="outline" onClick={() => setCommandOpen(true)}>
            Search FinLens
          </Button>
        </div>
      </div>
    </div>
  )
}
