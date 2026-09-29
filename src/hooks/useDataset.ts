import { useEffect, useState } from 'react'
import { useDataStore } from '@/store/data'
import type { FindexRepository } from '@/data/repository'

/** Dataset status + repository. Components re-render when lazily loaded data arrives. */
export function useDataset() {
  const status = useDataStore((s) => s.status)
  const repo = useDataStore((s) => s.repo)
  const error = useDataStore((s) => s.error)
  const revision = useDataStore((s) => s.revision)
  const load = useDataStore((s) => s.load)
  return { status, repo, error, revision, retry: load }
}

/** Requests extra data (all population groups and/or catalogue series) when a view needs it. */
export function useEnsureData(opts: { groups?: boolean; indicators?: string[] }): {
  ready: boolean
  error: string | null
} {
  const repo = useDataStore((s) => s.repo)
  const ensure = useDataStore((s) => s.ensure)
  const key = `${opts.groups ? 'g' : ''}|${(opts.indicators ?? []).join(',')}`
  const [state, setState] = useState<{ key: string; error: string | null } | null>(null)

  useEffect(() => {
    if (!repo) return
    let cancelled = false
    ensure(opts)
      .then(() => !cancelled && setState({ key, error: null }))
      .catch(
        (e: unknown) =>
          !cancelled && setState({ key, error: e instanceof Error ? e.message : String(e) }),
      )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures opts
  }, [repo, ensure, key])

  const done = state?.key === key
  return {
    ready: Boolean(repo) && done && !state?.error && isReady(repo, opts),
    error: done ? (state?.error ?? null) : null,
  }
}

function isReady(repo: FindexRepository | null, opts: { groups?: boolean; indicators?: string[] }) {
  if (!repo) return false
  if (opts.groups && !repo.hasAllGroups) return false
  return (opts.indicators ?? []).every((id) => repo.isLoaded(id))
}
