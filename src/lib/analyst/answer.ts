import type { FindexRepository } from '@/data/repository'
import type { Entity, GroupId, IndicatorDefinition, IndicatorId, Wave } from '@/data/types'
import { buildForecast } from '@/features/forecast/forecast.logic'
import { rankValues } from '@/features/rankings/rankings.logic'
import { WORLD, scopeSourceFor } from '@/lib/analytics/scope'
import { pct, pp, ppShort } from '@/lib/insights/text'
import type { ParsedQuestion } from './parse'

/**
 * Turns a parsed question into an answer built only from repository values. Every number in
 * the text is also listed as a `Fact` (entity · indicator · group · wave · value), which the UI
 * shows as the answer's sources. Nothing is estimated except where labelled (FinLens projection).
 */

export interface Fact {
  id: string
  entity: string
  indicator: string
  group: string
  wave: Wave | string
  value: string
}

export type AnswerChart =
  | { kind: 'bars'; unit: '%' | 'pp'; items: { key: string; label: string; value: number }[] }
  | {
      kind: 'trend'
      unit: '%' | 'pp'
      series: { id: string; label: string; points: { wave: Wave; value: number | null }[] }[]
    }

export interface AnalystAnswer {
  status: 'answered' | 'partial' | 'unknown'
  text: string[]
  facts: Fact[]
  chart?: AnswerChart
  caveats: string[]
  links: { to: string; label: string }[]
  /** What the parser understood — shown as chips so the user can check it. */
  understood: string[]
  followUps: string[]
}

const MAX_ENTITIES = 5

function ctx(repo: FindexRepository) {
  const facts: Fact[] = []
  const fmt = (ind: IndicatorDefinition, v: number) => (ind.unit === 'pp' ? ppShort(v) : pct(v))
  const groupLabel = (g: GroupId) => repo.meta.groups.find((x) => x.id === g)?.label ?? g
  const fact = (
    e: Entity,
    ind: IndicatorDefinition,
    wave: Wave,
    v: number,
    group: GroupId = 'all',
  ) => {
    facts.push({
      id: `${e.code}-${ind.id}-${group}-${wave}`,
      entity: e.shortName,
      indicator: ind.shortLabel,
      group: groupLabel(group),
      wave,
      value: fmt(ind, v),
    })
    return fmt(ind, v)
  }
  /** A value computed from facts (a change or a difference) — recorded as a fact too. */
  const derived = (entity: string, label: string, wave: string, v: number) => {
    facts.push({
      id: `${entity}-${label}-${wave}`,
      entity,
      indicator: label,
      group: 'Computed from the values above',
      wave,
      value: ppShort(v),
    })
    return v
  }
  return { facts, fmt, fact, groupLabel, derived }
}

/** Latest wave with a value for this entity (optionally at or before a wave). */
function latest(
  repo: FindexRepository,
  id: IndicatorId,
  code: string,
  group: GroupId,
  atOrBefore?: Wave,
) {
  return repo.latest(id, code, group, atOrBefore)
}

/** For World, fall back to the developing-economies aggregate where no world figure exists. */
function resolveCode(repo: FindexRepository, e: Entity, id: IndicatorId, group: GroupId): Entity {
  if (e.code !== WORLD.code) return e
  const src = scopeSourceFor(repo, id, WORLD, group)
  return repo.entity(src.code) ?? e
}

const SUGGESTIONS = [
  'How has account ownership in Bangladesh changed since 2011?',
  'Compare mobile money in Kenya, Uganda and Tanzania',
  'Which countries have the highest digital payments?',
  'What is the gender gap in South Asia?',
  'What is formal borrowing?',
  'Account ownership in Sub-Saharan Africa by 2030',
]

export function answerQuestion(repo: FindexRepository, q: ParsedQuestion): AnalystAnswer {
  const c = ctx(repo)
  const ind = q.indicator ? repo.indicator(q.indicator) : undefined
  const group: GroupId = q.group ?? 'all'
  const understood = [
    `Question type: ${q.kind}`,
    ...(ind ? [`Indicator: ${ind.shortLabel}${q.indicatorAssumed ? ' (assumed)' : ''}`] : []),
    ...q.entities.map((e) => `Place: ${e.shortName}`),
    ...(q.group ? [`Group: ${c.groupLabel(q.group)}`] : []),
    ...(q.breakdown ? [`Breakdown: ${repo.breakdown(q.breakdown)?.label}`] : []),
    ...q.waves.map((w) => `Year: ${w}`),
  ]
  const base = {
    facts: c.facts,
    understood,
    caveats: [] as string[],
    links: [] as { to: string; label: string }[],
  }
  const unknown = (msg: string): AnalystAnswer => ({
    ...base,
    status: 'unknown',
    text: [
      msg,
      'Try asking about an indicator (account ownership, mobile money, digital payments, saving, borrowing, emergency funds…) for a country, region or the world.',
    ],
    followUps: SUGGESTIONS.slice(0, 4),
  })

  if (q.kind === 'unknown')
    return unknown('I could not find an indicator or a place in that question.')
  if (!ind) return unknown('I could not tell which indicator you mean.')
  const entities = (q.entities.length ? q.entities : [repo.entity('WLD')!]).slice(0, MAX_ENTITIES)
  const assumedNote = q.indicatorAssumed
    ? [`No indicator was named, so I used ${ind.shortLabel.toLowerCase()}.`]
    : []
  const worldNote = (e: Entity, used: Entity) =>
    used.code !== e.code
      ? [
          `No World figure is published for ${ind.shortLabel.toLowerCase()}; I used ${used.shortName.toLowerCase()} instead.`,
        ]
      : []

  switch (q.kind) {
    case 'definition':
      return {
        ...base,
        status: 'answered',
        text: [
          `${ind.label}: ${ind.definition}`,
          `Unit: ${ind.unitLabel}.${ind.coverage ? ` Published for ${ind.coverage.firstWave}–${ind.coverage.lastWave}.` : ''}${ind.derived ? ` FinLens-derived: ${ind.derived.formula}.` : ''}`,
        ],
        links: [{ to: '/about', label: 'About the data' }],
        followUps: [
          `${ind.shortLabel} worldwide`,
          `Which countries have the highest ${ind.shortLabel.toLowerCase()}?`,
        ],
      }

    case 'value': {
      const lines: string[] = []
      const notes: string[] = [...assumedNote]
      const items: { key: string; label: string; value: number }[] = []
      for (const e of entities) {
        const used = resolveCode(repo, e, ind.id, group)
        notes.push(...worldNote(e, used))
        const wave = q.waves.at(-1)
        const v =
          wave !== undefined
            ? (() => {
                const x = repo.value(ind.id, used.code, wave, group)
                return x === null ? null : { wave, value: x }
              })()
            : latest(repo, ind.id, used.code, group)
        if (!v) {
          lines.push(
            `${ind.shortLabel} is not published for ${used.shortName}${group !== 'all' ? ` (${c.groupLabel(group).toLowerCase()})` : ''}${wave ? ` in ${wave}` : ''}.`,
          )
          continue
        }
        const s = c.fact(used, ind, v.wave, v.value, group)
        let line = `${used.shortName}${group !== 'all' ? `, ${c.groupLabel(group).toLowerCase()}` : ''}: ${s} (${ind.unitLabel}, ${repo.surveyYear(used.code, v.wave)}).`
        if (used.kind === 'economy' && used.regionId) {
          const r = repo.region(used.regionId)
          const rv = r ? repo.value(ind.id, r.aggregateCode, v.wave, group) : null
          if (r && rv !== null) {
            c.fact(repo.entity(r.aggregateCode)!, ind, v.wave, rv, group)
            line += ` The ${r.name} average${group !== 'all' ? ` for ${c.groupLabel(group).toLowerCase()}` : ''} is ${c.fmt(ind, rv)}.`
          }
        }
        lines.push(line)
        items.push({ key: used.code, label: used.shortName, value: v.value })
      }
      return {
        ...base,
        status: items.length ? 'answered' : 'partial',
        text: lines,
        caveats: notes,
        chart:
          items.length > 1
            ? { kind: 'bars', unit: ind.unit === 'pp' ? 'pp' : '%', items }
            : undefined,
        links:
          entities[0]?.kind === 'economy'
            ? [{ to: `/country/${entities[0].slug}`, label: `${entities[0].shortName} profile` }]
            : [{ to: `/overview?metric=${ind.id}`, label: 'Open the overview' }],
        followUps: [
          `How has ${ind.shortLabel.toLowerCase()} in ${entities[0]!.shortName} changed?`,
          `Which countries have the highest ${ind.shortLabel.toLowerCase()}?`,
        ],
      }
    }

    case 'trend':
    case 'explain': {
      const lines: string[] = []
      const notes = [...assumedNote]
      const series: {
        id: string
        label: string
        points: { wave: Wave; value: number | null }[]
      }[] = []
      for (const e of entities) {
        const used = resolveCode(repo, e, ind.id, group)
        notes.push(...worldNote(e, used))
        const pts = repo.series(ind.id, used.code, group)
        const obs = pts.filter((p): p is { wave: Wave; value: number } => p.value !== null)
        const from = q.waves.length
          ? obs.find((p) => p.wave >= q.waves[0]!)
          : q.kind === 'explain'
            ? obs.at(-2)
            : obs[0]
        const to =
          q.waves.length > 1
            ? [...obs].reverse().find((p) => p.wave <= q.waves.at(-1)!)
            : obs.at(-1)
        if (!from || !to || from.wave === to.wave) {
          lines.push(`Not enough published surveys to describe a change for ${used.shortName}.`)
          continue
        }
        c.fact(used, ind, from.wave, from.value, group)
        c.fact(used, ind, to.wave, to.value, group)
        const d = c.derived(
          used.shortName,
          `Change in ${ind.shortLabel.toLowerCase()}`,
          `${from.wave}–${to.wave}`,
          to.value - from.value,
        )
        lines.push(
          `${used.shortName}: ${ind.shortLabel.toLowerCase()} ${Math.abs(d) < 0.5 ? 'was essentially unchanged' : `${d > 0 ? 'rose' : 'fell'} ${pp(d)}`} from ${c.fmt(ind, from.value)} in ${from.wave} to ${c.fmt(ind, to.value)} in ${to.wave}.`,
        )
        const prev = obs.at(-2)
        if (prev && prev.wave !== from.wave && to.wave === obs.at(-1)!.wave) {
          c.fact(used, ind, prev.wave, prev.value, group)
          lines.push(
            `Since the previous survey (${prev.wave}): ${ppShort(c.derived(used.shortName, `Change in ${ind.shortLabel.toLowerCase()}`, `${prev.wave}–${to.wave}`, to.value - prev.value))}.`,
          )
        }
        series.push({ id: used.code, label: used.shortName, points: pts })
      }
      if (q.kind === 'explain') {
        // Describe the components that moved; never assert a cause.
        const e = entities[0]!
        if (ind.id === 'accountOwnership' && e.kind === 'economy') {
          const w = repo.latest('accountOwnership', e.code)?.wave
          if (w) {
            for (const id of ['fiAccount', 'mobileMoneyAccount'] as IndicatorId[]) {
              const def = repo.indicator(id)!
              const v = repo.value(id, e.code, w)
              const p = repo.previous(id, e.code, w)
              if (v !== null && p) {
                c.fact(e, def, w, v)
                c.fact(e, def, p.wave, p.value)
                lines.push(
                  `${def.shortLabel}: ${c.fmt(def, p.value)} (${p.wave}) → ${c.fmt(def, v)} (${w}).`,
                )
              }
            }
          }
        }
        notes.push(
          'The Findex shows what changed, not why. Causes such as policy, prices, shocks or survey differences cannot be read from these numbers alone.',
        )
      }
      return {
        ...base,
        status: series.length ? 'answered' : 'partial',
        text: lines,
        caveats: notes,
        chart: series.length
          ? { kind: 'trend', unit: ind.unit === 'pp' ? 'pp' : '%', series }
          : undefined,
        links: [
          {
            to: `/trends?metric=${ind.id}${entities[0]?.kind === 'economy' ? `&country=${entities[0].code}` : ''}`,
            label: 'Open in Trends',
          },
        ],
        followUps: [
          `Compare ${ind.shortLabel.toLowerCase()} in ${entities[0]!.shortName} with its region`,
          `${ind.shortLabel} in ${entities[0]!.shortName} by 2030`,
        ],
      }
    }

    case 'compare': {
      const list =
        entities.length >= 2
          ? entities
          : [
              ...entities,
              ...(entities[0]?.regionId
                ? [repo.entity(repo.region(entities[0].regionId)!.aggregateCode)!]
                : []),
              repo.entity('WLD')!,
            ]
      const items: { key: string; label: string; value: number }[] = []
      const lines: string[] = []
      const notes = [...assumedNote]
      for (const e of list.slice(0, MAX_ENTITIES)) {
        const used = resolveCode(repo, e, ind.id, group)
        notes.push(...worldNote(e, used))
        const v = q.waves.length
          ? (() => {
              const x = repo.value(ind.id, used.code, q.waves.at(-1)!, group)
              return x === null ? null : { wave: q.waves.at(-1)!, value: x }
            })()
          : latest(repo, ind.id, used.code, group)
        if (!v) {
          lines.push(`${used.shortName}: not published.`)
          continue
        }
        c.fact(used, ind, v.wave, v.value, group)
        items.push({ key: used.code, label: `${used.shortName} (${v.wave})`, value: v.value })
      }
      const sorted = [...items].sort((a, b) => b.value - a.value)
      if (sorted.length >= 2) {
        const hi = sorted[0]!
        const lo = sorted.at(-1)!
        const two = sorted.length === 2
        const strip = (l: string) => l.replace(/ \(\d+\)$/, '')
        lines.unshift(
          `${strip(hi.label)} has the ${two ? 'higher' : 'highest'} ${ind.shortLabel.toLowerCase()} (${c.fmt(ind, hi.value)}) and ${strip(lo.label)} the ${two ? 'lower' : 'lowest'} (${c.fmt(ind, lo.value)}) — a difference of ${pp(c.derived(`${strip(hi.label)} vs ${strip(lo.label)}`, 'Difference', 'latest values', hi.value - lo.value))}.`,
        )
      }
      const years = new Set(items.map((i) => i.label.match(/\((\d+)\)$/)?.[1]))
      if (years.size > 1)
        notes.push(
          'Values come from different survey years; each is the latest published for that economy.',
        )
      const codes = list.filter((e) => e.kind === 'economy').map((e) => e.code)
      return {
        ...base,
        status: items.length ? 'answered' : 'partial',
        text: lines,
        caveats: notes,
        chart: items.length
          ? { kind: 'bars', unit: ind.unit === 'pp' ? 'pp' : '%', items: sorted }
          : undefined,
        links:
          codes.length >= 2
            ? [{ to: `/compare?countries=${codes.join(',')}`, label: 'Open in Compare' }]
            : [],
        followUps: [
          `How has ${ind.shortLabel.toLowerCase()} changed in ${list[0]!.shortName}?`,
          `What is the gender gap in ${list[0]!.shortName}?`,
        ],
      }
    }

    case 'rank': {
      const scopeEntity = q.entities.find((e) => e.kind !== 'economy' && e.code !== 'WLD')
      const region = scopeEntity
        ? repo.regions.find((r) => r.aggregateCode === scopeEntity.code)
        : undefined
      const income = scopeEntity
        ? repo.incomeGroups.find((g) => g.aggregateCode === scopeEntity.code)
        : undefined
      const wave = q.waves.at(-1) ?? repo.latestWave
      const pool = repo.crossSection(ind.id, wave, {
        group,
        regionId: region?.id,
        incomeGroupId: income?.id,
      })
      const ranked = rankValues(pool, q.order).slice(0, q.limit)
      if (!ranked.length)
        return {
          ...base,
          status: 'partial',
          text: [
            `${ind.shortLabel} is not published for economies${scopeEntity ? ` in ${scopeEntity.shortName}` : ''} in ${wave}.`,
          ],
          followUps: SUGGESTIONS.slice(0, 3),
        }
      for (const r of ranked) c.fact(r.entity, ind, wave, r.value, group)
      const where = scopeEntity ? ` in ${scopeEntity.shortName}` : ''
      return {
        ...base,
        status: 'answered',
        text: [
          `${q.order === 'desc' ? 'Highest' : 'Lowest'} ${ind.shortLabel.toLowerCase()}${group !== 'all' ? ` among ${c.groupLabel(group).toLowerCase()}` : ''}${where}, ${wave}: ${ranked.map((r) => `${r.rank}. ${r.entity.shortName} (${c.fmt(ind, r.value)})`).join(', ')}.`,
          `Out of ${pool.length} economies with a published value.`,
        ],
        caveats: [
          ...assumedNote,
          'A rank is a position on this one indicator, not an overall judgement.',
        ],
        chart: {
          kind: 'bars',
          unit: ind.unit === 'pp' ? 'pp' : '%',
          items: ranked.map((r) => ({
            key: r.entity.code,
            label: r.entity.shortName,
            value: r.value,
          })),
        },
        links: [
          {
            to: `/rankings?metric=${ind.id}&year=${wave}${region ? `&region=${region.slug}` : ''}${q.order === 'asc' ? '&order=asc' : ''}`,
            label: 'Open in Rankings',
          },
        ],
        followUps: [
          `${q.order === 'desc' ? 'Lowest' : 'Highest'} ${ind.shortLabel.toLowerCase()}${where}`,
          `What is ${ind.shortLabel.toLowerCase()}?`,
        ],
      }
    }

    case 'gap': {
      const b = repo.breakdown(q.breakdown ?? 'sex')!
      const lines: string[] = []
      const items: { key: string; label: string; value: number }[] = []
      const notes: string[] = []
      for (const e of entities) {
        const used = resolveCode(repo, e, ind.id, b.disadvantaged)
        notes.push(...worldNote(e, used))
        const waves = q.waves.length ? q.waves : [...repo.waves].reverse()
        const w = waves.find((x) => repo.gap(ind.id, used.code, x, b.id) !== null)
        if (w === undefined) {
          lines.push(
            `The ${b.gapLabel.toLowerCase()} in ${ind.shortLabel.toLowerCase()} is not published for ${used.shortName}.`,
          )
          continue
        }
        const hi = repo.value(ind.id, used.code, w, b.advantaged)!
        const lo = repo.value(ind.id, used.code, w, b.disadvantaged)!
        c.fact(used, ind, w, hi, b.advantaged)
        c.fact(used, ind, w, lo, b.disadvantaged)
        const g = hi - lo
        let line = `${used.shortName}, ${w}: ${c.groupLabel(b.advantaged)} ${c.fmt(ind, hi)} vs ${c.groupLabel(b.disadvantaged)} ${c.fmt(ind, lo)} — ${b.gapLabel.toLowerCase()}: ${pp(c.derived(used.shortName, b.gapLabel, String(w), g))}${g < 0 ? ' (reversed)' : ''}.`
        const prevW = [...repo.waves]
          .reverse()
          .find((x) => x < w && repo.gap(ind.id, used.code, x, b.id) !== null)
        if (prevW !== undefined) {
          const pg = c.derived(
            used.shortName,
            b.gapLabel,
            String(prevW),
            repo.gap(ind.id, used.code, prevW, b.id)!,
          )
          const dd = Math.abs(g) - Math.abs(pg)
          line += ` In ${prevW} it was ${pp(pg)}, so it ${Math.abs(dd) < 1 ? 'is roughly unchanged' : dd < 0 ? 'narrowed' : 'widened'}.`
        }
        lines.push(line)
        items.push({ key: used.code, label: used.shortName, value: Math.round(g * 100) / 100 })
      }
      return {
        ...base,
        status: items.length ? 'answered' : 'partial',
        text: lines,
        caveats: [
          ...notes,
          'Gap = better-off group minus the other, in percentage points, from the two published group values.',
        ],
        chart: items.length > 1 ? { kind: 'bars', unit: 'pp', items } : undefined,
        links: [
          { to: `/gaps?breakdown=${b.id}&metric=${ind.id}`, label: 'Open in Inclusion Gaps' },
        ],
        followUps: [
          ...(b.id === 'sex' || b.id === 'income'
            ? [`Which countries have the highest ${b.gapLabel.toLowerCase()}?`]
            : []),
          `What is the ${b.id === 'income' ? 'gender' : 'income'} gap in ${entities[0]!.shortName}?`,
        ],
      }
    }

    case 'forecast': {
      const e = entities[0]!
      const view = buildForecast(repo, {
        metric: ind.id,
        ...(e.kind === 'economy'
          ? { country: e.code }
          : {
              region: repo.regions.find((r) => r.aggregateCode === e.code)?.slug,
              income: repo.incomeGroups.find((g) => g.aggregateCode === e.code)?.slug,
            }),
      })
      const sel = view.selected
      if (!sel?.projections.length)
        return {
          ...base,
          status: 'partial',
          text: [
            `Too few surveys to project ${ind.shortLabel.toLowerCase()} for ${view.target.label}.`,
          ],
          followUps: SUGGESTIONS.slice(0, 3),
        }
      const last = view.forecast.observations.at(-1)!
      c.facts.push({
        id: `${view.target.code}-${ind.id}-obs`,
        entity: view.target.label,
        indicator: ind.shortLabel,
        group: 'All adults',
        wave: last.year,
        value: c.fmt(ind, last.value),
      })
      for (const p of sel.projections)
        c.facts.push({
          id: `${view.target.code}-${ind.id}-${p.year}`,
          entity: view.target.label,
          indicator: `${ind.shortLabel} (FinLens projection)`,
          group: 'All adults',
          wave: p.year,
          value: `~${c.fmt(ind, p.value)} (80% range ${c.fmt(ind, p.low)}–${c.fmt(ind, p.high)})`,
        })
      return {
        ...base,
        status: 'answered',
        text: [
          `If the past pattern continued, a ${sel.model.label.toLowerCase()} puts ${ind.shortLabel.toLowerCase()} in ${view.target.label} at ${sel.projections.map((p) => `~${c.fmt(ind, p.value)} in ${p.year} (80% range ${c.fmt(ind, p.low)}–${c.fmt(ind, p.high)})`).join(' and ')}, from ${c.fmt(ind, last.value)} in ${last.year}.`,
        ],
        caveats: [
          'FinLens projection — not an official World Bank forecast. It assumes past trends continue.',
          ...(view.forecast.unstable
            ? [
                'The latest survey broke from the earlier pattern, so this projection is especially uncertain.',
              ]
            : []),
          ...assumedNote,
        ],
        links: [
          {
            to: `/forecast?metric=${ind.id}${e.kind === 'economy' ? `&country=${e.code}` : ''}`,
            label: 'See the forecast models',
          },
        ],
        followUps: [`How has ${ind.shortLabel.toLowerCase()} in ${view.target.label} changed?`],
      }
    }
  }
  return unknown('I could not answer that.')
}

export { SUGGESTIONS }
