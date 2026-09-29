import { useEffect } from 'react'
import { RouterProvider } from 'react-router'
import { useDataStore } from '@/store/data'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useApplyTheme } from '@/hooks/useTheme'
import { router } from './router'

export function App() {
  useApplyTheme()
  const load = useDataStore((s) => s.load)
  useEffect(() => {
    void load()
  }, [load])
  return (
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>
  )
}
