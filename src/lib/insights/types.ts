export type InsightTone = 'positive' | 'negative' | 'neutral' | 'warning'

/**
 * A finding generated from dataset values only. `evidence` names the aggregate/economies and
 * waves the numbers come from so every card is traceable to source data.
 */
export interface Insight {
  id: string
  tone: InsightTone
  title: string
  detail?: string
  evidence: string
  /** Deep link to explore further (route path with query). */
  link?: string
  /** Lower = more important. */
  priority: number
}
