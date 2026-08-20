import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { listScreenshots } from '@/lib/db/listing-screenshots'
import { signForReviewer } from '@/lib/screenshot-storage'
import { intakeIdForCheck } from '@/lib/db/listing-intake'

/**
 * Short-lived signed URLs for one authorised reviewer view.
 *
 * ── AUTHORISATION IS SERVER-SIDE, ALWAYS ───────────────────────────────────
 *
 * isAdminAuthenticated compares an httpOnly cookie holding sha256(ADMIN_SECRET)
 * with timingSafeEqual. There is no query flag, no header and no client
 * assertion that can substitute for it — in particular `?admin_preview=1`,
 * which is a routing hint on the report page and confers nothing here.
 *
 * ── URLS ARE MINTED, NEVER STORED ──────────────────────────────────────────
 *
 * A signed URL is a bearer credential. Persisted, it outlives the request that
 * justified it and is readable by anything that can read the row. They are
 * generated per view, expire in two minutes, and are never logged — not even
 * on failure, where the temptation is strongest.
 */
export async function GET(request: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const checkId = request.nextUrl.searchParams.get('checkId')
  if (!checkId) return NextResponse.json({ error: 'missing' }, { status: 400 })

  // check -> converted intake -> screenshots. One join, and it cannot disagree
  // with itself the way two nullable owners could.
  const intakeId = await intakeIdForCheck(checkId)
  if (!intakeId) return NextResponse.json({ screenshots: [] })

  const rows = await listScreenshots(intakeId)
  const screenshots = await Promise.all(
    rows.map(async r => ({
      id:     r.id,
      width:  r.width,
      height: r.height,
      // Null rather than an error string: a failure to sign is not something
      // the reviewer can act on, and the path must not appear in a message.
      url:    await signForReviewer(r.storage_path),
    })),
  )

  return NextResponse.json({ screenshots })
}
