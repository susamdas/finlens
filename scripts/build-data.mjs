#!/usr/bin/env node
/**
 * FinLens data pipeline.
 *
 *   public/data/raw/GlobalFindexDatabase2025.xlsx
 *        │  read (Data, Series Table, Notes, Updates sheets)
 *        │  validate  → hard errors abort the build
 *        │  normalize → waves, entities, groups, percentages
 *        ▼
 *   public/data/processed/
 *        meta.json            reference data + full indicator catalogue (definitions from Series Table)
 *        core.json            curated indicators × all entities × waves × population groups
 *        series/<id>.json     every other Findex series, loaded on demand
 *        data-report.json     validation & coverage summary
 *
 * Source values are never modified beyond unit conversion (fraction → %) and rounding to 2 dp.
 * Nothing is imputed: absent values stay absent.
 *
 * Usage: npm run data:build [-- path/to/file.xlsx]
 */
import { mkdir, readFile, readdir, rm, writeFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'
import countries from 'i18n-iso-countries'
import {
  AGGREGATE_KIND,
  BREAKDOWNS,
  GROUP_LABELS,
  GROUP_MAP,
  INCOME_GROUPS,
  REGIONS,
  SHORT_NAMES,
  WAVE_OF_SURVEY_YEAR,
  catalogueId,
  inferCategory,
  parseIndicatorName,
  slugify,
  toPercent,
  removeNotCollectedZeros,
  removeStructuralZeros,
} from './lib/normalize.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RAW_DIR = join(ROOT, 'public/data/raw')
const OUT_DIR = join(ROOT, 'public/data/processed')
const CORE_CONFIG = join(ROOT, 'src/data/indicators/core-indicators.json')
const SCHEMA_VERSION = 1
const ID_COLUMNS = [
  'countrynewwb',
  'codewb',
  'year',
  'pop_adult',
  'regionwb24_hi',
  'incomegroupwb24',
  'group',
  'group2',
]

const errors = []
const warnings = []
const fail = (msg) => errors.push(msg)
const warn = (msg) => warnings.push(msg)

function normalizeValue(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'object') {
    if ('result' in v) return v.result ?? null
    if ('richText' in v) return v.richText.map((t) => t.text).join('')
    if ('text' in v) return v.text
  }
  return v
}

/**
 * Streams every worksheet into plain row arrays (0-indexed columns). The streaming reader is
 * ~50× faster than loading the full workbook model for this 4M-cell file.
 */
async function readWorkbook(path) {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(path, {
    sharedStrings: 'cache',
    worksheets: 'emit',
    hyperlinks: 'ignore',
    styles: 'ignore',
  })
  const sheets = new Map()
  for await (const ws of reader) {
    const rows = []
    for await (const row of ws) {
      const vals = row.values // 1-indexed, sparse
      const out = new Array(Math.max(0, vals.length - 1))
      for (let c = 1; c < vals.length; c++) out[c - 1] = normalizeValue(vals[c])
      rows.push(out)
    }
    sheets.set(ws.name, rows)
  }
  return sheets
}

async function findSource() {
  const arg = process.argv[2]
  if (arg) return resolve(arg)
  if (!existsSync(RAW_DIR)) throw new Error(`Missing ${RAW_DIR}`)
  const files = (await readdir(RAW_DIR)).filter((f) => /^GlobalFindex.*\.xlsx$/i.test(f)).sort()
  if (!files.length) throw new Error(`No GlobalFindex*.xlsx found in ${RAW_DIR}`)
  return join(RAW_DIR, files[files.length - 1])
}

function iso2For(code) {
  if (code === 'XKX') return 'XK' // Kosovo: user-assigned code, widely used for flags
  return countries.alpha3ToAlpha2(code) ?? null
}

async function main() {
  const t0 = Date.now()
  const source = await findSource()
  console.log(`▸ Reading ${basename(source)} …`)
  const sheets = await readWorkbook(source)
  const sheetRows = (name) => {
    const rows = sheets.get(name)
    if (!rows)
      throw new Error(`Sheet "${name}" not found — is this the Global Findex Database file?`)
    return rows
  }

  // ---- Series Table: definitions -------------------------------------------------------------
  const seriesRows = sheetRows('Series Table')
  const sHeader = [...seriesRows[0]].map((h) => String(h ?? ''))
  const col = (name) => {
    const i = sHeader.indexOf(name)
    if (i === -1) throw new Error(`Series Table column "${name}" missing`)
    return i
  }
  const S = {
    code: col('Series'),
    name: col('Indicator name'),
    short: col('Short definition'),
    long: col('Long definition'),
    sub1: col('Sub Topic 1'),
    sub2: col('Sub Topic 2'),
    unit: col('Unit of Measure'),
    agg: col('Aggregation method'),
  }
  const seriesMeta = new Map()
  for (const r of seriesRows.slice(1)) {
    const code = r[S.code] && String(r[S.code]).trim()
    if (!code) continue
    seriesMeta.set(code, {
      code,
      name: String(r[S.name] ?? code).trim(),
      definition: String(r[S.long] ?? r[S.short] ?? '').trim(),
      subTopic1: r[S.sub1] ? String(r[S.sub1]).trim() : null,
      subTopic2: r[S.sub2] ? String(r[S.sub2]).trim() : null,
      unit: r[S.unit] ? String(r[S.unit]).trim() : null,
      aggregation: r[S.agg] ? String(r[S.agg]).trim() : null,
    })
  }

  // ---- Notes & Updates -----------------------------------------------------------------------
  const notesText = sheetRows('Notes').flat().filter(Boolean).map(String).slice(1).join('\n')
  const notes = notesText
    .split(/\n\s*\n|\n(?=\d+\.\s)/)
    .map((s) => s.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean)
  const updates = []
  {
    let release = sheetRows('Updates')[0]?.[0] ?? null
    let current = release ? String(release) : null
    for (const r of sheetRows('Updates').slice(1)) {
      const [a, b] = r
      if (a && !b && /\d{4}/.test(String(a))) current = String(a)
      else if (a && b && String(a) !== 'Series')
        updates.push({ release: current, series: String(a).trim(), change: String(b).trim() })
    }
  }
  const releaseDate = (r) => {
    const m = /^(\d{4}),\s*([A-Za-z]+)/.exec(r ?? '')
    return m ? new Date(`${m[2]} 1, ${m[1]}`).getTime() : NaN
  }
  const latestRelease =
    [...new Set(updates.map((u) => u.release).filter(Boolean))].sort(
      (x, y) => releaseDate(y) - releaseDate(x),
    )[0] ?? null

  // ---- Data sheet ----------------------------------------------------------------------------
  const dataRows = sheetRows('Data')
  const header = [...dataRows[0]].map((h) =>
    h === null || h === undefined ? null : String(h).trim(),
  )
  for (const c of ID_COLUMNS) if (!header.includes(c)) fail(`Data sheet is missing column "${c}"`)
  if (errors.length) throw new Error(errors.join('\n'))
  const idx = Object.fromEntries(ID_COLUMNS.map((c) => [c, header.indexOf(c)]))
  const valueCols = header
    .map((h, i) => ({ code: h, i }))
    .filter((c) => c.code && !ID_COLUMNS.includes(c.code))
  for (const c of valueCols)
    if (!seriesMeta.has(c.code)) warn(`Series ${c.code} has no Series Table entry`)
  // Row 2 of the Data sheet repeats human-readable labels — skip it.
  const isBlank = (r) => r.every((v) => v === null || v === undefined || String(v).trim() === '')
  const blankRows = dataRows.slice(1).filter(isBlank).length
  const body = dataRows
    .slice(1)
    .filter((r) => !isBlank(r) && String(r[idx.codewb] ?? '').trim() !== 'Economy code')

  // ---- Indicator catalogue -------------------------------------------------------------------
  const coreConfig = JSON.parse(await readFile(CORE_CONFIG, 'utf8')).indicators
  const coreByCode = new Map(coreConfig.map((c) => [c.code, c]))
  for (const c of coreConfig)
    if (!valueCols.some((v) => v.code === c.code))
      fail(`Core indicator ${c.id} → series ${c.code} not in Data sheet`)

  const indicators = valueCols.map(({ code }) => {
    const meta = seriesMeta.get(code) ?? {
      name: code,
      definition: '',
      subTopic1: null,
      subTopic2: null,
      aggregation: null,
    }
    const { label, unitLabel, denominator } = parseIndicatorName(meta.name)
    const core = coreByCode.get(code)
    return {
      id: core?.id ?? catalogueId(code),
      code,
      label,
      shortLabel: core?.shortLabel ?? label,
      unit: '%',
      unitLabel,
      denominator,
      definition: meta.definition,
      topic: meta.subTopic1,
      subTopic: meta.subTopic2,
      category: core?.category ?? inferCategory(code, label, meta.subTopic1),
      higherIsBetter: core ? core.higherIsBetter : null,
      aggregation: meta.aggregation,
      core: Boolean(core),
      featured: Boolean(core?.featured),
    }
  })
  const ids = new Set()
  for (const ind of indicators) {
    if (ids.has(ind.id)) fail(`Duplicate indicator id ${ind.id}`)
    ids.add(ind.id)
  }

  // ---- Entities, groups, observations --------------------------------------------------------
  const regionBySource = new Map(REGIONS.map((r) => [r.source, r]))
  const incomeBySource = new Map(INCOME_GROUPS.map((g) => [g.source, g]))
  const entities = new Map()
  const populations = {}
  const surveyYears = {}
  const seen = new Set()
  /** @type {Array<{code:string,wave:number,group:string,values:(number|null)[]}>} */
  const records = []
  let outOfRange = 0

  for (const r of body) {
    const code = String(r[idx.codewb] ?? '').trim()
    const name = String(r[idx.countrynewwb] ?? '').trim()
    const surveyYear = Number(r[idx.year])
    const groupKey = `${String(r[idx.group] ?? '').trim()}|${String(r[idx.group2] ?? '').trim()}`
    if (!/^[A-Z]{3}$/.test(code)) {
      fail(`Invalid economy code "${code}" (${name})`)
      continue
    }
    const wave = WAVE_OF_SURVEY_YEAR[surveyYear]
    if (!wave) {
      fail(`Unknown survey year ${surveyYear} for ${code}`)
      continue
    }
    const group = GROUP_MAP[groupKey]
    if (!group) {
      fail(`Unknown population group "${groupKey}" for ${code} ${surveyYear}`)
      continue
    }
    const key = `${code}|${wave}|${group}`
    if (seen.has(key)) {
      fail(`Duplicate row ${key}`)
      continue
    }
    seen.add(key)

    if (!entities.has(code)) {
      const aggKind = AGGREGATE_KIND[code]
      const regionSrc = r[idx.regionwb24_hi] ? String(r[idx.regionwb24_hi]).trim() : null
      const incomeSrc = r[idx.incomegroupwb24] ? String(r[idx.incomegroupwb24]).trim() : null
      const region = regionSrc ? regionBySource.get(regionSrc) : null
      const income = incomeSrc ? incomeBySource.get(incomeSrc) : null
      if (!aggKind && (!region || !income))
        fail(`Economy ${code} has unknown region "${regionSrc}" or income group "${incomeSrc}"`)
      entities.set(code, {
        code,
        name: code === 'WLD' ? 'World' : name,
        shortName:
          SHORT_NAMES[code] ??
          (aggKind === 'region' ? REGIONS.find((x) => x.id === code)?.name : null) ??
          name,
        slug:
          aggKind === 'region'
            ? REGIONS.find((x) => x.id === code).slug
            : slugify(SHORT_NAMES[code] ?? name),
        kind: aggKind ?? 'economy',
        iso2: aggKind ? null : iso2For(code),
        regionId: region?.id ?? null,
        incomeGroupId: income?.id ?? null,
      })
    }
    if (group === 'all') {
      const pop = Number(r[idx.pop_adult])
      if (Number.isFinite(pop) && pop > 0) (populations[code] ??= {})[wave] = pop
      if (surveyYear !== wave) (surveyYears[code] ??= {})[wave] = surveyYear
    }

    const values = valueCols.map(({ code: s, i }) => {
      try {
        return toPercent(r[i])
      } catch {
        outOfRange++
        fail(`Out-of-range value for ${s} at ${key}: ${r[i]}`)
        return null
      }
    })
    if (values.some((v) => v !== null)) records.push({ code, wave, group, values })
  }

  for (const e of entities.values())
    if (e.kind === 'economy' && !e.iso2)
      warn(`No ISO2 code for ${e.code} (${e.name}) — flag unavailable`)
  const slugs = new Map()
  for (const e of entities.values()) {
    const k = `${e.kind === 'economy' ? 'c' : 'a'}:${e.slug}`
    if (slugs.has(k)) fail(`Slug collision ${e.slug}: ${slugs.get(k)} / ${e.code}`)
    slugs.set(k, e.code)
  }
  const seriesCodes = valueCols.map((v) => v.code)
  const notCollectedZeros = removeNotCollectedZeros(records, entities, seriesCodes)
  const structuralZeros = removeStructuralZeros(records, entities, seriesCodes)
  // Drop rows left empty by the rule (never keep an all-null record).
  for (let k = records.length - 1; k >= 0; k--)
    if (records[k].values.every((v) => v === null)) records.splice(k, 1)

  if (errors.length) {
    console.error(`✖ ${errors.length} validation error(s):\n  ` + errors.slice(0, 30).join('\n  '))
    process.exit(1)
  }

  // ---- Coverage ------------------------------------------------------------------------------
  const waves = [...new Set(records.map((r) => r.wave))].sort()
  const coverage = {}
  for (const w of waves) {
    coverage[w] = new Set(
      records
        .filter((r) => r.wave === w && r.group === 'all' && entities.get(r.code).kind === 'economy')
        .map((r) => r.code),
    ).size
  }
  const valueIdx = new Map(indicators.map((ind, i) => [ind.id, i]))
  const firstLast = indicators.map((ind, i) => {
    const ws = records.filter((r) => r.values[i] !== null).map((r) => r.wave)
    return ws.length ? { first: Math.min(...ws), last: Math.max(...ws), count: ws.length } : null
  })
  indicators.forEach((ind, i) => {
    ind.coverage = firstLast[i]
      ? { firstWave: firstLast[i].first, lastWave: firstLast[i].last, values: firstLast[i].count }
      : null
  })
  // Series the World Bank lists but publishes no values for are left out of the catalogue.
  const emptySeries = indicators.filter((i) => !i.coverage).map((i) => i.code)
  const catalogue = indicators.filter((i) => i.coverage)
  for (const c of coreConfig)
    if (emptySeries.includes(c.code)) fail(`Core indicator ${c.id} (${c.code}) has no values`)

  // ---- Write ---------------------------------------------------------------------------------
  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(join(OUT_DIR, 'series'), { recursive: true })

  const pack = (cols, rowFilter = () => true) => {
    const colIdx = cols.map((id) => valueIdx.get(id))
    const rows = []
    for (const r of records) {
      if (!rowFilter(r)) continue
      const vals = colIdx.map((i) => r.values[i])
      if (vals.some((v) => v !== null)) rows.push([r.code, r.wave, r.group, ...vals])
    }
    return { schemaVersion: SCHEMA_VERSION, columns: cols, rows }
  }

  // Eager file: all adults + women/men (gender gap is a headline metric).
  // Other population groups load on demand for gap and demographic views.
  const EAGER_GROUPS = new Set(['all', 'women', 'men'])
  const coreIds = catalogue.filter((i) => i.core).map((i) => i.id)
  await writeFile(
    join(OUT_DIR, 'core.json'),
    JSON.stringify(pack(coreIds, (r) => EAGER_GROUPS.has(r.group))),
  )
  await writeFile(
    join(OUT_DIR, 'core-groups.json'),
    JSON.stringify(pack(coreIds, (r) => !EAGER_GROUPS.has(r.group))),
  )

  let seriesFiles = 0
  for (const ind of catalogue) {
    if (ind.core) continue
    await writeFile(join(OUT_DIR, 'series', `${ind.id}.json`), JSON.stringify(pack([ind.id])))
    seriesFiles++
  }

  const groupEntries = Object.entries(GROUP_LABELS).map(([id, label]) => ({
    id,
    label,
    waves: [...new Set(records.filter((r) => r.group === id).map((r) => r.wave))].sort(),
    breakdown: BREAKDOWNS.find((b) => b.advantaged === id || b.disadvantaged === id)?.id ?? null,
  }))

  const meta = {
    schemaVersion: SCHEMA_VERSION,
    source: {
      name: 'World Bank Global Findex Database',
      edition: 'Global Findex Database 2025',
      file: basename(source),
      release: latestRelease,
      url: 'https://www.worldbank.org/en/publication/globalfindex',
      methodologyUrl: 'https://www.worldbank.org/en/publication/globalfindex/methodology',
      termsUrl: 'https://datacatalog.worldbank.org/',
      citation: 'World Bank. The Global Findex Database 2025. Washington, DC: World Bank.',
    },
    builtAt: new Date().toISOString(),
    waves,
    coverage,
    notes,
    updates,
    regions: REGIONS.map(({ source: _s, ...r }) => ({
      ...r,
      economies: [...entities.values()].filter((e) => e.regionId === r.id).length,
    })),
    incomeGroups: INCOME_GROUPS.map(({ source: _s, ...g }) => ({
      ...g,
      economies: [...entities.values()].filter((e) => e.incomeGroupId === g.id).length,
    })),
    groups: groupEntries,
    breakdowns: BREAKDOWNS,
    entities: [...entities.values()].sort((a, b) =>
      a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'economy' ? -1 : 1,
    ),
    populations,
    surveyYears,
    indicators: catalogue,
  }
  await writeFile(join(OUT_DIR, 'meta.json'), JSON.stringify(meta))

  const report = {
    builtAt: meta.builtAt,
    source: meta.source.file,
    rowsRead: body.length,
    blankRowsSkipped: blankRows,
    recordsWritten: records.length,
    economies: [...entities.values()].filter((e) => e.kind === 'economy').length,
    aggregates: [...entities.values()].filter((e) => e.kind !== 'economy').length,
    indicators: catalogue.length,
    emptySeriesOmitted: emptySeries,
    coreIndicators: coreIds.length,
    nonNullValues: records.reduce((n, r) => n + r.values.filter((v) => v !== null).length, 0),
    waves,
    coverage,
    surveyYearRemaps: surveyYears,
    outOfRange,
    notCollectedZeros,
    structuralZeros,
    warnings,
    ms: Date.now() - t0,
  }
  await writeFile(join(OUT_DIR, 'data-report.json'), JSON.stringify(report, null, 2))

  if (errors.length) {
    console.error('✖ ' + errors.join('\n  '))
    process.exit(1)
  }
  const size = async (f) => ((await stat(join(OUT_DIR, f))).size / 1024).toFixed(0) + ' KB'
  console.log(
    `✔ ${report.economies} economies + ${report.aggregates} aggregates · ${report.indicators} indicators (${report.coreIndicators} core) · waves ${waves.join(', ')}`,
  )
  console.log(
    `  ${report.nonNullValues.toLocaleString()} values · meta.json ${await size('meta.json')} · core.json ${await size('core.json')} · ${seriesFiles} series files`,
  )
  if (warnings.length) console.log(`  ⚠ ${warnings.length} warning(s) — see data-report.json`)
  console.log(`  done in ${(report.ms / 1000).toFixed(1)}s`)
}

main().catch((e) => {
  console.error('✖', e.message)
  process.exit(1)
})
