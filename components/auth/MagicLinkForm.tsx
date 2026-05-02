'use client'

import { useState }     from 'react'
import { Button }       from '@/components/ui/button'
import { Input }        from '@/components/ui/input'
import { Label }        from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

interface Props {
  claimToken?: string
  redirectTo:  string
  onBack:      () => void
}

export function MagicLinkForm({ claimToken, redirectTo, onBack }: Props) {
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const callbackUrl = new URL('/auth/callback', window.location.origin)
    callbackUrl.searchParams.set('next', redirectTo)
    if (claimToken) callbackUrl.searchParams.set('claim_token', claimToken)

    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl.toString() },
    })
    if (err) { setError(err.message); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm font-semibold text-slate-900">Check your email</p>
        <p className="text-sm text-slate-500">
          We sent a sign-in link to <strong>{email}</strong>. It expires in 10 minutes.
        </p>
        <button onClick={onBack} className="text-sm text-teal-700 font-semibold hover:underline">
          ← Back to phone
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-widest">Email</Label>
        <Input id="email" type="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com" className="mt-1.5 text-base" required />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}
        className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-3">
        {loading ? 'Sending…' : 'Send magic link →'}
      </Button>
      <button type="button" onClick={onBack}
        className="w-full text-sm text-slate-400 hover:text-teal-700 text-center">
        ← Back to phone sign-in
      </button>
    </form>
  )
}
