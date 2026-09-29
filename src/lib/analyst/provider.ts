import type { FindexRepository } from '@/data/repository'
import { answerQuestion, type AnalystAnswer } from './answer'
import { entityDictionary, parseQuestion, withContext, type ParsedQuestion } from './parse'

/**
 * Analyst providers. FinLens ships only the rule-based provider: it runs entirely in the
 * browser, sends nothing anywhere and answers only from dataset values.
 *
 * An optional language-model provider can be added later behind a server-side proxy (never
 * with an API key in the browser). It must receive the facts the rule provider selected and
 * return text that passes `validateGrounding`, so it can rephrase but never add numbers.
 */
export interface AnalystProvider {
  id: string
  label: string
  answer: (
    question: string,
    ctx: { repo: FindexRepository; previous: ParsedQuestion | null },
  ) => Promise<{ parsed: ParsedQuestion; answer: AnalystAnswer }>
}

let dictCache: { repo: FindexRepository; dict: [string, string][] } | null = null

export const ruleProvider: AnalystProvider = {
  id: 'rules',
  label: 'Rule-based (runs in your browser)',
  answer: async (question, { repo, previous }) => {
    if (dictCache?.repo !== repo) dictCache = { repo, dict: entityDictionary(repo) }
    const parsed = withContext(parseQuestion(repo, question, dictCache.dict), previous)
    return { parsed, answer: answerQuestion(repo, parsed) }
  },
}

/**
 * Every number in the answer text must appear in its facts (or be a year / count of
 * economies). Returns the numbers that are not grounded; empty means the answer is grounded.
 */
export function validateGrounding(a: AnalystAnswer): string[] {
  const allowed = new Set<string>()
  for (const f of a.facts) {
    for (const m of `${f.value} ${f.wave} ${f.group}`.matchAll(/\d+(?:\.\d+)?/g)) allowed.add(m[0])
  }
  const out: string[] = []
  for (const line of a.text) {
    for (const m of line.matchAll(/(?<![\w.])\d+(?:\.\d+)?/g)) {
      const n = m[0]
      if (allowed.has(n)) continue
      if (/^(19|20)\d\d$/.test(n)) continue // years
      const after = line.slice(m.index! + n.length)
      // Integer counts and rank labels ("3. Kenya"), but not percentages or decimals.
      if (/^\d{1,3}$/.test(n) && !after.startsWith('%') && !/^\.\d/.test(after)) continue
      out.push(n)
    }
  }
  return out
}
