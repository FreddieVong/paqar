import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'

import { GET as checkExpiries }     from '../check-expiries/route'
import { GET as retarget }          from '../retarget/route'
import { GET as retargetModel }     from '../retarget-model/route'
import { GET as warmCache }         from '../warm-cache/route'
import { GET as metaAds }           from '../meta-ads/route'
import { GET as screenshotCleanup } from '../screenshot-cleanup/route'

/**
 * Every daily job, behind ONE schedule.
 *
 * ── WHY ─────────────────────────────────────────────────────────────────────
 *
 * vercel.json listed six crons. The plan allows two, so most of them were
 * never registered and simply did not run — silently, because a cron that does
 * not exist reports nothing. The cost was not theoretical: /privasi promises
 * screenshots are deleted after 30 days, and on the day this was written 17
 * abandoned uploads sat past their expiry with nothing sweeping them.
 *
 * Adding a seventh entry would have made it worse. One entry cannot exceed a
 * limit, whatever plan this project is on today or moves to later, so the
 * schedule stops being a thing anyone has to remember.
 *
 * ── HOW ─────────────────────────────────────────────────────────────────────
 *
 * The route handlers are called directly rather than fetched over HTTP. A
 * self-fetch would double the invocations, need an absolute URL that differs
 * per deployment, and turn one timeout into two. Each handler still runs its
 * own CRON_SECRET check against the request forwarded here, so none of them
 * becomes reachable without the secret.
 *
 * ── ORDER AND ISOLATION ─────────────────────────────────────────────────────
 *
 * Sequential, and every job is independently caught: one failure must not stop
 * the rest, which is exactly what a single shared schedule risks. Cleanup runs
 * FIRST — it is the one with a promise to a buyer behind it, and the one whose
 * cost of being skipped is a false statement on a public page rather than a
 * late email.
 *
 * warm-cache is the slow one (maxDuration 300 in its own route), so this route
 * claims the same ceiling for the whole sequence.
 */
export const maxDuration = 300

const JOBS: [name: string, run: (r: NextRequest) => Promise<Response>][] = [
  ['screenshot-cleanup', screenshotCleanup],
  ['check-expiries',     checkExpiries],
  ['retarget-model',     retargetModel],
  ['retarget',           retarget],
  ['meta-ads',           metaAds],
  ['warm-cache',         warmCache],
]

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, unknown> = {}
  for (const [name, run] of JOBS) {
    const started = Date.now()
    try {
      const res  = await run(request)
      const body = await res.json().catch(() => null)
      results[name] = { ok: res.ok, status: res.status, ms: Date.now() - started, body }
      if (!res.ok) console.error('[cron/daily] job returned non-ok', { name, status: res.status })
    } catch (err) {
      // Caught per job on purpose: a thrown warm-cache must not cost the
      // buyer-facing cleanup that already ran, nor the jobs after it.
      results[name] = { ok: false, ms: Date.now() - started, error: String(err) }
      console.error('[cron/daily] job threw', { name, err })
    }
  }

  const failed = Object.values(results).filter(r => !(r as { ok: boolean }).ok).length
  // 200 even with failures: the sequence completed, and the per-job detail is
  // in the body. A 500 here would tell the platform to retry every job,
  // including the ones that succeeded.
  return NextResponse.json({ ran: JOBS.length, failed, results })
}
