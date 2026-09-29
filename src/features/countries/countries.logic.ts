import type { FindexRepository } from '@/data/repository'
import type { Entity, Wave } from '@/data/types'

export interface CountryRow {
  entity: Entity
  region: string
  incomeGroup: string
  incomeOrder: number
  wave: Wave | null
  account: number | null
  accountDelta: number | null
  previousWave: Wave | null
  mobileMoney: number | null
  digitalPayments: number | null
  genderGap: number | null
}

export type SortKey =
  | 'name'
  | 'region'
  | 'income'
  | 'account'
  | 'accountDelta'
  | 'mobileMoney'
  | 'digitalPayments'
  | 'genderGap'

/** One row per economy, using its latest wave with account-ownership data. */
export function countryRows(repo: FindexRepository): CountryRow[] {
  return repo.economies().map((e) => {
    const latest = repo.latest('accountOwnership', e.code)
    const wave = latest?.wave ?? null
    const prev = wave ? repo.previous('accountOwnership', e.code, wave) : null
    const r = e.regionId ? repo.region(e.regionId) : undefined
    const g = e.incomeGroupId ? repo.incomeGroup(e.incomeGroupId) : undefined
    return {
      entity: e,
      region: r?.name ?? '—',
      incomeGroup: g?.name ?? '—',
      incomeOrder: g?.order ?? 0,
      wave,
      account: latest?.value ?? null,
      accountDelta: latest && prev ? Math.round((latest.value - prev.value) * 100) / 100 : null,
      previousWave: prev?.wave ?? null,
      mobileMoney: wave ? repo.value('mobileMoneyAccount', e.code, wave) : null,
      digitalPayments: wave ? repo.value('digitalPayments', e.code, wave) : null,
      genderGap: wave ? repo.value('genderGapAccount', e.code, wave) : null,
    }
  })
}

/** Nulls always sort last, whatever the direction. */
export function sortRows(rows: CountryRow[], key: SortKey, dir: 'asc' | 'desc'): CountryRow[] {
  const val = (r: CountryRow): string | number | null => {
    switch (key) {
      case 'name':
        return r.entity.shortName
      case 'region':
        return r.region
      case 'income':
        return r.incomeOrder
      default:
        return r[key]
    }
  }
  return [...rows].sort((a, b) => {
    const va = val(a)
    const vb = val(b)
    if (va === null && vb === null) return a.entity.shortName.localeCompare(b.entity.shortName)
    if (va === null) return 1
    if (vb === null) return -1
    const c =
      typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
    return (dir === 'asc' ? c : -c) || a.entity.shortName.localeCompare(b.entity.shortName)
  })
}

export function filterRows(
  rows: CountryRow[],
  q: string,
  regionId?: string,
  incomeGroupId?: string,
): CountryRow[] {
  const s = q.trim().toLowerCase()
  return rows.filter(
    (r) =>
      (!regionId || r.entity.regionId === regionId) &&
      (!incomeGroupId || r.entity.incomeGroupId === incomeGroupId) &&
      (!s || `${r.entity.shortName} ${r.entity.name} ${r.entity.code}`.toLowerCase().includes(s)),
  )
}
