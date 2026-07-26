import 'server-only'
import { env } from '@/lib/env'

/**
 * Meta Marketing API client for the RM210 experiment.
 *
 * ⚠ THE EXPORT SURFACE IS THE SAFETY MECHANISM.
 *
 * This module exports exactly ONE mutating verb: pauseCampaign. There is no
 * create, update, delete, reactivate, budget-edit or per-ad pause function
 * anywhere in it. That is why "never create a second campaign", "never add an
 * ad set", "never activate a third ad", "never raise a budget" and "never
 * restart a manually paused object" are structurally impossible rather than
 * rules a future edit could quietly break.
 *
 * A test asserts this surface. If you are here to add a mutation, that test
 * will fail, and it is meant to.
 *
 * Campaign, ad set and ads are created and activated BY HAND in Ads Manager.
 */

const GRAPH = 'https://graph.facebook.com'

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
    readonly subcode?: number
  ) {
    super(message)
    this.name = 'MetaApiError'
  }

  /**
   * Failures that mean the operator can no longer trust or control the
   * account, as opposed to a transient blip.
   */
  get isCritical(): boolean {
    if (this.status === 401 || this.status === 403) return true
    // 190 = invalid/expired token, 200 = permission error,
    // 2635 = deprecated API version, 1487xxx = ad account / billing / policy.
    if (this.code === 190 || this.code === 200 || this.code === 2635) return true
    if (this.code === 100 && this.subcode === 33) return true // object unreadable
    if (this.code != null && this.code >= 1487000 && this.code < 1488000) return true
    return false
  }
}

/** Removes tokens from anything that might be logged or stored. */
export function redactMeta(value: string): string {
  const token = env.META_SYSTEM_USER_ACCESS_TOKEN
  let out = value
  if (token) out = out.split(token).join('[REDACTED_TOKEN]')
  return out.replace(/(access_token=)[^&\s"']+/gi, '$1[REDACTED_TOKEN]')
}

function requireToken(): string {
  const token = env.META_SYSTEM_USER_ACCESS_TOKEN
  if (!token) throw new MetaApiError('META_SYSTEM_USER_ACCESS_TOKEN is not set', 0)
  return token
}

function base(): string {
  return `${GRAPH}/${env.META_GRAPH_API_VERSION}`
}

/**
 * Read-only GET. Token travels in the Authorization header, never the query
 * string, so it cannot leak into an error URL or a proxy log.
 */
export async function metaGet<T = Record<string, unknown>>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const token = requireToken()
  const url = new URL(`${base()}/${path.replace(/^\//, '')}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  let res: Response
  try {
    res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache:   'no-store',
      signal:  AbortSignal.timeout(20_000),
    })
  } catch (err) {
    throw new MetaApiError(`Network failure: ${redactMeta(String(err))}`, 0)
  }

  const text = await res.text()
  if (!res.ok) {
    let code: number | undefined
    let subcode: number | undefined
    let message = redactMeta(text).slice(0, 500)
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string; code?: number; error_subcode?: number } }
      if (parsed.error) {
        code    = parsed.error.code
        subcode = parsed.error.error_subcode
        message = redactMeta(parsed.error.message ?? message)
      }
    } catch { /* non-JSON error body — keep the redacted text */ }
    throw new MetaApiError(message, res.status, code, subcode)
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new MetaApiError('Malformed JSON from Meta', res.status)
  }
}

/**
 * The ONLY mutation in this codebase. Sets a campaign to PAUSED.
 *
 * Deliberately cannot un-pause: `status` is hard-coded, not a parameter, so
 * there is no way to call this with 'ACTIVE'. A manually paused campaign can
 * never be restarted by the operator.
 */
export async function pauseCampaign(campaignId: string): Promise<{ ok: true }> {
  const token = requireToken()

  let res: Response
  try {
    res = await fetch(`${base()}/${campaignId}`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body:   JSON.stringify({ status: 'PAUSED' }),
      cache:  'no-store',
      signal: AbortSignal.timeout(20_000),
    })
  } catch (err) {
    throw new MetaApiError(`Network failure: ${redactMeta(String(err))}`, 0)
  }

  const text = await res.text()
  if (!res.ok) {
    let code: number | undefined
    let subcode: number | undefined
    let message = redactMeta(text).slice(0, 500)
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string; code?: number; error_subcode?: number } }
      if (parsed.error) {
        code    = parsed.error.code
        subcode = parsed.error.error_subcode
        message = redactMeta(parsed.error.message ?? message)
      }
    } catch { /* keep redacted text */ }
    throw new MetaApiError(message, res.status, code, subcode)
  }

  return { ok: true }
}
