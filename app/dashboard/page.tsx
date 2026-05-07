import { redirect }                  from 'next/navigation'
import Link                          from 'next/link'
import { Nav }                       from '@/components/layout/Nav'
import { Shell }                     from '@/components/layout/Shell'
import { ExpiryCard }                from '@/components/dashboard/ExpiryCard'
import { createClient }              from '@/lib/supabase/server'
import { getUserDocumentExpiries }   from '@/lib/db/document-expiries'
import { getOrCreateVehicleForUser } from '@/lib/db/vehicles'
import { getUserBuyerReports }       from '@/lib/db/buyer-reports'
import { getUserTrustCards }         from '@/lib/db/seller-trust-cards'
import { decrypt }                   from '@/lib/crypto'
import type { DocType, DocumentExpiry } from '@/types/domain'

const DOC_TYPES: DocType[] = ['roadtax', 'insurance', 'driving_licence']

function overallStatus(expiries: DocumentExpiry[]): 'all_clear' | 'attention' | 'urgent' {
  const statuses = DOC_TYPES.map(dt => {
    const e = expiries.find(x => x.document_type === dt)
    if (!e) return 'missing'
    const days = Math.floor(
      (new Date(e.expires_on).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000
    )
    if (days < 0)   return 'expired'
    if (days <= 29) return 'urgent'
    if (days <= 60) return 'warning'
    return 'safe'
  })
  if (statuses.some(s => s === 'expired' || s === 'urgent')) return 'urgent'
  if (statuses.some(s => s === 'warning' || s === 'missing')) return 'attention'
  return 'all_clear'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ms-MY', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function trustCardExpiry(expiresAt: string | null): { label: string; isExpired: boolean } {
  if (!expiresAt) return { label: '—', isExpired: false }
  const days = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
  if (days < 0)  return { label: 'Tamat tempoh',        isExpired: true }
  if (days === 0) return { label: 'Tamat hari ini',     isExpired: false }
  return { label: `Sah ${days} hari lagi`, isExpired: false }
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth?next=/dashboard')

  const [expiries, vehicleResult, buyerReportRows, trustCards] = await Promise.all([
    getUserDocumentExpiries(user.id),
    getOrCreateVehicleForUser(user.id),
    getUserBuyerReports(user.id),
    getUserTrustCards(user.id),
  ])

  const status = overallStatus(expiries)

  const buyerReports = buyerReportRows.map(({ report, plateEncrypted }) => ({
    report,
    plate: plateEncrypted ? decrypt(plateEncrypted).toUpperCase() : '—',
  }))

  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-6 space-y-5">

          {/* Status banner */}
          <div className={`rounded-[14px] px-4 py-3.5 ${
            status === 'all_clear' ? 'bg-[#064E4A]' :
            status === 'attention' ? 'bg-[#B45309]' : 'bg-[#DC2626]'
          }`}>
            <p className="font-heading font-bold text-[14px] text-white">
              {status === 'all_clear'
                ? 'Semua dokumen dalam order'
                : status === 'attention'
                ? 'Beberapa dokumen perlu perhatian'
                : 'Ada dokumen perlu tindakan segera'}
            </p>
            <p className="font-body text-[12px] text-white/70 mt-0.5">
              {status === 'all_clear'
                ? 'Tiada dokumen tamat tempoh dalam masa terdekat'
                : 'Semak kad di bawah untuk butiran'}
            </p>
          </div>

          {/* Vehicle pill */}
          {vehicleResult ? (
            <div className="bg-white border border-[#E5E7EB] rounded-xl px-4 py-3">
              <p className="font-heading font-extrabold text-[18px] text-[#111827] tracking-[.06em]">
                {vehicleResult.platePlain.toUpperCase()}
              </p>
              <p className="font-body text-[11px] text-[#9CA3AF] mt-0.5">Kenderaan anda</p>
            </div>
          ) : (
            <div className="bg-[#FEF9C3] border border-[#FDE68A] rounded-xl px-4 py-3">
              <p className="font-heading font-bold text-[13px] text-[#B45309]">
                Tiada kenderaan ditemui
              </p>
              <p className="font-body text-[12px] text-[#6B7280] mt-0.5">
                Buat semakan kenderaan dahulu untuk mulakan penjejakan.
              </p>
            </div>
          )}

          {/* Document expiry */}
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#6B7280]">
            Status Dokumen
          </p>
          <div className="space-y-3">
            {DOC_TYPES.map(dt => (
              <ExpiryCard
                key={dt}
                docType={dt}
                expiry={expiries.find(e => e.document_type === dt) ?? null}
                onSaved={() => {}}
              />
            ))}
          </div>

          {/* Email reminder note */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl px-4 py-3.5">
            <p className="font-heading font-bold text-[13px] text-[#111827]">Peringatan E-mel Aktif</p>
            <p className="font-body text-[12px] text-[#6B7280] mt-0.5">
              Kami akan hantar e-mel 90, 60, 30, 7 &amp; 1 hari sebelum tamat tempoh.
            </p>
          </div>

          {/* Past Buyer Reports */}
          {buyerReports.length > 0 && (
            <>
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#6B7280]">
                Laporan Pembeli
              </p>
              <div className="space-y-2">
                {buyerReports.map(({ report, plate }) => (
                  <div key={report.id} className="bg-white border border-[#E5E7EB] rounded-[14px] px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-heading font-extrabold text-[16px] text-[#111827] tracking-[.06em]">
                        {plate}
                      </p>
                      <p className="font-body text-[11px] text-[#9CA3AF] mt-0.5">
                        {report.paid_at ? formatDate(report.paid_at) : '—'}
                      </p>
                    </div>
                    <Link
                      href={`/laporan-pembeli/${report.check_id}`}
                      className="flex-shrink-0 font-heading font-bold text-[12px] text-[#064E4A] border border-[#064E4A]/30 rounded-lg px-3 py-1.5 hover:bg-[#064E4A]/5 transition-colors"
                    >
                      Lihat →
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Past Trust Cards */}
          {trustCards.length > 0 && (
            <>
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#6B7280]">
                Seller Trust Card
              </p>
              <div className="space-y-2">
                {trustCards.map(card => {
                  const { label: expiryLabel, isExpired } = trustCardExpiry(card.expires_at)
                  return (
                    <div key={card.id} className="bg-white border border-[#E5E7EB] rounded-[14px] px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-heading font-extrabold text-[16px] text-[#111827] tracking-[.06em]">
                          {card.plate_plain ?? '—'}
                        </p>
                        <p className={`font-body text-[11px] mt-0.5 ${isExpired ? 'text-[#B91C1C]' : 'text-[#9CA3AF]'}`}>
                          {expiryLabel}
                        </p>
                      </div>
                      <Link
                        href={`/trust/${card.public_token}`}
                        className="flex-shrink-0 font-heading font-bold text-[12px] text-[#064E4A] border border-[#064E4A]/30 rounded-lg px-3 py-1.5 hover:bg-[#064E4A]/5 transition-colors"
                      >
                        Lihat →
                      </Link>
                    </div>
                  )
                })}
              </div>
            </>
          )}

        </div>
      </Shell>
    </>
  )
}
