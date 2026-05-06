import { notFound }            from 'next/navigation'
import { Nav }                 from '@/components/layout/Nav'
import { Shell }               from '@/components/layout/Shell'
import { getTrustCardByToken } from '@/lib/db/seller-trust-cards'
import { getCheck }            from '@/lib/db/checks'
import { decrypt }             from '@/lib/crypto'
import Link                    from 'next/link'

interface Props { params: { token: string } }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function TrustCardPage({ params }: Props) {
  const card = await getTrustCardByToken(params.token)
  if (!card || card.status !== 'paid') notFound()

  const isExpired = card.expires_at ? new Date(card.expires_at) < new Date() : false
  const row   = await getCheck(card.check_id)
  const plate = row ? decrypt(row.check.plate_encrypted as string).toUpperCase() : '—'
  const hasIssues = row?.results.some(r => r.status === 'hit') ?? false
  const allClear  = !hasIssues && !isExpired

  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-6 pb-10 max-w-sm mx-auto space-y-5">
          <div className={`rounded-[16px] p-5 text-center ${allClear ? 'bg-[#064E4A]' : isExpired ? 'bg-[#6B7280]' : 'bg-[#DC2626]'}`}>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-white/60 mb-2">
              Paqar Seller Trust Card
            </p>
            <p className="font-heading font-extrabold text-[28px] tracking-[.08em] text-white mb-1">{plate}</p>
            <div className={`inline-block font-heading font-bold text-[13px] px-3 py-1.5 rounded-full mt-2 ${
              allClear ? 'bg-white text-[#064E4A]' : isExpired ? 'bg-white/20 text-white' : 'bg-white text-[#DC2626]'
            }`}>
              {isExpired ? 'Tamat Tempoh' : allClear ? '✓ Saman Clear' : '⚠ Ada Isu'}
            </div>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5 space-y-3">
            <div className="flex justify-between text-[13px]">
              <span className="font-body text-[#6B7280]">Tarikh semakan</span>
              <span className="font-heading font-bold text-[#111827]">{formatDate(card.paid_at ?? card.created_at)}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="font-body text-[#6B7280]">Sah sehingga</span>
              <span className="font-heading font-bold text-[#111827]">{card.expires_at ? formatDate(card.expires_at) : '—'}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="font-body text-[#6B7280]">Disemak oleh</span>
              <span className="font-heading font-bold text-[#111827]">Pemilik kenderaan</span>
            </div>
            <div className="h-px bg-[#F3F4F6]" />
            <p className="font-body text-[11px] text-[#9CA3AF]">
              Berdasarkan maklumat yang tersedia semasa semakan. Paqar adalah perkhidmatan pihak ketiga.
            </p>
          </div>

          {row && (
            <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
              <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#6B7280] mb-3">Butiran Semakan</p>
              <div className="space-y-2">
                {row.results.map(r => (
                  <div key={r.source} className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                    r.status === 'clear' ? 'bg-[#F0FDF4]' : r.status === 'hit' ? 'bg-[#FEF2F2]' : 'bg-[#F9FAFB]'
                  }`}>
                    <span className="font-heading font-bold text-[12px] text-[#111827]">{r.label}</span>
                    <span className={`font-body text-[11px] ${r.status === 'clear' ? 'text-[#15803D]' : r.status === 'hit' ? 'text-[#B91C1C]' : 'text-[#9CA3AF]'}`}>
                      {r.status === 'clear' ? 'Tiada Isu' : r.status === 'hit' ? 'Ada Isu ⚠' : 'Tidak dapat disemak'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <a href={`/api/trust-card-image/${params.token}`} download={`paqar-trust-card-${plate}.png`}
            className="block w-full border-[1.5px] border-[#064E4A] text-[#064E4A] font-heading font-bold text-[15px] rounded-[14px] py-4 text-center hover:bg-[#064E4A]/5 transition-colors">
            Muat Turun Kad (PNG) →
          </a>

          <div className="text-center">
            <Link href="/" className="font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A]">
              Semak kereta anda di Paqar →
            </Link>
          </div>
        </div>
      </Shell>
    </>
  )
}
