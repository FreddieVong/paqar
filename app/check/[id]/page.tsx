import { notFound, redirect } from 'next/navigation'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { ResultsStream } from '@/components/check/ResultsStream'
import { getCheck }      from '@/lib/db/checks'
import { checkHasPaidReport } from '@/lib/db/buyer-reports'
import { decrypt }       from '@/lib/crypto'

interface Props {
  params:       { id: string }
  searchParams: { claim_token?: string; asking_price?: string }
}

export default async function CheckPage({ params, searchParams }: Props) {
  const claimToken = searchParams.claim_token
  if (!claimToken) notFound()

  // Already bought? Send them to what they own.
  //
  // ResultsStream renders the payment form as soon as a check completes and has
  // no notion of entitlement, so without this a buyer who has already paid and
  // returns to this URL — it is in their history, it is where the plate tab
  // sends them — is shown the paywall for a report they own. They could pay a
  // second time; initiateBuyerReport now refuses, but being asked at all is the
  // damage. The report page authorises on the same claim token, so this always
  // lands somewhere valid.
  if (await checkHasPaidReport(params.id).catch(() => false)) {
    redirect(`/laporan-pembeli/${params.id}?claim_token=${encodeURIComponent(claimToken)}`)
  }

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
          <ResultsStream checkId={params.id} claimToken={claimToken} plate={plate} askingPrice={searchParams.asking_price} />
        </div>
      </Shell>
    </>
  )
}
