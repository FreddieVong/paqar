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
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sign in</h1>
        <p className="text-sm text-slate-500 mt-1">
          Save your check and get alerts when anything changes.
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
