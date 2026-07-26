import 'server-only'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, type Attribution, EMPTY_ATTRIBUTION } from '@/lib/attribution'
import { getSessionAttribution } from '@/lib/db/ad-attribution'

/**
 * Resolves the current request's session and its canonical first-touch
 * attribution. Kept apart from lib/attribution.ts so that module stays pure
 * and directly unit-testable — this one touches next/headers and the database.
 */
export async function currentAttribution(): Promise<{
  sessionId:   string | null
  attribution: Attribution
}> {
  const sessionId = cookies().get(SESSION_COOKIE)?.value ?? null
  if (!sessionId) return { sessionId: null, attribution: { ...EMPTY_ATTRIBUTION } }

  try {
    return { sessionId, attribution: await getSessionAttribution(sessionId) }
  } catch {
    // Attribution is never allowed to break a checkout.
    return { sessionId, attribution: { ...EMPTY_ATTRIBUTION } }
  }
}
