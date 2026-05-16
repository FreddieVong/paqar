# Overpriced Checker — Design Spec
**Date:** 2026-05-16  
**Status:** Approved

---

## Problem

The current free check (plate → saman guide) delivers almost no car-specific value. It runs 4 saman sources but PDRM and JPJ both require the owner's IC — so a buyer with only the plate gets generic instructions to "ask the seller to check." The user feels Paqar checked their car; it didn't.

The paid RM12 report's strongest selling point — live Mudah market prices — is invisible until after payment. There is no taste of real data before the paywall.

---

## Solution

Replace the homepage entry with an **Overpriced Checker**: user enters brand/model/year/asking price, gets a real market verdict (Harga Bagus / Wajar / Sedikit Tinggi / Terlalu Tinggi) powered by cached Mudah data. The verdict appears instantly inline. The plate input appears below the verdict — motivated users enter their plate and proceed to the RM12 paid report.

**Free:** Verdict only — no RM numbers, no individual listings  
**Paid RM12:** Actual Mudah listings, new car price, JPJ data, nego script, seller questions

---

## User Flow

```
Homepage
  └─ Enter: Brand (dropdown) + Model (text) + Year + Asking Price
        └─ POST /api/price-check
              ├─ Cache hit → show verdict inline
              └─ Cache miss → show "no data" + fire background scrape

Verdict screen (same page, inline)
  └─ Badge: Harga Terlalu Tinggi / Sedikit Tinggi / Harga Wajar / Harga Bagus
  └─ Teaser copy (no RM numbers)
  └─ Malaysian plate input → user types plate
        └─ Submit → POST /api/checks → redirect /check/[id]?claim_token=...
              └─ Existing check flow → ReportCTA → PaymentForm → Paid report
```

No skip path — all users go through the free verdict first.

---

## Architecture

### New: `app/api/price-check/route.ts`
POST handler. Input: `{ brand, model, year, askingPrice }`.

1. Call `getCachedMarketPrices(brand, model, year)` — already normalises to lowercase
2. **Cache miss:** fire `fetchAndCacheMarketPrices` non-blocking → return `{ hasData: false }`
3. **Cache hit:** compute verdict from prices array → return `{ hasData: true, verdict, listingCount }`

Response **never includes** marketMin, marketMax, or individual listing prices.

**Verdict logic:**
```ts
const prices = listings.map(l => l.price)
const lo = Math.min(...prices)
const hi = Math.max(...prices)

if      (askingPrice < lo)         → 'good_deal'
else if (askingPrice <= hi)        → 'fair_price'
else if (askingPrice <= hi * 1.08) → 'slightly_high'
else                               → 'overpriced'
```

### New: `components/check/OverpricedCheckerForm.tsx`
Client component. Manages form state + inline result display.

**Form fields (stacked, full-width):**
| Field | Type | Notes |
|---|---|---|
| Jenama | `<select>` | Dropdown: Perodua, Proton, Toyota, Honda, Mazda, BMW, Mercedes-Benz, Volkswagen, Mitsubishi, Nissan, Hyundai, Kia, Suzuki, Subaru, Ford, Volvo, Audi, MINI, Lexus, Isuzu, Chery, BYD |
| Model | `<input type="text">` | Placeholder: "cth: Vios, Axia, X5" |
| Tahun | `<input type="number">` | min=2000, max=2026, placeholder: "cth: 2020" |
| Harga Diminta (RM) | `<input type="number">` | min=1000, max=2000000, placeholder: "cth: 59000" |

**Submit button:** "Semak Harga →" (teal `#064E4A`)  
**Subtext:** "Percuma · Laporan penuh RM12 · Tanpa daftar akaun"

**States:**
- `idle` — form shown, empty
- `loading` — form collapses to summary + spinner ("Semak harga pasaran…")
- `result` — form shows as compact summary with "Ubah →" link + verdict card below
- `error` — inline error message, form stays editable

**Collapsed form summary (result state):**  
`[Brand Model] [Ubah →]`  
`[Year · RM Price]`

Clicking "Ubah →" restores the full form pre-filled with the current values and hides the verdict. User can change any field and resubmit.

### Verdict display (inside OverpricedCheckerForm, result state)

**4 verdict cards:**

| Verdict | Badge | Background | Copy |
|---|---|---|---|
| `overpriced` | "Harga Terlalu Tinggi" `#DC2626` | `#FEF2F2 / #FECACA` | "Harga penjual nampak jauh lebih tinggi dari pasaran untuk [Brand Model Year]. Laporan penuh tunjukkan berapa beza dan cara tawar dengan yakin." |
| `slightly_high` | "Sedikit Tinggi" `#B45309` | `#FFFBEB / #FDE68A` | "Harga sedikit di atas julat pasaran untuk [Brand Model Year]. Ada ruang untuk tawar turun — skrip rundingan ada dalam laporan penuh." |
| `fair_price` | "Harga Wajar" `#064E4A` | `#F0FDF4 / #BBF7D0` | "Harga dalam julat pasaran. Sebelum setuju, semak data JPJ dan tanya soalan yang betul kepada penjual." |
| `good_deal` | "Harga Bagus" `#0891B2` | `#F0FAFA / #99D4D1` | "Harga di bawah julat pasaran — nampak berbaloi. Semak data JPJ dan rekod penjual dulu sebelum bayar deposit." |

No-data card (neutral `#F9FAFB / #E5E7EB`):  
"Data pasaran belum tersedia" — "Kami belum ada data untuk model ini. Laporan penuh ada harga pasaran terkini terus dari Mudah."

CTA subtext varies by verdict:
- overpriced / slightly_high: "Harga sebenar · Skrip rundingan · Data JPJ"
- fair_price / good_deal / no_data: "Data JPJ · Soalan penjual · Checklist deposit"

### Malaysian plate input component
Appears below verdict copy in all states (including no-data). Styled to match real Malaysian front plate.

```
┌─────────────────────────────────────────────┐  ← black frame (#1a1a1a), border-radius: 7px
│ ┌──────┬──────────────────────────────────┐ │
│ │  🇲🇾  │                                  │ │  ← green strip (#4CAF50) left, white main
│ │      │     VS 2277  (placeholder)        │ │  ← bold, 22px, letter-spacing .16em
│ │ MAL  │                          FRONT   │ │  ← "MAL" bottom of strip, "FRONT" italic
│ └──────┴──────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

The inner white area is a focusable `<input>` field. `toUpperCase()` on change. `maxLength=10`.

On submit: reuses existing `POST /api/checks` logic from `DualCheckForm` → redirects to `/check/[id]?claim_token=...`

**Note (v1 simplification):** The asking price entered in the free checker is NOT pre-filled into the PaymentForm. The user enters it again in the paid flow. Acceptable for MVP — they're motivated enough after seeing the verdict. Pre-fill can be added in v2 via URL param.

### Modified: `app/page.tsx`
- Replace `<DualCheckForm />` with `<OverpricedCheckerForm />`
- Update hero headline: "Semak Harga Kereta Terpakai"
- Update hero subtext: "Masukkan maklumat kereta yang nak dibeli. Tahu sama ada harga penjual berpatutan sebelum bayar deposit."
- Update free tier feature card copy:
  - "Verdict harga pasaran"
  - "Tahu sama ada perlu tawar lebih"
  - "Tanpa daftar akaun"
- Update "Cara ia berfungsi" steps:
  - Step 1: "Masukkan maklumat kereta" / "Jenama, model, tahun, dan harga yang penjual minta."
  - Step 2: "Dapat verdict harga" / "Kami semak harga pasaran dan tunjukkan sama ada berpatutan."
  - Step 3: "Unlock laporan penuh" / "Masukkan nombor plat untuk data JPJ, skrip rundingan, dan soalan penjual."

---

## What the free check must NOT return

- `marketMin` or `marketMax` (exact numbers)
- Individual Mudah listing prices or URLs
- New car price
- Percentage over/under market
- Any saman data

---

## Error handling

| Scenario | Behaviour |
|---|---|
| Missing required field | Inline validation: "Sila isi semua maklumat kereta." |
| Invalid asking price | "Sila masukkan harga yang sah." |
| API timeout / server error | "Semakan gagal — sila cuba semula." Form stays editable. |
| Cache miss (no Mudah data) | Show no-data card immediately. Fire background scrape. |
| Plate validation fails | Existing `plateSchema` validation from DualCheckForm |

---

## Files changed

**Create:**
- `app/api/price-check/route.ts`
- `components/check/OverpricedCheckerForm.tsx`

**Modify:**
- `app/page.tsx` — replace DualCheckForm, update hero + feature copy

**Unchanged:**
- `lib/db/market-prices.ts` — already has all needed functions
- `/check/[id]` page, `ResultsStream`, `ReportCTA`, `SamanGuide` — no changes
- `/api/checks` route — no changes
- Paid report path — no changes

---

## Verification

1. Enter Toyota Vios 2020 RM59,000 → if cached, verdict shows with correct badge and no RM numbers visible
2. Enter an obscure model → no-data card shows, scraper fires in background (check Railway logs)
3. Inspect `/api/price-check` response: confirm `marketMin`/`marketMax`/`listings` absent
4. Enter plate in verdict card → redirects to `/check/[id]` → ReportCTA → PaymentForm works
5. "Ubah →" resets form to editable state
6. All 4 verdict badge colours render correctly on mobile
7. Plate input: typing auto-uppercases, "FRONT" label visible, MAL + flag on green strip
