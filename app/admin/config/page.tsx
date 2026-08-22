import { notFound } from 'next/navigation'
import { env } from '@/lib/env'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { adminLogin } from '@/app/admin/review/_actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Konfigurasi', robots: { index: false, follow: false } }

/**
 * Does this deployment have what it needs to work?
 *
 * ── WHY THIS PAGE EXISTS ───────────────────────────────────────────────────
 *
 * A preview build went out without ANTHROPIC_API_KEY. The only symptom a human
 * could see was a buyer being told their screenshot was unreadable — the
 * screenshot was perfect, and the same message appears when a screenshot
 * genuinely is bad. Finding the real cause took reproducing the upload locally
 * against a replica of the buyer's image.
 *
 * Vercel bakes environment variables in AT BUILD TIME, so a variable added
 * after a build is invisible to the deployment already running while showing
 * as set in the dashboard. That gap is the whole reason for this page: it
 * reports what THIS RUNNING BUILD actually holds, not what the dashboard says.
 *
 * ── IT VERIFIES, IT DOES NOT JUST CHECK PRESENCE ───────────────────────────
 *
 * A key that is present but wrong fails exactly like one that is absent. So
 * the credentials that can be tested are tested, with the cheapest call each
 * provider offers.
 *
 * ── NO VALUES, EVER ────────────────────────────────────────────────────────
 *
 * Booleans and outcomes only. Not the first characters, not the length — a
 * page that leaks a prefix is a page that leaks a secret to whoever gets the
 * admin cookie next.
 */

type Check = {
  name:     string
  required: boolean
  ok:       boolean
  detail:   string
  /** What this breaks when it is wrong. */
  breaks:   string
}

async function verifyAnthropic(): Promise<Check> {
  const base = {
    name: 'ANTHROPIC_API_KEY', required: true,
    breaks: 'Muat naik screenshot — setiap upload akan kata gagal baca',
  }
  if (!env.ANTHROPIC_API_KEY) {
    return { ...base, ok: false, detail: 'Tiada dalam build ini. Set di Vercel, kemudian REDEPLOY — env var lama tidak masuk ke build yang sedang jalan.' }
  }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-5', max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (res.ok) return { ...base, ok: true, detail: 'Ada dan disahkan oleh Anthropic.' }
    if (res.status === 401) return { ...base, ok: false, detail: 'Ada, tetapi ditolak (401) — nilai salah atau tersalin dengan awalan.' }
    if (res.status === 403) return { ...base, ok: false, detail: 'Ada, tetapi tiada akses kepada model ini (403).' }
    if (res.status === 429) return { ...base, ok: true, detail: 'Ada dan sah — tetapi rate limited sekarang (429).' }
    return { ...base, ok: false, detail: `Ada, tetapi Anthropic menjawab ${res.status}.` }
  } catch {
    return { ...base, ok: false, detail: 'Ada, tetapi panggilan gagal — rangkaian atau timeout.' }
  }
}

/**
 * Bill CREATION, which is a different credential from webhook verification.
 *
 * The split matters and the first version of this page missed it: with the API
 * key present and the signature key absent, a buyer pays successfully, Billplz
 * takes the money, and every webhook is rejected — so the report is never
 * marked paid and never produced. The money moves and nothing is delivered,
 * which is the worst outcome this product can have.
 */
async function verifyBillplz(): Promise<Check> {
  const base = {
    name: 'BILLPLZ_API_KEY + BILLPLZ_COLLECTION_ID', required: true,
    breaks: 'Butang bayar — bil tidak dapat dibuat, pembeli nampak ralat',
  }
  if (!env.BILLPLZ_API_KEY || !env.BILLPLZ_COLLECTION_ID) {
    return { ...base, ok: false, detail: 'Tiada dalam build ini.' }
  }
  try {
    const res = await fetch('https://www.billplz.com/api/v3/collections?page=1', {
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.BILLPLZ_API_KEY}:`).toString('base64')}`,
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (res.ok) return { ...base, ok: true, detail: 'Ada dan disahkan oleh Billplz.' }
    if (res.status === 401) return { ...base, ok: false, detail: 'Ada, tetapi ditolak (401) — nilai salah.' }
    return { ...base, ok: false, detail: `Ada, tetapi Billplz menjawab ${res.status}.` }
  } catch {
    return { ...base, ok: false, detail: 'Ada, tetapi panggilan gagal — rangkaian atau timeout.' }
  }
}

async function verifyScraper(): Promise<Check> {
  const base = {
    name: 'SCRAPER_URL + SCRAPER_API_KEY', required: false,
    breaks: 'Baca link iklan automatik — pembeli terpaksa isi butiran sendiri',
  }
  if (!env.SCRAPER_URL || !env.SCRAPER_API_KEY) {
    return { ...base, ok: false, detail: 'Tidak dikonfigurasi. Link tetap disimpan untuk dibaca manusia.' }
  }
  try {
    const health = await fetch(`${env.SCRAPER_URL.replace(/\/$/, '')}/health`, {
      signal: AbortSignal.timeout(15_000),
    })
    const version = health.ok ? ((await health.json()) as { version?: string }).version ?? '?' : '?'

    // /health needs no key, so it proves nothing about the credential. This does.
    const authed = await fetch(`${env.SCRAPER_URL.replace(/\/$/, '')}/extract/listing`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.SCRAPER_API_KEY },
      body: JSON.stringify({ url: 'https://www.mudah.my/' }),
      signal: AbortSignal.timeout(25_000),
    })
    if (authed.status === 401 || authed.status === 403) {
      return { ...base, ok: false, detail: `Servis hidup (${version}) tetapi kunci ditolak — SCRAPER_API_KEY tidak sama dengan API_KEY di Railway.` }
    }
    if (authed.status === 404) {
      return { ...base, ok: false, detail: `Servis hidup (${version}) tetapi /extract/listing tiada — scraper belum di-deploy semula.` }
    }
    return { ...base, ok: true, detail: `Servis hidup dan kunci diterima. Versi ${version}.` }
  } catch {
    return { ...base, ok: false, detail: 'Servis tidak dapat dihubungi.' }
  }
}

function present(name: string, value: unknown, required: boolean, breaks: string): Check {
  return {
    name, required, breaks,
    ok: value != null && value !== '',
    detail: value != null && value !== '' ? 'Ada dalam build ini.' : 'Tiada dalam build ini.',
  }
}

export default async function AdminConfigPage() {
  if (!env.ADMIN_SECRET) notFound()

  // A LOGIN FORM, NOT A 404.
  //
  // This page is reached precisely when something is broken, and 404ing an
  // unauthenticated visitor meant the only way in was to log in at
  // /admin/review first and then retype the URL — a detour, at the moment
  // someone is already debugging. Same form and same action as the queue.
  if (!isAdminAuthenticated()) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-5">
        <form action={adminLogin} className="w-full max-w-xs bg-white border border-[#E5E7EB] rounded-[16px] p-6 space-y-4">
          <p className="font-heading font-bold text-[16px] text-[#111827]">Paqar Admin</p>
          <input type="hidden" name="from" value="/admin/config" />
          <input
            type="password"
            name="secret"
            placeholder="Admin secret"
            autoFocus
            className="w-full border border-[#D1D5DB] rounded-[10px] px-4 py-3 text-[16px]"
          />
          <button
            type="submit"
            className="w-full bg-[#3D472F] text-white font-heading font-bold text-[15px] rounded-[10px] py-3"
          >
            Log Masuk
          </button>
        </form>
      </div>
    )
  }

  const [anthropic, scraper, billplz] = await Promise.all([
    verifyAnthropic(), verifyScraper(), verifyBillplz(),
  ])

  const checks: Check[] = [
    anthropic,
    scraper,
    billplz,
    present('BILLPLZ_X_SIGNATURE_KEY', env.BILLPLZ_X_SIGNATURE_KEY, true,
      'BAHAYA — pembeli boleh bayar tetapi webhook ditolak, jadi laporan tidak pernah dibuat. Duit masuk, pembeli tak dapat apa-apa.'),
    present('RESEND_API_KEY', env.RESEND_API_KEY, true,
      'Semua e-mel — resit, laporan siap, dan refund'),
    present('CRON_SECRET', env.CRON_SECRET, false,
      'Tugas berjadual — pembersihan screenshot'),
  ]

  const broken = checks.filter(c => !c.ok && c.required)

  return (
    <div className="min-h-screen bg-[#F9FAFB] px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="font-heading font-extrabold text-[24px] text-[#111827]">Konfigurasi</h1>
          {/* WHICH BUILD AM I LOOKING AT?
              Without this you cannot tell a page served by the deployment you
              just redeployed from one served by an older build — and that is
              the exact question when a variable you have definitely set still
              reads as missing. Vercel injects these itself; none is a secret. */}
          <p className="font-body text-[12px] text-[#6B7280] mt-1">
            Build:{' '}
            <strong className="font-heading font-bold text-[#111827]">
              {process.env.VERCEL_ENV ?? 'local'}
            </strong>
            {process.env.VERCEL_GIT_COMMIT_REF && <> · {process.env.VERCEL_GIT_COMMIT_REF}</>}
            {process.env.VERCEL_GIT_COMMIT_SHA && (
              <> · <span className="font-mono">{process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)}</span></>
            )}
          </p>
          {process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production' && (
            <p className="font-body text-[12px] text-[#B45309] mt-1 leading-relaxed">
              Env var mesti ditanda <strong>{process.env.VERCEL_ENV}</strong> di Vercel &mdash;
              menandakan Production sahaja tidak cukup untuk build ini.
            </p>
          )}
          <p className="font-body text-[13px] text-[#6B7280] mt-1">
            Apa yang build ini benar-benar ada &mdash; bukan apa yang dashboard Vercel tunjuk.
            Env var Vercel hanya masuk ke build BARU.
          </p>
        </div>

        {broken.length > 0 && (
          <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[12px] px-4 py-3">
            <p className="font-heading font-bold text-[13px] text-[#B91C1C]">
              {broken.length} perkara wajib tidak berfungsi
            </p>
          </div>
        )}

        {checks.map(c => (
          <div key={c.name}
               className={`bg-white border rounded-[12px] p-4 ${c.ok ? 'border-[#E5E7EB]' : c.required ? 'border-[#FECACA]' : 'border-[#FDE68A]'}`}>
            <div className="flex items-start gap-2.5">
              <span className="text-[15px] leading-none mt-0.5" aria-hidden="true">
                {c.ok ? '✅' : c.required ? '❌' : '⚠️'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-bold text-[13px] text-[#111827]">
                  {c.name}
                  {!c.required && <span className="font-normal text-[#9CA3AF]"> · pilihan</span>}
                </p>
                <p className="font-body text-[13px] text-[#374151] mt-0.5 leading-relaxed">{c.detail}</p>
                {!c.ok && (
                  <p className="font-body text-[12px] text-[#9CA3AF] mt-1 leading-relaxed">
                    Kesannya: {c.breaks}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}

        <p className="font-body text-[12px] text-[#9CA3AF] leading-relaxed">
          Halaman ini tidak pernah memaparkan nilai sebenar mana-mana kunci.
          Supabase, AES_KEY dan Upstash tiada di sini kerana ia wajib &mdash;
          tanpa mereka aplikasi ini langsung tidak akan naik, jadi halaman ini
          sendiri membuktikannya.
        </p>

        <a href="/admin/review"
           className="inline-block font-heading font-bold text-[13px] text-[#3D472F] underline underline-offset-2">
          ← Semakan Laporan
        </a>
      </div>
    </div>
  )
}
