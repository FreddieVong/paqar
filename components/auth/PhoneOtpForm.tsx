'use client'

import { useState }     from 'react'
import { Button }       from '@/components/ui/button'
import { Input }        from '@/components/ui/input'
import { Label }        from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { claimCheck }   from '@/app/auth/_actions'

type AuthState = 'phone' | 'otp'

interface Props {
  claimToken?: string
  redirectTo:  string
  onEmailClick: () => void
}

export function PhoneOtpForm({ claimToken, redirectTo, onEmailClick }: Props) {
  const [state,   setState]   = useState<AuthState>('phone')
  const [phone,   setPhone]   = useState('+60')
  const [otp,     setOtp]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const supabase = createClient()

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Server-side rate limit check before calling Supabase
    const rateRes = await fetch('/api/auth/otp-rate-check', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phone }),
    })
    if (!rateRes.ok) {
      setError('Too many OTP requests. Please wait before trying again.')
      setLoading(false)
      return
    }

    const { error: err } = await supabase.auth.signInWithOtp({ phone })
    if (err) { setError(err.message); setLoading(false); return }
    setState('otp')
    setLoading(false)
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase.auth.verifyOtp({
      phone, token: otp, type: 'sms',
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
          Enter the 6-digit code sent to <strong>{phone}</strong>
        </p>
        <div>
          <Label htmlFor="otp" className="text-xs font-semibold uppercase tracking-widest">OTP</Label>
          <Input id="otp" value={otp} onChange={(e) => setOtp(e.target.value)}
            placeholder="123456" inputMode="numeric" maxLength={6}
            className="mt-1.5 tracking-[.3em] text-lg font-bold" required />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading}
          className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-3">
          {loading ? 'Verifying…' : 'Verify →'}
        </Button>
        <button type="button" onClick={() => setState('phone')}
          className="w-full text-sm text-slate-400 hover:text-teal-700 text-center">
          ← Change number
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={sendOtp} className="space-y-4">
      <div>
        <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-widest">
          Phone number
        </Label>
        <div className="flex gap-2 mt-1.5">
          <div className="bg-slate-50 border border-slate-200 rounded-md px-3 flex items-center text-sm font-semibold text-slate-700 whitespace-nowrap">
            +60
          </div>
          <Input id="phone"
            value={phone.replace(/^\+60/, '')}
            onChange={(e) => setPhone('+60' + e.target.value.replace(/^0/, ''))}
            placeholder="12-345 6789" inputMode="tel" className="flex-1 text-base" required />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}
        className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-3">
        {loading ? 'Sending…' : 'Send OTP →'}
      </Button>
      <div className="text-center">
        <span className="text-sm text-slate-400">Prefer email? </span>
        <button type="button" onClick={onEmailClick}
          className="text-sm text-teal-700 font-semibold hover:underline">
          Get a magic link
        </button>
      </div>
    </form>
  )
}
