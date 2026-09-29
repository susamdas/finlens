import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FindexRepository } from '@/data/repository/FindexRepository'
import {
  explorerParams,
  longTable,
  parseExplorerParams,
  runQuery,
  wideTable,
} from '@/features/explorer/explorer.logic'
import {
  buildSummaryMarkdown,
  citationLines,
  csvField,
  safeFilename,
  toCsv,
  toSectionedCsv,
} from '@/lib/export'

describe('csv', () => {
  it('quotes only when needed and doubles quotes', () => {
    expect(csvField('Kenya')).toBe('Kenya')
    expect(csvField('Congo, Dem. Rep.')).toBe('"Congo, Dem. Rep."')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField(null)).toBe('')
    expect(csvField(43.28)).toBe('43.28')
    expect(toCsv(['a', 'b'], [[1, 'x,y']])).toBe('a,b\r\n1,"x,y"')
  })
  it('writes sections with titles and a preamble', () => {
    const s = toSectionedCsv([{ title: 'T', columns: ['a'], rows: [[1]] }], ['Head'])
    expect(s.split('\r\n')).toEqual(['Head', '', 'T', 'a', '1', ''])
  })
  it('makes safe, dated file names', () => {
    expect(safeFilename("Côte d'Ivoire: profile", 'csv', new Date('2026-09-29'))).toBe(
      'finlens-cote-d-ivoire-profile-2026-09-29.csv',
    )
  })
  it('builds a markdown summary with findings, tables and citation', () => {
    const md = buildSummaryMarkdown({
      title: 'Overview',
      url: 'https://x/overview',
      items: [
        { kind: 'insight', title: 'A finding.', evidence: 'World · 2024' },
        {
          kind: 'table',
          title: 'T',
          table: { caption: 'T', columns: ['Economy', 'Value'], rows: [['A|B', 1]] },
        },
      ],
      citation: citationLines(undefined, 'https://x/overview', new Date('2026-09-29')),
    })
    expect(md).toContain('# Overview')
    expect(md).toContain('- **A finding.** _(World · 2024)_')
    expect(md).toContain('| A\\|B | 1 |')
    expect(md).toContain('Global Findex Database')
  })
})

const DIR = resolve(import.meta.dirname, '../../public/data/processed')
const built = existsSync(resolve(DIR, 'meta.json'))

describe.skipIf(!built)('data explorer on real data', () => {
  const read = (f: string) => JSON.parse(readFileSync(resolve(DIR, f.split('?')[0]!), 'utf8'))
  const repo = FindexRepository.fromData(read('meta.json'), [read('core.json')], async (p) =>
    read(p),
  )

  it('parses URL state with safe defaults and round-trips it', () => {
    const d = parseExplorerParams(repo, new URLSearchParams(''))
    expect(d).toMatchObject({
      indicators: ['accountOwnership'],
      waves: [2024],
      groups: ['all'],
      layout: 'long',
      codes: [],
    })
    const q = parseExplorerParams(
      repo,
      new URLSearchParams(
        'ind=mobileMoneyAccount,bogus&codes=bgd,XXX&waves=2021,1999&groups=women&layout=wide',
      ),
    )
    expect(q).toMatchObject({
      indicators: ['mobileMoneyAccount'],
      codes: ['BGD'],
      waves: [2021],
      groups: ['women'],
      layout: 'wide',
    })
    const back = new URLSearchParams(
      Object.entries(explorerParams(repo, q)).filter((e): e is [string, string] => e[1] !== null),
    )
    expect(parseExplorerParams(repo, back)).toEqual(q)
  })

  it('returns only published values for the selection', () => {
    const q = parseExplorerParams(
      repo,
      new URLSearchParams('ind=accountOwnership&codes=BGD,IND&waves=2021,2024'),
    )
    const rows = runQuery(repo, q)
    expect(rows).toHaveLength(4)
    expect(rows.find((r) => r.entity.code === 'BGD' && r.wave === 2024)!.value).toBe(43.28)
    const long = longTable(rows)
    expect(long.columns[0]).toBe('indicator_id')
    expect(long.rows[0]![1]).toBe(repo.indicator('accountOwnership')!.code)
    const wide = wideTable(rows, q, repo)
    expect(wide.rows).toHaveLength(2)
    expect(wide.columns).toContain('Account ownership (2024)')
  })

  it('filters by region and includes aggregates on request', () => {
    const sas = repo.region('south-asia')!
    const q = parseExplorerParams(repo, new URLSearchParams(`region=south-asia&agg=1`))
    const rows = runQuery(repo, q)
    expect(
      rows.every((r) => r.entity.regionId === sas.id || r.entity.code === sas.aggregateCode),
    ).toBe(true)
    expect(rows.some((r) => r.entity.code === sas.aggregateCode)).toBe(true)
  })
})
