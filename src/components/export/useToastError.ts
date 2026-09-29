import { useCallback } from 'react'
import { toast } from '@/components/common/toast'

/** Reports an export failure to the user without breaking the page. */
export function useToastError() {
  return useCallback((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e)
    toast.error(`The download could not be created: ${msg}`)
  }, [])
}
