'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button }    from '@/components/ui/button'
import { Input }     from '@/components/ui/input'
import { Label }     from '@/components/ui/label'
import type { CreateCheckResponse } from '@/types/api'

export function CheckForm() {
  const router = useRouter()
  const [plate, setPlate]     = useState('')
  const [ic, setIc]           = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const idempotencyKey = crypto.randomUUID()

    try {
      const res = await fetch('/api/checks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plate, ic, idempotencyKey }),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Something went wrong')
        return
      }

      const { checkId, claimToken } = await res.json() as CreateCheckResponse
      router.push(`/check/${checkId}?claim_token=${claimToken}`)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="plate" className="text-xs font-semibold uppercase tracking-widest text-slate-900">
          Plate number
        </Label>
        <Input
          id="plate"
          value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          placeholder="WVP 1234"
          className="mt-1.5 font-semibold tracking-widest text-base"
          autoComplete="off"
          required
        />
      </div>

      <div>
        <Label htmlFor="ic" className="text-xs font-semibold uppercase tracking-widest text-slate-900">
          IC number
        </Label>
        <Input
          id="ic"
          value={ic}
          onChange={(e) => setIc(e.target.value)}
          placeholder="880614-10-5421"
          inputMode="numeric"
          className="mt-1.5 text-base"
          required
        />
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-3 text-sm"
      >
        {loading ? 'Checking…' : 'Run check →'}
      </Button>

      <p className="text-xs text-slate-400 text-center">
        Your IC is encrypted and never stored in plain text.
      </p>
    </form>
  )
}
