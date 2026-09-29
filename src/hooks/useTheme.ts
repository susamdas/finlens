import { useEffect, useSyncExternalStore } from 'react'
import { resolveTheme, useThemeStore, type ResolvedTheme } from '@/store/theme'

const query = '(prefers-color-scheme: dark)'

function subscribeSystem(cb: () => void) {
  const mq = window.matchMedia?.(query)
  mq?.addEventListener('change', cb)
  return () => mq?.removeEventListener('change', cb)
}

/** Current resolved theme, reacting to both the user preference and the OS setting. */
export function useResolvedTheme(): ResolvedTheme {
  const preference = useThemeStore((s) => s.preference)
  // Re-render when the OS theme changes while preference is "system".
  useSyncExternalStore(
    subscribeSystem,
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  )
  return resolveTheme(preference)
}

/** Mount once at the app root: keeps the `.dark` class on <html> in sync. */
export function useApplyTheme(): ResolvedTheme {
  const theme = useResolvedTheme()
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0b1120' : '#f6f7f9')
  }, [theme])
  return theme
}
