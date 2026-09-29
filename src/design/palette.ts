/**
 * JS mirror of the validated chart palette in src/styles/tokens.css.
 *
 * Prefer CSS variables in markup (`fill="var(--chart-1)"`) so charts re-theme for free.
 * Use these hex values only where a library needs concrete colors (e.g. D3 interpolation,
 * canvas, PNG export).
 */
export type ThemeMode = 'light' | 'dark'

/**
 * Categorical slots in validated order. Colors are assigned to ENTITIES in this order and
 * never cycled or re-ranked. Adjacent-pair safe for bars/lines/stacks (up to 8 series).
 * For scatter / map / small multiples (all-pairs), only the first 3 slots are safe —
 * beyond that, highlight-and-mute or add shape encoding.
 */
export const CATEGORICAL: Record<ThemeMode, readonly string[]> = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
}

/** Sequential magnitude ramp, low → high. The dark ramp is flipped so "low" recedes. */
export const SEQUENTIAL: Record<ThemeMode, readonly string[]> = {
  light: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'],
  dark: ['#104281', '#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4', '#cde2fb'],
}

/** Diverging ramp: negative arm (red) → neutral midpoint (gray) → positive arm (blue). */
export const DIVERGING: Record<ThemeMode, readonly string[]> = {
  light: ['#a3272a', '#e34948', '#f4a9a3', '#f0efec', '#9ec5f4', '#3987e5', '#184f95'],
  dark: ['#f4a9a3', '#e66767', '#8f3436', '#2e3647', '#1c5cab', '#3987e5', '#9ec5f4'],
}

export const MISSING: Record<ThemeMode, { line: string; bg: string }> = {
  light: { line: '#b8bdc7', bg: '#f1f2f5' },
  dark: { line: '#4a556b', bg: '#161f33' },
}

/** CSS variable references, for use directly in SVG/Recharts props. */
/** Slot index is 0-based. Slots past the 8th never cycle — they fold into a neutral "Other". */
export const chartVar = (slot: number): string =>
  slot >= 0 && slot < 8 ? `var(--chart-${slot + 1})` : 'var(--neutral)'
export const seqVar = (step: number): string => `var(--seq-${Math.min(7, Math.max(1, step))})`

export const CHART_CHROME = {
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
  label: 'var(--chart-label)',
  highlight: 'var(--chart-highlight)',
  surface: 'var(--card)',
} as const
