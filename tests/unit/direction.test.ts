import { classifyBenchmark, movementTone } from '@/lib/analytics/direction'

describe('movementTone', () => {
  it('respects higherIsBetter', () => {
    expect(movementTone(5)).toBe('positive')
    expect(movementTone(-5)).toBe('negative')
    expect(movementTone(5, false)).toBe('negative') // e.g. a widening gender gap
    expect(movementTone(-5, false)).toBe('positive')
  })
  it('treats tiny changes as neutral and nulls as missing', () => {
    expect(movementTone(0.2)).toBe('neutral')
    expect(movementTone(null)).toBe('missing')
  })
})

describe('classifyBenchmark', () => {
  it('classifies above / near / below', () => {
    expect(classifyBenchmark(60, 50)).toBe('above')
    expect(classifyBenchmark(51, 50)).toBe('near')
    expect(classifyBenchmark(40, 50)).toBe('below')
    expect(classifyBenchmark(40, 50, false)).toBe('above')
    expect(classifyBenchmark(null, 50)).toBe('missing')
  })
})

describe('classifyBenchmark without direction', () => {
  it('reports higher / lower without judgement', () => {
    expect(classifyBenchmark(60, 50, null)).toBe('higher')
    expect(classifyBenchmark(40, 50, null)).toBe('lower')
    expect(classifyBenchmark(51, 50, null)).toBe('near')
  })
})
