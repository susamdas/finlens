import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'

/**
 * Animates a number from its previous value to `target`. Returns `null` for missing data.
 * Respects prefers-reduced-motion (returns the value immediately).
 */
export function useCountUp(target: number | null, duration = 0.8): number | null {
  const reduce = useReducedMotion()
  const [animated, setAnimated] = useState(0)
  const from = useRef(0)

  useEffect(() => {
    if (target === null || reduce) return
    const controls = animate(from.current, target, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        from.current = v
        setAnimated(v)
      },
    })
    return () => controls.stop()
  }, [target, duration, reduce])

  if (target === null) return null
  return reduce ? target : animated
}
