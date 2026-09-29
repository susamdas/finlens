import type { FindexRepository } from '@/data/repository'
import { Flag } from '@/components/common/Flag'
import { formatPercent, formatPP, MISSING_TEXT } from '@/lib/format'
import { economyDetail, type MapModel } from './map.logic'

/** Tooltip body for a hovered economy (spec §6). Values are dataset values or "Data unavailable". */
export function MapTooltipContent({
  repo,
  model,
  code,
  name,
}: {
  repo: FindexRepository
  model: MapModel
  code: string
  name: string
}) {
  const d = economyDetail(repo, code, model.wave)
  if (!d || d.entity.kind !== 'economy') {
    return (
      <>
        <p className="font-semibold">{name}</p>
        <p className="mt-1 text-muted-foreground">Not covered by the Global Findex survey.</p>
      </>
    )
  }
  const fmt = model.metric.indicator.unit === 'pp' ? formatPP : formatPercent
  const v = model.values[code]
  const regionAvg = d.region ? model.regionAverage[d.region.id] : undefined
  return (
    <>
      <div className="flex items-center gap-2">
        <Flag iso2={d.entity.iso2} code={d.entity.code} className="h-4 w-5" />
        <p className="font-semibold">{d.entity.shortName}</p>
      </div>
      <div className="mt-2 rounded-lg bg-muted/60 px-2.5 py-2">
        <p className="text-muted-foreground">{model.metric.label}</p>
        <p className="text-base font-semibold tabular">{v === undefined ? MISSING_TEXT : fmt(v)}</p>
        {v !== undefined && model.rankOf[code] && (
          <p className="text-[11px] text-muted-foreground">
            Rank {model.rankOf[code]} of {model.stats.count}
          </p>
        )}
      </div>
      <dl className="mt-2 space-y-0.5">
        {d.rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="font-medium tabular">{formatPercent(r.value)}</dd>
          </div>
        ))}
        {regionAvg && (
          <div className="flex justify-between gap-3 border-t pt-1">
            <dt className="text-muted-foreground">{regionAvg.name} avg.</dt>
            <dd className="font-medium tabular">{fmt(regionAvg.value)}</dd>
          </div>
        )}
      </dl>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {d.surveyYear !== model.wave ? `Surveyed in ${d.surveyYear} (${model.wave} wave) · ` : ''}
        Click to open profile
      </p>
    </>
  )
}
