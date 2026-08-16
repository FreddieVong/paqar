import { classifyTrafficSource, type TrafficSource } from '@/lib/traffic-source'

/**
 * The plate-first measurement regime, as pure functions.
 *
 * WHY THIS IS A LIBRARY AND NOT A SCRIPT
 *
 * The cohort definition is the part that can be argued with, so it has to be
 * testable without a database. Everything here takes plain rows and returns
 * counts; scripts/measure-plate-first.ts does the reading and nothing else.
 * That is what lets the fixtures in __tests__ pin the definition before anyone
 * reads a real result.
 *
 * WHAT A "QUALIFIED PLATE JOURNEY" IS, AND WHY EACH CLAUSE EXISTS
 *
 *  1. A `checks` row. Only the plate paths create one — the model tab calls
 *     /api/price-check and never /api/checks — so a check IS a plate journey.
 *
 *  2. Created at or after REGIME_START. The plate-first homepage went live at
 *     that instant; earlier journeys describe a different product.
 *
 *  3. A valid asking price was supplied. There is no asking_price column on
 *     `checks`, and none is invented here. It does not need one: since the
 *     plate-first release /api/checks REJECTS a body without a well-formed
 *     askingPriceRm (400, no row written), so after REGIME_START the existence
 *     of the row is itself the proof. See __tests__/api/checks-asking-price-gate.
 *
 *  4. The vehicle lookup resolved. Taken from the per-journey funnel event
 *     `plate_lookup_succeeded`, which /api/checks writes with the check id from
 *     the PERSISTED terminal status — never inferred from a null vehicle.
 *     Deliberately not read from plate_lookup_cache.lookup_status, which is the
 *     plate's CURRENT state and can change after the journey.
 *
 *  5. The free result was reached: `plate_price_evidence_viewed`, or a verdict
 *     shown or suppressed. A suppressed verdict still reached a result — the
 *     product answering "we cannot judge this" is a delivered outcome, not a
 *     failure, and dropping it would flatter the denominator.
 *
 * DEDUPLICATION
 *
 * One journey per (session_id, plate_hash), earliest check wins. That is the
 * app's own key: getCachedCheck(plateHash, sessionId) hands a returning visitor
 * their existing check for the same plate, so distinct rows already approximate
 * distinct journeys; this closes the residual case where a paid re-check forces
 * a fresh row. Crucially it does NOT collapse by session, so a buyer comparing
 * three cars is three journeys — which is the behaviour the product wants.
 *
 * RIGHT-CENSORING
 *
 * A journey is MATURE once it has had the full CONVERSION_WINDOW_DAYS to
 * convert. Immature journeys are counted and reported, but excluded from the
 * conversion denominator: including them understates conversion by counting
 * journeys that have not yet had their chance.
 */

export const REGIME_START = '2026-08-16T04:47:22Z'
export const CONVERSION_WINDOW_DAYS = 7
export const RM12_CENTS = 1200
/** Provider list price. An ESTIMATE input, never a reconciled bill. */
export const COST_PER_LOOKUP_RM = 0.81

/** Deployments inside the regime. Annotated, never treated as new experiments. */
export const REGIME_ANNOTATIONS: { at: string; note: string }[] = [
  { at: '2026-08-16T04:47:22Z', note: 'plate-first journey live (regime start)' },
  { at: '2026-08-16T05:01:33Z', note: 'paywall provenance copy corrected' },
  { at: '2026-08-16T08:00:46Z', note: 'verdict wording rescoped; plate input 44px' },
]

// ── Input rows. Field names mirror the columns exactly; nothing is invented. ──

export interface CheckRow {
  id:         string
  session_id: string | null
  plate_hash: string
  created_at: string
}
export interface EventRow {
  event_name: string
  check_id:   string | null
  occurred_at: string
}
export interface ReportRow {
  check_id:     string | null
  status:       string
  amount_cents: number | null
  paid_at:      string | null
  /** buyer_email folded to a boolean by the caller; the address never travels. */
  internal:     boolean | null
}
export interface SessionRow {
  session_id: string
  utm_source: string | null
  fbclid:     string | null
  referrer:   string | null
}
export interface LookupRow {
  plate_hash:    string
  lookup_status: string | null
  fetched_at:    string | null
}

export interface Exclusions {
  /** Session-id prefixes that are QA traffic, e.g. 'qa_attr_'. */
  sessionPrefixes: string[]
  /** plate_hash values used by documented QA runs. */
  plateHashes:     string[]
  /** utm_source values that mark internal traffic. */
  internalUtm:     string[]
}

export const DEFAULT_EXCLUSIONS: Exclusions = {
  sessionPrefixes: ['qa_attr_'],
  plateHashes:     [],
  internalUtm:     ['internal'],
}

/** Explicit shape, not an index signature: every reason is named and typed. */
export interface ExclusionCounts {
  before_regime:       number
  qa_session:          number
  qa_plate:            number
  internal_utm:        number
  team_purchase:       number
  no_vehicle_resolved: number
  no_free_result:      number
  duplicate_journey:   number
}

export interface StageCounts {
  plate_form_engaged:   number | null  // null = PostHog-only, not in ad_events
  plate_submitted:      number
  vehicle_resolved:     number
  free_result_reached:  number
  paywall_viewed:       number
  payment_form_focused: number
  settled_rm12:         number
}

export interface CohortResult {
  regimeStart:       string
  now:               string
  qualified:         number
  mature:            number
  immature:          number
  excluded:          ExclusionCounts
  stages:            StageCounts
  /** Stage-to-stage conversion, each over the stage above it. */
  stageConversion:   Record<string, string>
  purchasesMature:   number
  purchasesAll:      number
  outsideWindow:     number
  byChannel:         Record<TrafficSource, { qualified: number; mature: number; purchases: number }>
  provider:          { cacheHits: number; estimatedBillable: number; estimatedCostRm: number }
  wilson:            { n: number; k: number; point: number; lower: number; upper: number } | null
  decision:          string
}

const DAY_MS = 86_400_000
const ms = (s: string) => new Date(s).getTime()

/** Wilson score interval. Implemented here to avoid adding a dependency. */
export function wilson(k: number, n: number, z = 1.96) {
  if (n === 0) return { n, k, point: 0, lower: 0, upper: 0 }
  const p = k / n
  const d = 1 + (z * z) / n
  const centre = (p + (z * z) / (2 * n)) / d
  const margin = (z / d) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
  return {
    n, k, point: p,
    lower: Math.max(0, centre - margin),
    upper: Math.min(1, centre + margin),
  }
}

/**
 * The predefined decision rules, fixed before any result was read.
 *
 * They are stated in terms of MATURE journeys and settled purchases, and the
 * 7% figure is the PROVIDER-COST floor (RM0.81 / RM12), not business
 * break-even — Billplz fees, refunds, support and acquisition cash all sit on
 * top of it and are not in this number.
 */
export function decide(mature: number, purchases: number): string {
  if (mature < 100) return `IMMATURE — ${mature} of 100 mature journeys; no decision is valid yet.`
  if (mature < 200) {
    return purchases <= 1
      ? `EARLY FAILURE — ${purchases} purchase(s) at ${mature} mature journeys; the 7% floor is already excluded.`
      : `CONTINUE — ${purchases} purchase(s) at ${mature} mature journeys; continue to 200.`
  }
  if (purchases <= 6)  return `FLOOR EXCLUDED — ${purchases} purchases at ${mature} mature; 7% provider-cost floor ruled out.`
  if (purchases <= 21) return `INCONCLUSIVE — ${purchases} purchases at ${mature} mature; the interval spans 7%. Not a win.`
  return `FLOOR CLEARED — ${purchases} purchases at ${mature} mature; 7% provider-cost floor cleared. Business break-even remains UNPROVEN.`
}

export function buildCohort(input: {
  checks:   CheckRow[]
  events:   EventRow[]
  reports:  ReportRow[]
  sessions: SessionRow[]
  lookups:  LookupRow[]
  now:      string
  exclusions?: Exclusions
}): CohortResult {
  const ex = input.exclusions ?? DEFAULT_EXCLUSIONS
  const regime = ms(REGIME_START)
  const nowMs = ms(input.now)
  const windowMs = CONVERSION_WINDOW_DAYS * DAY_MS

  const sessionById = new Map(input.sessions.map(s => [s.session_id, s]))
  const excluded: ExclusionCounts = {
    before_regime: 0, qa_session: 0, qa_plate: 0, internal_utm: 0,
    team_purchase: 0, no_vehicle_resolved: 0, no_free_result: 0, duplicate_journey: 0,
  }

  // Per-check event presence.
  const has = (name: string) => {
    const s = new Set<string>()
    for (const e of input.events) if (e.event_name === name && e.check_id) s.add(e.check_id)
    return s
  }
  const resolved   = has('plate_lookup_succeeded')
  const evidence   = has('plate_price_evidence_viewed')
  const verdict    = has('plate_verdict_viewed')
  const suppressed = has('plate_verdict_suppressed')
  const ctaViewed  = has('paid_report_cta_viewed')

  // Reports by check. A team-email purchase marks the whole journey internal.
  const reportsByCheck = new Map<string, ReportRow[]>()
  for (const r of input.reports) {
    if (!r.check_id) continue
    const a = reportsByCheck.get(r.check_id) ?? []
    a.push(r); reportsByCheck.set(r.check_id, a)
  }

  // ── Qualify ────────────────────────────────────────────────────────────────
  const seen = new Map<string, CheckRow>()   // (session|plate) -> earliest check
  const qualified: CheckRow[] = []

  for (const c of [...input.checks].sort((a, b) => ms(a.created_at) - ms(b.created_at))) {
    if (ms(c.created_at) < regime)                                   { excluded.before_regime++; continue }
    if (c.session_id && ex.sessionPrefixes.some(p => c.session_id!.startsWith(p))) { excluded.qa_session++; continue }
    if (ex.plateHashes.includes(c.plate_hash))                       { excluded.qa_plate++; continue }
    const sess = c.session_id ? sessionById.get(c.session_id) : undefined
    if (sess?.utm_source && ex.internalUtm.includes(sess.utm_source)) { excluded.internal_utm++; continue }
    // Team activity is only ever identifiable through a purchase's email.
    if ((reportsByCheck.get(c.id) ?? []).some(r => r.internal === true)) { excluded.team_purchase++; continue }
    if (!resolved.has(c.id))                                          { excluded.no_vehicle_resolved++; continue }
    if (!(evidence.has(c.id) || verdict.has(c.id) || suppressed.has(c.id))) { excluded.no_free_result++; continue }

    const key = `${c.session_id ?? 'nosession:' + c.id}|${c.plate_hash}`
    if (seen.has(key)) { excluded.duplicate_journey++; continue }
    seen.set(key, c)
    qualified.push(c)
  }

  const isMature = (c: CheckRow) => nowMs - ms(c.created_at) >= windowMs
  const mature = qualified.filter(isMature)

  // ── Numerator: settled external RM12 inside the window ─────────────────────
  let purchasesAll = 0, purchasesMature = 0, outsideWindow = 0
  const purchasedCheckIds = new Set<string>()
  for (const c of qualified) {
    const paid = (reportsByCheck.get(c.id) ?? []).filter(r =>
      r.status === 'paid' && r.amount_cents === RM12_CENTS && r.internal === false && r.paid_at)
    if (!paid.length) continue
    const inWindow = paid.some(r => ms(r.paid_at!) - ms(c.created_at) <= windowMs)
    if (!inWindow) { outsideWindow++; continue }
    purchasesAll++
    purchasedCheckIds.add(c.id)
    if (isMature(c)) purchasesMature++
  }

  // ── Stages, over the qualified cohort ──────────────────────────────────────
  const qIds = new Set(qualified.map(c => c.id))
  const countIn = (s: Set<string>) => [...s].filter(id => qIds.has(id)).length
  const paywall = has('paywall_viewed'), formFocus = has('payment_form_focused')

  const stages: StageCounts = {
    plate_form_engaged:   null,             // PostHog-only by design; see docs
    plate_submitted:      qualified.length,
    vehicle_resolved:     countIn(resolved),
    free_result_reached:  qualified.length, // qualification requires it
    paywall_viewed:       countIn(paywall) || countIn(ctaViewed),
    payment_form_focused: countIn(formFocus),
    settled_rm12:         purchasesAll,
  }

  const pct = (a: number, b: number) => b === 0 ? 'n/a' : `${((a / b) * 100).toFixed(1)}%`
  const stageConversion: Record<string, string> = {
    'submitted→resolved':   pct(stages.vehicle_resolved, stages.plate_submitted),
    'resolved→free result': pct(stages.free_result_reached, stages.vehicle_resolved),
    'free result→paywall':  pct(stages.paywall_viewed, stages.free_result_reached),
    'paywall→form focus':   pct(stages.payment_form_focused, stages.paywall_viewed),
    'form focus→purchase':  pct(stages.settled_rm12, stages.payment_form_focused),
    'MATURE journey→purchase': pct(purchasesMature, mature.length),
  }

  // ── Channel split, via R1–R6 ───────────────────────────────────────────────
  const emptyCh = () => ({ qualified: 0, mature: 0, purchases: 0 })
  const byChannel = {
    paid: emptyCh(), organic_search: emptyCh(), ai_assistant: emptyCh(),
    referral: emptyCh(), direct_or_unknown: emptyCh(),
  } as Record<TrafficSource, { qualified: number; mature: number; purchases: number }>

  for (const c of qualified) {
    const s = c.session_id ? sessionById.get(c.session_id) : undefined
    const ch = classifyTrafficSource({
      utmSource: s?.utm_source ?? null, fbclid: s?.fbclid ?? null, referrer: s?.referrer ?? null,
    })
    byChannel[ch].qualified++
    if (isMature(c)) byChannel[ch].mature++
    if (purchasedCheckIds.has(c.id)) byChannel[ch].purchases++
  }

  // ── Provider cost, ESTIMATED ───────────────────────────────────────────────
  // A plate whose cache row was fetched at/after the journey started is a call
  // Paqar paid for; an older row was served from cache. Retries are not visible
  // per journey, so this is a FLOOR.
  const lookupByPlate = new Map(input.lookups.map(l => [l.plate_hash, l]))
  const platesSeen = new Set<string>()
  let cacheHits = 0, billable = 0
  for (const c of qualified) {
    if (platesSeen.has(c.plate_hash)) { cacheHits++; continue }
    platesSeen.add(c.plate_hash)
    const l = lookupByPlate.get(c.plate_hash)
    if (l?.fetched_at && ms(l.fetched_at) >= ms(c.created_at)) billable++
    else cacheHits++
  }

  const w = mature.length > 0 ? wilson(purchasesMature, mature.length) : null

  return {
    regimeStart: REGIME_START,
    now: input.now,
    qualified: qualified.length,
    mature: mature.length,
    immature: qualified.length - mature.length,
    excluded,
    stages,
    stageConversion,
    purchasesMature,
    purchasesAll,
    outsideWindow,
    byChannel,
    provider: {
      cacheHits,
      estimatedBillable: billable,
      estimatedCostRm: Number((billable * COST_PER_LOOKUP_RM).toFixed(2)),
    },
    wilson: w,
    decision: decide(mature.length, purchasesMature),
  }
}
