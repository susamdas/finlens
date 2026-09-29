import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CATEGORICAL, DIVERGING, SEQUENTIAL, chartVar } from '@/design/palette'

const css = readFileSync(resolve(import.meta.dirname, '../../src/styles/tokens.css'), 'utf8')
const [lightBlock = '', darkBlock = ''] = css.split(/^\.dark\s*\{/m)

function varValue(block: string, name: string): string | undefined {
  return block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase()
}

describe('palette mirrors tokens.css', () => {
  it.each([
    ['light', lightBlock],
    ['dark', darkBlock],
  ] as const)('%s mode matches', (mode, block) => {
    CATEGORICAL[mode].forEach((hex, i) => expect(varValue(block, `chart-${i + 1}`)).toBe(hex))
    SEQUENTIAL[mode].forEach((hex, i) => expect(varValue(block, `seq-${i + 1}`)).toBe(hex))
    const divNames = ['div-n3', 'div-n2', 'div-n1', 'div-0', 'div-p1', 'div-p2', 'div-p3']
    DIVERGING[mode].forEach((hex, i) => expect(varValue(block, divNames[i]!)).toBe(hex))
  })

  it('never cycles categorical slots', () => {
    expect(chartVar(0)).toBe('var(--chart-1)')
    expect(chartVar(7)).toBe('var(--chart-8)')
    expect(chartVar(8)).toBe('var(--neutral)')
  })
})
