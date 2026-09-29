import type { IndicatorCategory } from '@/data/types'

export const CATEGORY_LABELS: Record<IndicatorCategory, string> = {
  access: 'Account access',
  digital: 'Digital finance',
  payments: 'Payments & transfers',
  savings: 'Savings',
  borrowing: 'Borrowing',
  resilience: 'Financial resilience',
  barriers: 'Barriers to access',
  connectivity: 'Digital connectivity',
  equality: 'Inclusion gaps',
}

export const CATEGORY_ORDER: IndicatorCategory[] = [
  'access',
  'digital',
  'payments',
  'savings',
  'borrowing',
  'resilience',
  'equality',
  'barriers',
  'connectivity',
]
