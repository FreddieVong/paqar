'use client'

import { useState } from 'react'

interface Props { text: string }

export function CopyButton({ text }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="w-full bg-[#3D472F] hover:bg-[#2E3523] text-white font-heading font-bold text-[13px] rounded-[10px] py-2.5 transition-colors"
    >
      {copied ? 'Disalin ✓' : 'Salin Skrip'}
    </button>
  )
}
