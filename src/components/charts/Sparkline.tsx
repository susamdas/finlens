import { useId, useMemo } from 'react'
import { area, line } from 'd3-shape'
import { scaleLinear } from 'd3-scale'
import { extent } from 'd3-array'
import { cn } from '@/lib/utils'

export interface SparkPoint {
  year: number
  value: number | null
}

/**
 * Minimal trend glyph for KPI cards. Gaps (null) break the line instead of being
 * bridged, so a missing survey wave is never implied. Decorative: the card's text
 * carries the actual values.
 */
export function Sparkline({
  data,
  color = 'var(--chart-1)',
  width = 112,
  height = 36,
  className,
}: {
  data: SparkPoint[]
  color?: string
  width?: number
  height?: number
  className?: string
}) {
  const gradientId = useId()
  const pad = 3
  const paths = useMemo(() => {
    const valid = data.filter((d): d is { year: number; value: number } => d.value !== null)
    if (valid.length < 2) return null
    const [x0, x1] = extent(data, (d) => d.year) as [number, number]
    const [y0, y1] = extent(valid, (d) => d.value) as [number, number]
    const padY = (y1 - y0) * 0.15 || 1
    const x = scaleLinear()
      .domain([x0, x1])
      .range([pad, width - pad])
    const y = scaleLinear()
      .domain([y0 - padY, y1 + padY])
      .range([height - pad, pad])
    const defined = (d: SparkPoint) => d.value !== null
    const l = line<SparkPoint>()
      .defined(defined)
      .x((d) => x(d.year))
      .y((d) => y(d.value as number))
    const a = area<SparkPoint>()
      .defined(defined)
      .x((d) => x(d.year))
      .y0(height)
      .y1((d) => y(d.value as number))
    const last = valid[valid.length - 1]!
    // Points with no neighbour on either side would be invisible in a broken line — mark them.
    const isolated = data
      .map((d, i) => ({ d, prev: data[i - 1], next: data[i + 1] }))
      .filter(
        ({ d, prev, next }) =>
          d.value !== null && (prev?.value ?? null) === null && (next?.value ?? null) === null,
      )
      .map(({ d }) => ({ cx: x(d.year), cy: y(d.value as number) }))
    return {
      line: l(data) ?? '',
      area: a(data) ?? '',
      last: { cx: x(last.year), cy: y(last.value) },
      isolated,
    }
  }, [data, width, height])

  if (!paths) return <div style={{ width, height }} className={className} aria-hidden />

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className={cn('overflow-visible', className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={paths.area} fill={`url(#${gradientId})`} />
      <path
        d={paths.line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {paths.isolated.map((p) => (
        <circle key={p.cx} cx={p.cx} cy={p.cy} r={2} fill={color} />
      ))}
      <circle
        cx={paths.last.cx}
        cy={paths.last.cy}
        r={3}
        fill={color}
        stroke="var(--card)"
        strokeWidth={2}
      />
    </svg>
  )
}
