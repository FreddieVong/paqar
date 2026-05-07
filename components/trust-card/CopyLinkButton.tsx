'use client'

import { useState } from 'react'

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="w-full border-[1.5px] border-[#064E4A] text-[#064E4A] font-heading font-bold text-[14px] rounded-[14px] py-4 text-center hover:bg-[#064E4A]/5 transition-colors"
    >
      {copied ? 'Disalin! ✓' : 'Salin Link Verifikasi'}
    </button>
  )
}
