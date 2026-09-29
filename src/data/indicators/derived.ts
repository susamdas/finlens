import type { IndicatorDefinition } from '@/data/types'

/**
 * FinLens-derived indicators. Each is a transparent formula over published Findex values;
 * the formula is shown on About the Data and in tooltips. They are never labelled as
 * World Bank indicators.
 */
export const DERIVED_INDICATORS: IndicatorDefinition[] = [
  {
    id: 'noAccount',
    code: null,
    label: 'Adults without an account',
    shortLabel: 'Without an account',
    unit: '%',
    unitLabel: '%, age 15+',
    denominator: 'adults age 15+',
    definition:
      'Share of adults who do not have an account at a financial institution or a mobile money provider. Computed by FinLens as 100 − account ownership.',
    topic: 'Financial inclusion',
    subTopic: 'Access',
    category: 'access',
    higherIsBetter: false,
    aggregation: null,
    core: true,
    featured: true,
    coverage: null,
    derived: { formula: '100 − Account ownership', inputs: ['accountOwnership'] },
  },
  {
    id: 'genderGapAccount',
    code: null,
    label: 'Gender gap in account ownership',
    shortLabel: 'Gender gap',
    unit: 'pp',
    unitLabel: 'percentage points',
    denominator: 'adults age 15+',
    definition:
      'Account ownership among men minus account ownership among women, in percentage points. Positive values mean women are behind. Computed by FinLens.',
    topic: 'Financial inclusion',
    subTopic: 'Access',
    category: 'equality',
    higherIsBetter: false,
    aggregation: null,
    core: true,
    featured: true,
    coverage: null,
    derived: {
      formula: 'Account ownership (men) − Account ownership (women)',
      inputs: ['accountOwnership'],
    },
  },
  {
    id: 'incomeGapAccount',
    code: null,
    label: 'Income gap in account ownership',
    shortLabel: 'Income gap',
    unit: 'pp',
    unitLabel: 'percentage points',
    denominator: 'adults age 15+',
    definition:
      'Account ownership among the richest 60% of households minus the poorest 40%, in percentage points. Computed by FinLens.',
    topic: 'Financial inclusion',
    subTopic: 'Access',
    category: 'equality',
    higherIsBetter: false,
    aggregation: null,
    core: true,
    featured: false,
    coverage: null,
    derived: {
      formula: 'Account ownership (richest 60%) − Account ownership (poorest 40%)',
      inputs: ['accountOwnership'],
      groupsOnly: true,
    },
  },
]
