import { notFound }      from 'next/navigation'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'
import { ResultsStream } from '@/components/check/ResultsStream'

interface Props {
  params:       { id: string }
  searchParams: { claim_token?: string }
}

export default function CheckPage({ params, searchParams }: Props) {
  const claimToken = searchParams.claim_token
  if (!claimToken) notFound()

  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-4">
          <ResultsStream checkId={params.id} claimToken={claimToken} />
        </div>
      </Shell>
    </>
  )
}
