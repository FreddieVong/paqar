'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function MarketPricePoller({ active }: { active: boolean }) {
  const router = useRouter()

  useEffect(() => {
    if (!active) return
    let attempts = 0
    const id = setInterval(() => {
      if (++attempts >= 24) { clearInterval(id); return }
      router.refresh()
    }, 5_000)
    return () => clearInterval(id)
  }, [active, router])

  return null
}
