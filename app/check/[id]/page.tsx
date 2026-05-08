import { notFound }      from 'next/navigation'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { ResultsStream } from '@/components/check/ResultsStream'
import { getCheck }      from '@/lib/db/checks'
import { decrypt }       from '@/lib/crypto'
import type { CheckMode } from '@/types/api'

interface Props {
  params:       { id: string }
  searchParams: { claim_token?: string; mode?: string }
}

export default async function CheckPage({ params, searchParams }: Props) {
  const claimToken = searchParams.claim_token
  if (!claimToken) notFound()

  const mode = (searchParams.mode === 'buyer' ? 'buyer' : 'owner') as CheckMode

  // Decrypt plate server-side so ResultsStream can pre-fill the seller verify CTA
  let plate: string | undefined
  try {
    const row = await getCheck(params.id, claimToken)
    if (row?.check.plate_encrypted) {
      plate = decrypt(row.check.plate_encrypted).toUpperCase()
    }
  } catch {
    // Non-fatal — CTA will not show plate but page still renders
  }

  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-4">
          <ResultsStream checkId={params.id} claimToken={claimToken} mode={mode} plate={plate} />
        </div>
      </Shell>
    </>
  )
}
