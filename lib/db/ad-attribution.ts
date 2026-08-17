import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'
import {
  type Attribution,
  type AdEventName,
  EMPTY_ATTRIBUTION,
  hasAttribution,
} from '@/lib/attribution'
import { redact } from '@/lib/meta-capi'
import type { ValuationPath, ErrorStage, ErrorCode } from '@/lib/funnel-stages'

/**
 * Session-anchored attribution storage. Sessions, events and checkout records
 * are one concern and always change together, so they live in one module.
 */

export interface AdSession extends Attribution {
  session_id:    string
  first_seen_at: string
  landing_path:  string | null
  referrer:      string | null
}

/** Backfillable later; everything else in Attribution is write-once. */
const BACKFILLABLE = ['fbc', 'fbp'] as const

/**
 * Records first touch, then defends it.
 *
 * STRICT FIRST-TOUCH INVARIANT: utm_source, utm_medium, utm_campaign,
 * utm_content, utm_term and fbclid are written exactly once and can never be
 * changed. A visitor who arrives on creative_a stays creative_a — whether they
 * later return via creative_b, via organic search, or by typing the URL.
 * Nothing in this module issues an UPDATE touching those columns.
 *
 * fbc and fbp are the sole exception, and only from NULL. Meta's pixel writes
 * _fbc/_fbp a moment after the landing request, so the first event usually
 * arrives without them; the `.is(col, null)` guard means a value can fill a
 * gap but can never replace one.
 */
export async function upsertAdSession(params: {
  sessionId:    string
  attribution:  Attribution
  landingPath?: string | null
  referrer?:    string | null
  /**
   * The raw _fbc cookie value, when the request actually carried one.
   *
   * This is the ONE value allowed to replace a non-NULL fbc, and it exists
   * because of a real defect: Meta's pixel writes _fbc asynchronously, so the
   * landing request almost never has it, and attributionFromRequest therefore
   * fabricates `fb.1.<server_ms>.<fbclid>`. The `.is(col, null)` guard below
   * then made that fabrication permanent — the genuine cookie could never
   * replace it, so every later event, Purchase included, shipped a synthetic
   * click timestamp for the rest of the session's life.
   *
   * Events Manager flags exactly that: "Do not modify the fbclid value
   * retrieved from _fbc cookie or fbclid query parameter in the page URL when
   * sending the fbc parameter." Meta's own cookie is authoritative; ours is a
   * stand-in until it arrives.
   *
   * Only fbc is affected. utm_* and fbclid remain write-once.
   */
  authoritativeFbc?: string | null
}): Promise<void> {
  const supabase = createServiceClient()
  const a = params.attribution

  const { data: inserted, error } = await supabase
    .from('ad_sessions')
    .upsert(
      {
        session_id:   params.sessionId,
        utm_source:   a.utm_source,
        utm_medium:   a.utm_medium,
        utm_campaign: a.utm_campaign,
        utm_content:  a.utm_content,
        utm_term:     a.utm_term,
        fbclid:       a.fbclid,
        fbc:          a.fbc,
        fbp:          a.fbp,
        landing_path: params.landingPath ?? null,
        referrer:     params.referrer ?? null,
      },
      { onConflict: 'session_id', ignoreDuplicates: true }
    )
    .select('session_id')

  if (error) throw error
  if (inserted && inserted.length > 0) return // first touch, nothing to backfill

  // Session already existed. Only BACKFILLABLE columns are touched, and only
  // where they are still NULL. utm_* and fbclid are never in this loop, which
  // is what makes the first-touch invariant structural rather than a
  // convention someone could later break.
  for (const column of BACKFILLABLE) {
    const value = a[column]
    if (!value) continue
    await supabase
      .from('ad_sessions')
      .update({ [column]: value })
      .eq('session_id', params.sessionId)
      .is(column, null)
  }

  // Meta's own _fbc, once it exists, replaces whatever we stood in for it —
  // including a non-NULL fabricated value the loop above cannot touch. Without
  // this the stand-in outlives the real cookie forever. Narrowly scoped: one
  // column, and only when the request genuinely carried the cookie.
  if (params.authoritativeFbc) {
    await supabase
      .from('ad_sessions')
      .update({ fbc: params.authoritativeFbc })
      .eq('session_id', params.sessionId)
      .neq('fbc', params.authoritativeFbc)
  }
}

/** The canonical first-touch attribution for a session. */
export async function getSessionAttribution(sessionId: string): Promise<Attribution> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('ad_sessions')
    .select('utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, fbc, fbp')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (!data) return { ...EMPTY_ATTRIBUTION }
  return data as Attribution
}

export interface RecordEventParams {
  sessionId:     string
  eventName:     AdEventName
  eventId:       string
  attribution?:  Attribution
  checkId?:      string | null
  buyerReportId?: string | null
  billId?:       string | null
  amountCents?:  number | null
  path?:         string | null
  occurredAt?:   Date
  /** Which entry point this journey began from. */
  valuationPath?: ValuationPath | null
  /** Unique per SUBMISSION, so retries collapse but a second car does not. */
  journeyId?:    string | null
  errorStage?:   ErrorStage | null
  errorCode?:    ErrorCode | null
}

export type RecordAdEventResult =
  | { status: 'inserted'; id: string }
  | { status: 'duplicate' }
  | { status: 'error'; error: Error }

/**
 * Inserts one funnel event, resolving attribution from ad_sessions when the
 * caller has none (the usual case once query parameters are gone).
 *
 * The three outcomes are deliberately distinct:
 *
 *   inserted  — a genuinely new occurrence; the caller sends the CAPI event.
 *   duplicate — UNIQUE(event_name, event_id) rejected it. A refresh, a
 *               re-rendered /selesai or a webhook retry lands here. Success
 *               for the caller, but nothing is sent to Meta.
 *   error     — the request itself failed. NEVER conflated with duplicate:
 *               a dropped connection returning an empty array must not be
 *               read as "already recorded", or the event is lost silently.
 */
export async function recordAdEvent(params: RecordEventParams): Promise<RecordAdEventResult> {
  const supabase = createServiceClient()

  let attribution: Attribution
  try {
    attribution =
      params.attribution && hasAttribution(params.attribution)
        ? params.attribution
        : await getSessionAttribution(params.sessionId)
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err : new Error(String(err)) }
  }

  const { data, error } = await supabase
    .from('ad_events')
    .upsert(
      {
        session_id:      params.sessionId,
        event_name:      params.eventName,
        event_id:        params.eventId,
        occurred_at:     (params.occurredAt ?? new Date()).toISOString(),
        utm_source:      attribution.utm_source,
        utm_medium:      attribution.utm_medium,
        utm_campaign:    attribution.utm_campaign,
        utm_content:     attribution.utm_content,
        utm_term:        attribution.utm_term,
        fbclid:          attribution.fbclid,
        fbc:             attribution.fbc,
        fbp:             attribution.fbp,
        check_id:        params.checkId       ?? null,
        buyer_report_id: params.buyerReportId ?? null,
        bill_id:         params.billId        ?? null,
        amount_cents:    params.amountCents   ?? null,
        path:            params.path          ?? null,
        valuation_path:  params.valuationPath ?? null,
        journey_id:      params.journeyId     ?? null,
        error_stage:     params.errorStage    ?? null,
        error_code:      params.errorCode     ?? null,
      },
      { onConflict: 'event_name,event_id', ignoreDuplicates: true }
    )
    .select('id')

  // An empty array only means "ignored conflict" when the request itself
  // succeeded. Check the error first, always.
  if (error) {
    console.error('[ad-attribution] recordAdEvent failed', redact(String(error.message)))
    return { status: 'error', error: new Error(error.message) }
  }
  const row = data?.[0]
  if (row) return { status: 'inserted', id: row.id as string }
  return { status: 'duplicate' }
}

export async function markCapiSent(eventName: AdEventName, eventId: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('ad_events')
    .update({ capi_sent_at: new Date().toISOString() })
    .eq('event_name', eventName)
    .eq('event_id', eventId)
}

export type CheckoutProduct = 'buyer_report' | 'buyer_report_bundle' | 'claim_check_upgrade'

export interface CheckoutAttribution extends Attribution {
  billplz_bill_id:     string
  buyer_report_id:     string | null
  check_id:            string | null
  paqar_sid:           string | null
  product:             CheckoutProduct
  amount_cents:        number
  checkout_started_at: string
}

/**
 * Persists attribution at bill creation. This is what makes purchases
 * attributable from the Billplz webhook alone — the customer who pays and
 * immediately closes the tab never reaches /selesai, and without this row
 * that sale could only be attributed by guessing.
 */
export async function recordCheckoutAttribution(params: {
  billId:         string
  buyerReportId?: string | null
  checkId?:       string | null
  sessionId:      string | null
  attribution:    Attribution
  product:        CheckoutProduct
  amountCents:    number
}): Promise<void> {
  const supabase = createServiceClient()
  const a = params.attribution

  const { error } = await supabase
    .from('checkout_attributions')
    .upsert(
      {
        billplz_bill_id: params.billId,
        buyer_report_id: params.buyerReportId ?? null,
        check_id:        params.checkId ?? null,
        paqar_sid:       params.sessionId,
        utm_source:      a.utm_source,
        utm_medium:      a.utm_medium,
        utm_campaign:    a.utm_campaign,
        utm_content:     a.utm_content,
        utm_term:        a.utm_term,
        fbclid:          a.fbclid,
        fbc:             a.fbc,
        fbp:             a.fbp,
        product:         params.product,
        amount_cents:    params.amountCents,
      },
      { onConflict: 'billplz_bill_id', ignoreDuplicates: true }
    )

  if (error) throw error
}

/**
 * The journey a bill was created from, read back off its own funnel events.
 *
 * checkout_attributions is the natural home and has no column for it; adding
 * one is a production migration this change does not otherwise need. ad_events
 * already carries valuation_path on every row and checkout_started is written
 * with the same bill id in the same server action, so the value is one join
 * away the moment captureCheckout passes it.
 *
 * Inheritance rather than re-derivation is the point: the Billplz webhook has
 * no session, no route and no referrer, so it has no honest way to work a path
 * out on its own. Null is correct and expected for every bill created before
 * this shipped; nothing is backfilled.
 */
export async function getBillValuationPath(billId: string): Promise<ValuationPath | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('ad_events')
    .select('valuation_path')
    .eq('bill_id', billId)
    .not('valuation_path', 'is', null)
    .order('occurred_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return (data?.valuation_path as ValuationPath | null) ?? null
}

export async function getCheckoutAttribution(
  billId: string
): Promise<CheckoutAttribution | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('checkout_attributions')
    .select('*')
    .eq('billplz_bill_id', billId)
    .maybeSingle()

  return (data as CheckoutAttribution | null) ?? null
}
