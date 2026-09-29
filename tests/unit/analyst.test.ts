import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FindexRepository } from '@/data/repository/FindexRepository'
import { answerQuestion } from '@/lib/analyst/answer'
import { normalise, parseQuestion, withContext } from '@/lib/analyst/parse'
import { ruleProvider, validateGrounding } from '@/lib/analyst/provider'

describe('normalisation', () => {
  it('lower-cases, strips accents and punctuation', () => {
    expect(normalise('Côte d’Ivoire & Ghana?')).toBe('cote divoire and ghana')
  })
})

const DIR = resolve(import.meta.dirname, '../../public/data/processed')
const built = existsSync(resolve(DIR, 'meta.json'))

describe.skipIf(!built)('rule-based analyst on real data', async () => {
  const read = (f: string) => JSON.parse(readFileSync(resolve(DIR, f.split('?')[0]!), 'utf8'))
  const repo = FindexRepository.fromData(read('meta.json'), [read('core.json')], async (p) =>
    read(p),
  )
  await repo.ensureGroups()
  const p = (q: string) => parseQuestion(repo, q)

  it('recognises places, indicators, groups and years', () => {
    const q = p('How has mobile money for women in Kenya changed since 2014?')
    expect(q.kind).toBe('trend')
    expect(q.entities.map((e) => e.code)).toEqual(['KEN'])
    expect(q.indicator).toBe('mobileMoneyAccount')
    expect(q.group).toBe('women')
    expect(q.waves).toEqual([2014])
    expect(
      p('BGD vs IND')
        .entities.map((e) => e.code)
        .sort(),
    ).toEqual(['BGD', 'IND'])
    expect(p('debit cards in the world').indicator).toBe('debitCard')
    expect(
      p('Niger or Nigeria?')
        .entities.map((e) => e.code)
        .sort(),
    ).toEqual(['NER', 'NGA'])
    expect(p('surveyed in 2022').waves).toEqual([2021])
  })

  it('classifies question types', () => {
    expect(p('What is formal borrowing?').kind).toBe('definition')
    expect(p('What is the gender gap in South Asia?').kind).toBe('gap')
    expect(p('Which countries have the lowest account ownership?')).toMatchObject({
      kind: 'rank',
      order: 'asc',
    })
    expect(p('top 3 countries for savings clubs')).toMatchObject({
      kind: 'rank',
      limit: 3,
      indicator: 'savedInformal',
    })
    expect(p('Compare Ghana and Senegal').kind).toBe('compare')
    expect(p('Account ownership in Kenya by 2030').kind).toBe('forecast')
    expect(p('Why did account ownership fall in Bangladesh?').kind).toBe('explain')
    expect(p('hello there').kind).toBe('unknown')
  })

  it('carries context only for follow-ups', () => {
    const first = p('How has digital payments in Ghana changed?')
    const f = withContext(p('and Kenya?'), first)
    expect(f).toMatchObject({ kind: 'trend', indicator: 'digitalPayments' })
    expect(f.entities[0]!.code).toBe('KEN')
    expect(withContext(p('hello'), first).kind).toBe('unknown')
  })

  it('answers only with dataset values, all listed as sources', async () => {
    const questions = [
      'How has account ownership in Bangladesh changed since 2011?',
      'Compare mobile money in Kenya, Uganda and Tanzania',
      'Which countries have the highest digital payments?',
      'What is the gender gap in South Asia?',
      'income gap in Nigeria 2021',
      'Account ownership in Sub-Saharan Africa by 2030',
      'Why did account ownership fall in Bangladesh?',
      'women in Pakistan',
      'debit cards in the world',
    ]
    for (const q of questions) {
      const { answer } = await ruleProvider.answer(q, { repo, previous: null })
      expect(answer.status, q).toBe('answered')
      expect(validateGrounding(answer), q).toEqual([])
      expect(answer.facts.length, q).toBeGreaterThan(0)
    }
    const bgd = answerQuestion(
      repo,
      p('How has account ownership in Bangladesh changed since 2011?'),
    )
    expect(bgd.text[0]).toMatch(/31\.7% in 2011 to 43\.3% in 2024/)
  })

  it('labels fallbacks, projections and causal questions', () => {
    expect(answerQuestion(repo, p('debit cards in the world')).caveats.join(' ')).toMatch(
      /No World figure/,
    )
    expect(answerQuestion(repo, p('Account ownership in Kenya by 2030')).caveats[0]).toMatch(
      /not an official World Bank forecast/,
    )
    expect(
      answerQuestion(repo, p('Why did account ownership fall in Bangladesh?')).caveats.join(' '),
    ).toMatch(/not why/)
    expect(answerQuestion(repo, p('hello there')).status).toBe('unknown')
  })
})
