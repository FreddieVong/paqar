import 'server-only'
import type { NextRequest } from 'next/server'
import { loadOwnedIntake, type IntakeRow } from '@/lib/db/listing-intake'

/**
 * Prove ownership of an intake, on every operation without exception.
 *
 * ── WHY THE TOKEN TRAVELS IN A HEADER ──────────────────────────────────────
 *
 * Not in the URL. A query string reaches places its author never intended:
 * server access logs, the browser's history, the Referer header sent to any
 * third party the page loads, analytics that capture full paths, and every
 * screenshot of the address bar. A credential in any of those is a credential
 * given away.
 *
 * A header goes to one server and is not recorded by default.
 *
 * ── WHY EVERY FAILURE LOOKS THE SAME ───────────────────────────────────────
 *
 * Wrong token, expired intake and non-existent id all return null. Telling them
 * apart would confirm which ids are real, turning a guessing attack into an
 * enumeration one. The buyer sees the same recoverable message either way,
 * because for them the remedy is identical: start again.
 */

export const INTAKE_TOKEN_HEADER = 'x-paqar-intake-token'

export async function authorizeIntake(
  request: NextRequest,
  intakeId: string,
): Promise<IntakeRow | null> {
  const token = request.headers.get(INTAKE_TOKEN_HEADER)
  if (!token || !intakeId) return null
  // Never logged, never echoed, never attached to an error.
  return loadOwnedIntake(intakeId, token)
}
