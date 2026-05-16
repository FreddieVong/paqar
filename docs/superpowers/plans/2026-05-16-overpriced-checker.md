# Overpriced Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage plate-only entry with a free "Overpriced Checker" (brand/model/year/price → real Mudah-backed verdict) that funnels motivated users into the RM12 paid report via a Malaysian plate input.

**Architecture:** New `POST /api/price-check` route looks up `market_price_cache` and returns a verdict enum (never raw prices). A new `OverpricedCheckerForm` client component renders the stacked form, loading state, 4-tier verdict card, and Malaysian-plate-styled input that submits to the existing `/api/checks` route. The homepage replaces `DualCheckForm` with `OverpricedCheckerForm`. The asking price is carried forward to pre-fill `PaymentForm`.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, Zod validation, `@vercel/functions` waitUntil, existing `lib/db/market-prices.ts` functions.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `app/api/price-check/route.ts` | Validate input, lookup cache, return verdict (no prices) |
| Create | `components/check/OverpricedCheckerForm.tsx` | Full form + loading + verdict + plate input |
| Modify | `app/page.tsx` | Swap DualCheckForm, update hero/feature/steps copy |
| Modify | `components/report/PaymentForm.tsx` | Accept `defaultAskingPrice` prop |
| Modify | `app/laporan-pembeli/[checkId]/page.tsx` | Read `asking_price` from searchParams, pass to PaymentForm |

---

## Task 1: POST /api/price-check

**Files:**
- Create: `app/api/price-check/route.ts`

- [ ] **Create the file with full implementation**

```typescript
import { NextRequest, NextResponse }                          from 'next/server'
import { waitUntil }                                          from '@vercel/functions'
import { z }                                                  from 'zod'
import { getCachedMarketPrices, fetchAndCacheMarketPrices }   from '@/lib/db/market-prices'

const schema = z.object({
  brand:       z.string().min(1).max(50),
  model:       z.string().min(1).max(50),
  year:        z.string().regex(/^\d{4}$/),
  askingPrice: z.number().int().min(1000).max(2_000_000),
})

type Verdict = 'good_deal' | 'fair_price' | 'slightly_high' | 'overpriced'

function computeVerdict(askingPrice: number, prices: number[]): Verdict {
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  if (askingPrice < lo)         return 'good_deal'
  if (askingPrice <= hi)        return 'fair_price'
  if (askingPrice <= hi * 1.08) return 'slightly_high'
  return 'overpriced'
}

export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { brand, model, year, askingPrice } = parsed.data

  const cached = await getCachedMarketPrices(brand, model, year).catch(() => null)

  if (!cached || cached.listings.length < 3) {
    waitUntil(fetchAndCacheMarketPrices(brand, model, year).catch(() => {}))
    return NextResponse.json({ hasData: false })
  }

  const prices  = cached.listings.map(l => l.price)
  const verdict = computeVerdict(askingPrice, prices)

  return NextResponse.json({
    hasData:      true,
    verdict,
    listingCount: cached.listings.length,
  })
}
```

- [ ] **Verify TypeScript compiles**

```bash
cd /home/freddievong/Paqar && pnpm tsc --noEmit 2>&1 | grep error
```
Expected: no output (zero errors).

- [ ] **Commit**

```bash
git add app/api/price-check/route.ts
git commit -m "feat: POST /api/price-check — verdict from Mudah cache, no prices exposed"
```

---

## Task 2: OverpricedCheckerForm component

**Files:**
- Create: `components/check/OverpricedCheckerForm.tsx`

- [ ] **Create the file with full implementation**

```typescript
'use client'

import { useState }    from 'react'
import { useRouter }   from 'next/navigation'
import type { CreateCheckResponse } from '@/types/api'

type Verdict   = 'good_deal' | 'fair_price' | 'slightly_high' | 'overpriced'
type FormState = 'idle' | 'loading' | 'result' | 'error'

interface PriceCheckResult {
  hasData:       boolean
  verdict?:      Verdict
  listingCount?: number
}

const BRANDS = [
  'Perodua', 'Proton', 'Toyota', 'Honda', 'Mazda',
  'BMW', 'Mercedes-Benz', 'Volkswagen', 'Mitsubishi', 'Nissan',
  'Hyundai', 'Kia', 'Suzuki', 'Subaru', 'Ford',
  'Volvo', 'Audi', 'MINI', 'Lexus', 'Isuzu', 'Chery', 'BYD',
]

const VERDICT_CONFIG: Record<Verdict, {
  badge:        string
  badgeCls:     string
  cardBg:       string
  cardBorder:   string
  copy:         (brand: string, model: string, year: string) => string
  ctaSub:       string
}> = {
  overpriced: {
    badge:      'Harga Terlalu Tinggi',
    badgeCls:   'bg-[#DC2626] text-white',
    cardBg:     'bg-[#FEF2F2]',
    cardBorder: 'border-[#FECACA]',
    copy:       (b, m, y) => `Harga penjual nampak jauh lebih tinggi dari pasaran untuk ${b} ${m} ${y}. Laporan penuh tunjukkan berapa beza dan cara tawar dengan yakin.`,
    ctaSub:     'Harga sebenar · Skrip rundingan · Data JPJ',
  },
  slightly_high: {
    badge:      'Sedikit Tinggi',
    badgeCls:   'bg-[#B45309] text-white',
    cardBg:     'bg-[#FFFBEB]',
    cardBorder: 'border-[#FDE68A]',
    copy:       (b, m, y) => `Harga sedikit di atas julat pasaran untuk ${b} ${m} ${y}. Ada ruang untuk tawar turun — skrip rundingan ada dalam laporan penuh.`,
    ctaSub:     'Harga sebenar · Skrip rundingan · Data JPJ',
  },
  fair_price: {
    badge:      'Harga Wajar',
    badgeCls:   'bg-[#064E4A] text-white',
    cardBg:     'bg-[#F0FDF4]',
    cardBorder: 'border-[#BBF7D0]',
    copy:       () => 'Harga dalam julat pasaran. Sebelum setuju, semak data JPJ dan tanya soalan yang betul kepada penjual.',
    ctaSub:     'Data JPJ · Soalan penjual · Checklist deposit',
  },
  good_deal: {
    badge:      'Harga Bagus',
    badgeCls:   'bg-[#0891B2] text-white',
    cardBg:     'bg-[#F0FAFA]',
    cardBorder: 'border-[#99D4D1]',
    copy:       () => 'Harga di bawah julat pasaran — nampak berbaloi. Semak data JPJ dan rekod penjual dulu sebelum bayar deposit.',
    ctaSub:     'Data JPJ · Soalan penjual · Checklist deposit',
  },
}

const INPUT_CLS = `w-full bg-[#F9FAFB] border-[1.5px] border-[#E5E7EB] rounded-xl px-4 py-3
  font-heading font-semibold text-[14px] text-[#111827]
  placeholder:text-[#D1D5DB] placeholder:font-normal
  focus:outline-none focus:border-[#064E4A] focus:ring-[3px] focus:ring-[#064E4A]/10
  transition-all`

const LABEL_CLS = 'block font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#111827] mb-1.5'

export function OverpricedCheckerForm() {
  const router = useRouter()

  const [brand,       setBrand]       = useState('')
  const [model,       setModel]       = useState('')
  const [year,        setYear]        = useState('')
  const [askingPrice, setAskingPrice] = useState('')
  const [formState,   setFormState]   = useState<FormState>('idle')
  const [result,      setResult]      = useState<PriceCheckResult | null>(null)
  const [checkError,  setCheckError]  = useState<string | null>(null)
  const [plate,       setPlate]       = useState('')
  const [plateBusy,   setPlateBusy]   = useState(false)
  const [plateError,  setPlateError]  = useState<string | null>(null)

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    setCheckError(null)
    setFormState('loading')
    try {
      const res = await fetch('/api/price-check', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          brand,
          model:       model.trim(),
          year,
          askingPrice: parseInt(askingPrice, 10),
        }),
      })
      if (!res.ok) throw new Error('server')
      const data = await res.json() as PriceCheckResult
      setResult(data)
      setFormState('result')
    } catch {
      setCheckError('Semakan gagal — sila cuba semula.')
      setFormState('error')
    }
  }

  async function handlePlateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!plate.trim()) return
    setPlateBusy(true)
    setPlateError(null)
    try {
      const res = await fetch('/api/checks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plate: plate.trim(), idempotencyKey: crypto.randomUUID() }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setPlateError(data.error ?? 'Ralat — sila cuba semula')
        return
      }
      const { checkId, claimToken } = await res.json() as CreateCheckResponse
      const priceParam = askingPrice ? `&asking_price=${askingPrice}` : ''
      router.push(`/check/${checkId}?claim_token=${claimToken}${priceParam}`)
    } catch {
      setPlateError('Ralat rangkaian — sila cuba semula')
    } finally {
      setPlateBusy(false)
    }
  }

  function resetForm() {
    setFormState('idle')
    setResult(null)
    setPlate('')
    setPlateError(null)
    setCheckError(null)
  }

  // ── Form (idle / error) ────────────────────────────────────────────────
  if (formState === 'idle' || formState === 'error') {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-[20px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
        <form onSubmit={handleCheck} className="space-y-3">
          <div>
            <label className={LABEL_CLS}>Jenama</label>
            <select
              value={brand} onChange={e => setBrand(e.target.value)} required
              className={INPUT_CLS}
            >
              <option value="">Pilih jenama…</option>
              {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL_CLS}>Model</label>
            <input
              type="text" value={model} onChange={e => setModel(e.target.value)}
              placeholder="cth: Vios, Axia, X5" required className={INPUT_CLS}
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Tahun</label>
            <input
              type="number" value={year} onChange={e => setYear(e.target.value)}
              placeholder="cth: 2020" min={2000} max={2026} required className={INPUT_CLS}
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Harga Diminta (RM)</label>
            <input
              type="number" value={askingPrice} onChange={e => setAskingPrice(e.target.value)}
              placeholder="cth: 59000" min={1000} max={2000000} required className={INPUT_CLS}
            />
          </div>
          {checkError && <p className="font-body text-[13px] text-[#DC2626]">{checkError}</p>}
          <button
            type="submit"
            className="w-full bg-[#064E4A] hover:bg-[#053D3A] text-white font-heading font-extrabold text-[15px] rounded-[14px] py-4 transition-colors"
          >
            Semak Harga →
          </button>
          <p className="font-body text-[11px] text-[#9CA3AF] text-center">
            Percuma · Laporan penuh RM12 · Tanpa daftar akaun
          </p>
        </form>
      </div>
    )
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (formState === 'loading') {
    return (
      <div className="space-y-3">
        <CollapsedSummary brand={brand} model={model} year={year} askingPrice={askingPrice} onReset={resetForm} />
        <div className="bg-white border border-[#E5E7EB] rounded-[20px] p-8 text-center">
          <p className="font-heading font-bold text-[14px] text-[#6B7280]">🔍 Semak harga pasaran…</p>
        </div>
      </div>
    )
  }

  // ── Result ─────────────────────────────────────────────────────────────
  const cfg     = result?.verdict ? VERDICT_CONFIG[result.verdict] : null
  const noData  = !result?.hasData || !cfg

  return (
    <div className="space-y-3">
      <CollapsedSummary brand={brand} model={model} year={year} askingPrice={askingPrice} onReset={resetForm} />
      <div className={`border rounded-[14px] p-5 ${noData ? 'bg-[#F9FAFB] border-[#E5E7EB]' : `${cfg!.cardBg} ${cfg!.cardBorder}`}`}>
        {noData ? (
          <>
            <p className="font-heading font-bold text-[14px] text-[#374151] mb-1">Data pasaran belum tersedia</p>
            <p className="font-body text-[13px] text-[#6B7280] mb-4 leading-relaxed">
              Kami belum ada data untuk model ini. Laporan penuh ada harga pasaran terkini terus dari Mudah.
            </p>
          </>
        ) : (
          <>
            <span className={`inline-block font-heading font-bold text-[11px] rounded-[5px] px-3 py-1 mb-3 ${cfg!.badgeCls}`}>
              {cfg!.badge}
            </span>
            <p className="font-body text-[13px] text-[#374151] leading-relaxed mb-2">
              {cfg!.copy(brand, model, year)}
            </p>
            <p className="font-body text-[11px] text-[#9CA3AF] mb-4">
              Berdasarkan {result!.listingCount} kereta serupa.
            </p>
          </>
        )}

        {/* Malaysian plate input */}
        <form onSubmit={handlePlateSubmit} className="space-y-2">
          <div className="bg-[#1a1a1a] rounded-[7px] p-[5px]">
            <div className="bg-white rounded-[3px] flex items-stretch overflow-hidden min-h-[48px]">
              <div className="w-7 bg-[#4CAF50] flex flex-col items-center justify-between py-1 flex-shrink-0">
                <span className="text-[12px] leading-none">🇲🇾</span>
                <span className="font-heading font-black text-[7px] text-[#1a1a1a] tracking-[.04em]">MAL</span>
              </div>
              <div className="flex-1 flex items-center justify-center px-2 relative">
                <input
                  type="text"
                  value={plate}
                  onChange={e => setPlate(e.target.value.toUpperCase())}
                  placeholder="VS 2277"
                  maxLength={10}
                  required
                  className="w-full bg-transparent border-none outline-none text-center font-black text-[22px] tracking-[.16em] text-[#1a1a1a] uppercase placeholder:text-[#D1D5DB] placeholder:font-normal placeholder:tracking-[.1em] placeholder:text-[16px]"
                  style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}
                />
                <span className="absolute bottom-1 right-2 text-[6px] text-[#9CA3AF] italic pointer-events-none">FRONT</span>
              </div>
            </div>
            <p className="text-center text-[7px] font-black text-white tracking-[.18em] uppercase py-0.5">
              Malaysia
            </p>
          </div>
          <p className="font-body text-[9px] text-[#9CA3AF] text-center leading-relaxed">
            Masukkan nombor plat untuk unlock data JPJ, soalan penjual dan skrip tawar.
          </p>
          {plateError && (
            <p className="font-body text-[12px] text-[#DC2626] text-center">{plateError}</p>
          )}
          <button
            type="submit" disabled={plateBusy}
            className="w-full bg-[#FACC15] hover:bg-[#FDE047] text-[#111827] font-heading font-extrabold text-[14px] rounded-[12px] py-3.5 text-center transition-colors disabled:opacity-60"
          >
            {plateBusy ? 'Memproses…' : 'Unlock Laporan Penuh — RM12'}
          </button>
        </form>

        {!noData && (
          <p className="font-body text-[9px] text-[#9CA3AF] text-center mt-2">{cfg!.ctaSub}</p>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function CollapsedSummary({
  brand, model, year, askingPrice, onReset,
}: {
  brand: string; model: string; year: string; askingPrice: string; onReset: () => void
}) {
  const fmt = (v: string) => parseInt(v, 10).toLocaleString()
  return (
    <div className="flex items-center justify-between bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-4 py-3">
      <div>
        <p className="font-heading font-bold text-[13px] text-[#374151]">{brand} {model}</p>
        <p className="font-body text-[11px] text-[#6B7280]">{year} · RM {fmt(askingPrice)}</p>
      </div>
      <button
        type="button" onClick={onReset}
        className="font-heading font-bold text-[12px] text-[#064E4A] ml-4 flex-shrink-0"
      >
        Ubah →
      </button>
    </div>
  )
}
```

- [ ] **Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | grep error
```
Expected: no output.

- [ ] **Commit**

```bash
git add components/check/OverpricedCheckerForm.tsx
git commit -m "feat: OverpricedCheckerForm — 4-field form, 4-tier verdict, Malaysian plate input"
```

---

## Task 3: Pre-fill asking price in PaymentForm

**Files:**
- Modify: `components/report/PaymentForm.tsx`
- Modify: `app/laporan-pembeli/[checkId]/page.tsx`

- [ ] **Update PaymentForm to accept defaultAskingPrice prop**

In `components/report/PaymentForm.tsx`, change the `Props` interface and `price` initial state:

```typescript
// Change line 7-9:
interface Props {
  checkId:             string
  claimToken:          string
  defaultAskingPrice?: number   // ← add this
}

// Change line 12:
export function PaymentForm({ checkId, claimToken, defaultAskingPrice }: Props) {

// Change line 14:
const [price, setPrice] = useState(defaultAskingPrice ? String(defaultAskingPrice) : '')
```

- [ ] **Update laporan-pembeli page to read asking_price from searchParams**

In `app/laporan-pembeli/[checkId]/page.tsx`, change lines 20-22:

```typescript
interface Props {
  params:       { checkId: string }
  searchParams: { claim_token?: string; asking_price?: string }  // ← add asking_price
}
```

And in the unpaid path (around line 148), change `<PaymentForm>`:

```typescript
<PaymentForm
  checkId={params.checkId}
  claimToken={claimToken}
  defaultAskingPrice={searchParams.asking_price ? parseInt(searchParams.asking_price, 10) : undefined}
/>
```

- [ ] **Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | grep error
```
Expected: no output.

- [ ] **Commit**

```bash
git add components/report/PaymentForm.tsx app/laporan-pembeli/\[checkId\]/page.tsx
git commit -m "feat: pre-fill asking price in PaymentForm from URL param"
```

---

## Task 4: Update homepage

**Files:**
- Modify: `app/page.tsx`

- [ ] **Replace DualCheckForm import (line 3)**

```typescript
// Before:
import { DualCheckForm } from '@/components/check/DualCheckForm'
// After:
import { OverpricedCheckerForm } from '@/components/check/OverpricedCheckerForm'
```

- [ ] **Update hero headline (lines 38-41)**

```tsx
// Before:
<h1 className="font-heading font-extrabold text-[32px] md:text-[40px] leading-[1.08] tracking-[-0.03em] text-[#111827] mb-3">
  Semak Sebelum<br />
  <span className="text-[#064E4A]">Bayar Deposit</span>
</h1>
// After:
<h1 className="font-heading font-extrabold text-[32px] md:text-[40px] leading-[1.08] tracking-[-0.03em] text-[#111827] mb-3">
  Semak Harga<br />
  <span className="text-[#064E4A]">Kereta Terpakai</span>
</h1>
```

- [ ] **Update hero subtitle (lines 43-45)**

```tsx
// Before:
<p className="font-body text-[15px] md:text-[16px] text-[#6B7280] leading-relaxed mb-8 md:mb-0">
  Masukkan nombor plat kereta yang nak dibeli. Paqar bantu anda semak sebelum bayar deposit.
</p>
// After:
<p className="font-body text-[15px] md:text-[16px] text-[#6B7280] leading-relaxed mb-8 md:mb-0">
  Masukkan maklumat kereta yang nak dibeli. Tahu sama ada harga penjual berpatutan sebelum bayar deposit.
</p>
```

- [ ] **Remove desktop-only subtext (lines 47-49)**

Delete this block entirely — the new form's subtext already covers it:
```tsx
// Remove:
<p className="hidden md:block font-body text-[13px] text-[#6B7280] mt-6">
  Panduan saman percuma · Laporan penuh RM12 · Tanpa daftar akaun
</p>
```

- [ ] **Replace DualCheckForm with OverpricedCheckerForm (line 54)**

```tsx
// Before:
<DualCheckForm />
// After:
<OverpricedCheckerForm />
```

- [ ] **Update free tier feature card copy** (the 3-bullet green card, around line 62)

```tsx
{['Verdict harga pasaran', 'Tahu sama ada perlu tawar lebih', 'Tanpa daftar akaun'].map(t => (
```

- [ ] **Update "Cara ia berfungsi" steps** (around lines 131-145)

```tsx
{
  n: '1',
  title: 'Masukkan maklumat kereta',
  desc:  'Jenama, model, tahun, dan harga yang penjual minta.',
},
{
  n: '2',
  title: 'Dapat verdict harga',
  desc:  'Kami semak harga pasaran dan tunjukkan sama ada berpatutan.',
},
{
  n: '3',
  title: 'Unlock laporan penuh',
  desc:  'Masukkan nombor plat untuk data JPJ, skrip rundingan, dan soalan penjual.',
},
```

- [ ] **Verify build passes**

```bash
pnpm run build 2>&1 | tail -20
```
Expected: build completes, exit code 0.

- [ ] **Commit**

```bash
git add app/page.tsx
git commit -m "feat: homepage — replace DualCheckForm with OverpricedCheckerForm, update hero + steps copy"
```

---

## Task 5: End-to-end verification

- [ ] **Test cache hit flow**

  1. Open `paqar.my` (or `localhost:3000`) on mobile
  2. Select Toyota, enter "Vios", 2020, 59000
  3. Tap "Semak Harga →"
  4. Verify: loading state shows "🔍 Semak harga pasaran…" with collapsed summary
  5. Verify: verdict badge appears (no RM numbers visible anywhere)
  6. Verify: "Berdasarkan X kereta serupa." appears below copy
  7. Verify: Malaysian plate input renders with green strip, 🇲🇾 flag, MAL, FRONT text
  8. Type a plate → verify auto-uppercase
  9. Tap "Unlock Laporan Penuh — RM12" → verify redirect to `/check/[id]`
  10. On the laporan-pembeli page → verify price field is pre-filled with 59000

- [ ] **Test cache miss flow**

  1. Enter a brand/model/year with no cached data (e.g. Chery, Omoda, 2024)
  2. Verify: "Data pasaran belum tersedia" card appears
  3. Verify: plate input and CTA still show
  4. Check Railway logs: confirm scraper was triggered for chery/omoda/2024

- [ ] **Test "Ubah →"**

  1. Get to result state
  2. Tap "Ubah →"
  3. Verify: full form appears pre-filled with Toyota, Vios, 2020, 59000
  4. Change price to 45000, resubmit
  5. Verify: new verdict reflects lower price

- [ ] **Test asking price carry-through**

  1. Complete the plate submit from the verdict card (price: 59000)
  2. On the laporan-pembeli unpaid page, verify "Harga Diminta" field shows 59000
  3. Verify user can still edit the price before paying

- [ ] **Verify API response never leaks prices**

  ```bash
  curl -s -X POST https://paqar.my/api/price-check \
    -H "Content-Type: application/json" \
    -d '{"brand":"Toyota","model":"vios","year":"2020","askingPrice":59000}' | jq .
  ```
  Expected response shape:
  ```json
  { "hasData": true, "verdict": "overpriced", "listingCount": 5 }
  ```
  Confirm: no `marketMin`, `marketMax`, `listings`, or price numbers in response.

- [ ] **Final commit + push**

```bash
git push
```
