import type { FindexRepository } from '@/data/repository'
import type { Entity, GroupId, IndicatorId, Wave } from '@/data/types'

export interface Mover {
  entity: Entity
  value: number
  previous: { wave: Wave; value: number }
  delta: number
}

/**
 * Change for each economy between `wave` and its previous wave with data.
 * Only economies measured in both waves are included — no gap filling.
 */
export function changes(
  repo: FindexRepository,
  id: IndicatorId,
  wave: Wave,
  economies: Entity[],
  group: GroupId = 'all',
): Mover[] {
  const out: Mover[] = []
  for (const entity of economies) {
    const value = repo.value(id, entity.code, wave, group)
    if (value === null) continue
    const previous = repo.previous(id, entity.code, wave, group)
    if (!previous) continue
    out.push({ entity, value, previous, delta: Math.round((value - previous.value) * 100) / 100 })
  }
  return out
}

export function topMovers(movers: Mover[], n: number, direction: 'up' | 'down' = 'up'): Mover[] {
  return [...movers]
    .sort((a, b) => (direction === 'up' ? b.delta - a.delta : a.delta - b.delta))
    .slice(0, n)
}

export interface Ranked {
  entity: Entity
  value: number
  rank: number
}

/** Rank economies by value, highest first. Ties share a rank (competition ranking). */
export function rank(items: { entity: Entity; value: number }[]): Ranked[] {
  const sorted = [...items].sort(
    (a, b) => b.value - a.value || a.entity.shortName.localeCompare(b.entity.shortName),
  )
  let prev: number | null = null
  let prevRank = 0
  return sorted.map((it, i) => {
    const r = prev !== null && it.value === prev ? prevRank : i + 1
    prev = it.value
    prevRank = r
    return { ...it, rank: r }
  })
}
