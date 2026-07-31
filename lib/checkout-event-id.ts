/**
 * The single definition of the InitiateCheckout event_id.
 *
 * Meta deduplicates a browser-pixel event against its Conversions API twin
 * only when both carry the SAME event_id. The two sends happen in different
 * runtimes — PaymentForm in the browser, captureCheckout on the server — so
 * nothing but a shared derivation keeps them equal.
 *
 * This module exists because they once drifted: the server derived its id from
 * the Billplz bill id, which does not exist client-side and therefore could
 * never collide with the browser's. Meta counted every checkout TWICE.
 *
 * Deliberately free of `server-only` and of any import that pulls it in —
 * PaymentForm is a client component and must be able to import this.
 *
 * The inputs are the only two facts both runtimes know at checkout time: which
 * check is being paid for, and whether the JomCheck add-on is included.
 */
export function checkoutEventId(checkId: string, bundle: boolean): string {
  return `ic_${checkId}_${bundle ? 'bundle' : 'base'}`
}
