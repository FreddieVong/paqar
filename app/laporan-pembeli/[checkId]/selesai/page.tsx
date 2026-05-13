import { redirect }  from 'next/navigation'
import { Nav }        from '@/components/layout/Nav'
import { Shell }      from '@/components/layout/Shell'
import { getCheck }   from '@/lib/db/checks'
import { decrypt }    from '@/lib/crypto'
import Link           from 'next/link'

interface Props {
  params:       { checkId: string }
  searchParams: { claim_token?: string }
}

export default async function LaporanSelesaiPage({ params, searchParams }: Props) {
  const claimToken = searchParams.claim_token
  if (!claimToken) redirect('/')

  const row   = await getCheck(params.checkId, claimToken)
  const plate = row ? decrypt(row.check.plate_encrypted as string).toUpperCase() : null

  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-10 pb-10 max-w-sm mx-auto space-y-5 text-center">
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[16px] p-6">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#6B7280] mb-2">
              Laporan Pembeli
            </p>
            <p className="font-heading font-extrabold text-[22px] text-[#111827] mb-1">
              Pembayaran Berjaya
            </p>
            {plate && (
              <p className="font-heading font-extrabold text-[28px] tracking-[.1em] text-[#064E4A] mb-2">
                {plate}
              </p>
            )}
            <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">
              Laporan anda sedia untuk dilihat. Simpan link ini — anda boleh akses semula pada bila-bila masa.
            </p>
          </div>

          <Link
            href={`/laporan-pembeli/${params.checkId}?claim_token=${claimToken}`}
            className="block w-full bg-[#064E4A] text-white font-heading font-extrabold text-[15px] rounded-[14px] py-4 hover:bg-[#053D3A] transition-colors"
          >
            Lihat Laporan Saya →
          </Link>

          {plate && (
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Laporan Paqar untuk ${plate} sedia!\n\nLihat laporan di sini:\nhttps://paqar.my/laporan-pembeli/${params.checkId}?claim_token=${claimToken}\n\nJuga boleh tempah inspection sebelum bayar deposit.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full border-[1.5px] border-[#25D366] text-[#25D366] font-heading font-bold text-[14px] rounded-[14px] py-3.5 hover:bg-[#25D366]/5 transition-colors"
            >
              Kongsi Laporan via WhatsApp →
            </a>
          )}

          <p className="font-body text-[11px] text-[#9CA3AF]">
            Resit akan dihantar ke e-mel anda.
          </p>
        </div>
      </Shell>
    </>
  )
}
