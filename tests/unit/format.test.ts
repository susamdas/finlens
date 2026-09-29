import {
  formatCompact,
  formatDecimal,
  formatPP,
  formatPercent,
  formatRelativeChange,
  MISSING_GLYPH,
} from '@/lib/format'

describe('format', () => {
  it('formats percentages and missing values', () => {
    expect(formatPercent(53.44)).toBe('53.4%')
    expect(formatPercent(null)).toBe(MISSING_GLYPH)
    expect(formatPercent(Number.NaN)).toBe(MISSING_GLYPH)
  })

  it('signs percentage-point deltas with a typographic minus', () => {
    expect(formatPP(7.2)).toBe('+7.2 pp')
    expect(formatPP(-3)).toBe('−3.0 pp')
    expect(formatPP(0.01)).toBe('0.0 pp')
    expect(formatPP(-0.01)).toBe('0.0 pp')
  })

  it('computes relative change safely', () => {
    expect(formatRelativeChange(60, 50)).toBe('+20.0%')
    expect(formatRelativeChange(60, 0)).toBe(MISSING_GLYPH)
    expect(formatRelativeChange(null, 50)).toBe(MISSING_GLYPH)
  })

  it('formats compact and decimals', () => {
    expect(formatCompact(1_400_000_000)).toBe('1.4B')
    expect(formatDecimal(0.7234)).toBe('0.72')
    expect(formatDecimal(-0.5)).toBe('−0.50')
  })
})
