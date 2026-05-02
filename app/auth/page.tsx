import { Nav }       from '@/components/layout/Nav'
import { Shell }     from '@/components/layout/Shell'
import { AuthShell } from '@/components/auth/AuthShell'

interface Props {
  searchParams: { claim_token?: string; next?: string }
}

export default function AuthPage({ searchParams }: Props) {
  const redirectTo = searchParams.next ?? '/'

  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-6">
          <AuthShell
            claimToken={searchParams.claim_token}
            redirectTo={redirectTo}
          />
        </div>
      </Shell>
    </>
  )
}
