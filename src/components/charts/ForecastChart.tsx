import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  evenTicks,
  axisProps,
  CHART_MARGIN,
  gridProps,
  lineStyle,
  projectionStyle,
  valueAxisProps,
} from './chart-theme'
import { formatPercent, formatPP, MISSING_GLYPH } from '@/lib/format'

export interface ForecastChartSeries {
  observed: { year: number; value: number }[]
  projection: { year: number; value: number; low: number; high: number }[]
  /** Other models' central projections, drawn faint for comparison. */
  alternatives?: { id: string; label: string; points: { year: number; value: number }[] }[]
}

/**
 * Observed survey values (solid, with markers) and a FinLens projection (dashed, no markers)
 * with its uncertainty band. Projections are never styled like observed data (chart-theme).
 */
export function ForecastChart({
  data,
  unit = '%',
  color = 'var(--chart-1)',
  height = 340,
  levelLabel = '80% range',
  domain,
}: {
  data: ForecastChartSeries
  unit?: '%' | 'pp'
  color?: string
  height?: number
  levelLabel?: string
  domain?: [number, number]
}) {
  const last = data.observed.at(-1)
  const years = new Set<number>([
    ...data.observed.map((o) => o.year),
    ...data.projection.map((p) => p.year),
    ...(data.alternatives ?? []).flatMap((a) => a.points.map((p) => p.year)),
  ])
  const rows = [...years]
    .sort((a, b) => a - b)
    .map((year) => {
      const o = data.observed.find((p) => p.year === year)
      const p = data.projection.find((q) => q.year === year)
      const row: Record<string, number | [number, number] | null> = {
        year,
        observed: o?.value ?? null,
        projection: p?.value ?? (last && year === last.year ? last.value : null),
        band: p ? [p.low, p.high] : last && year === last.year ? [last.value, last.value] : null,
      }
      for (const a of data.alternatives ?? []) {
        const q = a.points.find((x) => x.year === year)
        row[a.id] = q?.value ?? (last && year === last.year ? last.value : null)
      }
      return row
    })
  const fmt = unit === '%' ? formatPercent : formatPP
  const xs = rows.map((r) => r.year as number)
  const yDomain: [number, number] = domain ?? [0, 100]
  const ticks = [...new Set(xs)]

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ ...CHART_MARGIN, right: 16 }}>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="year"
            type="number"
            domain={[xs[0]!, xs.at(-1)!]}
            ticks={ticks}
            {...axisProps}
            padding={{ left: 8, right: 8 }}
          />
          <YAxis
            {...valueAxisProps}
            domain={yDomain}
            {...(evenTicks(yDomain) ? { ticks: evenTicks(yDomain) } : {})}
            tickFormatter={(v: number) => (unit === '%' ? `${v}%` : `${v}`)}
          />
          {last && (
            <ReferenceLine
              x={last.year}
              stroke="var(--chart-axis)"
              strokeDasharray="3 3"
              label={{
                value: 'Projection →',
                position: 'insideTopRight',
                fill: 'var(--chart-label)',
                fontSize: 11,
              }}
            />
          )}
          <Tooltip
            content={<ForecastTooltip fmt={fmt} levelLabel={levelLabel} lastYear={last?.year} />}
            cursor={{ stroke: 'var(--chart-axis)' }}
          />
          <Area
            dataKey="band"
            stroke="none"
            fill={color}
            fillOpacity={0.14}
            isAnimationActive={false}
            name={levelLabel}
          />
          {(data.alternatives ?? []).map((a) => (
            <Line
              key={a.id}
              dataKey={a.id}
              name={a.label}
              {...projectionStyle('var(--chart-axis)')}
              strokeWidth={1.25}
              connectNulls
            />
          ))}
          <Line dataKey="observed" name="Observed (Findex)" {...lineStyle(color)} />
          <Line
            dataKey="projection"
            name="FinLens projection"
            {...projectionStyle(color)}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function ForecastTooltip({
  active,
  payload,
  fmt,
  levelLabel,
  lastYear,
}: {
  active?: boolean
  payload?: { payload: Record<string, unknown> }[]
  fmt: (v: number | null) => string
  levelLabel: string
  lastYear?: number
}) {
  const row = payload?.[0]?.payload as
    | {
        year: number
        observed: number | null
        projection: number | null
        band: [number, number] | null
      }
    | undefined
  if (!active || !row) return null
  const projected = lastYear !== undefined && row.year > lastYear
  return (
    <div className="glass min-w-44 rounded-xl border px-3 py-2.5 text-xs shadow-overlay">
      <p className="mb-1.5 font-semibold">
        {row.year}
        {projected && <span className="ml-1 font-normal text-muted-foreground">· projection</span>}
      </p>
      {projected ? (
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-muted-foreground">
          <dt>FinLens projection</dt>
          <dd className="text-right font-semibold text-foreground tabular">
            {fmt(row.projection)}
          </dd>
          <dt>{levelLabel}</dt>
          <dd className="text-right text-foreground tabular">
            {row.band ? `${fmt(row.band[0])} – ${fmt(row.band[1])}` : MISSING_GLYPH}
          </dd>
        </dl>
      ) : (
        <p className="text-muted-foreground">
          Observed{' '}
          <span className="ml-2 font-semibold text-foreground tabular">{fmt(row.observed)}</span>
        </p>
      )}
    </div>
  )
}
