'use client'

import { useState }       from 'react'
import { PhoneOtpForm }   from './PhoneOtpForm'
import { MagicLinkForm }  from './MagicLinkForm'

interface Props {
  claimToken?: string
  redirectTo:  string
}

export function AuthShell({ claimToken, redirectTo }: Props) {
  const [mode, setMode] = useState<'phone' | 'email'>('phone')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-extrabold text-[24px] text-[#111827] tracking-tight">Log Masuk</h1>
        <p className="font-body text-[14px] text-[#6B7280] mt-1">
          Simpan semakan dan dapatkan notifikasi jika ada perubahan.
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
