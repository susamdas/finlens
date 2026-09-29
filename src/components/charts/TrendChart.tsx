import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SeriesPoint } from '@/data/types'
import { formatPercent, formatPP } from '@/lib/format'
import {
  axisProps,
  CHART_MARGIN,
  evenTicks,
  gridProps,
  lineStyle,
  valueAxisProps,
} from './chart-theme'
import { ChartTooltip } from './ChartTooltip'

export interface TrendSeries {
  id: string
  label: string
  color: string
  points: SeriesPoint[]
  /** Context series are thinner and muted. */
  muted?: boolean
  /** Background context: faint, thin and without markers (e.g. other regions). */
  dim?: boolean
}

/**
 * Line chart over survey waves. The x-axis is numeric so uneven gaps between waves
 * (2017 → 2021 → 2024) are shown truthfully; missing waves break the line.
 */
export function TrendChart({
  series,
  waves,
  unit = '%',
  height = 260,
  highlightWave,
  yDomain,
}: {
  series: TrendSeries[]
  waves: number[]
  unit?: '%' | 'pp'
  height?: number
  highlightWave?: number
  yDomain?: [number, number]
}) {
  const rows = waves.map((wave) => {
    const row: Record<string, number | null> = { wave }
    for (const s of series) row[s.id] = s.points.find((p) => p.wave === wave)?.value ?? null
    return row
  })
  const fmt =
    unit === '%' ? (v: number | null) => formatPercent(v) : (v: number | null) => formatPP(v)
  const allValues = series
    .flatMap((s) => s.points.map((p) => p.value))
    .filter((v): v is number => v !== null)
  const pctMax = Math.min(100, Math.ceil((Math.max(10, ...allValues) + 5) / 25) * 25)
  const domain: [number, number] =
    yDomain ??
    (unit === '%'
      ? [0, pctMax]
      : [Math.floor(Math.min(0, ...allValues)), Math.ceil(Math.max(1, ...allValues))])
  const ticks =
    unit === '%' && !yDomain
      ? Array.from({ length: pctMax / 25 + 1 }, (_, i) => i * 25)
      : evenTicks(domain)

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ ...CHART_MARGIN, right: 16 }}>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="wave"
            type="number"
            domain={[waves[0]!, waves[waves.length - 1]!]}
            ticks={waves}
            {...axisProps}
            padding={{ left: 8, right: 8 }}
          />
          <YAxis
            {...valueAxisProps}
            domain={domain}
            {...(ticks ? { ticks } : {})}
            tickFormatter={(v: number) => (unit === '%' ? `${v}%` : `${v}`)}
          />
          {highlightWave !== undefined && (
            <ReferenceLine x={highlightWave} stroke="var(--chart-axis)" strokeDasharray="3 3" />
          )}
          <Tooltip
            content={<ChartTooltip valueFormatter={fmt} />}
            cursor={{ stroke: 'var(--chart-axis)' }}
          />
          {series.map((s) => (
            <Line
              key={s.id}
              dataKey={s.id}
              name={s.label}
              {...lineStyle(s.color)}
              {...(s.muted ? { strokeWidth: 1.5, strokeOpacity: 0.7 } : {})}
              {...(s.dim ? { strokeWidth: 1.5, strokeOpacity: 0.35, dot: false } : {})}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SeriesLegend({
  items,
}: {
  items: { label: string; color: string; muted?: boolean }[]
}) {
  return (
    <ul
      className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
      aria-label="Legend"
    >
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-0.5 w-4 rounded-full"
            style={{ background: i.color, opacity: i.muted ? 0.7 : 1 }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  )
}
