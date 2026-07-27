import { notFound } from 'next/navigation'
import { env } from '@/lib/env'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { listManualPendingReports, listRecentlyFulfilledReports } from '@/lib/jomcheck/db'
import { decrypt } from '@/lib/crypto'
import type { JomCheckResult } from '@/lib/jomcheck'
import { adminLogin, submitJomCheckResult, markJomCheckUncheckable } from './_actions'
import { JomCheckExtractForm } from './JomCheckExtractForm'

export const dynamic = 'force-dynamic'

export const metadata = {
  title:  'Admin — Semakan JomCheck',
  robots: { index: false, follow: false },
}

const CLAIM_FIELDS = [
  { name: 'accident',   label: 'Own Damage' },
  { name: 'flood',      label: 'Banjir' },
  { name: 'windscreen', label: 'Windscreen' },
  { name: 'total_loss', label: 'Total Loss' },
] as const

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ms-MY', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function safePlate(plateEncrypted: string | null): string {
  if (!plateEncrypted) return '(tiada plat)'
  try {
    return decrypt(plateEncrypted).toUpperCase()
  } catch {
    return '(plat tidak dapat dibaca)'
  }
}

export default async function AdminJomCheckPage() {
  if (!env.ADMIN_SECRET) notFound()

  if (!isAdminAuthenticated()) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-5">
        <form action={adminLogin} className="w-full max-w-xs bg-white border border-[#E5E7EB] rounded-[16px] p-6 space-y-4">
          <p className="font-heading font-bold text-[16px] text-[#111827]">Paqar Admin</p>
          <input
            type="password"
            name="secret"
            placeholder="Admin secret"
            autoFocus
            className="w-full border border-[#D1D5DB] rounded-[10px] px-4 py-3 text-[16px]"
          />
          <button
            type="submit"
            className="w-full bg-[#064E4A] text-white font-heading font-bold text-[15px] rounded-[10px] py-3"
          >
            Log Masuk
          </button>
        </form>
      </div>
    )
  }

  const [pending, fulfilled] = await Promise.all([
    listManualPendingReports(),
    listRecentlyFulfilledReports(7),
  ])

  return (
    <div className="min-h-screen bg-[#F9FAFB] px-5 py-8">
      <div className="max-w-md mx-auto space-y-5">
        <div>
          <p className="font-heading font-extrabold text-[20px] text-[#111827]">
            Semakan Accident/Claim — Queue
          </p>
          <p className="font-body text-[13px] text-[#6B7280]">
            Beli semakan di jomcheck.com.my, muat naik gambar laporan, semak baris yang dibaca,
            kemudian hantar. Pelanggan akan di-emel secara automatik.
          </p>
        </div>

        {pending.length === 0 && (
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <p className="font-body text-[14px] text-[#6B7280]">Tiada order menunggu. 🎉</p>
          </div>
        )}

        {pending.map(({ report, plateEncrypted }) => {
          const plate = safePlate(plateEncrypted)
          return (
            <div key={report.id} className="bg-white border border-[#E5E7EB] rounded-[16px] p-5 space-y-4">
              <div>
                <p className="font-heading font-extrabold text-[20px] tracking-[.08em] text-[#064E4A]">
                  {plate}
                </p>
                <p className="font-body text-[13px] text-[#374151]">{report.buyer_email}</p>
                <p className="font-body text-[12px] text-[#9CA3AF]">
                  RM{(report.amount_cents / 100).toFixed(0)} · dibayar {formatDateTime(report.paid_at)}
                </p>
                <a
                  href="https://www.jomcheck.com.my"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 font-heading font-bold text-[13px] text-[#064E4A] underline underline-offset-2"
                >
                  Buka JomCheck untuk plat ini →
                </a>
              </div>

              {/* Primary: upload report screenshot → vision extract → review → save */}
              <JomCheckExtractForm reportId={report.id} />

              <form action={submitJomCheckResult}>
                <input type="hidden" name="reportId" value={report.id} />
                <button
                  type="submit"
                  name="clean"
                  value="1"
                  className="w-full bg-[#ECFDF5] border border-[#6EE7B7] text-[#065F46] font-heading font-bold text-[15px] rounded-[10px] py-3"
                >
                  Tiada Claim (0) ✓
                </button>
              </form>

              {/* Fallback: manual counts (when vision is unavailable / no API key) */}
              <details>
                <summary className="font-body text-[12px] text-[#6B7280] cursor-pointer">Masukkan bilangan claim secara manual</summary>
                <form action={submitJomCheckResult} className="space-y-3 mt-3">
                  <input type="hidden" name="reportId" value={report.id} />
                  <div className="grid grid-cols-2 gap-3">
                    {CLAIM_FIELDS.map(f => (
                      <label key={f.name} className="block">
                        <span className="font-body text-[12px] text-[#6B7280]">{f.label}</span>
                        <input
                          type="number"
                          name={f.name}
                          inputMode="numeric"
                          min={0}
                          defaultValue={0}
                          className="w-full border border-[#D1D5DB] rounded-[10px] px-3 py-3 text-[16px] mt-1"
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-white border border-[#D1D5DB] text-[#111827] font-heading font-bold text-[15px] rounded-[10px] py-3"
                  >
                    Simpan (bilangan) &amp; Hantar E-mel
                  </button>
                </form>
              </details>

              <form action={markJomCheckUncheckable} className="text-center">
                <input type="hidden" name="reportId" value={report.id} />
                <button type="submit" className="font-body text-[12px] text-[#9CA3AF] underline">
                  Tidak dapat disemak (plat tiada rekod)
                </button>
              </form>
            </div>
          )
        })}

        {fulfilled.length > 0 && (
          <details className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <summary className="font-heading font-bold text-[14px] text-[#374151] cursor-pointer">
              Selesai (7 hari) — {fulfilled.length}
            </summary>
            <div className="mt-3 space-y-3">
              {fulfilled.map(({ report, plateEncrypted }) => {
                const data = report.jomcheck_data as JomCheckResult | null
                return (
                  <div key={report.id} className="border-t border-[#F3F4F6] pt-3">
                    <p className="font-heading font-bold text-[14px] text-[#111827]">
                      {safePlate(plateEncrypted)}
                      <span className="font-body font-normal text-[12px] text-[#9CA3AF] ml-2">
                        {formatDateTime(report.jomcheck_checked_at ?? null)}
                      </span>
                    </p>
                    <p className="font-body text-[12px] text-[#6B7280]">
                      {data == null || data.totalClaims === 0
                        ? 'Tiada claim'
                        : data.claims.map(c => `${c.type}: ${c.count}`).join(' · ')}
                    </p>
                  </div>
                )
              })}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
