import 'server-only'
import { env } from '@/lib/env'
import {
  ALLOW_PAUSED_CREATION,
  APPROVED_BID_STRATEGY, APPROVED_BILLING_EVENT, APPROVED_OPTIMISATION_GOAL,
  MAX_ADSET_LIFETIME_BUDGET_CENTS, MAX_TOTAL_SPEND_CENTS, TEST_DURATION_DAYS,
  isDestinationAllowed, isLifetimeBudgetAllowed, isPromotedObjectAllowed,
  isScheduleAllowed, isTargetingAllowed, isUrlTagsAllowed,
  type PromotedObject, type SpendAuthorisation, type TargetingSpec,
} from '@/lib/meta-ads/guards'

/**
 * Meta Marketing API client.
 *
 * ⚠ THE EXPORT SURFACE IS THE SAFETY MECHANISM.
 *
 * The property this module guarantees changed on 2026-08-11, and it did not
 * weaken:
 *
 *   Before: this codebase cannot CREATE anything.
 *   Now:    this codebase cannot START OR INCREASE SPEND.
 *
 * The old rule was a proxy for the real one. An object that cannot deliver
 * cannot cost money, so what actually protects the account is the absence of
 * any path to a delivering state — which is now the property stated and tested
 * directly. Creation had to become possible because the creative-treatment test
 * needs ad creatives whose destination URLs are correct, and editing the
 * historical creatives to obtain them would have corrupted ads that already ran.
 *
 * THREE INVARIANTS, each enforced structurally and asserted in
 * __tests__/lib/meta-ads-safety.test.ts:
 *
 *   1. Every object this module creates is created PAUSED. The status is
 *      applied by pausedBody() and never by a caller — the draft types have no
 *      status field, so asking for a delivering object is a compile error
 *      before it is a runtime one, and pausedBody() throws if one is smuggled
 *      in through an untyped cast.
 *   2. No verb here changes an existing object's status except to PAUSED.
 *   3. No verb here touches a budget on an object that already exists.
 *
 * There is exactly one status literal in this entire file, inside pausedBody().
 * A test asserts that. If you are here to add a mutation, the surface test will
 * fail, and it is meant to.
 *
 * Campaigns, ad sets and ads are still STARTED by hand in Ads Manager. Nothing
 * in this codebase can do it, and nothing should ever be added that can.
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

function accountPath(): string {
  const id = env.META_AD_ACCOUNT_ID
  if (!id) throw new MetaApiError('META_AD_ACCOUNT_ID is not set', 0)
  return id.startsWith('act_') ? id : `act_${id}`
}

/**
 * Was duplicated in metaGet and pauseCampaign; a third copy for metaPost would
 * have been the point where the two drifted.
 */
function parseMetaError(text: string, status: number): MetaApiError {
  let code: number | undefined
  let subcode: number | undefined
  let message = redactMeta(text).slice(0, 500)
  try {
    const parsed = JSON.parse(text) as {
      error?: {
        message?: string; code?: number; error_subcode?: number
        error_user_title?: string; error_user_msg?: string
      }
    }
    if (parsed.error) {
      code    = parsed.error.code
      subcode = parsed.error.error_subcode
      // `message` is very often the useless generic "Invalid parameter", while
      // the actionable reason sits in error_user_title / error_user_msg. A
      // campaign creation failed with nothing but "Invalid parameter" and the
      // real cause — a required is_adset_budget_sharing_enabled field — was
      // only reachable by re-issuing the request by hand outside this client.
      // Keeping the detail is what makes a creation failure diagnosable.
      const parts = [
        parsed.error.message,
        parsed.error.error_user_title,
        parsed.error.error_user_msg,
      ].filter((p): p is string => typeof p === 'string' && p.length > 0)
      // Deduped: Meta frequently repeats message inside error_user_msg.
      message = redactMeta([...new Set(parts)].join(' — ') || message)
    }
  } catch { /* non-JSON error body — keep the redacted text */ }
  return new MetaApiError(message.slice(0, 1000), status, code, subcode)
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
  if (!res.ok) throw parseMetaError(text, res.status)

  try {
    return JSON.parse(text) as T
  } catch {
    throw new MetaApiError('Malformed JSON from Meta', res.status)
  }
}

/**
 * DELIBERATELY NOT EXPORTED.
 *
 * A generic POST on the export surface would restore exactly the unbounded
 * capability this module exists to withhold — every guarantee above would
 * become a convention. The surface test asserts it is absent.
 */
async function metaPost<T = Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = requireToken()

  let res: Response
  try {
    res = await fetch(`${base()}/${path.replace(/^\//, '')}`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body:   JSON.stringify(body),
      cache:  'no-store',
      signal: AbortSignal.timeout(20_000),
    })
  } catch (err) {
    throw new MetaApiError(`Network failure: ${redactMeta(String(err))}`, 0)
  }

  const text = await res.text()
  if (!res.ok) throw parseMetaError(text, res.status)

  try {
    return JSON.parse(text) as T
  } catch {
    throw new MetaApiError('Malformed JSON from Meta', res.status)
  }
}

/**
 * The one place a delivery status is written, for every verb in this file.
 *
 * Throws rather than overwriting when a caller supplies a status through an
 * untyped cast: silently correcting it would hide an attempt to create a
 * delivering object, and that attempt is exactly what should surface. The
 * status is spread LAST regardless, so even a key this list has not thought of
 * cannot win.
 */
const FORBIDDEN_KEYS = ['status', 'effective_status', 'configured_status', 'execution_options']

/**
 * Applied to the DRAFT as well as the body, and that is not belt-and-braces.
 *
 * The create verbs build their request bodies field by field, so a status
 * smuggled onto a draft through an untyped cast would simply be ignored — the
 * object would still be created PAUSED, but the caller's intent to create a
 * delivering one would pass silently. Refusing at the boundary makes that
 * attempt visible instead of merely ineffective.
 */
function rejectCallerStatus(input: Record<string, unknown>): void {
  for (const key of FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      throw new MetaApiError(`${key} is not caller-controllable`, 0)
    }
  }
}

function pausedBody(body: Record<string, unknown>): Record<string, unknown> {
  rejectCallerStatus(body)
  // Spread LAST, so even a key this list has not anticipated cannot win.
  return { ...body, status: 'PAUSED' }
}

function guardCreation(draft: Record<string, unknown>): void {
  if (!ALLOW_PAUSED_CREATION) {
    throw new MetaApiError('Paused creation is disabled (ALLOW_PAUSED_CREATION)', 0)
  }
  rejectCallerStatus(draft)
}

/**
 * Sets a campaign to PAUSED.
 *
 * Deliberately cannot reverse itself: the status is hard-coded by pausedBody(),
 * not a parameter, so there is no call shape that starts delivery. A manually
 * paused campaign can never be restarted by the operator.
 */
export async function pauseCampaign(campaignId: string): Promise<{ ok: true }> {
  await metaPost(campaignId, pausedBody({}))
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Creation. Every draft type below omits `status` on purpose.
// ---------------------------------------------------------------------------

export interface CampaignDraft {
  name:      string
  objective: 'OUTCOME_SALES' | 'OUTCOME_LEADS'
}

/**
 * No budget field of any kind is accepted or sent, so a campaign created here
 * can never carry one. Budgets live on ad sets, where the lifetime cap is the
 * real Meta-enforced ceiling for this test.
 */
export async function createCampaignPaused(draft: CampaignDraft): Promise<{ id: string }> {
  guardCreation(draft as unknown as Record<string, unknown>)
  if (!draft.name.trim()) throw new MetaApiError('Campaign name is required', 0)

  const res = await metaPost<{ id: string }>(`${accountPath()}/campaigns`, pausedBody({
    name:                  draft.name,
    objective:             draft.objective,
    special_ad_categories: [],
    buying_type:           'AUCTION',
    // Meta REQUIRES this field on a campaign with no campaign budget, and
    // rejects creation outright without it (error_subcode 4834011).
    //
    // false is not a formality. Setting it true lets ad sets "share 20% of
    // their budget to optimize overall performance" — Meta would move money
    // between the two arms based on its own read of which is winning. The
    // whole point of this campaign is that the arms are identical apart from
    // the creative and each gets exactly RM90; budget sharing would make the
    // spend a FUNCTION of the outcome being measured, so the cheaper arm would
    // look better partly because Meta had already decided it was better.
    //
    // Hardcoded rather than exposed on CampaignDraft for the same reason
    // optimization_goal is: a caller must not be able to turn it on.
    is_adset_budget_sharing_enabled: false,
  }))
  return { id: res.id }
}

export interface AdSetDraft {
  name:                string
  campaignId:          string
  lifetimeBudgetCents: number
  startTimeIso:        string
  endTimeIso:          string
  promotedObject:      PromotedObject
  targeting:           TargetingSpec
  /** Required, never defaulted — see isPromotedObjectAllowed. */
  expectedCustomConversionId: string
}

/**
 * The only verb that can commit money, so it demands a SpendAuthorisation.
 *
 * The brand is compile-time only, so the authorisation's own numbers are
 * re-validated here: a cast could produce the type but not a consistent value.
 *
 * optimization_goal, billing_event and bid_strategy are module constants rather
 * than draft fields, so a caller cannot request a bid cap or a different goal
 * and quietly make the two arms non-comparable.
 */
export async function createAdSetPaused(
  draft: AdSetDraft,
  authorisation: SpendAuthorisation,
): Promise<{ id: string }> {
  guardCreation(draft as unknown as Record<string, unknown>)

  if (!authorisation || authorisation.__brand !== 'SpendAuthorisation') {
    throw new MetaApiError('A SpendAuthorisation is required to commit budget', 0)
  }
  const { cumulativeSpentCents, commitmentCents } = authorisation
  if (!Number.isFinite(cumulativeSpentCents) || !Number.isFinite(commitmentCents)) {
    throw new MetaApiError('SpendAuthorisation carries unreadable figures', 0)
  }
  if (cumulativeSpentCents + commitmentCents > MAX_TOTAL_SPEND_CENTS) {
    throw new MetaApiError('SpendAuthorisation exceeds the total spend allowance', 0)
  }
  if (draft.lifetimeBudgetCents > commitmentCents) {
    throw new MetaApiError('Lifetime budget exceeds the authorised commitment', 0)
  }
  if (!isLifetimeBudgetAllowed(draft.lifetimeBudgetCents, TEST_DURATION_DAYS)) {
    throw new MetaApiError(
      `Lifetime budget must be <= ${MAX_ADSET_LIFETIME_BUDGET_CENTS} cents over `
      + `${TEST_DURATION_DAYS} days and within the daily ceiling`, 0)
  }
  if (!isScheduleAllowed(draft.startTimeIso, draft.endTimeIso, new Date())) {
    throw new MetaApiError(`Schedule must be exactly ${TEST_DURATION_DAYS} days and start in the future`, 0)
  }
  if (!isTargetingAllowed(draft.targeting)) {
    throw new MetaApiError('Targeting does not match the approved specification', 0)
  }
  if (!isPromotedObjectAllowed(draft.promotedObject, draft.expectedCustomConversionId)) {
    throw new MetaApiError('promoted_object does not match the configured custom conversion', 0)
  }

  const res = await metaPost<{ id: string }>(`${accountPath()}/adsets`, pausedBody({
    name:              draft.name,
    campaign_id:       draft.campaignId,
    lifetime_budget:   draft.lifetimeBudgetCents,
    start_time:        draft.startTimeIso,
    end_time:          draft.endTimeIso,
    optimization_goal: APPROVED_OPTIMISATION_GOAL,
    billing_event:     APPROVED_BILLING_EVENT,
    bid_strategy:      APPROVED_BID_STRATEGY,
    promoted_object:   draft.promotedObject,
    targeting:         draft.targeting,
  }))
  return { id: res.id }
}

/**
 * Effective states in which an ad set is provably not delivering.
 *
 * An allow-list, not a "not delivering" test, so a state Meta adds later is
 * refused by default rather than silently permitted. Deliberately excludes
 * IN_PROCESS and WITH_ISSUES: both can deliver.
 */
const NON_DELIVERING_EFFECTIVE = ['PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED'] as const

/** The ONLY keys this verb accepts. Anything else is refused, not ignored. */
const SCHEDULE_KEYS = ['adSetId', 'startTimeIso', 'endTimeIso'] as const

export interface AdSetScheduleUpdate {
  adSetId:      string
  startTimeIso: string
  endTimeIso:   string
}

/**
 * Moves the start/end of a paused, never-delivered ad set. Nothing else.
 *
 * WHY THIS EXISTS AT ALL
 *
 * The two experiment arms were created 64 minutes apart, so their schedules
 * differ — which is a rival explanation for whatever the test measures. Ads
 * Manager would not let the owner edit the start date, and the alternative was
 * abandoning both ad sets and rebuilding them.
 *
 * WHY IT IS NOT updateAdSet()
 *
 * A generic updater would hand back every capability the export surface exists
 * to withhold: budget, targeting, optimisation, status. This verb can express
 * exactly two fields. It cannot raise a budget, cannot start delivery, and
 * cannot change what the ad set is pointed at, because there is no argument
 * through which to say any of those things.
 *
 * WHY THE PRECONDITIONS ARE NOT PARANOIA
 *
 * Moving the schedule of an ad set that is ALREADY delivering could extend a
 * spending window. So it refuses unless the ad set is in a non-delivering
 * effective state AND has never spent a cent. Both are read from Meta at call
 * time, not taken on trust from the caller.
 */
export async function updatePausedAdSetSchedule(
  update: AdSetScheduleUpdate,
): Promise<{ ok: true }> {
  const asRecord = update as unknown as Record<string, unknown>
  for (const key of Object.keys(asRecord)) {
    if (!(SCHEDULE_KEYS as readonly string[]).includes(key)) {
      throw new MetaApiError(`${key} is not accepted by updatePausedAdSetSchedule`, 0)
    }
  }
  rejectCallerStatus(asRecord)

  if (!isScheduleAllowed(update.startTimeIso, update.endTimeIso, new Date())) {
    throw new MetaApiError(
      `Schedule must be exactly ${TEST_DURATION_DAYS} days and start in the future`, 0)
  }

  // Read the live object; the caller's belief about its state is not evidence.
  const before = await metaGet<{
    status?: string; effective_status?: string
  }>(update.adSetId, { fields: 'id,status,effective_status' })

  if (before.status !== 'PAUSED') {
    throw new MetaApiError(
      `Ad set ${update.adSetId} is not paused (status=${before.status ?? 'unreadable'})`, 0)
  }
  if (!(NON_DELIVERING_EFFECTIVE as readonly string[]).includes(before.effective_status ?? '')) {
    throw new MetaApiError(
      `Ad set ${update.adSetId} may be delivering `
      + `(effective_status=${before.effective_status ?? 'unreadable'})`, 0)
  }

  const insights = await metaGet<{ data?: Array<{ spend?: string }> }>(
    `${update.adSetId}/insights`, { fields: 'spend', date_preset: 'maximum' })
  const spent = Number(insights.data?.[0]?.spend ?? 0)
  if (!Number.isFinite(spent) || spent > 0) {
    throw new MetaApiError(
      `Ad set ${update.adSetId} has already spent ${spent} — its schedule is history, not a draft`, 0)
  }

  // Exactly two fields leave this function. Not spread from the input.
  await metaPost(update.adSetId, {
    start_time: update.startTimeIso,
    end_time:   update.endTimeIso,
  })
  return { ok: true }
}

export interface AdCreativeDraft {
  name:            string
  /** Same assets as an existing creative; a fresh spec, never the old object. */
  objectStorySpec: Record<string, unknown>
  urlTags:         string
  expectedCampaign: string
  expectedContent:  string
}

/**
 * An ad creative has no delivery status — it is inert until a live ad references
 * it, and no verb in this module can make an ad live. So it is safe to create
 * without a paused state, which it could not have anyway.
 *
 * THE URL VALIDATION LIVES HERE because the destination is encoded in the
 * creative and nowhere else. Every link is checked, including every carousel
 * child attachment: creative_b's UTMs were baked into its own link, so a
 * per-creative check that skipped children would have passed it.
 *
 * The caller must verify the stored result afterwards with
 * assertCreativeUrlsClean — creation is not trusted to have kept what it was
 * sent.
 */
export async function createAdCreative(draft: AdCreativeDraft): Promise<{ id: string }> {
  guardCreation(draft as unknown as Record<string, unknown>)

  if (!isUrlTagsAllowed(draft.urlTags, {
    campaign: draft.expectedCampaign,
    content:  draft.expectedContent,
  })) {
    throw new MetaApiError('url_tags do not carry the required UTMs', 0)
  }
  for (const link of collectLinks(draft.objectStorySpec)) {
    if (!isDestinationAllowed(link)) {
      throw new MetaApiError(`Destination link is not an untagged paqar.my URL: ${link}`, 0)
    }
  }

  const res = await metaPost<{ id: string }>(`${accountPath()}/adcreatives`, {
    name:              draft.name,
    object_story_spec: draft.objectStorySpec,
    url_tags:          draft.urlTags,
  })
  return { id: res.id }
}

/**
 * Every destination in a creative spec, including carousel children.
 *
 * Exported so preflight and the creation script re-run the identical extraction
 * against what Meta actually stored, rather than a second implementation that
 * could disagree with this one.
 */
export function collectLinks(spec: Record<string, unknown>): string[] {
  const out: string[] = []
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(visit); return }
    if (!node || typeof node !== 'object') return
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if ((key === 'link' || key === 'link_url') && typeof value === 'string') out.push(value)
      else visit(value)
    }
  }
  visit(spec)
  return out
}

export interface AdDraft {
  name:       string
  adSetId:    string
  creativeId: string
}

export async function createAdPaused(draft: AdDraft): Promise<{ id: string }> {
  guardCreation(draft as unknown as Record<string, unknown>)
  if (!draft.adSetId || !draft.creativeId) {
    throw new MetaApiError('Ad requires both an ad set and a creative', 0)
  }

  const res = await metaPost<{ id: string }>(`${accountPath()}/ads`, pausedBody({
    name:     draft.name,
    adset_id: draft.adSetId,
    creative: { creative_id: draft.creativeId },
  }))
  return { id: res.id }
}
