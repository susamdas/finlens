import { useEffect } from 'react'

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

/**
 * Registers a global keyboard shortcut.
 * `mod` means Cmd on macOS, Ctrl elsewhere. Plain keys are ignored while the user is typing.
 */
export function useHotkey(
  key: string,
  handler: (e: KeyboardEvent) => void,
  opts: { mod?: boolean } = {},
) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key.toLowerCase()) return
      const mod = e.metaKey || e.ctrlKey
      if (opts.mod ? !mod : mod || e.altKey) return
      if (!opts.mod && isTypingTarget(e.target)) return
      e.preventDefault()
      handler(e)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [key, handler, opts.mod])
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
export const modKeyLabel = isMac ? '⌘' : 'Ctrl'
