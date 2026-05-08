import { env } from '@/lib/env'
import type { SourceResult } from '../types'
import type { SourceData } from '@/types/api'

type ScraperPayload = { plate?: string; ic?: string }

interface ScraperResponse {
  status:      'clear' | 'hit' | 'unavailable' | 'requires_user_action'
  samans?:     Array<{
    offence: string; date: string; amount: number; currency: string
    location: string | null; discounted: number | null; paymentUrl: string | null
  }>
  error?:      string
}

/**
 * Call the Playwright scraper service for a given source.
 * Falls back to 'unavailable' if SCRAPER_URL is not configured.
 */
export async function callScraper(
  source:    string,
  payload:   ScraperPayload,
  sourceId:  SourceResult['source'],
  label:     string,
): Promise<SourceResult> {
  const base = { source: sourceId, label, checkedAt: new Date() } as const

  if (!env.SCRAPER_URL || !env.SCRAPER_API_KEY) {
    return { ...base, status: 'unavailable', data: null, errorMessage: 'Scraper service not configured' }
  }

  try {
    const res = await fetch(`${env.SCRAPER_URL}/check/${source}`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key':    env.SCRAPER_API_KEY,
      },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      return { ...base, status: 'unavailable', data: null, errorMessage: `Scraper ${res.status}` }
    }

    const data = await res.json() as ScraperResponse

    if (data.status === 'unavailable') {
      return { ...base, status: 'unavailable', data: null, errorMessage: data.error ?? 'Unavailable' }
    }
    if (data.status === 'requires_user_action') {
      return { ...base, status: 'requires_user_action', data: null, errorMessage: data.error ?? 'Requires user action' }
    }

    // Saman sources
    if (data.samans !== undefined) {
      const sourceData = { source: sourceId, samans: data.samans } as SourceData
      // local_councils needs council field — scraper returns it in samans[0].location
      if (sourceId === 'local_councils') {
        const council = data.samans[0]?.location ?? 'Majlis Tempatan'
        return { ...base, status: data.status, data: { source: 'local_councils', samans: data.samans, council }, errorMessage: null }
      }
      return { ...base, status: data.status, data: sourceData, errorMessage: null }
    }

    return { ...base, status: 'unavailable', data: null, errorMessage: 'Unknown response shape' }
  } catch (err) {
    return { ...base, status: 'unavailable', data: null, errorMessage: err instanceof Error ? err.message : 'Fetch failed' }
  }
}
