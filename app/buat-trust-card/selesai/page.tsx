import { redirect }            from 'next/navigation'
import { Nav }                 from '@/components/layout/Nav'
import { Shell }               from '@/components/layout/Shell'
import Link                    from 'next/link'

interface Props { searchParams: { token?: string } }

export default async function SelesaiPage({ searchParams }: Props) {
  const token = searchParams.token
  if (!token) redirect('/')

  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-10 pb-10 text-center space-y-5 max-w-sm mx-auto">
          <span className="text-4xl block">🎉</span>
          <h1 className="font-heading font-extrabold text-[24px] text-[#111827]">
            Seller Trust Card anda sudah siap!
          </h1>
          <p className="font-body text-[14px] text-[#6B7280]">
            Kongsi link ini dengan pembeli. Sah 30 hari.
          </p>
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-4 py-3 font-heading font-bold text-[13px] text-[#15803D] break-all">
            paqar.my/trust/{token}
          </div>
          <Link href={`/trust/${token}`}
            className="block w-full bg-[#064E4A] text-white font-heading font-extrabold text-[15px] rounded-[14px] py-4 hover:bg-[#053D3A] transition-colors text-center">
            Lihat Trust Card →
          </Link>
        </div>
      </Shell>
    </>
  )
}
