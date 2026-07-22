'use client'
import { useEffect, useRef } from 'react'
import { trackPurchase, type PurchaseItem } from '@/lib/ga4-events'

const MAX_ATTEMPTS   = 30
const RETRY_DELAY_MS = 100

function guardKey(transactionId: string): string {
  return `ga4_purchase_${transactionId}`
}

// Storage failures (private browsing, quota, disabled storage) must never
// block sending the event — each direction gets its own try/catch.
function readGuard(transactionId: string): boolean {
  try {
    return sessionStorage.getItem(guardKey(transactionId)) === '1'
  } catch {
    return false
  }
}

function writeGuard(transactionId: string): void {
  try {
    sessionStorage.setItem(guardKey(transactionId), '1')
  } catch {
    // best-effort only — the useRef guard still prevents duplicates within this mount
  }
}

export function GA4PurchaseEvent({
  transactionId,
  value,
  itemId,
  itemName,
}: {
  transactionId: string
  value:         number
  itemId:        string
  itemName:      string
}) {
  const sentRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0

    function attempt() {
      if (cancelled) return

      // Recheck immediately before every send — not just once on mount —
      // since sessionStorage state can be set by another mount in the
      // interim (e.g. fast mount -> unmount -> remount).
      if (sentRef.current || readGuard(transactionId)) return

      if (window.gtag) {
        sentRef.current = true
        writeGuard(transactionId)
        const items: PurchaseItem[] = [{ item_id: itemId, item_name: itemName, price: value, quantity: 1 }]
        trackPurchase({ transaction_id: transactionId, value, items })
        return
      }

      attempts += 1
      if (attempts < MAX_ATTEMPTS) {
        timer = setTimeout(attempt, RETRY_DELAY_MS)
      }
    }

    attempt()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [transactionId, value, itemId, itemName])

  return null
}
