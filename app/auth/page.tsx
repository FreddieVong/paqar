import { Nav }       from '@/components/layout/Nav'
import { Shell }     from '@/components/layout/Shell'
import { AuthShell } from '@/components/auth/AuthShell'

interface Props {
  searchParams: { claim_token?: string; next?: string; error?: string }
}

export default function AuthPage({ searchParams }: Props) {
  const redirectTo = searchParams.next ?? '/'

  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-6">
          {searchParams.error === 'link_expired' && (
            <div className="mb-5 bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-3">
              <p className="font-heading font-bold text-[13px] text-[#B91C1C]">Link telah tamat tempoh</p>
              <p className="font-body text-[12px] text-[#6B7280] mt-0.5">
                Masukkan emel atau nombor telefon anda semula untuk dapatkan link baharu.
              </p>
            </div>
          )}
          <AuthShell
            claimToken={searchParams.claim_token}
            redirectTo={redirectTo}
          />
        </div>
      </Shell>
    </>
  )
}
