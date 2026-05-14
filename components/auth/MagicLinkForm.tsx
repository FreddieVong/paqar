'use client'

import { useState }     from 'react'
import { Button }       from '@/components/ui/button'
import { Input }        from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { claimCheck }   from '@/app/auth/_actions'

type EmailState = 'email' | 'otp'

interface Props {
  claimToken?: string
  redirectTo:  string
  onBack:      () => void
}

export function MagicLinkForm({ claimToken, redirectTo, onBack: _onBack }: Props) {
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
        <p className="font-body text-[13px] text-[#6B7280]">
          Kod 6 digit dihantar ke <strong className="text-[#111827]">{email}</strong>
        </p>
        <div>
          <label className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5">
            Kod Pengesahan
          </label>
          <Input id="email-otp" value={otp} onChange={(e) => setOtp(e.target.value)}
            placeholder="123456" inputMode="numeric" maxLength={6}
            className="mt-1.5 tracking-[.3em] text-lg font-bold" required />
        </div>
        {error && <p className="font-body text-[13px] text-[#DC2626]">{error}</p>}
        <Button type="submit" disabled={loading}
          className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-bold py-3">
          {loading ? 'Mengesahkan…' : 'Sahkan →'}
        </Button>
        <button type="button" onClick={() => setState('email')}
          className="w-full font-body text-[12px] text-[#9CA3AF] hover:text-[#064E4A] text-center transition-colors">
          ← Tukar e-mel
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={sendOtp} className="space-y-4">
      <div>
        <label className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5">
          Alamat E-mel
        </label>
        <Input id="email" type="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="anda@email.com" className="mt-1.5 text-base" required />
      </div>
      {error && <p className="font-body text-[13px] text-[#DC2626]">{error}</p>}
      <Button type="submit" disabled={loading}
        className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-bold py-3">
        {loading ? 'Menghantar…' : 'Hantar Kod →'}
      </Button>
    </form>
  )
}
