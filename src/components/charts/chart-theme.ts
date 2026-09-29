/**
 * Shared Recharts styling so every chart reads as one system.
 * Mark specs: 2px lines, ≥8px markers, bar data-ends rounded 4px on the far end only,
 * recessive hairline grid, muted axis labels, no dual axes.
 */
import { CHART_CHROME } from '@/design/palette'

export const axisProps = {
  stroke: CHART_CHROME.axis,
  tick: { fill: CHART_CHROME.label, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: CHART_CHROME.axis },
  tickMargin: 8,
} as const

export const valueAxisProps = {
  ...axisProps,
  axisLine: false,
  width: 44,
} as const

export const gridProps = {
  stroke: CHART_CHROME.grid,
  strokeDasharray: '0',
  vertical: false,
} as const

/**
 * Props for an observed-data line: 2px stroke, survey points marked with 8px dots ringed
 * by the surface color so overlapping series stay separable.
 */
export function lineStyle(color: string) {
  return {
    stroke: color,
    strokeWidth: 2,
    dot: { r: 4, strokeWidth: 2, stroke: CHART_CHROME.surface, fill: color },
    activeDot: { r: 5, strokeWidth: 2, stroke: CHART_CHROME.surface, fill: color },
    isAnimationActive: true,
    animationDuration: 600,
    connectNulls: false,
  } as const
}

/** Projected values (forecasts) are always dashed and dot-less — never styled like observed data. */
export function projectionStyle(color: string) {
  return { ...lineStyle(color), strokeDasharray: '5 4', dot: false as const } as const
}

export const barProps = {
  radius: [4, 4, 0, 0] as [number, number, number, number],
  stroke: CHART_CHROME.surface,
  strokeWidth: 2, // the 2px surface gap between adjacent fills
  maxBarSize: 36,
  isAnimationActive: true,
  animationDuration: 600,
} as const

export const cursorProps = { fill: 'var(--muted)', opacity: 0.6 } as const

export const CHART_MARGIN = { top: 8, right: 12, bottom: 4, left: 0 } as const

/** Round, evenly spaced ticks (step 1, 2, 5, 10, 20, 25…) when the domain allows it. */
export function evenTicks([lo, hi]: [number, number]): number[] | undefined {
  const span = hi - lo
  if (!(span > 0)) return undefined
  const step = [1, 2, 5, 10, 20, 25, 50].find((s) => span / s <= 6)
  if (!step || lo % step !== 0 || hi % step !== 0) return undefined
  return Array.from({ length: span / step + 1 }, (_, i) => lo + i * step)
}
