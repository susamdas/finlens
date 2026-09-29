import { useCallback, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { BarList } from '@/components/charts/BarList'
import { ForecastChart } from '@/components/charts/ForecastChart'
import { SeriesLegend, TrendChart } from '@/components/charts/TrendChart'
import { SourceBadge } from '@/components/common/SourceBadge'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/states'
import { chartVar } from '@/design/palette'
import type { FindexRepository } from '@/data/repository'
import { useDataset, useEnsureData } from '@/hooks/useDataset'
import { formatPercent, formatPP } from '@/lib/format'
import { cn } from '@/lib/utils'
import { buildStory, type StoryVisual } from './story.logic'

export default function StoryPage() {
  const { repo, status, error, retry } = useDataset()
  const groups = useEnsureData({ groups: true })
  if (status === 'error')
    return (
      <ErrorState
        title="The dataset could not be loaded."
        description={error ?? undefined}
        onRetry={() => void retry()}
      />
    )
  if (!repo) return <LoadingSkeleton variant="chart" />
  return <Story repo={repo} groupsReady={groups.ready} />
}

function Story({ repo, groupsReady }: { repo: FindexRepository; groupsReady: boolean }) {
  const steps = useMemo(() => buildStory(repo, groupsReady), [repo, groupsReady])
  const [params, setParams] = useSearchParams()
  const reduce = useReducedMotion()
  const raw = Number(params.get('step') ?? '1')
  const index = Math.min(Math.max(1, Number.isFinite(raw) ? raw : 1), Math.max(1, steps.length)) - 1

  const go = useCallback(
    (i: number) =>
      setParams(
        (p) => {
          const n = new URLSearchParams(p)
          n.set('step', String(Math.min(Math.max(0, i), steps.length - 1) + 1))
          return n
        },
        { replace: true },
      ),
    [setParams, steps.length],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'ArrowRight') go(index + 1)
      if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, index])

  if (!steps.length) return <EmptyState title="Not enough data to tell the story." />
  const step = steps[index]!

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            Data story
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Financial inclusion in {steps.length} steps
          </h1>
        </div>
        <nav aria-label="Story steps" className="flex items-center gap-1.5">
          {steps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Step ${i + 1}: ${s.title}`}
              aria-current={i === index ? 'step' : undefined}
              className="group grid h-6 min-w-6 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <span
                aria-hidden
                className={cn(
                  'h-2 rounded-full transition-all',
                  i === index
                    ? 'w-8 bg-primary'
                    : 'w-2 bg-muted-foreground/30 group-hover:bg-muted-foreground/60',
                )}
              />
            </button>
          ))}
        </nav>
      </div>

      <AnimatePresence mode="wait">
        <motion.section
          key={step.id}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          aria-live="polite"
          aria-labelledby={`step-${step.id}`}
        >
          <Card className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="space-y-4">
              <p className="text-sm font-medium text-muted-foreground">
                {index + 1} / {steps.length} · {step.kicker}
              </p>
              <h2
                id={`step-${step.id}`}
                className="text-3xl leading-tight font-semibold tracking-tight text-balance"
              >
                {step.title}
              </h2>
              {step.body.map((b) => (
                <p key={b} className="text-[15px] leading-relaxed text-muted-foreground">
                  {b}
                </p>
              ))}
              <Link
                to={step.link.to}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                {step.link.label} <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
            <div className="min-w-0 space-y-3">
              <Visual v={step.visual} repo={repo} />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{step.source}</span>
                <SourceBadge />
              </div>
            </div>
          </Card>
        </motion.section>
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => go(index - 1)} disabled={index === 0}>
          <ArrowLeft /> Previous
        </Button>
        <p className="hidden text-xs text-muted-foreground sm:block">
          Use ← and → to move between steps
        </p>
        {index < steps.length - 1 ? (
          <Button onClick={() => go(index + 1)}>
            Next <ArrowRight />
          </Button>
        ) : (
          <Button asChild>
            <Link to="/insights">
              All insights <ArrowRight />
            </Link>
          </Button>
        )}
      </div>
    </div>
  )
}

function Visual({ v, repo }: { v: StoryVisual; repo: FindexRepository }) {
  if (v.kind === 'trend') {
    const vals = v.series
      .flatMap((s) => s.points.map((p) => p.value))
      .filter((x): x is number => x !== null)
    const domain: [number, number] | undefined =
      v.unit === 'pp' ? [0, Math.ceil(Math.max(10, ...vals) / 5) * 5] : undefined
    const series = v.series.map((s, i) => ({
      id: s.id,
      label: s.label,
      color: chartVar(i),
      points: s.points,
      dim: v.series.length > 3 && i > 0,
    }))
    return (
      <>
        <TrendChart
          waves={repo.waves}
          unit={v.unit}
          series={series}
          height={300}
          {...(domain ? { yDomain: domain } : {})}
        />
        <SeriesLegend
          items={series.map((s) => ({ label: s.label, color: s.color, muted: s.dim }))}
        />
      </>
    )
  }
  if (v.kind === 'bars')
    return (
      <BarList
        ariaLabel="Story chart"
        {...(v.max ? { max: v.max } : {})}
        emphasis={v.items.some((i) => i.highlight)}
        items={v.items.map((i) => ({
          key: i.key,
          label: i.label,
          value: i.value,
          display: v.max === 100 ? formatPercent(i.value) : formatPP(i.value),
          highlight: i.highlight,
        }))}
      />
    )
  if (v.kind === 'stat')
    return (
      <div className="grid h-full place-items-center">
        <p className="text-6xl font-semibold tabular">{v.value}</p>
        <p className="text-muted-foreground">{v.caption}</p>
      </div>
    )
  return (
    <ForecastChart height={300} data={{ observed: v.observed, projection: v.model.projections }} />
  )
}
