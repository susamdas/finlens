#!/usr/bin/env node
/**
 * Verifies the processed Findex files in public/data/processed before a build or deploy.
 * It needs only the processed JSON (not the raw workbook), so it runs in CI.
 *
 * Checks: schema version, unique ids, valid references, every indicator has its data file,
 * every row points at a known economy/wave/group, no duplicate rows, and every value is a finite
 * percentage in [0, 100]. It never changes a file. Exit code 1 on any failure.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const DIR = resolve(
  process.env.FINLENS_DATA_DIR ?? resolve(import.meta.dirname, '../public/data/processed'),
)
const errors = []
const fail = (msg) => errors.push(msg)
const read = (f) => JSON.parse(readFileSync(resolve(DIR, f), 'utf8'))

if (!existsSync(resolve(DIR, 'meta.json'))) {
  console.error('✗ public/data/processed/meta.json not found. Run `npm run data:build` first.')
  process.exit(1)
}

const meta = read('meta.json')
const report = existsSync(resolve(DIR, 'data-report.json')) ? read('data-report.json') : null

// ── Metadata ────────────────────────────────────────────────────────────────
if (meta.schemaVersion !== 1) fail(`meta.json schemaVersion is ${meta.schemaVersion}, expected 1`)
if (!meta.source?.name || !meta.source?.url) fail('meta.json source citation is incomplete')

const waves = new Set(meta.waves)
if ([...meta.waves].sort((a, b) => a - b).join() !== meta.waves.join())
  fail('meta.json waves are not sorted')

const unique = (list, key, label) => {
  const seen = new Set()
  for (const x of list) {
    if (seen.has(x[key])) fail(`duplicate ${label} ${key} "${x[key]}"`)
    seen.add(x[key])
  }
  return seen
}
const codes = unique(meta.entities, 'code', 'entity')
unique(meta.entities, 'slug', 'entity')
const regionIds = unique(meta.regions, 'id', 'region')
const incomeIds = unique(meta.incomeGroups, 'id', 'income group')
const groups = new Map(meta.groups.map((g) => [g.id, g]))
unique(meta.groups, 'id', 'group')
const indicatorIds = unique(meta.indicators, 'id', 'indicator')

for (const e of meta.entities) {
  if (e.kind === 'economy') {
    if (e.regionId && !regionIds.has(e.regionId)) fail(`${e.code}: unknown region ${e.regionId}`)
    if (e.incomeGroupId && !incomeIds.has(e.incomeGroupId))
      fail(`${e.code}: unknown income group ${e.incomeGroupId}`)
  }
}
for (const r of [...meta.regions, ...meta.incomeGroups])
  if (r.aggregateCode && !codes.has(r.aggregateCode))
    fail(`${r.id}: aggregate ${r.aggregateCode} is not an entity`)
for (const [code, byWave] of Object.entries(meta.populations ?? {})) {
  if (!codes.has(code)) fail(`populations: unknown entity ${code}`)
  for (const [w, v] of Object.entries(byWave))
    if (!waves.has(Number(w)) || !(Number.isFinite(v) && v > 0))
      fail(`populations ${code} ${w}: invalid value ${v}`)
}

// ── Data files ──────────────────────────────────────────────────────────────
let checkedValues = 0
const covered = new Set()

function checkTable(file) {
  const t = read(file)
  if (t.schemaVersion !== 1) fail(`${file}: schemaVersion ${t.schemaVersion}`)
  const cols = t.columns
  for (const c of cols) {
    if (!indicatorIds.has(c)) fail(`${file}: column "${c}" is not a known indicator`)
    covered.add(c)
  }
  const keys = new Set()
  for (const row of t.rows) {
    const [code, wave, group, ...values] = row
    const key = `${code}|${wave}|${group}`
    if (keys.has(key)) fail(`${file}: duplicate row ${key}`)
    keys.add(key)
    if (!codes.has(code)) fail(`${file}: unknown entity ${code}`)
    if (!waves.has(wave)) fail(`${file}: unknown wave ${wave} (${code})`)
    const g = groups.get(group)
    if (!g) fail(`${file}: unknown group ${group} (${code} ${wave})`)
    if (values.length !== cols.length) fail(`${file}: ${key} has ${values.length} values`)
    values.forEach((v, i) => {
      if (v === null) return
      checkedValues++
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100)
        fail(`${file}: ${key} ${cols[i]} = ${v} is not a percentage in [0, 100]`)
    })
  }
  return t.rows.length
}

const files = ['core.json', 'core-groups.json'].filter((f) => existsSync(resolve(DIR, f)))
if (!files.includes('core.json')) fail('core.json is missing')
let rows = files.reduce((n, f) => n + checkTable(f), 0)

const seriesDir = resolve(DIR, 'series')
const seriesFiles = existsSync(seriesDir)
  ? readdirSync(seriesDir).filter((f) => f.endsWith('.json'))
  : []
for (const f of seriesFiles) rows += checkTable(`series/${f}`)

for (const i of meta.indicators) {
  if (i.unit !== '%') fail(`${i.id}: unexpected unit "${i.unit}"`)
  if (!i.label || !i.definition) fail(`${i.id}: missing label or definition`)
  if (!covered.has(i.id)) fail(`${i.id}: no data file contains this indicator`)
}

if (report) {
  if (report.indicators !== meta.indicators.length)
    fail(
      `data-report says ${report.indicators} indicators, meta.json has ${meta.indicators.length}`,
    )
  if (report.waves && report.waves.join() !== meta.waves.join())
    fail('data-report waves differ from meta.json')
}

// ── Result ──────────────────────────────────────────────────────────────────
const summary = `${meta.entities.length} entities · ${meta.indicators.length} indicators · ${
  files.length + seriesFiles.length
} files · ${rows.toLocaleString('en')} rows · ${checkedValues.toLocaleString('en')} values`
if (errors.length) {
  console.error(`✗ Processed data failed ${errors.length} check(s):`)
  for (const e of errors.slice(0, 50)) console.error(`  - ${e}`)
  if (errors.length > 50) console.error(`  … and ${errors.length - 50} more`)
  process.exit(1)
}
console.log(`✓ Processed data verified: ${summary}`)
