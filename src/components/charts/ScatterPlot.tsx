import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Delaunay } from 'd3-delaunay'
import { scaleLinear } from 'd3-scale'
import type { LinearFit } from '@/lib/analytics/stats'
import { formatPercent, formatPP } from '@/lib/format'
import { cn } from '@/lib/utils'

const PCT_DOMAIN: [number, number] = [0, 100]

export interface ScatterPoint {
  id: string
  label: string
  x: number
  y: number
  highlight?: boolean
  group?: string
  /** Fill colour (e.g. by region). Overrides the highlight/muted colours. */
  color?: string
  /** Draw a persistent name label next to the point (e.g. the focus economy). */
  labelled?: boolean
}

/**
 * Economy-level scatter with an optional OLS fit. Nearest-point hover (Delaunay) so the pointer
 * never has to land on an 8px dot; highlighted points use the accent, others are muted.
 */
export function ScatterPlot({
  points,
  xLabel,
  yLabel,
  fit,
  height = 300,
  onSelect,
  yDomain = PCT_DOMAIN,
  yUnit = '%',
  xDomain = PCT_DOMAIN,
  xUnit = '%',
}: {
  points: ScatterPoint[]
  xLabel: string
  yLabel: string
  fit?: LinearFit | null
  height?: number
  onSelect?: (p: ScatterPoint) => void
  /** Defaults to 0–100%. Pass e.g. [-20, 40] with yUnit 'pp' for gaps. */
  yDomain?: [number, number]
  yUnit?: '%' | 'pp'
  xDomain?: [number, number]
  xUnit?: '%' | 'pp'
}) {
  const fmtY = yUnit === 'pp' ? formatPP : formatPercent
  const fmtX = xUnit === 'pp' ? formatPP : formatPercent
  const tickText = (t: number, unit: '%' | 'pp') =>
    unit === 'pp' ? (t > 0 ? `+${t}` : `${t}`) : `${t}%`
  const ref = useRef<SVGSVGElement>(null)
  const [width, setWidth] = useState(320)
  const [hover, setHover] = useState<ScatterPoint | null>(null)
  const m = { top: 12, right: 16, bottom: 40, left: 48 }

  const box = useRef<HTMLDivElement>(null)
  const clipId = `clip${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(
      ([e]) => e && setWidth(Math.max(260, Math.floor(e.contentRect.width))),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { x, y, delaunay, xTicks, yTicks } = useMemo(() => {
    const x = scaleLinear()
      .domain(xDomain)
      .range([m.left, width - m.right])
    const y = scaleLinear()
      .domain(yDomain)
      .range([height - m.bottom, m.top])
    const delaunay = Delaunay.from(
      points,
      (p) => x(p.x),
      (p) => y(p.y),
    )
    return { x, y, delaunay, xTicks: x.ticks(5), yTicks: y.ticks(5) }
  }, [points, width, height, m.left, m.right, m.bottom, m.top, yDomain, xDomain])

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect || !points.length) return
    const i = delaunay.find(e.clientX - rect.left, e.clientY - rect.top)
    const p = points[i]
    if (!p) return
    const dist = Math.hypot(x(p.x) - (e.clientX - rect.left), y(p.y) - (e.clientY - rect.top))
    setHover(dist < 40 ? p : null)
  }

  const sorted = [...points].sort(
    (a, b) => Number(Boolean(a.highlight)) - Number(Boolean(b.highlight)),
  )

  return (
    <div ref={box} className="relative w-full min-w-0 overflow-hidden">
      <svg
        ref={ref}
        width={width}
        height={height}
        role="img"
        aria-label={`Scatter plot of ${yLabel} against ${xLabel} for ${points.length} economies`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onClick={() => hover && onSelect?.(hover)}
        className={cn('block touch-none', onSelect && hover && 'cursor-pointer')}
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x={m.left}
              y={m.top}
              width={Math.max(0, width - m.left - m.right)}
              height={Math.max(0, height - m.top - m.bottom)}
            />
          </clipPath>
        </defs>
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" />
            <text
              x={m.left - 8}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              fontSize={12}
              fill="var(--chart-label)"
            >
              {tickText(t, yUnit)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text
            key={`x${t}`}
            x={x(t)}
            y={height - m.bottom + 18}
            textAnchor="middle"
            fontSize={12}
            fill="var(--chart-label)"
          >
            {tickText(t, xUnit)}
          </text>
        ))}
        <line
          x1={m.left}
          x2={width - m.right}
          y1={y(Math.max(yDomain[0], Math.min(yDomain[1], 0)))}
          y2={y(Math.max(yDomain[0], Math.min(yDomain[1], 0)))}
          stroke="var(--chart-axis)"
        />
        <text
          x={(m.left + width - m.right) / 2}
          y={height - 4}
          textAnchor="middle"
          fontSize={12}
          fill="var(--chart-label)"
        >
          {xLabel}
        </text>
        <text
          transform={`translate(12 ${(m.top + height - m.bottom) / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={12}
          fill="var(--chart-label)"
        >
          {yLabel}
        </text>
        {fit && (
          <line
            x1={x(xDomain[0])}
            x2={x(xDomain[1])}
            y1={y(fit.predict(xDomain[0]))}
            y2={y(fit.predict(xDomain[1]))}
            stroke="var(--foreground)"
            strokeOpacity={0.45}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            clipPath={`url(#${clipId})`}
          />
        )}
        {sorted.map((p) => (
          <circle
            key={p.id}
            cx={x(p.x)}
            cy={y(p.y)}
            r={p.highlight ? 5 : 4}
            fill={p.color ?? (p.highlight ? 'var(--chart-1)' : 'var(--chart-axis)')}
            fillOpacity={p.highlight ? 1 : 0.9}
            stroke="var(--card)"
            strokeWidth={1.5}
          />
        ))}
        {sorted
          .filter((p) => p.labelled)
          .map((p) => (
            <g key={`l${p.id}`} pointerEvents="none">
              <circle
                cx={x(p.x)}
                cy={y(p.y)}
                r={7}
                fill="none"
                stroke="var(--foreground)"
                strokeWidth={1.5}
              />
              <text
                x={x(p.x) + (x(p.x) > width - 120 ? -11 : 11)}
                y={y(p.y)}
                dy="0.32em"
                textAnchor={x(p.x) > width - 120 ? 'end' : 'start'}
                fontSize={12}
                fontWeight={600}
                fill="var(--foreground)"
                stroke="var(--card)"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {p.label}
              </text>
            </g>
          ))}
        {hover && (
          <circle
            cx={x(hover.x)}
            cy={y(hover.y)}
            r={8}
            fill="none"
            stroke="var(--foreground)"
            strokeWidth={1.5}
          />
        )}
      </svg>
      {hover && (
        <div
          className="glass pointer-events-none absolute z-10 min-w-40 rounded-xl border px-3 py-2 text-xs shadow-overlay"
          style={{
            left: Math.min(width - 180, x(hover.x) + 12),
            top: Math.max(0, y(hover.y) - 56),
          }}
          role="status"
        >
          <p className="font-semibold">{hover.label}</p>
          <p className="mt-1 flex justify-between gap-3 text-muted-foreground">
            {yLabel} <span className="font-semibold text-foreground tabular">{fmtY(hover.y)}</span>
          </p>
          <p className="flex justify-between gap-3 text-muted-foreground">
            {xLabel} <span className="font-semibold text-foreground tabular">{fmtX(hover.x)}</span>
          </p>
        </div>
      )}
    </div>
  )
}
