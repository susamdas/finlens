import type { FindexRepository } from '@/data/repository'
import type { BreakdownId, Entity, GroupId, IndicatorId, Wave } from '@/data/types'
import { BREAKDOWN_PHRASES, ENTITY_ALIASES, GROUP_PHRASES, INDICATOR_PHRASES } from './lexicon'

/**
 * Rule-based question parser. Turns a plain-language question into a structured intent using
 * only the vocabulary in `lexicon.ts` and names from the dataset. It never guesses values —
 * the answer layer looks everything up in the repository.
 */

export type IntentKind =
  'definition' | 'forecast' | 'rank' | 'compare' | 'gap' | 'trend' | 'explain' | 'value' | 'unknown'

export interface ParsedQuestion {
  raw: string
  kind: IntentKind
  entities: Entity[]
  indicator: IndicatorId | null
  /** True when no indicator was named and account ownership is assumed. */
  indicatorAssumed: boolean
  group: GroupId | null
  breakdown: BreakdownId | null
  waves: Wave[]
  order: 'desc' | 'asc'
  limit: number
}

export function normalise(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9%+\-. ]+/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

interface Match {
  start: number
  end: number
  kind: 'entity' | 'indicator' | 'group' | 'breakdown'
  value: string
}

function findAll(text: string, phrase: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = []
  if (!phrase) return out
  const re = new RegExp(
    `(?:^|\\s)(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:s|es)?)(?=\\s|$|[.,?])`,
    'g',
  )
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const start = m.index + (m[0].length - m[1]!.length)
    out.push({ start, end: start + m[1]!.length })
  }
  return out
}

/** Name → entity code dictionary built from the dataset plus aliases. */
export function entityDictionary(repo: FindexRepository): [string, string][] {
  const dict = new Map<string, string>()
  for (const e of repo.meta.entities) {
    for (const n of [e.name, e.shortName]) {
      const k = normalise(n)
      if (k.length >= 3 && !dict.has(k)) dict.set(k, e.code)
    }
    // "Congo, Dem. Rep." → also "congo dem rep"; "Egypt, Arab Rep." → "egypt" is the short name.
  }
  for (const [alias, code] of ENTITY_ALIASES) if (repo.entity(code)) dict.set(alias, code)
  return [...dict.entries()]
}

const WAVE_OF_YEAR: Record<string, Wave> = {
  '2011': 2011,
  '2014': 2014,
  '2017': 2017,
  '2021': 2021,
  '2022': 2021,
  '2024': 2024,
  '2025': 2024,
}

export function parseQuestion(
  repo: FindexRepository,
  question: string,
  dict: [string, string][] = entityDictionary(repo),
): ParsedQuestion {
  const text = normalise(question)

  // Collect every candidate match, then keep the longest non-overlapping ones.
  const cands: Match[] = []
  for (const [name, code] of dict)
    for (const s of findAll(text, name)) cands.push({ ...s, kind: 'entity', value: code })
  for (const [p, id] of INDICATOR_PHRASES)
    for (const s of findAll(text, p)) cands.push({ ...s, kind: 'indicator', value: id })
  for (const [p, g] of GROUP_PHRASES)
    for (const s of findAll(text, p)) cands.push({ ...s, kind: 'group', value: g })
  for (const [p, b] of BREAKDOWN_PHRASES)
    for (const s of findAll(text, p)) cands.push({ ...s, kind: 'breakdown', value: b })
  cands.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start)
  const taken: Match[] = []
  for (const c of cands) if (!taken.some((t) => c.start < t.end && t.start < c.end)) taken.push(c)
  taken.sort((a, b) => a.start - b.start)

  const entities: Entity[] = []
  // Upper-case ISO3 codes typed as such ("BGD vs IND").
  for (const m of question.matchAll(/\b[A-Z]{3}\b/g)) {
    const e = repo.entity(m[0])
    if (e && !entities.some((x) => x.code === e.code)) entities.push(e)
  }
  for (const t of taken.filter((t) => t.kind === 'entity')) {
    const e = repo.entity(t.value)
    if (e && !entities.some((x) => x.code === e.code)) entities.push(e)
  }
  const indicator =
    (taken.find((t) => t.kind === 'indicator')?.value as IndicatorId | undefined) ?? null
  const groups = taken.filter((t) => t.kind === 'group').map((t) => t.value as GroupId)
  const breakdown =
    (taken.find((t) => t.kind === 'breakdown')?.value as BreakdownId | undefined) ?? null

  const waves = [
    ...new Set(
      [...text.matchAll(/\b(20\d\d)\b/g)]
        .map((m) => WAVE_OF_YEAR[m[1]!])
        .filter((w): w is Wave => w !== undefined),
    ),
  ].sort()
  const futureYear = [...text.matchAll(/\b(20\d\d)\b/g)].some((m) => Number(m[1]) > 2025)

  const has = (re: RegExp) => re.test(text)
  const limitMatch = text.match(/\b(?:top|bottom|first|last)\s+(\d{1,2})\b/)
  const limit = limitMatch ? Math.min(20, Math.max(1, Number(limitMatch[1]))) : 5
  const lowest = has(/\b(lowest|least|bottom|worst|smallest|fewest|lagging|behind)\b/)

  let kind: IntentKind
  if (
    entities.length === 0 &&
    (has(/^(what is|what are|what does|define|definition|meaning of|how is .* measured)\b/) ||
      has(/\bmean\b\??$/))
  )
    kind = 'definition'
  else if (
    futureYear ||
    has(/\b(forecast|predict|projection|project|future|will be|by 2030|expected)\b/)
  )
    kind = 'forecast'
  else if (
    has(
      /\b(highest|lowest|top|bottom|best|worst|rank|ranking|most|least|leading|leaders?|which (countries|economies))\b/,
    )
  )
    kind = 'rank'
  else if (has(/\bwhy\b/)) kind = 'explain'
  else if (has(/\bgap\b|\bdivide\b|\bdisparit/) || (groups.length >= 2 && !has(/\bcompare\b/)))
    kind = 'gap'
  else if (
    has(/\b(compare|comparison|versus|vs|difference between|against)\b/) ||
    entities.length >= 2
  )
    kind = 'compare'
  else if (
    has(
      /\b(change|changed|trend|over time|since|grow|grew|growth|increase|increased|decrease|decreased|decline|declined|evolve|progress|history|rise|rose|fall|fell)\b/,
    )
  )
    kind = 'trend'
  else if (indicator || entities.length) kind = 'value'
  else kind = 'unknown'

  // A gap question names a breakdown directly or through two groups.
  let bd = breakdown
  if (kind === 'gap' && !bd) {
    const byGroup = repo.breakdowns.find(
      (b) => groups.includes(b.advantaged) || groups.includes(b.disadvantaged),
    )
    bd = byGroup?.id ?? 'sex'
  }
  // For gap questions an "income"/"gender" word is a breakdown, not an indicator.
  let ind = indicator
  if (kind === 'gap' && (ind === 'genderGapAccount' || ind === 'incomeGapAccount')) {
    bd = ind === 'genderGapAccount' ? 'sex' : 'income'
    ind = 'accountOwnership'
  }
  if (!ind && kind !== 'unknown' && kind !== 'definition') ind = 'accountOwnership'

  return {
    raw: question,
    kind,
    entities,
    indicator: ind,
    indicatorAssumed: indicator === null && ind !== null,
    group: kind === 'gap' ? null : (groups[0] ?? null),
    breakdown: kind === 'gap' ? bd : null,
    waves,
    order: lowest ? 'asc' : 'desc',
    limit,
  }
}

/** Follow-ups ("and Kenya?", "what about women?") inherit what the new question leaves out. */
export function withContext(q: ParsedQuestion, prev: ParsedQuestion | null): ParsedQuestion {
  if (!prev || prev.kind === 'unknown') return q
  const text = normalise(q.raw)
  const explicit = /^(and|what about|how about|same for|also)\b/.test(text)
  if (explicit) {
    // "and Kenya?" / "what about women?": reuse everything the follow-up leaves out.
    const kind: IntentKind = q.kind === 'value' || q.kind === 'unknown' ? prev.kind : q.kind
    return {
      ...q,
      kind,
      entities: q.entities.length ? q.entities : prev.entities,
      indicator: q.indicatorAssumed || !q.indicator ? prev.indicator : q.indicator,
      indicatorAssumed: (q.indicatorAssumed || !q.indicator) && prev.indicatorAssumed,
      group: q.group ?? (q.entities.length ? null : prev.group),
      breakdown: q.breakdown ?? prev.breakdown,
      waves: q.waves.length ? q.waves : prev.waves,
    }
  }
  // A short question naming a place but no indicator keeps the previous indicator only.
  if (q.indicatorAssumed && q.entities.length && text.split(' ').length <= 6 && prev.indicator)
    return { ...q, indicator: prev.indicator, indicatorAssumed: prev.indicatorAssumed }
  return q
}
