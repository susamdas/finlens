import { useMemo } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight,
  Bot,
  GitCompareArrows,
  Globe2,
  HandCoins,
  LineChart,
  Scale,
  ScatterChart,
  Smartphone,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Flag } from '@/components/common/Flag'
import { DeltaIndicator } from '@/components/common/DeltaIndicator'
import { SourceBadge } from '@/components/common/SourceBadge'
import { ErrorState, LoadingSkeleton } from '@/components/common/states'
import { Sparkline } from '@/components/charts/Sparkline'
import { TrendChart } from '@/components/charts/TrendChart'
import { chartVar } from '@/design/palette'
import { useDataset } from '@/hooks/useDataset'
import { formatPercent, formatPP } from '@/lib/format'
import { compactPeople } from '@/lib/insights/text'
import { buildHome, type HomeModel } from './home.logic'

const CAPABILITIES = [
  {
    to: '/overview',
    icon: Globe2,
    title: 'Global overview',
    text: 'Headline indicators, trends and insights for any region or income group.',
  },
  {
    to: '/compare',
    icon: GitCompareArrows,
    title: 'Country comparison',
    text: 'Benchmark up to five economies against each other and their peers.',
  },
  {
    to: '/gaps',
    icon: Scale,
    title: 'Inclusion gaps',
    text: 'Gender, income, education, age and location gaps — narrowing or widening.',
  },
  {
    to: '/digital',
    icon: Smartphone,
    title: 'Digital finance',
    text: 'Mobile money, digital payments and the shift away from cash.',
  },
  {
    to: '/correlation',
    icon: ScatterChart,
    title: 'Correlation explorer',
    text: 'Test how indicators move together across economies.',
  },
  {
    to: '/forecast',
    icon: LineChart,
    title: 'Forecasting',
    text: 'Transparent statistical projections, clearly separated from data.',
  },
  {
    to: '/microfinance',
    icon: HandCoins,
    title: 'Microfinance lens',
    text: 'Savings, credit and women’s inclusion through a practitioner’s eyes.',
  },
  {
    to: '/analyst',
    icon: Bot,
    title: 'AI analyst',
    text: 'Ask questions in plain language — answers use only dataset values.',
  },
]

export default function HomePage() {
  const { repo, status, error, retry } = useDataset()
  const model = useMemo(() => (repo ? buildHome(repo) : null), [repo])

  return (
    <div className="space-y-14">
      <Hero model={model} />
      {status === 'error' && (
        <ErrorState
          title="The dataset could not be loaded."
          description={error ?? undefined}
          onRetry={() => void retry()}
        />
      )}
      {model ? <Body model={model} /> : status !== 'error' && <LoadingSkeleton variant="chart" />}
    </div>
  )
}

function Hero({ model }: { model: HomeModel | null }) {
  return (
    <section
      aria-labelledby="page-title"
      className="relative overflow-hidden rounded-3xl border bg-card px-6 py-12 shadow-card sm:px-10 lg:py-16"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-[28rem] rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-1/3 size-80 rounded-full bg-chart-1/10 blur-3xl"
      />
      <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            Financial Inclusion Intelligence Platform
          </p>
          <h1
            id="page-title"
            tabIndex={-1}
            className="text-4xl leading-[1.08] font-semibold tracking-tight outline-none sm:text-5xl"
          >
            See Financial Inclusion Through a <span className="text-primary">Smarter Lens.</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Explore how billions of people around the world save, borrow, pay, and access financial
            services through an interactive global financial inclusion intelligence platform.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/overview">
                Explore Dashboard <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/map">
                <Globe2 /> View Global Map
              </Link>
            </Button>
          </div>
          <SourceBadge note={model ? `${model.firstWave}–${model.wave} survey waves` : undefined} />
        </div>

        <Card className="glass p-5 shadow-raised">
          {model?.worldAccount ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13px] font-medium text-muted-foreground">
                    Adults with an account, world
                  </p>
                  <p className="mt-1 text-5xl font-semibold tracking-tight tabular">
                    {formatPercent(model.worldAccount.value)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {model.wave} · up from {formatPercent(model.worldAccountFirst)} in{' '}
                    {model.firstWave}
                  </p>
                </div>
                <DeltaIndicator
                  delta={model.worldAccount.delta}
                  comparisonLabel={`vs ${model.worldAccount.previous?.wave}`}
                />
              </div>
              <div className="mt-4">
                <TrendChart
                  height={180}
                  waves={model.worldSeries.map((p) => p.wave)}
                  series={[
                    { id: 'w', label: 'World', color: chartVar(0), points: model.worldSeries },
                  ]}
                />
              </div>
            </>
          ) : (
            <LoadingSkeleton variant="chart" />
          )}
        </Card>
      </div>
    </section>
  )
}

function Stat({ value, label, hint }: { value: string; label: string; hint: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <p className="text-3xl font-semibold tracking-tight tabular">{value}</p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function Body({ model }: { model: HomeModel }) {
  return (
    <>
      <section aria-label="Key statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          value={formatPercent(model.worldAccount?.value ?? null)}
          label="of adults worldwide have an account"
          hint={`World aggregate, ${model.wave}`}
        />
        <Stat
          value={
            model.unbanked
              ? compactPeople(model.unbanked.total)
                  .replace(' billion', 'B')
                  .replace(' million', 'M')
              : '—'
          }
          label="adults still without an account"
          hint={`FinLens estimate across ${model.unbanked?.economies ?? 0} surveyed economies`}
        />
        <Stat
          value={formatPercent(model.developingMobile?.value ?? null)}
          label="have a mobile money account"
          hint={`Developing economies, ${model.wave}`}
        />
        <Stat
          value={String(model.surveyed)}
          label={`economies surveyed in ${model.wave}`}
          hint={`${model.economies} economies across all waves`}
        />
      </section>

      <section aria-labelledby="regions-h" className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="regions-h" className="text-xl font-semibold tracking-tight">
              Account ownership around the world
            </h2>
            <p className="text-sm text-muted-foreground">
              Findex regional aggregates, {model.firstWave}–{model.wave}. Developing regions exclude
              high-income economies.
            </p>
          </div>
          <Link to="/regions" className="shrink-0 text-sm font-medium text-primary hover:underline">
            Regions
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {model.regions.map((r) => (
            <Link
              key={r.id}
              to={`/region/${r.slug}`}
              className="rounded-2xl border bg-card p-4 shadow-card transition-shadow outline-none hover:shadow-raised focus-visible:ring-[3px] focus-visible:ring-ring/40"
            >
              <p className="min-h-10 text-[13px] leading-snug font-medium">{r.name}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight tabular">
                {formatPercent(r.value)}
              </p>
              <Sparkline
                className="mt-2"
                width={120}
                height={32}
                data={r.series.map((p) => ({ year: p.wave, value: p.value }))}
              />
            </Link>
          ))}
        </div>
      </section>

      {model.movers.length > 0 && (
        <section aria-labelledby="featured-h" className="space-y-4">
          <div>
            <h2 id="featured-h" className="text-xl font-semibold tracking-tight">
              Featured countries
            </h2>
            <p className="text-sm text-muted-foreground">
              Largest gains in account ownership since each economy’s previous survey.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {model.movers.map((m) => (
              <Link
                key={m.entity.code}
                to={`/country/${m.entity.slug}`}
                className="group rounded-2xl border bg-card p-4 shadow-card transition-shadow outline-none hover:shadow-raised focus-visible:ring-[3px] focus-visible:ring-ring/40"
              >
                <div className="flex items-center gap-3">
                  <Flag iso2={m.entity.iso2} code={m.entity.code} />
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {m.entity.shortName}
                  </p>
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-tight tabular">
                  {formatPercent(m.value)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-semibold text-positive">{formatPP(m.delta)}</span> since{' '}
                  {m.previous.wave}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="cap-h" className="space-y-4">
        <div>
          <h2 id="cap-h" className="text-xl font-semibold tracking-tight">
            What you can do with FinLens
          </h2>
          <p className="text-sm text-muted-foreground">
            Data, analytics and financial-sector context in one place.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {CAPABILITIES.map(({ to, icon: Icon, title, text }) => (
            <Link
              key={to}
              to={to}
              className="group rounded-2xl border bg-card p-5 shadow-card transition-shadow outline-none hover:shadow-raised focus-visible:ring-[3px] focus-visible:ring-ring/40"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="size-5" aria-hidden />
              </span>
              <p className="mt-4 text-sm font-semibold">{title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{text}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
