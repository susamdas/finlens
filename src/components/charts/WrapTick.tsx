import { CHART_CHROME } from '@/design/palette'

/**
 * Category-axis tick that wraps its label onto up to two lines, so long indicator names
 * don't collide on narrow bar groups. Pass as `tick={<WrapTick />}`.
 */
export function WrapTick({
  x = 0,
  y = 0,
  payload,
  maxChars = 12,
}: {
  x?: number
  y?: number
  payload?: { value: string }
  maxChars?: number
}) {
  const words = String(payload?.value ?? '').split(' ')
  const lines: string[] = []
  for (const w of words) {
    const last = lines[lines.length - 1]
    if (last !== undefined && (last + ' ' + w).length <= maxChars)
      lines[lines.length - 1] = `${last} ${w}`
    else lines.push(w)
  }
  const shown = lines.length > 2 ? [lines[0]!, lines.slice(1).join(' ')] : lines
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fill={CHART_CHROME.label} fontSize={11}>
        {shown.map((l, i) => (
          <tspan key={i} x={0} dy={i === 0 ? 12 : 13}>
            {l}
          </tspan>
        ))}
      </text>
    </g>
  )
}
