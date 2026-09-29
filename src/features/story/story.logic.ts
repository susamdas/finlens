import type { FindexRepository } from '@/data/repository'
import type { BreakdownId, Wave } from '@/data/types'
import { buildForecast } from '@/features/forecast/forecast.logic'
import { unbankedAdults } from '@/lib/analytics/kpi'
import { DEVELOPING, scopeSourceFor, WORLD } from '@/lib/analytics/scope'
import type { ModelForecast, Observation } from '@/lib/forecast'
import { compactPeople, pct, pp } from '@/lib/insights/text'

/**
 * Story mode (spec §23): a guided tour whose every sentence and chart is computed from the
 * dataset. Steps whose data is missing are dropped rather than shown with placeholders.
 */

export type StoryVisual =
  | {
      kind: 'trend'
      unit: '%' | 'pp'
      series: { id: string; label: string; points: { wave: Wave; value: number | null }[] }[]
    }
  | {
      kind: 'bars'
      items: { key: string; label: string; value: number; highlight?: boolean }[]
      max?: number
    }
  | { kind: 'stat'; value: string; caption: string }
  | { kind: 'forecast'; observed: Observation[]; model: ModelForecast }

export interface StoryStep {
  id: string
  kicker: string
  title: string
  body: string[]
  visual: StoryVisual
  source: string
  link: { to: string; label: string }
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function buildStory(repo: FindexRepository, groupsReady: boolean): StoryStep[] {
  const wave = repo.latestWave
  const first = repo.waves[0]!
  const steps: StoryStep[] = []
  const series = (id: string, code: string, group: 'all' = 'all') => repo.series(id, code, group)

  // 1 · Progress
  const w0 = repo.value('accountOwnership', 'WLD', first)
  const w1 = repo.value('accountOwnership', 'WLD', wave)
  if (w0 !== null && w1 !== null)
    steps.push({
      id: 'progress',
      kicker: `${first}–${wave}`,
      title: 'More than a decade of progress',
      body: [
        `In ${first}, ${pct(w0)} of adults worldwide had an account. By ${wave} it was ${pct(w1)} — ${pp(w1 - w0)} more.`,
        'Every region has moved up, but at very different speeds.',
      ],
      visual: {
        kind: 'trend',
        unit: '%',
        series: [
          { id: 'WLD', label: 'World', points: series('accountOwnership', 'WLD') },
          ...repo.regions.map((r) => ({
            id: r.aggregateCode,
            label: r.name,
            points: series('accountOwnership', r.aggregateCode),
          })),
        ],
      },
      source: 'World and regional aggregates, all survey waves',
      link: { to: '/trends', label: 'Explore trends' },
    })

  // 2 · Still excluded
  const u = unbankedAdults(
    repo,
    repo.economies().map((e) => e.code),
    wave,
  )
  const noAcc = repo.value('noAccount', 'WLD', wave)
  if (u && noAcc !== null)
    steps.push({
      id: 'excluded',
      kicker: 'Still outside',
      title: `About ${compactPeople(u.total)} adults have no account`,
      body: [
        `Across the ${u.economies} economies surveyed in ${wave} — ${pct(noAcc)} of adults worldwide. (FinLens estimate: adult population × published share without an account.)`,
        'The share without an account is highest in the regions below — most of the unbanked live in developing economies.',
      ],
      visual: {
        kind: 'bars',
        max: 100,
        items: repo.regions
          .flatMap((r) => {
            const v = repo.value('noAccount', r.aggregateCode, wave)
            return v === null ? [] : [{ key: r.id, label: r.name, value: v }]
          })
          .sort((a, b) => b.value - a.value),
      },
      source: `Share of adults without an account, ${wave}`,
      link: { to: '/map?metric=noAccount', label: 'See the map' },
    })

  // 3 · Gender gap
  const gapPts = repo.waves.map((w) => ({
    wave: w,
    value: repo.gap('accountOwnership', 'WLD', w, 'sex'),
  }))
  const g0 = gapPts.find((p) => p.value !== null)
  const g1 = gapPts.at(-1)
  const wide = repo.crossSection('genderGapAccount', wave).filter((x) => x.value >= 20).length
  if (g0?.value != null && g1?.value != null)
    steps.push({
      id: 'gender',
      kicker: 'Women and men',
      title: g1.value < g0.value ? 'The gender gap is narrowing' : 'The gender gap persists',
      body: [
        `Worldwide, the gap between men’s and women’s account ownership went from ${pp(g0.value)} in ${g0.wave} to ${pp(g1.value)} in ${g1.wave}.`,
        wide > 0
          ? `But in ${wide} economies it is still 20 points or more — see Inclusion Gaps for where.`
          : 'No economy has a gap of 20 points or more.',
      ],
      visual: {
        kind: 'trend',
        unit: 'pp',
        series: [{ id: 'gap', label: 'Gender gap (men − women)', points: gapPts }],
      },
      source: 'World aggregate, men and women',
      link: { to: '/gaps', label: 'Explore gaps' },
    })

  // 4 · Other gaps (needs every population group)
  if (groupsReady) {
    const rows = repo.breakdowns
      .map((b) => ({ b, gap: repo.gap('accountOwnership', 'WLD', wave, b.id as BreakdownId) }))
      .filter((r): r is { b: (typeof r)['b']; gap: number } => r.gap !== null)
      .sort((a, b) => b.gap - a.gap)
    if (rows.length >= 3)
      steps.push({
        id: 'gaps',
        kicker: 'Who is left behind',
        title: `The widest divide is by ${rows[0]!.b.label.toLowerCase()}`,
        body: [
          `Account ownership differs by ${pp(rows[0]!.gap)} between groups by ${rows[0]!.b.label.toLowerCase()} — more than the gender gap.`,
          'Education, age, work and income all shape who is included.',
        ],
        visual: {
          kind: 'bars',
          items: rows.map((r) => ({
            key: r.b.id,
            label: r.b.gapLabel,
            value: r.gap,
            highlight: r.b.id === rows[0]!.b.id,
          })),
        },
        source: `World aggregate, ${wave}; gap = advantaged − disadvantaged group, pp`,
        link: { to: `/gaps?breakdown=${rows[0]!.b.id}`, label: 'Explore this gap' },
      })
  }

  // 5 · Digital
  const dSrc = scopeSourceFor(repo, 'digitalPayments', WORLD)
  const dPts = series('digitalPayments', dSrc.code)
  const dObs = dPts.filter((p) => p.value !== null)
  if (dObs.length >= 2) {
    const a = dObs[0]!
    const b = dObs.at(-1)!
    const mobileOnly = repo
      .crossSection('accountOwnership', wave)
      .flatMap(({ entity, value }) => {
        const fi = repo.value('fiAccount', entity.code, wave)
        return fi === null ? [] : [{ entity, v: r2(value - fi) }]
      })
      .sort((x, y) => y.v - x.v)
    const top = mobileOnly[0]
    steps.push({
      id: 'digital',
      kicker: 'Going digital',
      title: 'Digital payments are becoming the norm',
      body: [
        `In ${dSrc.label.toLowerCase()}, adults making or receiving a digital payment rose from ${pct(a.value!)} in ${a.wave} to ${pct(b.value!)} in ${b.wave}.`,
        top && top.v >= 20
          ? `Mobile money opened a second route: in ${top.entity.shortName}, ${pct(top.v)} of adults are included only through mobile money.`
          : '',
      ].filter(Boolean),
      visual: {
        kind: 'trend',
        unit: '%',
        series: [
          { id: 'dp', label: `Digital payments (${dSrc.label})`, points: dPts },
          {
            id: 'mm',
            label: `Mobile money (${dSrc.label})`,
            points: series('mobileMoneyAccount', dSrc.code),
          },
        ],
      },
      source: `${dSrc.label} aggregate`,
      link: { to: '/digital', label: 'Explore digital finance' },
    })
  }

  // 6 · Saving outside banks
  const any = repo.value('savedAny', DEVELOPING.code, wave)
  const formal = repo.value('formalSavings', DEVELOPING.code, wave)
  const informal = repo.value('savedInformal', DEVELOPING.code, wave)
  if (any !== null && formal !== null)
    steps.push({
      id: 'saving',
      kicker: 'Saving and credit',
      title: 'Many people save — not all of it in a bank',
      body: [
        `In developing economies, ${pct(any)} of adults saved in the past year but ${pct(formal)} saved formally.`,
        informal !== null
          ? `${pct(informal)} used a savings club or a person outside the family — the informal systems microfinance builds on.`
          : '',
      ].filter(Boolean),
      visual: {
        kind: 'bars',
        max: 100,
        items: [
          { key: 'any', label: 'Saved any money', value: any },
          { key: 'formal', label: 'Saved formally', value: formal },
          ...(informal !== null
            ? [{ key: 'informal', label: 'Saved informally', value: informal }]
            : []),
        ],
      },
      source: `Developing-economies aggregate, ${wave}`,
      link: { to: '/microfinance', label: 'Open the Microfinance Lens' },
    })

  // 7 · Outlook
  const fc = buildForecast(repo)
  if (fc.selected?.projections.length) {
    const last = fc.selected.projections.at(-1)!
    steps.push({
      id: 'outlook',
      kicker: 'Looking ahead',
      title: `If trends continue: ~${pct(last.value)} by ${last.year}`,
      body: [
        `A simple ${fc.selected.model.label.toLowerCase()} fitted to the world surveys points to about ${pct(last.value)} of adults with an account by ${last.year} (80% range ${pct(last.low)}–${pct(last.high)}).`,
        'This is a FinLens projection, not an official World Bank forecast. Policy — and people — can change the trend.',
      ],
      visual: { kind: 'forecast', observed: fc.forecast.observations, model: fc.selected },
      source: 'FinLens projection from World aggregates',
      link: { to: '/forecast', label: 'See the forecast models' },
    })
  }

  return steps
}
