import 'server-only'
import { waitUntil } from '@vercel/functions'
import { getOrFetchVehicleLookup } from '@/lib/db/plate-lookups'
import { mayLookupVehicle } from '@/lib/lookup-spend-guard'
import { recordAdEvent } from '@/lib/db/ad-attribution'
import { eventId as derive } from '@/lib/attribution'
import { isTerminalLookupStatus, eventForLookupStatus, VALUATION_PATHS } from '@/lib/funnel-stages'

/**
 * The RM0.81 vehicle lookup, fired AFTER the buyer has paid.
 *
 * ── WHY IT MOVED ───────────────────────────────────────────────────────────
 *
 * This ran inside POST /api/checks, so every stranger who typed a plate spent
 * RM0.81 of provider credit before paying anything — at a measured conversion
 * of roughly zero. It bought an identification the buyer did not need either:
 * they were reading an advert that already stated the model and year.
 *
 * Intake now takes brand, model and year, which identify the car for nothing.
 * The provider call happens once money has moved, where it does something the
 * buyer genuinely cannot do for themselves: check the seller's claimed variant
 * and year against the official registration record. Same call, same cost, a
 * completely different job.
 *
 * ── WHAT DID NOT CHANGE ────────────────────────────────────────────────────
 *
 * The spend guard. mayLookupVehicle still FAILS CLOSED in every state —
 * unconfigured, limiter error, timeout, rate-limited, missing session — because
 * a paid call is still a call, and an automated one is still automatable.
 *
 * The event derivation. A terminal outcome is read from the persisted status,
 * never inferred from a null vehicle: `not_found` (a valid outcome — the plate
 * simply is not on record) and a provider failure are different events and must
 * never be summed.
 */
export function triggerVehicleLookup(
  plate: string,
  ip: string,
  ctx: { sessionId: string | null; journeyId: string | null; checkId: string; plateHash: string }
) {
  waitUntil((async () => {
    try {
      // FAILS CLOSED. Anything short of an explicit allow — no credentials, a
      // limiter throw, a timeout, a refusal, or no session to key on — spends
      // nothing. See lib/lookup-spend-guard for why that asymmetry is correct.
      const decision = await mayLookupVehicle(ip, ctx.sessionId)
      if (!decision.allowed) return
      const outcome = await getOrFetchVehicleLookup(plate)

      // A legacy/unknown (null) or pending status is deliberately silent.
      if (!ctx.sessionId || !outcome.status || !isTerminalLookupStatus(outcome.status)) return
      const mapped = eventForLookupStatus(outcome.status)
      if (!mapped) return

      await recordAdEvent({
        sessionId:     ctx.sessionId,
        eventName:     mapped.event,
        // Keyed on journey + plate hash so the same outcome recorded twice is
        // one event, while re-checking the same plate in a new journey is not.
        eventId:       derive.plateLookup(mapped.event, ctx.journeyId ?? ctx.checkId, ctx.plateHash),
        checkId:       ctx.checkId,
        journeyId:     ctx.journeyId,
        valuationPath: VALUATION_PATHS.plateReport,
        errorStage:    mapped.errorStage ?? null,
        errorCode:     outcome.errorCode ?? mapped.errorCode ?? null,
      })
    } catch (err) {
      console.error('[vehicle-lookup] event recording failed', err)
    }
  })())
}

