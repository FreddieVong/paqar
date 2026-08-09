import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import * as Sentry from '@sentry/nextjs'
import { env } from '@/lib/env'

/**
 * TEMPORARY. Delete this file once the Sentry pipeline has been verified.
 *
 * WHY IT EXISTS
 *
 * lib/sentry-scrub.ts was written to stop claim_token — the credential the paid
 * report authorises on — reaching Sentry through URLs, query strings, Referer
 * headers, breadcrumbs, tags and extra. Its behaviour is covered by unit tests
 * and it is confirmed present in the deployed bundle, but neither proves the
 * live pipeline end to end: that events actually arrive, and that what lands in
 * Sentry has the token redacted.
 *
 * This fires exactly one identifiable exception carrying a FAKE token through
 * every field the scrubber is supposed to cover.
 *
 * SAFETY
 *
 * - Secret-gated on CRON_SECRET, constant-time compared. An open endpoint that
 *   writes to Sentry is an abuse vector: anyone could burn the error quota.
 * - No customer flow touches it. Nothing links here, it is under /api/ which
 *   robots.txt disallows, and it mutates nothing.
 * - The token is the literal string PAQAR_TEST_TOKEN_DO_NOT_USE. It is not a
 *   real credential, matches no row in `checks`, and opens nothing.
 * - captureException, not throw: one deterministic event, no 500 in the logs,
 *   no error budget consumed by a fake failure.
 */

export const dynamic = 'force-dynamic'

/** Deliberately not a real token. Matches nothing in the database. */
const FAKE_TOKEN = 'PAQAR_TEST_TOKEN_DO_NOT_USE'
const MARKER     = 'PAQAR_SENTRY_PRODUCTION_VERIFY_20260809'

function secretOk(candidate: string | null): boolean {
  if (!env.CRON_SECRET || !candidate) return false
  const a = Buffer.from(candidate)
  const b = Buffer.from(env.CRON_SECRET)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(request: NextRequest) {
  if (!secretOk(request.nextUrl.searchParams.get('secret'))) {
    // 404, not 401: an unauthenticated caller should not learn this exists.
    return new NextResponse('Not found', { status: 404 })
  }

  // A URL shaped exactly like a real report page, with a fake token in the
  // place a real one would sit. This is what request.url / Referer look like.
  const reportShapedUrl = `https://paqar.my/laporan-pembeli/ch_VERIFY?claim_token=${FAKE_TOKEN}`

  Sentry.addBreadcrumb({
    category: 'navigation',
    message:  `navigated to /laporan-pembeli/ch_VERIFY?claim_token=${FAKE_TOKEN}`,
    data:     { from: '/', to: reportShapedUrl },
  })

  Sentry.withScope((scope) => {
    scope.setTag('paqar_verify', MARKER)
    // Every field the scrubber walks, each carrying the fake token in a
    // different shape: a bare value, a URL, and a sensitive KEY name.
    scope.setTag('probe_url', reportShapedUrl)
    scope.setExtra('probe_absolute_url', reportShapedUrl)
    scope.setExtra('probe_relative_url', `/laporan-pembeli/ch_VERIFY?claim_token=${FAKE_TOKEN}`)
    scope.setExtra('claim_token', FAKE_TOKEN)
    scope.setExtra('probe_note', 'temporary verification — delete app/api/dev/sentry-verify')

    Sentry.captureException(new Error(MARKER))
  })

  // Vercel freezes the instance the moment the response is written, so an
  // unflushed event is simply lost. This is the one place a flush is required.
  const delivered = await Sentry.flush(5_000)

  return NextResponse.json({
    marker: MARKER,
    delivered,
    sentTokenValue: FAKE_TOKEN,
    expectInSentry: 'claim_token=%5BFiltered%5D (in URLs) and [Filtered] (in tags/extra)',
    reminder: 'DELETE app/api/dev/sentry-verify AND REDEPLOY once confirmed',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
