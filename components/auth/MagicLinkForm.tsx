'use client'

import { useState }     from 'react'
import { Button }       from '@/components/ui/button'
import { Input }        from '@/components/ui/input'
import { Label }        from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { claimCheck }   from '@/app/auth/_actions'

type EmailState = 'email' | 'otp'

interface Props {
  claimToken?: string
  redirectTo:  string
  onBack:      () => void
}

export function MagicLinkForm({ claimToken, redirectTo, onBack }: Props) {
  const [state,   setState]   = useState<EmailState>('email')
  const [email,   setEmail]   = useState('')
  const [otp,     setOtp]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const supabase = createClient()

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithOtp({ email })
    if (err) { setError(err.message); setLoading(false); return }
    setState('otp')
    setLoading(false)
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.auth.verifyOtp({
      email, token: otp, type: 'email',
    })
    if (err ?? !data.user) {
      setError(err?.message ?? 'Verification failed')
      setLoading(false)
      return
    }
    if (claimToken && data.user) await claimCheck(claimToken, data.user.id)
    window.location.href = redirectTo
  }

  if (state === 'otp') {
    return (
      <form onSubmit={verifyOtp} className="space-y-4">
        <p className="text-sm text-slate-500">
          Enter the 6-digit code sent to <strong>{email}</strong>
        </p>
        <div>
          <Label htmlFor="email-otp" className="text-xs font-semibold uppercase tracking-widest">Code</Label>
          <Input id="email-otp" value={otp} onChange={(e) => setOtp(e.target.value)}
            placeholder="12345678" inputMode="numeric"
            className="mt-1.5 tracking-[.3em] text-lg font-bold" required />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading}
          className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-3">
          {loading ? 'Verifying…' : 'Verify →'}
        </Button>
        <button type="button" onClick={() => setState('email')}
          className="w-full text-sm text-slate-400 hover:text-teal-700 text-center">
          ← Change email
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={sendOtp} className="space-y-4">
      <div>
        <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-widest">Email</Label>
        <Input id="email" type="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com" className="mt-1.5 text-base" required />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}
        className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-3">
        {loading ? 'Sending…' : 'Send code →'}
      </Button>
      <button type="button" onClick={onBack}
        className="w-full text-sm text-slate-400 hover:text-teal-700 text-center">
        ← Back to phone sign-in
      </button>
    </form>
  )
}
