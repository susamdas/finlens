#!/usr/bin/env node
/**
 * Geo & flag assets (run after data:build; re-run only when the economy list changes).
 *
 *   world-atlas countries-50m (Natural Earth, public domain)
 *     → ids re-keyed to ISO3 / World Bank codes, Antarctica removed, simplified
 *     → public/geo/world.json
 *   flag-icons 4x3 SVGs (MIT) for every Findex economy → public/flags/<iso2>.svg
 */
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import countries from 'i18n-iso-countries'
import { presimplify, quantile, simplify } from 'topojson-simplify'
import { quantize } from 'topojson-client'

const require = createRequire(import.meta.url)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const META = join(ROOT, 'public/data/processed/meta.json')
const GEO_OUT = join(ROOT, 'public/geo/world.json')
const FLAGS_OUT = join(ROOT, 'public/flags')

/** Natural Earth features without an ISO numeric code, mapped by name where Findex covers them. */
const BY_NAME = { Kosovo: 'XKX' }
const DROP = new Set(['010']) // Antarctica

async function main() {
  const meta = JSON.parse(await readFile(META, 'utf8'))
  const economies = meta.entities.filter((e) => e.kind === 'economy')

  // ---- Geo ----------------------------------------------------------------------------------
  const topo = JSON.parse(await readFile(require.resolve('world-atlas/countries-50m.json'), 'utf8'))
  const geoms = topo.objects.countries.geometries.filter((g) => !DROP.has(g.id))
  for (const g of geoms) {
    const iso3 = g.id ? countries.numericToAlpha3(g.id) : BY_NAME[g.properties?.name]
    g.properties = { name: g.properties?.name ?? null, iso3: iso3 ?? null }
    g.id = iso3 ?? undefined
  }
  topo.objects.countries.geometries = geoms
  const pre = presimplify(topo)
  const simple = simplify(pre, quantile(pre, 0.45))
  // Strip the simplification weights (z) and re-quantize (delta-encoded) to shrink the file.
  simple.arcs = simple.arcs.map((arc) => arc.map(([x, y]) => [x, y]))
  delete simple.transform
  const simplified = quantize({ ...simple, objects: { countries: simple.objects.countries } }, 1e4)
  await mkdir(dirname(GEO_OUT), { recursive: true })
  await writeFile(GEO_OUT, JSON.stringify(simplified))

  const geoCodes = new Set(geoms.map((g) => g.id).filter(Boolean))
  const missing = economies.filter((e) => !geoCodes.has(e.code))

  // ---- Flags --------------------------------------------------------------------------------
  const flagDir = join(dirname(require.resolve('flag-icons/package.json')), 'flags/4x3')
  await rm(FLAGS_OUT, { recursive: true, force: true })
  await mkdir(FLAGS_OUT, { recursive: true })
  let flags = 0
  const noFlag = []
  for (const e of economies) {
    if (!e.iso2) continue
    const src = join(flagDir, `${e.iso2.toLowerCase()}.svg`)
    if (existsSync(src)) {
      await copyFile(src, join(FLAGS_OUT, `${e.iso2.toLowerCase()}.svg`))
      flags++
    } else noFlag.push(e.code)
  }

  const kb = ((await stat(GEO_OUT)).size / 1024).toFixed(0)
  console.log(
    `✔ world.json ${kb} KB · ${geoms.length} features · ${economies.length - missing.length}/${economies.length} Findex economies mapped`,
  )
  if (missing.length) console.log(`  not in basemap: ${missing.map((e) => e.code).join(', ')}`)
  console.log(`✔ ${flags} flags copied${noFlag.length ? ` · missing: ${noFlag.join(', ')}` : ''}`)
}

main().catch((e) => {
  console.error('✖', e.message)
  process.exit(1)
})
