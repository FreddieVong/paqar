import { notFound }      from 'next/navigation'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { ResultsStream } from '@/components/check/ResultsStream'
import { getCheck }      from '@/lib/db/checks'
import { decrypt }       from '@/lib/crypto'

interface Props {
  params:       { id: string }
  searchParams: { claim_token?: string }
}

export default async function CheckPage({ params, searchParams }: Props) {
  const claimToken = searchParams.claim_token
  if (!claimToken) notFound()

  let plate: string | undefined
  try {
    const row = await getCheck(params.id, claimToken)
    if (row?.check.plate_encrypted) {
      plate = decrypt(row.check.plate_encrypted).toUpperCase()
    }
  } catch {
    // non-fatal — CTA shows generic "kenderaan ini" if plate unavailable
  }

  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-4">
          <ResultsStream checkId={params.id} claimToken={claimToken} plate={plate} />
        </div>
      </Shell>
    </>
  )
}
