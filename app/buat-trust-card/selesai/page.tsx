import { redirect }            from 'next/navigation'
import { Nav }                 from '@/components/layout/Nav'
import { Shell }               from '@/components/layout/Shell'
import { getTrustCardByToken } from '@/lib/db/seller-trust-cards'
import Link                    from 'next/link'

interface Props { searchParams: { token?: string } }

export default async function SelesaiPage({ searchParams }: Props) {
  const token = searchParams.token
  if (!token) redirect('/')

  const card  = await getTrustCardByToken(token)
  const plate = card?.plate_plain ?? null

  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-10 pb-10 max-w-sm mx-auto space-y-5 text-center">

          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[16px] p-6">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#6B7280] mb-2">
              Seller Trust Card
            </p>
            <p className="font-heading font-extrabold text-[22px] text-[#111827] mb-1">
              Trust Card Berjaya Dijana
            </p>
            {plate && (
              <p className="font-heading font-extrabold text-[28px] tracking-[.1em] text-[#064E4A] mb-2">
                {plate}
              </p>
            )}
            <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">
              Kongsi link di bawah dengan pembeli sebelum mereka datang melihat kereta anda. Sah 30 hari.
            </p>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-xl px-4 py-3">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#6B7280] mb-1.5">
              Link Verifikasi
            </p>
            <p className="font-heading font-bold text-[13px] text-[#064E4A] break-all">
              paqar.my/trust/{token}
            </p>
          </div>

          <Link
            href={`/trust/${token}`}
            className="block w-full bg-[#064E4A] text-white font-heading font-extrabold text-[15px] rounded-[14px] py-4 hover:bg-[#053D3A] transition-colors text-center"
          >
            Lihat Trust Card →
          </Link>

          <p className="font-body text-[11px] text-[#9CA3AF]">
            Resit akan dihantar ke e-mel anda.
          </p>
        </div>
      </Shell>
    </>
  )
}
