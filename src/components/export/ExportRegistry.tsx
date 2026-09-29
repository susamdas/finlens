import { useMemo, useRef, type ReactNode } from 'react'
import { ExportCtx, type Entry, type Registry } from './registry'

/**
 * Page export registry. Chart cards register their data tables and insight cards register their
 * findings; the page-level Export menu then offers "all data on this page" (CSV) and an
 * analytical summary without each page wiring its own exporters. Items are ordered by their
 * position in the document so downloads follow the page.
 */
export function ExportRegistryProvider({ children }: { children: ReactNode }) {
  const map = useRef(new Map<string, Entry>())
  const value = useMemo<Registry>(
    () => ({
      set: (id, entry) => map.current.set(id, entry),
      remove: (id) => map.current.delete(id),
      items: () =>
        [...map.current.values()]
          .filter((e) => e.ref.current?.isConnected)
          .sort((a, b) =>
            a.ref.current!.compareDocumentPosition(b.ref.current!) &
            Node.DOCUMENT_POSITION_FOLLOWING
              ? -1
              : 1,
          )
          .map((e) => e.item),
    }),
    [],
  )
  return <ExportCtx.Provider value={value}>{children}</ExportCtx.Provider>
}
