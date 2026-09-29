import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Route-level error boundary: a failed page never takes down the whole shell. */
export function RouteError() {
  const error = useRouteError()
  const chunkFailed =
    error instanceof Error && /dynamically imported module|Loading chunk/i.test(error.message)
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : chunkFailed
      ? 'A newer version of FinLens is available. Reload to continue.'
      : 'An unexpected error occurred while rendering this view.'

  if (import.meta.env.DEV) console.error(error)

  return (
    <div role="alert" className="grid min-h-[50vh] place-items-center">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-negative-soft text-negative">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <h1 id="page-title" tabIndex={-1} className="text-xl font-semibold outline-none">
          Something went wrong
        </h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button asChild variant="outline">
            <Link to="/overview">Back to overview</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
