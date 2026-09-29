import type { FindexRepository } from '@/data/repository'
import type { Entity, GroupId, IndicatorDefinition, IndicatorId, Wave } from '@/data/types'
import type { Cell } from '@/lib/export'

/**
 * Data Explorer (spec §24): query the published observations by indicator, economy or
 * aggregate, wave and population group, view them long or wide, and download exactly what is
 * selected. Values are the repository's (published or labelled FinLens-derived) — no filling.
 */

export type Layout = 'long' | 'wide'

export interface ExplorerQuery {
  indicators: IndicatorId[]
  /** Economy/aggregate codes; empty = every economy. */
  codes: string[]
  /** Include aggregates (World, regions, income groups) when `codes` is empty. */
  aggregates: boolean
  regionId: string | null
  waves: Wave[]
  groups: GroupId[]
  layout: Layout
}

export interface ExplorerRow {
  key: string
  indicator: IndicatorDefinition
  entity: Entity
  region: string
  income: string
  wave: Wave
  surveyYear: number
  group: GroupId
  groupLabel: string
  value: number
}

export const MAX_INDICATORS = 12
export const DEFAULT_INDICATOR: IndicatorId = 'accountOwnership'

const list = (v: string | null) =>
  v
    ? v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []

/** Reads the explorer state from URL parameters, dropping anything unknown. */
export function parseExplorerParams(repo: FindexRepository, p: URLSearchParams): ExplorerQuery {
  const indicators = list(p.get('ind'))
    .filter((id) => repo.indicator(id))
    .slice(0, MAX_INDICATORS)
  const codes = list(p.get('codes'))
    .map((c) => c.toUpperCase())
    .filter((c) => repo.entity(c))
  const waves = list(p.get('waves'))
    .map(Number)
    .filter((w) => repo.waves.includes(w))
  const groups = list(p.get('groups')).filter((g) =>
    repo.meta.groups.some((x) => x.id === g),
  ) as GroupId[]
  const region = p.get('region')
  return {
    indicators: indicators.length ? indicators : [DEFAULT_INDICATOR],
    codes,
    aggregates: p.get('agg') === '1',
    regionId: region && repo.region(region) ? repo.region(region)!.id : null,
    waves: waves.length ? waves.sort() : [repo.latestWave],
    groups: groups.length ? groups : ['all'],
    layout: p.get('layout') === 'wide' ? 'wide' : 'long',
  }
}

export function explorerParams(
  repo: FindexRepository,
  q: ExplorerQuery,
): Record<string, string | null> {
  const def = q.indicators.length === 1 && q.indicators[0] === DEFAULT_INDICATOR
  return {
    ind: def ? null : q.indicators.join(','),
    codes: q.codes.length ? q.codes.join(',') : null,
    agg: q.aggregates ? '1' : null,
    region: q.regionId ? (repo.region(q.regionId)?.slug ?? null) : null,
    waves: q.waves.length === 1 && q.waves[0] === repo.latestWave ? null : q.waves.join(','),
    groups: q.groups.length === 1 && q.groups[0] === 'all' ? null : q.groups.join(','),
    layout: q.layout === 'wide' ? 'wide' : null,
  }
}

export function needsGroups(q: ExplorerQuery) {
  return q.groups.some((g) => g !== 'all')
}

export function runQuery(repo: FindexRepository, q: ExplorerQuery): ExplorerRow[] {
  let entities: Entity[]
  if (q.codes.length) entities = q.codes.map((c) => repo.entity(c)!).filter(Boolean)
  else {
    entities = repo.economies()
    if (q.aggregates)
      entities = [...repo.meta.entities.filter((e) => e.kind !== 'economy'), ...entities]
  }
  if (q.regionId)
    entities = entities.filter(
      (e) => e.regionId === q.regionId || e.code === repo.region(q.regionId!)?.aggregateCode,
    )
  const codes = new Set(entities.map((e) => e.code))
  const groupLabel = (g: GroupId) => repo.meta.groups.find((x) => x.id === g)?.label ?? g
  const obs = repo.query({
    indicatorIds: q.indicators,
    codes: [...codes],
    waves: q.waves,
    groups: q.groups,
  })
  const order = new Map(q.indicators.map((id, i) => [id, i]))
  return obs
    .map((o) => {
      const e = repo.entity(o.code)!
      return {
        key: `${o.indicatorId}|${o.code}|${o.wave}|${o.group}`,
        indicator: repo.indicator(o.indicatorId)!,
        entity: e,
        region: e.regionId ? (repo.region(e.regionId)?.name ?? '') : '',
        income: e.incomeGroupId ? (repo.incomeGroup(e.incomeGroupId)?.name ?? '') : '',
        wave: o.wave,
        surveyYear: repo.surveyYear(o.code, o.wave),
        group: o.group,
        groupLabel: groupLabel(o.group),
        value: o.value,
      }
    })
    .sort(
      (a, b) =>
        order.get(a.indicator.id)! - order.get(b.indicator.id)! ||
        Number(a.entity.kind === 'economy') - Number(b.entity.kind === 'economy') ||
        a.entity.shortName.localeCompare(b.entity.shortName) ||
        a.wave - b.wave ||
        a.groupLabel.localeCompare(b.groupLabel),
    )
}

export type SortKey = 'entity' | 'indicator' | 'wave' | 'group' | 'value'

export function sortRows(
  rows: ExplorerRow[],
  key: SortKey | null,
  dir: 'asc' | 'desc',
): ExplorerRow[] {
  if (!key) return rows
  const s = dir === 'asc' ? 1 : -1
  const get = (r: ExplorerRow): string | number =>
    key === 'entity'
      ? r.entity.shortName
      : key === 'indicator'
        ? r.indicator.shortLabel
        : key === 'wave'
          ? r.wave
          : key === 'group'
            ? r.groupLabel
            : r.value
  return [...rows].sort((a, b) => {
    const x = get(a)
    const y = get(b)
    return (
      s *
      (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)))
    )
  })
}

export const LONG_COLUMNS = [
  'indicator_id',
  'findex_series',
  'indicator',
  'unit',
  'economy_code',
  'economy',
  'type',
  'region',
  'income_group',
  'wave',
  'survey_year',
  'group',
  'value',
]

export function longTable(rows: ExplorerRow[]): { columns: string[]; rows: Cell[][] } {
  return {
    columns: LONG_COLUMNS,
    rows: rows.map((r) => [
      r.indicator.id,
      r.indicator.code ?? 'FinLens-derived',
      r.indicator.label,
      r.indicator.unitLabel,
      r.entity.code,
      r.entity.name,
      r.entity.kind,
      r.region,
      r.income,
      r.wave,
      r.surveyYear,
      r.groupLabel,
      r.value,
    ]),
  }
}

/** One row per economy × group; one column per indicator × wave. */
export function wideTable(
  rows: ExplorerRow[],
  q: ExplorerQuery,
  repo: FindexRepository,
): { columns: string[]; rows: Cell[][] } {
  const cols: { id: IndicatorId; wave: Wave; label: string }[] = []
  for (const id of q.indicators)
    for (const w of q.waves)
      cols.push({ id, wave: w, label: `${repo.indicator(id)?.shortLabel ?? id} (${w})` })
  const byRow = new Map<string, { entity: Entity; group: string; values: Map<string, number> }>()
  for (const r of rows) {
    const k = `${r.entity.code}|${r.group}`
    if (!byRow.has(k)) byRow.set(k, { entity: r.entity, group: r.groupLabel, values: new Map() })
    byRow.get(k)!.values.set(`${r.indicator.id}|${r.wave}`, r.value)
  }
  return {
    columns: ['economy_code', 'economy', 'group', ...cols.map((c) => c.label)],
    rows: [...byRow.values()].map((r) => [
      r.entity.code,
      r.entity.name,
      r.group,
      ...cols.map((c) => r.values.get(`${c.id}|${c.wave}`) ?? null),
    ]),
  }
}
