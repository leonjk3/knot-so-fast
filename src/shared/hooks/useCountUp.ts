'use client'

import { useEffect, useState } from 'react'

export function useCountUp(target: number, durationMs = 1800): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    const start = performance.now()
    let raf: number

    function tick(now: number) {
      const progress = Math.min((now - start) / durationMs, 1)
      const eased = 1 - Math.pow(1 - progress, 4)
      setValue(target * eased)
      if (progress < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])

  return value
}
