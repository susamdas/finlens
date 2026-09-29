import { useLocation } from 'react-router'
import { useDataStore } from '@/store/data'

/** Shown only when printing (or saving as PDF): what this is, where it came from, and when. */
export function PrintHeader() {
  const location = useLocation()
  const source = useDataStore((s) => s.repo?.meta.source)
  const url =
    typeof window !== 'undefined'
      ? `${window.location.origin}${location.pathname}${location.search}`
      : ''
  return (
    <div className="mb-6 hidden border-b pb-3 text-xs text-muted-foreground print:block">
      <p className="text-sm font-semibold text-foreground">
        FinLens — Global Financial Inclusion Intelligence
      </p>
      <p>
        {source?.citation ?? 'World Bank Global Findex Database.'} Printed{' '}
        {new Date().toISOString().slice(0, 10)}.
      </p>
      <p className="break-all">{url}</p>
    </div>
  )
}
