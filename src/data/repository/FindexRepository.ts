import { DERIVED_INDICATORS } from '@/data/indicators/derived'
import type {
  BenchmarkValue,
  Benchmarks,
  Breakdown,
  BreakdownId,
  CountryCode,
  DatasetMeta,
  Entity,
  GroupId,
  IncomeGroup,
  IndicatorDefinition,
  IndicatorId,
  Observation,
  ObservationPack,
  Region,
  SeriesPoint,
  Wave,
} from '@/data/types'

export type JsonFetcher = <T>(path: string) => Promise<T>

export interface CrossSectionOptions {
  group?: GroupId
  /** Default: economies only. */
  kinds?: Entity['kind'][]
  regionId?: string
  incomeGroupId?: string
}

export interface ObservationQuery {
  indicatorIds?: IndicatorId[]
  codes?: CountryCode[]
  waves?: Wave[]
  groups?: GroupId[]
}

const key = (code: CountryCode, wave: Wave, group: GroupId) => `${code}|${wave}|${group}`
const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * In-memory access to the processed Global Findex dataset.
 *
 * - `meta.json` + `core.json` (all adults, women, men × curated indicators) load up front.
 * - Other population groups (`core-groups.json`) and non-core series (`series/<id>.json`)
 *   load on demand via `ensureGroups()` / `ensureIndicators()`.
 * - Values are returned exactly as published (percent, 2 dp). Missing is `null`, never 0.
 * - Derived indicators are computed from published inputs on read.
 */
export class FindexRepository {
  readonly meta: DatasetMeta
  private readonly fetchJson: JsonFetcher
  private readonly values = new Map<IndicatorId, Map<string, number>>()
  private readonly indicatorsById: Map<IndicatorId, IndicatorDefinition>
  private readonly entitiesByCode: Map<CountryCode, Entity>
  private readonly pending = new Map<string, Promise<void>>()
  private groupsLoaded = false

  private constructor(meta: DatasetMeta, fetchJson: JsonFetcher) {
    this.meta = meta
    this.fetchJson = fetchJson
    const derived = DERIVED_INDICATORS.map((d) => ({
      ...d,
      coverage: this.derivedCoverage(d, meta),
    }))
    this.indicatorsById = new Map([...meta.indicators, ...derived].map((i) => [i.id, i]))
    this.entitiesByCode = new Map(meta.entities.map((e) => [e.code, e]))
  }

  static async load(fetchJson: JsonFetcher): Promise<FindexRepository> {
    const meta = await fetchJson<DatasetMeta>('meta.json')
    if (meta.schemaVersion !== 1)
      throw new Error(`Unsupported data schema version ${String(meta.schemaVersion)}`)
    const repo = new FindexRepository(meta, fetchJson)
    repo.ingest(await fetchJson<ObservationPack>(repo.versioned('core.json')))
    return repo
  }

  /** For tests and fixtures. */
  static fromData(
    meta: DatasetMeta,
    packs: ObservationPack[],
    fetchJson?: JsonFetcher,
  ): FindexRepository {
    const repo = new FindexRepository(
      meta,
      fetchJson ?? (() => Promise.reject(new Error('No fetcher'))),
    )
    packs.forEach((p) => repo.ingest(p))
    return repo
  }

  // ---- Reference data -----------------------------------------------------------------------

  get waves(): Wave[] {
    return this.meta.waves
  }
  get latestWave(): Wave {
    return this.meta.waves[this.meta.waves.length - 1]!
  }
  get regions(): Region[] {
    return this.meta.regions
  }
  get incomeGroups(): IncomeGroup[] {
    return this.meta.incomeGroups
  }
  get breakdowns(): Breakdown[] {
    return this.meta.breakdowns
  }

  economies(): Entity[] {
    return this.meta.entities.filter((e) => e.kind === 'economy')
  }
  entity(code: CountryCode): Entity | undefined {
    return this.entitiesByCode.get(code.toUpperCase())
  }
  entityBySlug(slug: string, kind: 'economy' | 'aggregate' = 'economy'): Entity | undefined {
    const s = slug.toLowerCase()
    return this.meta.entities.find(
      (e) => e.slug === s && (kind === 'economy' ? e.kind === 'economy' : e.kind !== 'economy'),
    )
  }
  region(id: string): Region | undefined {
    return this.meta.regions.find((r) => r.id === id || r.slug === id)
  }
  incomeGroup(id: string): IncomeGroup | undefined {
    return this.meta.incomeGroups.find((g) => g.id === id || g.slug === id)
  }
  breakdown(id: BreakdownId): Breakdown | undefined {
    return this.meta.breakdowns.find((b) => b.id === id)
  }

  indicators(
    filter: { core?: boolean; category?: IndicatorDefinition['category'] } = {},
  ): IndicatorDefinition[] {
    return [...this.indicatorsById.values()].filter(
      (i) =>
        (filter.core === undefined || i.core === filter.core) &&
        (!filter.category || i.category === filter.category),
    )
  }
  indicator(id: IndicatorId): IndicatorDefinition | undefined {
    return this.indicatorsById.get(id)
  }

  population(code: CountryCode, wave: Wave): number | null {
    return this.meta.populations[code]?.[String(wave)] ?? null
  }
  /** Fieldwork year when it differs from the wave (e.g. 2022 fieldwork counted in the 2021 wave). */
  surveyYear(code: CountryCode, wave: Wave): number {
    return this.meta.surveyYears[code]?.[String(wave)] ?? wave
  }

  // ---- Loading ------------------------------------------------------------------------------

  isLoaded(id: IndicatorId): boolean {
    const def = this.indicatorsById.get(id)
    if (def?.derived)
      return (
        def.derived.inputs.every((i) => this.values.has(i)) &&
        (!def.derived.groupsOnly || this.groupsLoaded)
      )
    return this.values.has(id)
  }
  get hasAllGroups(): boolean {
    return this.groupsLoaded
  }

  /** Loads all population groups (income, education, age, labor force, location) for core indicators. */
  ensureGroups(): Promise<void> {
    if (this.groupsLoaded) return Promise.resolve()
    return this.once('groups', async () => {
      this.ingest(await this.fetchJson<ObservationPack>(this.versioned('core-groups.json')))
      this.groupsLoaded = true
    })
  }

  /** Loads catalogue (non-core) series on demand. Unknown ids are ignored. */
  async ensureIndicators(ids: IndicatorId[]): Promise<void> {
    const needed = ids.flatMap((id) => {
      const def = this.indicatorsById.get(id)
      if (!def) return []
      return def.derived ? def.derived.inputs : [id]
    })
    const tasks = needed
      .filter((id) => !this.values.has(id))
      .map((id) =>
        this.once(`series:${id}`, async () => {
          this.ingest(await this.fetchJson<ObservationPack>(this.versioned(`series/${id}.json`)))
        }),
      )
    if (ids.some((id) => this.indicatorsById.get(id)?.derived?.groupsOnly))
      tasks.push(this.ensureGroups())
    await Promise.all(tasks)
  }

  // ---- Values -------------------------------------------------------------------------------

  /** A single published (or derived) value, or null when not measured. */
  value(id: IndicatorId, code: CountryCode, wave: Wave, group: GroupId = 'all'): number | null {
    switch (id) {
      case 'noAccount': {
        const v = this.raw('accountOwnership', code, wave, group)
        return v === null ? null : round2(100 - v)
      }
      case 'genderGapAccount':
        return group === 'all' ? this.gap('accountOwnership', code, wave, 'sex') : null
      case 'incomeGapAccount':
        return group === 'all' ? this.gap('accountOwnership', code, wave, 'income') : null
      default:
        return this.raw(id, code, wave, group)
    }
  }

  /** Gap in percentage points: advantaged − disadvantaged group. Null unless both are published. */
  gap(id: IndicatorId, code: CountryCode, wave: Wave, breakdown: BreakdownId): number | null {
    const b = this.breakdown(breakdown)
    if (!b) return null
    const hi = this.value(id, code, wave, b.advantaged)
    const lo = this.value(id, code, wave, b.disadvantaged)
    return hi === null || lo === null ? null : round2(hi - lo)
  }

  /** Values across every wave, in order. Missing waves are present with `value: null`. */
  series(id: IndicatorId, code: CountryCode, group: GroupId = 'all'): SeriesPoint[] {
    return this.meta.waves.map((wave) => ({ wave, value: this.value(id, code, wave, group) }))
  }

  /** Most recent wave with a value, at or before `atOrBefore`. */
  latest(
    id: IndicatorId,
    code: CountryCode,
    group: GroupId = 'all',
    atOrBefore?: Wave,
  ): { wave: Wave; value: number } | null {
    for (let i = this.meta.waves.length - 1; i >= 0; i--) {
      const wave = this.meta.waves[i]!
      if (atOrBefore !== undefined && wave > atOrBefore) continue
      const value = this.value(id, code, wave, group)
      if (value !== null) return { wave, value }
    }
    return null
  }

  /** The previous wave (strictly before `wave`) that has a value — for "vs previous survey" deltas. */
  previous(id: IndicatorId, code: CountryCode, wave: Wave, group: GroupId = 'all') {
    return this.latest(id, code, group, wave - 1)
  }

  /** One indicator for many entities in one wave. Entities without a value are omitted. */
  crossSection(
    id: IndicatorId,
    wave: Wave,
    opts: CrossSectionOptions = {},
  ): { entity: Entity; value: number }[] {
    const kinds = opts.kinds ?? ['economy']
    const out: { entity: Entity; value: number }[] = []
    for (const e of this.meta.entities) {
      if (!kinds.includes(e.kind)) continue
      if (opts.regionId && e.regionId !== opts.regionId) continue
      if (opts.incomeGroupId && e.incomeGroupId !== opts.incomeGroupId) continue
      const v = this.value(id, e.code, wave, opts.group ?? 'all')
      if (v !== null) out.push({ entity: e, value: v })
    }
    return out
  }

  /**
   * Benchmarks for an economy: its region, income group and the world, using the aggregates
   * published by the World Bank in the Findex file (not recomputed by FinLens).
   */
  benchmarks(id: IndicatorId, code: CountryCode, wave: Wave, group: GroupId = 'all'): Benchmarks {
    const e = this.entity(code)
    const bench = (aggCode: string | null | undefined): BenchmarkValue | null => {
      if (!aggCode) return null
      const agg = this.entity(aggCode)
      if (!agg) return null
      return { code: agg.code, name: agg.shortName, value: this.value(id, agg.code, wave, group) }
    }
    return {
      region: bench(e?.regionId ? this.region(e.regionId)?.aggregateCode : null),
      incomeGroup: bench(
        e?.incomeGroupId ? this.incomeGroup(e.incomeGroupId)?.aggregateCode : null,
      ),
      world: bench('WLD'),
    }
  }

  /** Adults (15+) without an account = adult population × (100 − account ownership) / 100. */
  adultsWithoutAccount(code: CountryCode, wave: Wave): number | null {
    const pop = this.population(code, wave)
    const share = this.value('noAccount', code, wave)
    return pop === null || share === null ? null : Math.round((pop * share) / 100)
  }

  /** Flat observations for the Data Explorer and CSV export. Only loaded indicators are included. */
  query(q: ObservationQuery = {}): Observation[] {
    const ids = q.indicatorIds ?? [...this.values.keys()]
    const codes = q.codes ? new Set(q.codes) : null
    const waves = q.waves ? new Set(q.waves) : null
    const groups = q.groups ? new Set(q.groups) : new Set<GroupId>(['all'])
    const out: Observation[] = []
    for (const indicatorId of ids) {
      const def = this.indicatorsById.get(indicatorId)
      if (def?.derived) {
        for (const e of this.meta.entities) {
          if (codes && !codes.has(e.code)) continue
          for (const wave of this.meta.waves) {
            if (waves && !waves.has(wave)) continue
            for (const group of groups) {
              const value = this.value(indicatorId, e.code, wave, group)
              if (value !== null) out.push({ indicatorId, code: e.code, wave, group, value })
            }
          }
        }
        continue
      }
      const map = this.values.get(indicatorId)
      if (!map) continue
      for (const [k, value] of map) {
        const [code, w, group] = k.split('|') as [string, string, GroupId]
        const wave = Number(w)
        if (codes && !codes.has(code)) continue
        if (waves && !waves.has(wave)) continue
        if (!groups.has(group)) continue
        out.push({ indicatorId, code, wave, group, value })
      }
    }
    return out
  }

  // ---- Internals ----------------------------------------------------------------------------

  private raw(id: IndicatorId, code: CountryCode, wave: Wave, group: GroupId): number | null {
    return this.values.get(id)?.get(key(code, wave, group)) ?? null
  }

  private ingest(pack: ObservationPack) {
    if (pack.schemaVersion !== 1) throw new Error('Unsupported observation pack')
    const maps = pack.columns.map((id) => {
      let m = this.values.get(id)
      if (!m) this.values.set(id, (m = new Map()))
      return m
    })
    for (const row of pack.rows) {
      const [code, wave, group] = row
      const k = key(code, wave, group)
      for (let i = 0; i < maps.length; i++) {
        const v = row[i + 3]
        if (typeof v === 'number') maps[i]!.set(k, v)
      }
    }
  }

  private once(id: string, task: () => Promise<void>): Promise<void> {
    const existing = this.pending.get(id)
    if (existing) return existing
    const p = task().catch((err: unknown) => {
      this.pending.delete(id) // allow retry
      throw err
    })
    this.pending.set(id, p)
    return p
  }

  private versioned(path: string): string {
    return `${path}?v=${encodeURIComponent(this.meta.builtAt)}`
  }

  private derivedCoverage(
    d: IndicatorDefinition,
    meta: DatasetMeta,
  ): IndicatorDefinition['coverage'] {
    const input = meta.indicators.find((i) => i.id === d.derived?.inputs[0])
    return input?.coverage ? { ...input.coverage } : null
  }
}
