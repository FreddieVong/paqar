import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * The anonymous ownership credential for a listing intake.
 *
 * ── WHY A UUID IS NOT ENOUGH ───────────────────────────────────────────────
 *
 * An intake id identifies which intake; it does not establish who may touch it.
 * Ids leak: into browser history, referrer headers, screenshots of a URL bar,
 * server logs, and anything a buyer pastes into a support chat. If the id alone
 * authorised access, every one of those leaks would hand a stranger someone
 * else's uploaded screenshots.
 *
 * So the id names, and a separate secret authorises.
 *
 * ── WHY ONLY THE HASH IS STORED ────────────────────────────────────────────
 *
 * A token stored raw is a live credential sitting in a table, in every backup,
 * and in any query result that touches the row. Storing SHA-256 means a
 * database read yields nothing usable — the holder still has to present the
 * original.
 *
 * This is deliberately stricter than checks.claim_token, which is stored raw.
 * New surface gets the better pattern; migrating the old one is a separate
 * change with its own compatibility story, and doing it here would have
 * quietly broken every existing report link.
 *
 * ── WHY COMPARISON IS CONSTANT-TIME ────────────────────────────────────────
 *
 * A byte-by-byte comparison that returns early leaks how much of a guess was
 * correct, which turns brute force from infeasible into a few thousand
 * requests. The hashes are equal-length by construction, so timingSafeEqual is
 * safe to call directly.
 */

/** 32 bytes of CSPRNG output. Not a UUID: v4 has ~122 bits and a known shape. */
export function mintIntakeToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashIntakeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** True when this token owns the intake whose stored hash is `expectedHash`. */
export function verifyIntakeToken(token: string, expectedHash: string): boolean {
  if (!token || !expectedHash) return false
  const a = Buffer.from(hashIntakeToken(token), 'hex')
  const b = Buffer.from(expectedHash, 'hex')
  // Length check first: timingSafeEqual throws on a mismatch, and a thrown
  // error is itself a timing signal.
  return a.length === b.length && timingSafeEqual(a, b)
}
