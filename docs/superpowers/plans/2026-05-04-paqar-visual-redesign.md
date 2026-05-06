# Paqar Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Paqar frontend to match the approved design system — new fonts, brand colours, BM copy throughout, premium landing page with 6 sections, and refined check result UI.

**Architecture:** Pure frontend changes only. No API routes, DB schema, or adapters are touched. All functional logic (form submission, polling, auth) is preserved exactly. Changes are: fonts, colours, Tailwind tokens, component styling, landing page copy (BM), and the landing page layout.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, shadcn/ui, next/font (Plus Jakarta Sans + DM Sans), TypeScript strict

**Design reference:** `/home/freddievong/Paqar/DESIGN.md`

---

## File Map

```
Modify:
  app/layout.tsx                    ← fonts (Plus Jakarta Sans + DM Sans)
  app/globals.css                   ← brand CSS variables (teal primary, off-white bg)
  tailwind.config.ts                ← custom brand tokens + font families
  app/page.tsx                      ← full BM landing page (6 sections)
  components/layout/Nav.tsx         ← new logo, BM nav, "Log Masuk" button
  components/check/CheckForm.tsx    ← BM labels, plate styling, card wrapper
  components/check/ResultCard.tsx   ← BM text, refined design system colours
  components/check/ResultsStream.tsx ← BM copy, refined progress bar
```

---

## Task 1: Font setup

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace Inter with Plus Jakarta Sans + DM Sans**

Replace the entire `app/layout.tsx` with:

```typescript
import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, DM_Sans } from 'next/font/google'
import './globals.css'
import { AnalyticsProvider } from '@/components/layout/AnalyticsProvider'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Paqar — Semak Saman & Blacklist',
  description: 'Semak saman, status blacklist dan dokumen kenderaan anda dengan cepat dan mudah.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ms" className={`${plusJakartaSans.variable} ${dmSans.variable}`}>
      <body className="bg-[#F8FAF7] font-body antialiased">
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: replace Inter with Plus Jakarta Sans + DM Sans"
```

---

## Task 2: Brand colour tokens + Tailwind config

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`

- [ ] **Step 1: Update tailwind.config.ts to add brand tokens and font families**

Replace `tailwind.config.ts` with:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['var(--font-heading)', 'ui-sans-serif', 'system-ui'],
        body:    ['var(--font-body)', 'ui-sans-serif', 'system-ui'],
        sans:    ['var(--font-body)', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        // Shadcn tokens (keep for shadcn component compatibility)
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border:  'hsl(var(--border))',
        input:   'hsl(var(--input))',
        ring:    'hsl(var(--ring))',
        // Paqar brand tokens (direct hex for landing page components)
        brand: {
          primary:    '#064E4A',
          dark:       '#053D3A',
          accent:     '#FACC15',
          bg:         '#F8FAF7',
          text:       '#111827',
          muted:      '#6B7280',
          border:     '#E5E7EB',
          success:    '#16A34A',
          danger:     '#DC2626',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 2: Update globals.css — override shadcn primary to brand teal**

In `app/globals.css`, find the `:root {` block and update these specific variables (leave all others unchanged):

```css
:root {
  --brand: #064E4A;
  --background: oklch(0.99 0.003 143);   /* #F8FAF7 — warm off-white */
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.28 0.065 177);      /* #064E4A — brand teal */
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.28 0.065 177);         /* match primary teal */
  --radius: 0.75rem;
```

Also add at the very end of the `@layer base` block (after the `html { @apply font-sans; }` line):

```css
  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-heading);
  }
```

- [ ] **Step 3: Verify TypeScript + dev starts**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts app/globals.css
git commit -m "feat: brand colour tokens and font families in Tailwind config"
```

---

## Task 3: Nav redesign

**Files:**
- Modify: `components/layout/Nav.tsx`

- [ ] **Step 1: Replace Nav with new design**

Replace the entire file:

```typescript
import Link from 'next/link'

export function Nav() {
  return (
    <nav className="sticky top-0 z-10 bg-white border-b border-[#F3F4F6]">
      <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[9px] bg-[#064E4A] flex items-center justify-center flex-shrink-0">
            <div className="w-3.5 h-3.5 bg-[#FACC15] rounded-[3px]" />
          </div>
          <span className="font-heading font-extrabold text-[17px] text-[#111827] tracking-tight">
            Paqar
          </span>
        </Link>

        {/* Right */}
        <Link
          href="/auth"
          className="font-heading font-semibold text-[13px] text-[#064E4A] border border-[#E5E7EB] rounded-lg px-3.5 py-1.5 hover:border-[#064E4A] transition-colors"
        >
          Log Masuk
        </Link>

      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Verify TSC**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add components/layout/Nav.tsx
git commit -m "feat: nav redesign — new logo, BM copy, brand colours"
```

---

## Task 4: CheckForm redesign

**Files:**
- Modify: `components/check/CheckForm.tsx`

The CheckForm gains: a card wrapper, BM field labels, a large plate input (centred, wide-tracking), and BM CTA + trust strip. All form logic is preserved exactly.

- [ ] **Step 1: Replace CheckForm**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
        setError(data.error ?? 'Ralat tidak diketahui — sila cuba semula')
        return
      }

      const { checkId, claimToken } = await res.json() as CreateCheckResponse
      router.push(`/check/${checkId}?claim_token=${claimToken}`)
    } catch {
      setError('Ralat rangkaian — sila cuba semula')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[20px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-5 h-5 bg-[#064E4A] rounded-[5px] flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[10px] font-bold">✓</span>
        </div>
        <span className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#6B7280]">
          Semak Kenderaan Anda
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Plate input */}
        <div>
          <label
            htmlFor="plate"
            className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5"
          >
            Nombor Plat
          </label>
          <input
            id="plate"
            type="text"
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            placeholder="contoh: WVP 1234"
            autoComplete="off"
            required
            className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3.5
                       font-heading font-extrabold text-[22px] tracking-[.12em] text-[#111827]
                       text-center uppercase placeholder:text-[#D1D5DB] placeholder:font-normal
                       placeholder:text-[16px] placeholder:tracking-normal
                       focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10
                       transition-all"
          />
        </div>

        {/* IC input */}
        <div>
          <label
            htmlFor="ic"
            className="block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5"
          >
            No. IC
          </label>
          <input
            id="ic"
            type="text"
            value={ic}
            onChange={(e) => setIc(e.target.value)}
            placeholder="880614-10-5421"
            inputMode="numeric"
            required
            className="w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3.5
                       font-heading font-semibold text-[16px] text-[#111827]
                       placeholder:text-[#D1D5DB] placeholder:font-normal
                       focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10
                       transition-all"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-[13px] text-[#DC2626] font-medium">{error}</p>
        )}

        {/* CTA */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#064E4A] hover:bg-[#053D3A] active:scale-[.98] disabled:opacity-70
                     text-white font-heading font-extrabold text-[16px] rounded-[14px] py-4
                     flex items-center justify-center gap-2
                     transition-all duration-150 hover:-translate-y-[1px] hover:shadow-[0_6px_20px_rgba(6,78,74,.25)]"
        >
          {loading ? 'Menyemak…' : <>Semak Sekarang <span className="text-[18px]">→</span></>}
        </button>

        {/* Trust strip */}
        <div className="flex items-center justify-center gap-4 flex-wrap pt-1">
          <span className="flex items-center gap-1.5 text-[12px] text-[#6B7280] font-body">
            <span>🔒</span>Data disulitkan
          </span>
          <span className="flex items-center gap-1.5 text-[12px] text-[#6B7280] font-body">
            <span>⚡</span>60 saat
          </span>
          <span className="flex items-center gap-1.5 text-[12px] text-[#6B7280] font-body">
            <span>✓</span>Percuma
          </span>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Verify TSC**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add components/check/CheckForm.tsx
git commit -m "feat: CheckForm — BM copy, premium plate input, card wrapper"
```

---

## Task 5: ResultCard — BM copy + design system

**Files:**
- Modify: `components/check/ResultCard.tsx`

- [ ] **Step 1: Replace ResultCard**

```typescript
import type { CheckResult } from '@/types/domain'
import type { SourceData, SamanRecord, SourceKey } from '@/types/api'

// BM display labels — overrides whatever is stored in DB label field
const BM_LABELS: Record<SourceKey, string> = {
  pdrm:           'PDRM Saman',
  jpj:            'JPJ Saman',
  aes:            'AES Saman',
  local_councils: 'Majlis Tempatan',
  immigration:    'Blacklist Imigresen',
  lhdn:           'LHDN',
  ptptn:          'PTPTN',
}

const CARD_STYLES: Record<string, string> = {
  pending:     'bg-[#F9FAFB] border-[#E5E7EB]',
  clear:       'bg-[#F0FDF4] border-[#BBF7D0]',
  hit:         'bg-[#FEF2F2] border-[#FECACA]',
  unavailable: 'bg-[#F9FAFB] border-[#E5E7EB]',
  timeout:     'bg-[#F9FAFB] border-[#E5E7EB]',
  partial:     'bg-amber-50 border-amber-200',
  error:       'bg-[#F9FAFB] border-[#E5E7EB]',
}

const DOT_STYLES: Record<string, string> = {
  pending:     'bg-[#D1D5DB]',
  clear:       'bg-[#16A34A]',
  hit:         'bg-[#DC2626]',
  unavailable: 'bg-[#D1D5DB]',
  timeout:     'bg-[#D1D5DB]',
  partial:     'bg-amber-400',
  error:       'bg-[#D1D5DB]',
}

const LABEL_STYLES: Record<string, string> = {
  pending:     'text-[#9CA3AF]',
  clear:       'text-[#15803D]',
  hit:         'text-[#B91C1C]',
  unavailable: 'text-[#9CA3AF]',
  timeout:     'text-[#9CA3AF]',
  partial:     'text-amber-700',
  error:       'text-[#9CA3AF]',
}

const SAMAN_SOURCES: SourceKey[] = ['pdrm', 'jpj', 'aes', 'local_councils']

function renderDetail(result: CheckResult): string {
  const source = result.source as SourceKey

  if (result.status === 'pending')                          return 'Sedang disemak…'
  if (result.status === 'unavailable' || result.status === 'timeout' || result.status === 'error')
                                                            return 'Tidak dapat disemak buat masa ini'

  const data = result.data as SourceData | null

  if (result.status === 'clear') {
    return SAMAN_SOURCES.includes(source) ? 'Tiada Saman' : 'Tiada Isu'
  }

  if (result.status === 'hit' && data) {
    if ('samans' in data && data.samans.length > 0) {
      const total = data.samans.reduce((s: number, r: SamanRecord) => s + r.amount, 0)
      return `${data.samans.length} saman · RM${total}`
    }
    if ('blacklisted' in data && data.blacklisted) return 'Disenarai hitam'
  }

  if (result.status === 'partial') return 'Data tidak lengkap'

  return 'Tiada Isu'
}

export function ResultCard({ result }: { result: CheckResult }) {
  const s = result.source as SourceKey
  const status = result.status

  return (
    <div
      className={`
        rounded-xl border-[1.5px] px-4 py-3
        flex items-center justify-between
        transition-all duration-300
        ${CARD_STYLES[status] ?? CARD_STYLES['pending']}
      `}
    >
      <div>
        <p className={`font-heading font-bold text-[10px] uppercase tracking-[.07em] ${LABEL_STYLES[status] ?? LABEL_STYLES['pending']}`}>
          {BM_LABELS[s] ?? result.label}
        </p>
        <p className="font-heading font-bold text-[14px] text-[#111827] mt-0.5">
          {renderDetail(result)}
        </p>
      </div>
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT_STYLES[status] ?? DOT_STYLES['pending']}`} />
    </div>
  )
}
```

- [ ] **Step 2: Verify TSC**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add components/check/ResultCard.tsx
git commit -m "feat: ResultCard — BM copy, design system colours, BM source labels"
```

---

## Task 6: ResultsStream — BM copy + design system

**Files:**
- Modify: `components/check/ResultsStream.tsx`

Read the full current file first, then make targeted replacements to the strings and styling. The logic stays identical — only copy and classes change.

- [ ] **Step 1: Update copy strings and styling in ResultsStream**

Make these targeted changes to `components/check/ResultsStream.tsx`:

**Change 1** — error message:
```typescript
// Find:
if (!res.ok) { setError('Could not load results'); return }
// Replace with:
if (!res.ok) { setError('Tidak dapat memuatkan keputusan'); return }
```

**Change 2** — network error:
```typescript
// Find:
setError('Network error — retrying…')
// Replace with:
setError('Ralat rangkaian — cuba semula…')
```

**Change 3** — error display:
```typescript
// Find:
if (error) return <p className="text-sm text-red-600 py-4">{error}</p>
// Replace with:
if (error) return <p className="font-body text-[14px] text-[#DC2626] py-4">{error}</p>
```

**Change 4** — progress label:
```typescript
// Find:
<span className="font-semibold text-teal-700">
  {isComplete ? 'Check complete' : 'Checking 7 sources'}
</span>
<span>{completedCount} of {TOTAL_SOURCES}</span>
// Replace with:
<span className="font-heading font-bold text-[#064E4A]">
  {isComplete ? 'Semakan selesai' : 'Menyemak 7 sumber…'}
</span>
<span className="font-body text-[#6B7280]">{completedCount} daripada {TOTAL_SOURCES}</span>
```

**Change 5** — progress bar class:
```typescript
// Find:
className="h-1 bg-slate-100 [&>div]:bg-teal-700"
// Replace with:
className="h-1 bg-[#E5E7EB] [&>div]:bg-[#064E4A]"
```

**Change 6** — Save CTA text:
```typescript
// Find:
<p className="text-sm font-semibold text-teal-800 mb-1">
  Get notified if anything changes
</p>
<p className="text-xs text-slate-500 mb-3">
  Save this vehicle to your account and we'll alert you if new saman or blacklist entries appear.
</p>
<Button
  onClick={() => {
    const next = `/check/${checkId}?claim_token=${claimToken}`
    router.push(`/auth?claim_token=${claimToken}&next=${encodeURIComponent(next)}`)
  }}
  className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm"
>
  Save &amp; create account
</Button>
// Replace with:
<p className="font-heading font-bold text-[14px] text-[#064E4A] mb-1">
  Dapatkan notifikasi jika ada perubahan
</p>
<p className="font-body text-[12px] text-[#6B7280] mb-3">
  Simpan kenderaan ini dan kami akan maklumkan jika ada saman atau blacklist baru.
</p>
<Button
  onClick={() => {
    const next = `/check/${checkId}?claim_token=${claimToken}`
    router.push(`/auth?claim_token=${claimToken}&next=${encodeURIComponent(next)}`)
  }}
  className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-bold text-[14px]"
>
  Simpan &amp; buat akaun
</Button>
```

**Change 7** — Save CTA wrapper:
```typescript
// Find:
<div className="border-[1.5px] border-dashed border-teal-300 rounded-xl p-4 bg-teal-50/50">
// Replace with:
<div className="border-[1.5px] border-dashed border-[#064E4A]/30 rounded-xl p-4 bg-[#064E4A]/5">
```

- [ ] **Step 2: Verify TSC**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add components/check/ResultsStream.tsx
git commit -m "feat: ResultsStream — BM copy, brand colours"
```

---

## Task 7: Landing page — full BM redesign

**Files:**
- Modify: `app/page.tsx`

This replaces the single-section landing page with the full 6-section BM landing page from the approved mockup.

- [ ] **Step 1: Replace app/page.tsx**

```typescript
import Link from 'next/link'
import { Nav }       from '@/components/layout/Nav'
import { CheckForm } from '@/components/check/CheckForm'

export default function HomePage() {
  return (
    <>
      <Nav />

      {/* ── HERO ── */}
      <section className="bg-white px-5 pt-10 pb-12 md:pt-16 md:pb-20">
        <div className="max-w-5xl mx-auto md:grid md:grid-cols-2 md:gap-14 md:items-center">

          {/* Copy */}
          <div>
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-full px-3 py-1.5 mb-5">
              <span className="w-2 h-2 bg-[#16A34A] rounded-full" />
              <span className="font-heading font-bold text-[12px] text-[#15803D]">
                Percuma · Tanpa daftar akaun
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-heading font-extrabold text-[32px] md:text-[40px] leading-[1.08] tracking-[-0.03em] text-[#111827] mb-3">
              Semak <span className="text-[#064E4A]">Saman</span> &amp; Blacklist<br />
              Dengan Mudah
            </h1>

            {/* Subheadline */}
            <p className="font-body text-[15px] md:text-[16px] text-[#6B7280] leading-relaxed mb-8 md:mb-0">
              Paqar bantu anda semak status penting kenderaan dengan cepat, jelas dan mudah faham.
            </p>

            {/* Desktop trust strip */}
            <div className="hidden md:flex gap-5 mt-6">
              {[['🔒', 'Data disulitkan'], ['⚡', 'Keputusan dalam 60 saat'], ['✓', 'Percuma sepenuhnya']].map(([icon, text]) => (
                <span key={text} className="flex items-center gap-1.5 font-body text-[13px] text-[#6B7280]">
                  <span>{icon}</span>{text}
                </span>
              ))}
            </div>
          </div>

          {/* Checking card */}
          <div>
            <CheckForm />
          </div>
        </div>
      </section>

      {/* ── APA YANG BOLEH DISEMAK ── */}
      <section className="bg-[#F8FAF7] px-5 py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 md:text-center">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#064E4A] mb-2">
              Apa Yang Anda Boleh Semak
            </p>
            <h2 className="font-heading font-extrabold text-[22px] md:text-[26px] tracking-tight text-[#111827]">
              Semua status penting, dalam satu tempat
            </h2>
          </div>

          <div className="flex flex-col md:grid md:grid-cols-3 gap-3">
            {[
              { icon: '🚗', title: 'Saman Kenderaan', desc: 'PDRM, JPJ, AES & Majlis Tempatan', badge: 'Tersedia', badgeStyle: 'bg-[#DCFCE7] text-[#15803D]' },
              { icon: '🚫', title: 'Status Blacklist',  desc: 'Imigresen, LHDN & PTPTN',           badge: 'Tersedia', badgeStyle: 'bg-[#DCFCE7] text-[#15803D]' },
              { icon: '📄', title: 'Dokumen Kenderaan', desc: 'Cukai jalan, insurans & lesen',      badge: 'Akan Datang', badgeStyle: 'bg-[#F3F4F6] text-[#6B7280]' },
            ].map((item) => (
              <div key={item.title} className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 flex items-center gap-3 md:flex-col md:items-start md:p-5">
                <div className="w-11 h-11 rounded-xl bg-[#F3F4F6] flex items-center justify-center text-xl flex-shrink-0">
                  {item.icon}
                </div>
                <div className="flex-1">
                  <p className="font-heading font-bold text-[15px] text-[#111827] mb-0.5">{item.title}</p>
                  <p className="font-body text-[13px] text-[#6B7280]">{item.desc}</p>
                  <span className={`inline-block mt-2 font-heading font-bold text-[11px] px-2.5 py-1 rounded-full ${item.badgeStyle}`}>
                    {item.badge}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CARA IA BERFUNGSI ── */}
      <section className="bg-white px-5 py-12 md:py-16">
        <div className="max-w-xl mx-auto">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#064E4A] mb-2">
            Cara Ia Berfungsi
          </p>
          <h2 className="font-heading font-extrabold text-[22px] tracking-tight text-[#111827] mb-2">
            Tiga langkah. Satu minit.
          </h2>
          <p className="font-body text-[14px] text-[#6B7280] mb-8">
            Tiada pendaftaran diperlukan untuk semakan pertama anda.
          </p>

          <div className="flex flex-col gap-0">
            {[
              {
                n: '1',
                title: 'Masukkan maklumat',
                desc:  'Nombor plat dan No. IC anda. Data disulitkan — tidak disimpan dalam teks biasa.',
              },
              {
                n: '2',
                title: 'Paqar semak status',
                desc:  'Sistem kami semak 7 sumber serentak — PDRM, JPJ, AES, Imigresen dan lain-lain.',
              },
              {
                n: '3',
                title: 'Lihat keputusan dengan jelas',
                desc:  'Hijau bermakna selamat. Merah bermakna perlu tindakan. Tiada istilah teknikal.',
              },
            ].map((step, i) => (
              <div key={step.n} className="flex gap-4 pb-6 relative">
                {i < 2 && (
                  <div className="absolute left-5 top-10 w-0.5 h-[calc(100%-16px)] bg-[#E5E7EB]" />
                )}
                <div className="w-10 h-10 bg-[#064E4A] rounded-xl flex items-center justify-center font-heading font-extrabold text-[16px] text-white flex-shrink-0 z-10">
                  {step.n}
                </div>
                <div className="pt-2">
                  <p className="font-heading font-bold text-[16px] text-[#111827] mb-1">{step.title}</p>
                  <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── KENAPA PAQAR ── */}
      <section className="bg-[#F8FAF7] px-5 py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#064E4A] mb-2">
            Kenapa Paqar
          </p>
          <h2 className="font-heading font-extrabold text-[22px] tracking-tight text-[#111827] mb-8">
            Dibina untuk pengguna Malaysia
          </h2>

          <div className="flex flex-col md:grid md:grid-cols-3 gap-3">
            {[
              { icon: '⚡', title: 'Pantas', desc: 'Keputusan dalam 60 saat. Tiada menunggu, tiada keliru.' },
              { icon: '🎯', title: 'Jelas',  desc: 'Hijau atau merah. Anda tahu apa yang perlu dilakukan serta-merta.' },
              { icon: '🔒', title: 'Selamat', desc: 'IC disulitkan dengan AES-256. Kami tidak simpan data anda tanpa izin.' },
            ].map((item) => (
              <div key={item.title} className="bg-white border border-[#E5E7EB] rounded-[16px] p-5">
                <span className="text-3xl mb-3 block">{item.icon}</span>
                <p className="font-heading font-bold text-[16px] text-[#111827] mb-1">{item.title}</p>
                <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOALAN LAZIM ── */}
      <section className="bg-white px-5 py-12 md:py-16">
        <div className="max-w-xl mx-auto">
          <p className="font-heading font-bold text-[11px] uppercase tracking-[.1em] text-[#064E4A] mb-2">
            Soalan Lazim
          </p>
          <h2 className="font-heading font-extrabold text-[22px] tracking-tight text-[#111827] mb-6">
            Ada soalan?
          </h2>

          <div className="flex flex-col gap-2">
            {[
              {
                q: 'Adakah Paqar platform rasmi?',
                a: 'Paqar bukan platform rasmi kerajaan. Kami adalah perkhidmatan pihak ketiga yang menyemak maklumat daripada sumber-sumber yang boleh diakses awam.',
              },
              {
                q: 'Adakah semakan ini percuma?',
                a: 'Ya, semakan asas saman dan blacklist adalah percuma sepenuhnya. Tiada kad kredit diperlukan.',
              },
              {
                q: 'Berapa lama keputusan mengambil masa?',
                a: 'Biasanya dalam 60 saat. Masa mungkin berbeza bergantung kepada kesediaan sumber luar.',
              },
              {
                q: 'Adakah No. IC saya selamat?',
                a: 'No. IC anda disulitkan menggunakan AES-256-GCM sebelum disimpan. Kami tidak menyimpan dalam teks biasa dan mematuhi PDPA Malaysia.',
              },
            ].map((faq) => (
              <details key={faq.q} className="group bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                  <span className="font-heading font-bold text-[14px] text-[#111827] pr-4">{faq.q}</span>
                  <span className="font-heading font-bold text-[18px] text-[#6B7280] flex-shrink-0 group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-4 pb-4">
                  <p className="font-body text-[13px] text-[#6B7280] leading-relaxed">{faq.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="bg-[#064E4A] px-5 py-14 text-center md:py-20">
        <div className="max-w-lg mx-auto">
          <h2 className="font-heading font-extrabold text-[24px] md:text-[30px] leading-tight tracking-tight text-white mb-3">
            Semak kenderaan anda<br />sekarang — percuma
          </h2>
          <p className="font-body text-[14px] text-white/70 mb-7">
            Tiada pendaftaran.
            <span className="inline-block w-1.5 h-1.5 bg-[#FACC15] rounded-full mx-2 align-middle" />
            Tiada bayaran.
            <span className="inline-block w-1.5 h-1.5 bg-[#FACC15] rounded-full mx-2 align-middle" />
            Hasil dalam 60 saat.
          </p>
          <Link
            href="#semak"
            onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            className="inline-block bg-white text-[#064E4A] font-heading font-extrabold text-[15px] rounded-xl px-7 py-4 hover:bg-[#F8FAF7] transition-colors"
          >
            Semak Sekarang →
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-[#E5E7EB] px-5 py-6 text-center">
        <p className="font-body text-[12px] text-[#D1D5DB] leading-relaxed">
          © 2026 Paqar · Perkhidmatan pihak ketiga · Bukan platform rasmi kerajaan
          <br />
          <span className="text-[#9CA3AF]">Privasi · Terma · Hubungi Kami</span>
        </p>
      </footer>
    </>
  )
}
```

- [ ] **Step 2: Verify TSC**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: full BM landing page — 6 sections, brand design system"
```

---

## Task 8: Auth page BM copy

**Files:**
- Modify: `app/auth/page.tsx`
- Modify: `components/auth/AuthShell.tsx`

The auth page should match the brand — BM copy, same font classes.

- [ ] **Step 1: Update AuthShell copy**

In `components/auth/AuthShell.tsx`, replace the heading copy:

```typescript
// Find:
<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sign in</h1>
<p className="text-sm text-slate-500 mt-1">
  Save your check and get alerts when anything changes.
</p>
// Replace with:
<h1 className="font-heading font-extrabold text-[24px] text-[#111827] tracking-tight">Log Masuk</h1>
<p className="font-body text-[14px] text-[#6B7280] mt-1">
  Simpan semakan dan dapatkan notifikasi jika ada perubahan.
</p>
```

- [ ] **Step 2: Verify TSC**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add components/auth/AuthShell.tsx
git commit -m "feat: auth page — BM copy"
```

---

## Task 9: Visual verification

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

Open http://localhost:3000

- [ ] **Step 2: Verify landing page**

Check each section visually:
- Hero: teal headline accent, large plate input centred, BM trust strip
- "Apa Yang Boleh Disemak": 3 feature cards with badges
- "Cara Ia Berfungsi": 3 numbered steps with connector line
- "Kenapa Paqar": 3 trust cards
- "Soalan Lazim": 4 FAQ items using `<details>` accordion
- Final CTA: dark teal background, white button, yellow accent dots
- Footer: disclaimer text

- [ ] **Step 3: Verify check flow**

Enter plate `TEST-SAMAN1`, IC `880614105421` → Run check.
Confirm:
- BM CTA "Semak Sekarang"
- Progress bar shows "Menyemak 7 sumber…"
- JPJ result shows "2 saman · RM340" in red card
- All clear cards show "Tiada Saman" or "Tiada Isu"
- Complete state shows "Semakan selesai"

- [ ] **Step 4: Full TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5: Run tests**

```bash
pnpm test
```

Expected: 19/19 passing (redesign touches no tested modules)

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: Paqar visual redesign complete — design system, BM copy, landing page"
```
