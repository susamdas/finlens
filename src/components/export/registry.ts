import { createContext, useContext, useEffect, useId, type RefObject } from 'react'
import type { ChartTable } from '@/components/charts/ChartCard'

export type ExportItem =
  | { kind: 'table'; title: string; description?: string; table: ChartTable; source?: string }
  | { kind: 'insight'; title: string; detail?: string; evidence?: string }

export interface Entry {
  item: ExportItem
  ref: RefObject<HTMLElement | null>
}

export interface Registry {
  set: (id: string, entry: Entry) => void
  remove: (id: string) => void
  items: () => ExportItem[]
}

export const ExportCtx = createContext<Registry | null>(null)

export function useExportRegistry(): Registry | null {
  return useContext(ExportCtx)
}

/** Registers an exportable item for as long as the component is mounted. */
export function useRegisterExport(item: ExportItem | null, ref: RefObject<HTMLElement | null>) {
  const reg = useContext(ExportCtx)
  const id = useId()
  const key = item ? JSON.stringify(item) : ''
  useEffect(() => {
    if (!reg || !item) return
    reg.set(id, { item, ref })
    return () => reg.remove(id)
    // `key` captures the item's content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reg, id, key, ref])
}
