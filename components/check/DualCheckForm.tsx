'use client'

import { ListingIntakeForm } from './ListingIntakeForm'

/**
 * The SEO pages' intake form. Now a thin wrapper over ListingIntakeForm.
 *
 * ── WHY IT IS NO LONGER ITS OWN IMPLEMENTATION ─────────────────────────────
 *
 * It posted `{ plate, idempotencyKey, askingPriceRm }` to /api/checks, which
 * was the whole contract while a plate was the only way to identify a car.
 * Since migration 032 that route requires brand/model/year — they identify the
 * car without the RM0.81 provider call, which is what let the plate become
 * optional and the lookup move to the paid side of the line.
 *
 * Left as-is, this form would have returned a 400 on all thirteen SEO pages
 * that mount it. Rewriting it to the new contract would have meant maintaining
 * a second form doing the same job as ListingIntakeForm and drifting from it —
 * which is exactly how the homepage ended up with two checkers in the first
 * place.
 *
 * The name is kept so those thirteen pages need no edit. That is deliberate
 * and worth stating: there is nothing "dual" about it any more.
 */
export function DualCheckForm() {
  return <ListingIntakeForm />
}
