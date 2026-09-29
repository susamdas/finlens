import type { CompareModel } from '@/features/compare/compare.logic'
import { pct, pp, ppShort } from './text'

/**
 * Plain-language summary of the main differences between selected economies. Uses only the
 * values in the comparison model; metrics without enough data are skipped and noted.
 */
export function compareSummary(model: CompareModel): { sentences: string[]; gaps: string[] } {
  const name = (code: string) => model.entities.find((e) => e.code === code)?.shortName ?? code
  const sentences: string[] = []
  const gaps: string[] = []
  if (model.entities.length < 2) return { sentences, gaps }

  for (const m of model.metrics) {
    const cells = model.entities
      .map((e) => ({ code: e.code, v: model.cells[m.key]![e.code]!.value }))
      .filter((c): c is { code: string; v: number } => c.v !== null)
      .sort((a, b) => b.v - a.v)
    const missing = model.entities
      .filter((e) => model.cells[m.key]![e.code]!.value === null)
      .map((e) => e.shortName)
    if (missing.length) gaps.push(`${m.label}: no ${model.wave} value for ${missing.join(', ')}.`)
    if (cells.length < 2) continue
    const hi = cells[0]!
    const lo = cells[cells.length - 1]!
    const spread = hi.v - lo.v
    if (m.indicator.unit === 'pp') {
      // Gaps are compared by size; a negative gap means the usually-disadvantaged group is ahead.
      const bySize = [...cells].sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
      const wide = bySize[0]!
      const narrow = bySize[bySize.length - 1]!
      const describe = (v: number) => (v < 0 ? `${pp(v)}, reversed` : pp(v))
      if (Math.abs(wide.v) - Math.abs(narrow.v) >= 1)
        sentences.push(
          `The ${m.label.toLowerCase()} is widest in ${name(wide.code)} (${describe(wide.v)}) and narrowest in ${name(narrow.code)} (${describe(narrow.v)}).`,
        )
      continue
    }
    if (spread < 2) {
      sentences.push(`${m.label} is similar across the selection (${pct(lo.v)}–${pct(hi.v)}).`)
      continue
    }
    sentences.push(
      `${name(hi.code)} has the highest ${m.label.toLowerCase()} (${pct(hi.v)}), ${pp(spread)} above ${name(lo.code)} (${pct(lo.v)}).`,
    )
  }

  // Momentum since each economy's previous survey, for account ownership.
  const acc = model.cells.accountOwnership
  if (acc) {
    const moves = model.entities
      .map((e) => ({ e, c: acc[e.code]! }))
      .filter((x) => x.c.delta !== null)
      .sort((a, b) => b.c.delta! - a.c.delta!)
    if (moves.length >= 2) {
      const best = moves[0]!
      const worst = moves[moves.length - 1]!
      if (best.c.delta! > 0 && worst.c.delta! < 0)
        sentences.push(
          `Since their previous surveys, ${best.e.shortName} gained the most in account ownership (${ppShort(best.c.delta!)} vs ${best.c.previous!.wave}), while ${worst.e.shortName} declined (${ppShort(worst.c.delta!)} vs ${worst.c.previous!.wave}).`,
        )
      else
        sentences.push(
          `Since their previous surveys, account ownership changed most in ${best.e.shortName} (${ppShort(best.c.delta!)}) and least in ${worst.e.shortName} (${ppShort(worst.c.delta!)}).`,
        )
    }
  }
  return { sentences, gaps }
}
