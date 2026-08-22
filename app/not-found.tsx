import Link  from 'next/link'
import { Nav }   from '@/components/layout/Nav'
import { Shell } from '@/components/layout/Shell'

export default function NotFound() {
  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-20 pb-20 max-w-sm mx-auto text-center space-y-4">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.12em] text-[#3D472F]">
            404
          </p>
          <h1 className="font-heading font-extrabold text-[28px] tracking-tight text-[#111827]">
            Halaman tidak dijumpai
          </h1>
          <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
            Mungkin link ini sudah tamat tempoh atau tidak pernah wujud.
          </p>
          <Link
            href="/"
            className="block w-full bg-[#3D472F] text-white font-heading font-extrabold text-[15px] rounded-[14px] py-4 hover:bg-[#2E3523] transition-colors mt-2"
          >
            Balik ke Laman Utama →
          </Link>
        </div>
      </Shell>
    </>
  )
}
