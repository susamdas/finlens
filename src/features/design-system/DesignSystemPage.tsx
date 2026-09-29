import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Banknote, Landmark, PiggyBank, Search, Smartphone, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Logo, LogoMark } from '@/components/common/Logo'
import { PageHeader } from '@/components/layout/PageHeader'
import { InsightCard } from '@/components/common/InsightCard'
import { BenchmarkStatus } from '@/components/common/BenchmarkStatus'
import { DeltaIndicator } from '@/components/common/DeltaIndicator'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/states'
import { KPICard } from '@/components/charts/KPICard'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartTooltip } from '@/components/charts/ChartTooltip'
import {
  axisProps,
  barProps,
  CHART_MARGIN,
  cursorProps,
  gridProps,
  lineStyle,
  projectionStyle,
  valueAxisProps,
} from '@/components/charts/chart-theme'
import { chartVar } from '@/design/palette'
import { formatPercent } from '@/lib/format'

/*
 * Living style guide. ALL numbers on this page are illustrative placeholders used only to
 * demonstrate components — they are not Global Findex values and are labelled as such.
 */
const DEMO = 'Illustrative values — not Findex data'
const DEMO_SOURCE = 'FinLens design demo (illustrative)'

const trend = [
  { year: 2011, a: 32, b: 24, c: 18 },
  { year: 2014, a: 41, b: 30, c: 22 },
  { year: 2017, a: 50, b: 38, c: 27 },
  { year: 2021, a: 57, b: 46, c: 34, pa: 57 },
  { year: 2024, a: null, b: null, c: null, pa: 62 },
]
const bars = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((k, i) => ({
  name: `Group ${k}`,
  value: [72, 64, 58, 51, 46, 39, 30][i]!,
}))
const spark = [
  { year: 2011, value: 30 },
  { year: 2014, value: 36 },
  { year: 2017, value: 44 },
  { year: 2021, value: 49 },
]
// A missing survey wave: the line breaks instead of bridging the gap.
const sparkWithGap = [
  { year: 2011, value: 6 },
  { year: 2014, value: 9 },
  { year: 2017, value: null },
  { year: 2021, value: 24 },
]

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-8 space-y-4">
      <div>
        <h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}

function Swatch({ name, varName, note }: { name: string; varName: string; note?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="size-9 shrink-0 rounded-lg border"
        style={{ background: `var(${varName})` }}
        aria-hidden
      />
      <div className="min-w-0 text-xs">
        <p className="font-medium text-foreground">{name}</p>
        <p className="font-mono text-muted-foreground">{varName}</p>
        {note && <p className="text-muted-foreground">{note}</p>}
      </div>
    </div>
  )
}

function Ramp({ label, vars }: { label: string; vars: string[] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex h-9 overflow-hidden rounded-lg border">
        {vars.map((v) => (
          <span key={v} className="flex-1" style={{ background: `var(${v})` }} title={v} />
        ))}
      </div>
    </div>
  )
}

const TYPE_SCALE = [
  { name: 'Display', cls: 'text-4xl font-semibold tracking-tight', spec: '36 / 600 / −0.02em' },
  { name: 'Page title', cls: 'text-[28px] font-semibold tracking-tight', spec: '28 / 600' },
  { name: 'Section', cls: 'text-xl font-semibold tracking-tight', spec: '20 / 600' },
  { name: 'Card title', cls: 'text-[15px] font-semibold', spec: '15 / 600' },
  { name: 'Body', cls: 'text-sm', spec: '14 / 400' },
  { name: 'Secondary', cls: 'text-[13px] text-muted-foreground', spec: '13 / 400 muted' },
  { name: 'Caption', cls: 'text-xs text-muted-foreground', spec: '12 / 400 muted' },
  {
    name: 'KPI figure',
    cls: 'text-[28px] font-semibold tracking-tight tabular',
    spec: '28 / 600 tabular',
  },
]

export default function DesignSystemPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-14">
      <PageHeader
        breadcrumbs={[{ label: 'Data', to: '/about' }, { label: 'Design System' }]}
        title="Design System"
        description="Tokens, components and chart conventions shared by every FinLens view. Colors are validated for colorblind separation and contrast in both themes."
        actions={<Badge variant="warning">{DEMO}</Badge>}
      />

      <Section
        id="brand"
        title="Brand"
        description="Lens + globe + rising data line: looking closely at global finance."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid place-items-center rounded-2xl border bg-card p-8 shadow-card">
            <Logo />
          </div>
          <div className="grid place-items-center rounded-2xl border bg-[#0b1120] p-8">
            <span className="dark">
              <Logo className="text-white" />
            </span>
          </div>
          <div className="flex items-center justify-center gap-4 rounded-2xl border bg-card p-8 shadow-card">
            <LogoMark className="size-12" />
            <LogoMark className="size-8" />
            <LogoMark className="size-5" />
          </div>
        </div>
      </Section>

      <Section
        id="color"
        title="Color"
        description="UI surfaces stay quiet so data carries the color. Semantic colors always pair with an icon and label."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-card">
            <p className="text-sm font-semibold">Surfaces & ink</p>
            <Swatch name="Background" varName="--background" />
            <Swatch name="Card" varName="--card" />
            <Swatch name="Muted" varName="--muted" />
            <Swatch name="Foreground" varName="--foreground" />
            <Swatch name="Muted text" varName="--muted-foreground" note="AA on all surfaces" />
            <Swatch name="Primary (lens teal)" varName="--primary" />
          </div>
          <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-card">
            <p className="text-sm font-semibold">Semantic</p>
            <Swatch name="Positive movement" varName="--positive" />
            <Swatch name="Negative movement" varName="--negative" />
            <Swatch name="Warning / near" varName="--warning" />
            <Swatch name="Neutral" varName="--neutral" />
            <div className="flex items-center gap-3">
              <span className="size-9 shrink-0 rounded-lg border bg-missing-hatch" aria-hidden />
              <div className="text-xs">
                <p className="font-medium">Missing data</p>
                <p className="text-muted-foreground">Hatched — never shown as zero</p>
              </div>
            </div>
          </div>
          <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-card">
            <p className="text-sm font-semibold">Data palettes</p>
            <Ramp
              label="Categorical — fixed order, never cycled"
              vars={Array.from({ length: 8 }, (_, i) => `--chart-${i + 1}`)}
            />
            <Ramp
              label="Sequential — magnitude (map)"
              vars={Array.from({ length: 7 }, (_, i) => `--seq-${i + 1}`)}
            />
            <Ramp
              label="Diverging — gaps & change"
              vars={[
                '--div-n3',
                '--div-n2',
                '--div-n1',
                '--div-0',
                '--div-p1',
                '--div-p2',
                '--div-p3',
              ]}
            />
            <p className="text-xs text-muted-foreground">
              Scatter & map views use at most 3 categorical hues at once; beyond that, highlight one
              group and mute the rest.
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="type"
        title="Typography"
        description="Inter Variable. Tabular figures wherever numbers align or animate."
      >
        <div className="divide-y rounded-2xl border bg-card shadow-card">
          {TYPE_SCALE.map((t) => (
            <div
              key={t.name}
              className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3"
            >
              <span className={t.cls}>
                {t.name === 'KPI figure' ? '53.4%' : 'Financial inclusion'}
              </span>
              <span className="text-xs text-muted-foreground">
                {t.name} · {t.spec}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="controls" title="Controls">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-5 shadow-card">
          <Button>Explore dashboard</Button>
          <Button variant="outline">View global map</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <div className="relative w-56">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input placeholder="Search countries…" className="pl-9" aria-label="Search countries" />
          </div>
          <Select defaultValue="2021">
            <SelectTrigger className="w-28" aria-label="Survey year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['2011', '2014', '2017', '2021'].map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ToggleGroup type="single" defaultValue="all" aria-label="Population group">
            <ToggleGroupItem value="all">All adults</ToggleGroupItem>
            <ToggleGroupItem value="women">Women</ToggleGroupItem>
            <ToggleGroupItem value="poor">Poorest 40%</ToggleGroupItem>
          </ToggleGroup>
          <UITooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm">
                Hover me
              </Button>
            </TooltipTrigger>
            <TooltipContent>Tooltips explain indicators in plain language.</TooltipContent>
          </UITooltip>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Default</Badge>
          <Badge variant="accent">South Asia</Badge>
          <Badge variant="outline">Lower middle income</Badge>
          <Badge variant="positive">Improving</Badge>
          <Badge variant="negative">Declining</Badge>
          <Badge variant="warning">Experimental</Badge>
          <span className="mx-2 h-5 w-px bg-border" aria-hidden />
          <DeltaIndicator delta={7.2} comparisonLabel="vs previous wave" />
          <DeltaIndicator delta={-2.4} />
          <DeltaIndicator delta={0.2} />
          <DeltaIndicator delta={3.1} higherIsBetter={false} comparisonLabel="gap widened" />
          <DeltaIndicator delta={null} />
          <span className="mx-2 h-5 w-px bg-border" aria-hidden />
          <BenchmarkStatus status="above" />
          <BenchmarkStatus status="near" />
          <BenchmarkStatus status="below" />
          <BenchmarkStatus status="missing" />
        </div>
      </Section>

      <Section
        id="kpi"
        title="KPI cards"
        description="Value, change vs previous survey wave, sparkline (gaps break the line), hover explanation."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            label="Account ownership"
            icon={<Landmark />}
            value={57.1}
            delta={7.2}
            comparisonLabel="vs 2017"
            series={spark}
            description="Share of adults (15+) with an account at a financial institution or a mobile money provider."
          />
          <KPICard
            label="Mobile money account"
            icon={<Smartphone />}
            value={24.3}
            delta={11.8}
            comparisonLabel="vs 2017"
            series={sparkWithGap}
          />
          <KPICard
            label="Gender gap"
            icon={<Users />}
            value={8.6}
            delta={-1.9}
            higherIsBetter={false}
            comparisonLabel="vs 2017"
          />
          <KPICard label="Formal savings" icon={<PiggyBank />} value={null} delta={null} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard label="Loading" value={0} loading />
        </div>
      </Section>

      <Section
        id="charts"
        title="Chart conventions"
        description="Thin marks, rounded data-ends, hairline grid, one axis, tooltip on every chart. Forecasts are dashed."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Trend by group"
            description={DEMO}
            source={DEMO_SOURCE}
            footnote="Dashed = projected"
          >
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={trend} margin={CHART_MARGIN}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="year" {...axisProps} />
                  <YAxis
                    {...valueAxisProps}
                    tickFormatter={(v: number) => `${v}%`}
                    domain={[0, 80]}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--chart-axis)' }} />
                  <Line dataKey="a" name="Group A" {...lineStyle(chartVar(0))} />
                  <Line dataKey="b" name="Group B" {...lineStyle(chartVar(1))} />
                  <Line dataKey="c" name="Group C" {...lineStyle(chartVar(2))} />
                  <Line dataKey="pa" name="Group A (projected)" {...projectionStyle(chartVar(0))} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <ul
              className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground"
              aria-label="Legend"
            >
              {['Group A', 'Group B', 'Group C'].map((n, i) => (
                <li key={n} className="flex items-center gap-1.5">
                  <span
                    className="h-0.5 w-4 rounded-full"
                    style={{ background: chartVar(i) }}
                    aria-hidden
                  />
                  {n}
                </li>
              ))}
            </ul>
          </ChartCard>
          <ChartCard title="Ranking" description={DEMO} source={DEMO_SOURCE}>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={bars} margin={CHART_MARGIN}>
                  <CartesianGrid {...gridProps} />
                  <XAxis
                    dataKey="name"
                    {...axisProps}
                    interval={0}
                    tick={{ ...axisProps.tick, fontSize: 11 }}
                  />
                  <YAxis {...valueAxisProps} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip content={<ChartTooltip />} cursor={cursorProps} />
                  <Bar dataKey="value" name="Share of adults" fill={chartVar(0)} {...barProps} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <ChartCard title="Loading state" source={DEMO_SOURCE} status="loading" />
          <ChartCard title="Empty state" source={DEMO_SOURCE} status="empty" />
          <ChartCard
            title="Error state"
            source={DEMO_SOURCE}
            status="error"
            onRetry={() => undefined}
          />
        </div>
      </Section>

      <Section
        id="insights"
        title="Insight cards"
        description="Every insight must be derived from dataset values and cite them."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <InsightCard
            tone="positive"
            title="Account ownership rose 7.2 percentage points since the previous survey."
            evidence={DEMO}
            onOpen={() => undefined}
          />
          <InsightCard
            tone="warning"
            title="Women's account ownership remains 8.6 points below men's."
            evidence={DEMO}
          />
          <InsightCard
            tone="negative"
            title="Formal borrowing declined compared with the previous wave."
            evidence={DEMO}
          />
          <InsightCard
            tone="neutral"
            icon={<Banknote className="size-[18px]" />}
            title="Digital payments grew faster than account ownership."
            evidence={DEMO}
          />
        </div>
      </Section>

      <Section id="data" title="Tables & tabs">
        <Tabs defaultValue="table">
          <TabsList>
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger value="states">States</TabsTrigger>
          </TabsList>
          <TabsContent value="table">
            <div className="rounded-2xl border bg-card shadow-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Rank</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bars.slice(0, 4).map((b, i) => (
                    <TableRow key={b.name}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell className="text-right">{formatPercent(b.value)}</TableCell>
                      <TableCell className="text-right">
                        <DeltaIndicator delta={[4.1, -1.2, 0.3, 6.5][i] ?? null} />
                      </TableCell>
                      <TableCell>
                        <BenchmarkStatus
                          status={(['above', 'above', 'near', 'below'] as const)[i]!}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          <TabsContent value="states">
            <div className="grid gap-4 md:grid-cols-3">
              <EmptyState description="The 2014 survey did not include this indicator for the selected country." />
              <ErrorState
                description="The data file could not be loaded."
                onRetry={() => undefined}
              />
              <div className="rounded-xl border bg-card p-5">
                <LoadingSkeleton variant="table" rows={4} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Section>
    </div>
  )
}
