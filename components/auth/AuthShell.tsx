'use client'

import { useState }       from 'react'
import { PhoneOtpForm }   from './PhoneOtpForm'
import { MagicLinkForm }  from './MagicLinkForm'

interface Props {
  claimToken?: string
  redirectTo:  string
}

export function AuthShell({ claimToken, redirectTo }: Props) {
  const [mode, setMode] = useState<'phone' | 'email'>('email')

  return (
    <div className="space-y-6">
      <div>
        {/* Matches the nav ("Laporan Saya") and the "Tanpa daftar" promise: no
            password, no registration — an emailed link or an SMS code reaches
            the reports and checks already tied to you.

            The old subhead promised "notifikasi jika ada perubahan". Nothing in
            the product sends those. What ships is document-EXPIRY notification
            (roadtax/insurance/licence, /api/cron/check-expiries), which is a
            different thing and only applies once a buyer has saved an expiry
            date. Rather than restate a narrower claim here, this says what the
            page itself does. */}
        <h1 className="font-heading font-extrabold text-[24px] text-[#111827] tracking-tight">Laporan Saya</h1>
        <p className="font-body text-[14px] text-[#6B7280] mt-1">
          Masukkan emel atau nombor telefon untuk buka semula laporan dan semakan anda. Tiada kata laluan diperlukan.
        </p>
      </div>
      {mode === 'phone'
        ? <PhoneOtpForm claimToken={claimToken} redirectTo={redirectTo}
            onEmailClick={() => setMode('email')} />
        : <MagicLinkForm claimToken={claimToken} redirectTo={redirectTo}
            onBack={() => setMode('phone')} />
      }
    </div>
  )
}
