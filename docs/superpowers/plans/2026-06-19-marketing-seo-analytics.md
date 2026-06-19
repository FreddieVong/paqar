# Marketing: Analytics Wiring + OG Image + Model SEO Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three independent marketing improvements: wire up missing funnel analytics events, upgrade the OG social image, and add 8 model-specific SEO landing pages targeting used car buyer search intent.

**Architecture:** All changes are additive. Analytics wiring touches `lib/analytics.ts` + two existing form components. OG image replaces `app/api/og/route.tsx`. Model pages add a new dynamic route `app/harga-kereta-terpakai/[model]/page.tsx` with static config data. Each task is independently deployable.

**Tech Stack:** Next.js 14 App Router, PostHog (analytics), `next/og` ImageResponse (OG image), TypeScript, Tailwind CSS (page styling).

---

## File Map

| File | Action | Task |
|------|--------|------|
| `lib/analytics.ts` | Modify — add 2 new event functions | 1 |
| `components/check/OverpricedCheckerForm.tsx` | Modify — fire 3 analytics events | 1 |
| `components/check/HomeCheckerTabs.tsx` | Modify — fire tab_selected event | 1 |
| `components/check/PlateCheckerForm.tsx` | Modify — fire check_started event | 1 |
| `app/api/og/route.tsx` | Modify — redesign image layout | 2 |
| `app/harga-kereta-terpakai/[model]/page.tsx` | Create — dynamic model SEO page | 3 |
| `app/harga-kereta-terpakai/page.tsx` | Create — hub listing page | 3 |
| `app/sitemap.ts` | Modify — add model pages | 3 |

---

## Task 1: Wire missing analytics funnel events

**Context:** `lib/analytics.ts` defines `checkStarted`, `checkCompleted`, `verdictViewed` (doesn't exist yet) but none are called in the forms. PostHog receives `payment_form_viewed` and `payment_initiated` but has zero data on how many users reach each prior step. This makes it impossible to identify the biggest conversion drop-off.

**Files:**
- Modify: `lib/analytics.ts`
- Modify: `components/check/OverpricedCheckerForm.tsx`
- Modify: `components/check/HomeCheckerTabs.tsx`
- Modify: `components/check/PlateCheckerForm.tsx`

- [ ] **Step 1: Add missing event functions to analytics lib**

In `lib/analytics.ts`, add after the `checkCompleted` definition:

```ts
  verdictViewed: (props: {
    verdict: 'good_deal' | 'fair_price' | 'slightly_high' | 'overpriced' | 'no_data'
    listing_count: number
    has_data: boolean
  }) => posthog.capture('verdict_viewed', props),

  tabSelected: (props: { tab: 'model' | 'plate' }) =>
    posthog.capture('tab_selected', props),
```

- [ ] **Step 2: Wire check_started in OverpricedCheckerForm**

In `components/check/OverpricedCheckerForm.tsx`, at the top of `handleCheck` after `setFormState('loading')`, add:

```ts
analytics.checkStarted({ country: 'MY', is_test: false })
```

Import analytics at the top of the file:
```ts
import { analytics } from '@/lib/analytics'
```

- [ ] **Step 3: Wire verdict_viewed in OverpricedCheckerForm**

In `OverpricedCheckerForm.tsx`, the result is set with `setResult(data)` then `setFormState('result')`. Replace those two lines with:

```ts
setResult(data)
setFormState('result')
analytics.verdictViewed(
  data.hasData
    ? { verdict: data.verdict, listing_count: data.listingCount, has_data: true }
    : { verdict: 'no_data', listing_count: 0, has_data: false }
)
```

- [ ] **Step 4: Wire tab_selected in HomeCheckerTabs**

In `components/check/HomeCheckerTabs.tsx`, import analytics and update both tab buttons:

```ts
import { analytics } from '@/lib/analytics'
```

Change `onClick={() => setTab('model')}` to:
```ts
onClick={() => { setTab('model'); analytics.tabSelected({ tab: 'model' }) }}
```

Change `onClick={() => setTab('plate')}` to:
```ts
onClick={() => { setTab('plate'); analytics.tabSelected({ tab: 'plate' }) }}
```

- [ ] **Step 5: Wire check_started in PlateCheckerForm**

In `components/check/PlateCheckerForm.tsx`, import analytics and add at the top of `handleSubmit` after `setBusy(true)`:

```ts
import { analytics } from '@/lib/analytics'
```

```ts
analytics.checkStarted({ country: 'MY', is_test: false })
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 7: Commit**

```bash
git add lib/analytics.ts components/check/OverpricedCheckerForm.tsx components/check/HomeCheckerTabs.tsx components/check/PlateCheckerForm.tsx
git commit -m "feat: wire check_started, verdict_viewed, tab_selected analytics events"
```

---

## Task 2: Upgrade OG social image

**Context:** The current OG image (`app/api/og/route.tsx`) is a solid green rectangle with white text — functional but generic. It doesn't show the product or create curiosity. Replacing it with a layout that mimics the verdict card (the actual product output) gives people sharing Paqar links a concrete preview of what they'll get, increasing click-through from WhatsApp, Twitter, and Facebook shares.

**Files:**
- Modify: `app/api/og/route.tsx`

The new design: dark left panel showing a mock verdict card ("MAHAL", gap in RM, listing count), Paqar green right panel with headline and brand. When `title` param is passed (guide pages), show a simpler guide layout instead.

- [ ] **Step 1: Replace OG route with upgraded design**

Replace the entire contents of `app/api/og/route.tsx` with:

```tsx
import { ImageResponse } from 'next/og'
import { NextRequest }   from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const title    = searchParams.get('title')
  const subtitle = searchParams.get('subtitle')

  // Guide page mode — simple layout with title
  if (title) {
    return new ImageResponse(
      (
        <div style={{
          width: '1200px', height: '630px',
          background: '#064E4A',
          display: 'flex', flexDirection: 'column',
          padding: '72px 80px',
          fontFamily: 'sans-serif',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#FACC15', width: '16px', height: '16px', borderRadius: '4px' }} />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontWeight: 700, letterSpacing: '0.14em' }}>
              PAQAR
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <span style={{ color: 'white', fontSize: '60px', fontWeight: 900, lineHeight: 1.05 }}>
              {title}
            </span>
            {subtitle && (
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '24px' }}>
                {subtitle}
              </span>
            )}
          </div>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px', letterSpacing: '0.05em' }}>
            paqar.my
          </span>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  }

  // Default homepage OG — product preview layout
  return new ImageResponse(
    (
      <div style={{
        width: '1200px', height: '630px',
        display: 'flex',
        fontFamily: 'sans-serif',
      }}>
        {/* Left panel — mock verdict card */}
        <div style={{
          width: '480px', height: '630px',
          background: '#111827',
          display: 'flex', flexDirection: 'column',
          padding: '56px 48px',
          justifyContent: 'center',
          gap: '20px',
        }}>
          {/* Verdict badge */}
          <div style={{ display: 'flex' }}>
            <div style={{
              background: '#DC2626',
              color: 'white',
              fontWeight: 900,
              fontSize: '18px',
              letterSpacing: '0.08em',
              padding: '6px 16px',
              borderRadius: '6px',
            }}>
              MAHAL
            </div>
          </div>

          {/* Gap line */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ color: 'white', fontWeight: 800, fontSize: '28px', lineHeight: 1.1 }}>
              Lebih RM8,400 dari harga pasaran
            </span>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '16px' }}>
              Berdasarkan 23 listing serupa di pasaran
            </span>
          </div>

          {/* Mini price bar */}
          <div style={{
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', letterSpacing: '0.06em' }}>HARGA PASARAN</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', letterSpacing: '0.06em' }}>DIMINTA</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#22C55E', fontWeight: 800, fontSize: '20px' }}>RM 43,000</span>
              <span style={{ color: '#DC2626', fontWeight: 800, fontSize: '20px' }}>RM 51,400</span>
            </div>
          </div>
        </div>

        {/* Right panel — brand & headline */}
        <div style={{
          flex: 1,
          background: '#064E4A',
          display: 'flex', flexDirection: 'column',
          padding: '56px 64px',
          justifyContent: 'space-between',
        }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#FACC15', width: '18px', height: '18px', borderRadius: '4px' }} />
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '15px', fontWeight: 700, letterSpacing: '0.14em' }}>
              PAQAR
            </span>
          </div>

          {/* Headline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <span style={{ color: 'white', fontWeight: 900, fontSize: '48px', lineHeight: 1.08 }}>
              Tahu sama ada harga penjual berpatutan
            </span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '22px', lineHeight: 1.4 }}>
              Verdict percuma · Laporan penuh RM12
            </span>
          </div>

          {/* URL */}
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px', letterSpacing: '0.05em' }}>
            paqar.my
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
```

- [ ] **Step 2: Verify it builds**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/api/og/route.tsx
git commit -m "feat: redesign OG image with product verdict preview"
```

---

## Task 3: Model-specific SEO landing pages

**Context:** High-intent queries like "harga Perodua Myvi terpakai 2020 Malaysia" get thousands of monthly searches. Paqar's core product (used car price verdict) directly answers this intent — unlike the deleted saman city pages, these visitors CAN be helped. Each page shows typical price ranges by year, then asks users to check their specific car with `DualCheckForm`.

**Files:**
- Create: `app/harga-kereta-terpakai/page.tsx` (hub listing all models)
- Create: `app/harga-kereta-terpakai/[model]/page.tsx` (dynamic model page)
- Modify: `app/sitemap.ts`

**Models to cover (8 most searched used cars in Malaysia):**
`perodua-myvi`, `perodua-axia`, `perodua-bezza`, `proton-saga`, `toyota-vios`, `honda-city`, `perodua-alza`, `proton-x50`

- [ ] **Step 1: Create the model page**

Create `app/harga-kereta-terpakai/[model]/page.tsx`:

```tsx
import type { Metadata }  from 'next'
import { notFound }       from 'next/navigation'
import Link               from 'next/link'
import { Nav }            from '@/components/layout/Nav'
import { Shell }          from '@/components/layout/Shell'
import { DualCheckForm }  from '@/components/check/DualCheckForm'

type PriceRow = { year: string; min: number; max: number }

type ModelConfig = {
  brand:       string
  model:       string
  description: string
  priceRows:   PriceRow[]
  buyerTips:   string[]
  faqs:        { q: string; a: string }[]
}

const MODELS: Record<string, ModelConfig> = {
  'perodua-myvi': {
    brand: 'Perodua', model: 'Myvi',
    description: 'Perodua Myvi adalah kereta terpakai paling popular di Malaysia. Mudah diselenggara, kos servis rendah, dan ada banyak pilihan di pasaran. Semak harga pasaran sebelum beli.',
    priceRows: [
      { year: '2017', min: 33000,  max: 48000  },
      { year: '2018', min: 37000,  max: 52000  },
      { year: '2019', min: 42000,  max: 56000  },
      { year: '2020', min: 46000,  max: 60000  },
      { year: '2021', min: 50000,  max: 65000  },
      { year: '2022', min: 54000,  max: 70000  },
      { year: '2023', min: 58000,  max: 74000  },
    ],
    buyerTips: [
      'Semak nombor enjin dan casis pada geran — nombor mesti sama persis',
      'Myvi generasi 3 (2018 ke atas) ada VSC dan ASA — pastikan sistem ini berfungsi',
      'Tanya rekod servis di Perodua Service Centre — boleh semak dengan nombor plat',
      'Cat bumbung dan tiang A/B perlu sekata — kereta banjir sering ada kelunturan di sini',
    ],
    faqs: [
      { q: 'Berapa harga Myvi terpakai 2020?', a: 'Harga Myvi 2020 terpakai biasanya antara RM46,000 hingga RM60,000 bergantung kepada varian (E, X, AV, H) dan jarak tempuh. Semak harga semasa di Paqar untuk verdict yang tepat.' },
      { q: 'Varian Myvi mana yang paling berbaloi dibeli terpakai?', a: 'Varian H (1.5L) dan AV menawarkan nilai terbaik kerana ada VSC, ASA, dan pelek aloi. Varian X 1.3L lebih murah tapi ketiadaan VSC bermakna kurang selamat.' },
      { q: 'Apa yang perlu disemak sebelum beli Myvi terpakai?', a: 'Semak saman dengan PDRM dan JPJ, semak geran asal, rekod servis di Perodua, kondisi airbag, dan test drive untuk dengar bunyi gear atau enjin.' },
      { q: 'Boleh tawar berapa untuk Myvi terpakai?', a: 'Bergantung kepada verdict harga semasa. Jika Paqar tunjukkan harga MAHAL, anda ada asas untuk tawar turun menggunakan harga median pasaran sebagai rujukan.' },
    ],
  },
  'perodua-axia': {
    brand: 'Perodua', model: 'Axia',
    description: 'Perodua Axia adalah pilihan kereta terpakai paling berpatutan di Malaysia. Kos petrol dan insurans rendah, sesuai untuk pemandu baru atau bandar.',
    priceRows: [
      { year: '2016', min: 20000, max: 28000 },
      { year: '2017', min: 21000, max: 30000 },
      { year: '2018', min: 23000, max: 33000 },
      { year: '2019', min: 26000, max: 36000 },
      { year: '2020', min: 28000, max: 39000 },
      { year: '2022', min: 31000, max: 43000 },
      { year: '2023', min: 35000, max: 48000 },
    ],
    buyerTips: [
      'Axia 2023 (generasi 2) berbeza sangat dari versi lama — harga lebih tinggi tapi lebih besar dan lebih selamat',
      'Semak sama ada pemilik lama guna untuk Grab/e-hailing — jarak tempuh biasanya lebih tinggi',
      'Aircond Axia sering kena servis kerana kapasiti enjin kecil — tanya berapa kali sudah isi gas',
      'Pilih varian SE atau AV untuk dapat airbag — Standard tiada airbag penumpang hadapan',
    ],
    faqs: [
      { q: 'Berapa harga Axia terpakai 2020?', a: 'Axia 2020 terpakai biasanya antara RM28,000 hingga RM39,000. Harga bergantung kepada varian, jarak tempuh, dan sama ada pernah digunakan untuk e-hailing.' },
      { q: 'Axia generasi 1 atau generasi 2 lebih berbaloi?', a: 'Generasi 2 (2023) lebih besar, lebih selamat dan ada lebih banyak ciri keselamatan. Tapi harganya lebih tinggi. Generasi 1 lebih murah tapi ruang dalaman terhad.' },
      { q: 'Axia yang pernah jadi Grab boleh beli ke?', a: 'Boleh, tapi semak jarak tempuh dengan teliti. Kereta Grab biasanya ada jarak tempuh 80,000km ke atas dalam 3-4 tahun. Pastikan harga mencerminkan penggunaan tersebut.' },
    ],
  },
  'perodua-bezza': {
    brand: 'Perodua', model: 'Bezza',
    description: 'Perodua Bezza ialah sedan ekonomi paling popular di Malaysia. Boot besar, enjin 1.0L dan 1.3L, kos servis rendah. Semak harga pasaran sebelum beli.',
    priceRows: [
      { year: '2016', min: 26000, max: 38000 },
      { year: '2017', min: 28000, max: 40000 },
      { year: '2018', min: 30000, max: 42000 },
      { year: '2019', min: 33000, max: 46000 },
      { year: '2020', min: 36000, max: 50000 },
      { year: '2021', min: 38000, max: 52000 },
      { year: '2022', min: 40000, max: 55000 },
    ],
    buyerTips: [
      'Bezza 1.3L AV dan X lebih berbaloi kerana ada VSC dan kamera belakang',
      'Semak lampu belakang — Bezza lama ada isu kelembapan air masuk reflektor',
      'Rekod servis Perodua boleh disemak terus di service centre dengan nombor plat',
      'Pastikan tiada bunyi ketukan dari enjin 1.0L — isu stesen minyak RON 95 yang tidak konsisten',
    ],
    faqs: [
      { q: 'Berapa harga Bezza terpakai 2019?', a: 'Bezza 2019 terpakai biasanya antara RM33,000 hingga RM46,000 bergantung kepada varian dan jarak tempuh.' },
      { q: 'Enjin 1.0L atau 1.3L lebih bagus untuk Bezza?', a: '1.3L lebih berbaloi kerana tenaga lebih, gearbox CVT lebih baik, dan varian tinggi ada VSC. 1.0L cukup untuk bandar sahaja.' },
    ],
  },
  'proton-saga': {
    brand: 'Proton', model: 'Saga',
    description: 'Proton Saga adalah sedan nasional paling laris di Malaysia. Sejak dilancarkan semula pada 2016, ia menawarkan nilai terbaik dalam segmen sedan ekonomi. Semak harga sebelum beli.',
    priceRows: [
      { year: '2016', min: 20000, max: 30000 },
      { year: '2017', min: 22000, max: 32000 },
      { year: '2018', min: 24000, max: 35000 },
      { year: '2019', min: 27000, max: 38000 },
      { year: '2020', min: 30000, max: 42000 },
      { year: '2021', min: 32000, max: 45000 },
      { year: '2022', min: 34000, max: 48000 },
    ],
    buyerTips: [
      'Saga 2019 ke atas ada VSC — pilih varian ini untuk keselamatan tambahan',
      'Semak sama ada transmisi CVT atau AT — Saga lama ada isu CVT jika tidak diselenggara dengan betul',
      'Cat tiang B dan bawah pintu sering menunjukkan tanda karat pada Saga lama',
      'Minta penjual tunjukkan rekod servis di Proton Service Centre atau bengkel biasa',
    ],
    faqs: [
      { q: 'Berapa harga Proton Saga terpakai 2020?', a: 'Saga 2020 biasanya antara RM30,000 hingga RM42,000 bergantung kepada varian (Standard, Executive, Premium) dan jarak tempuh.' },
      { q: 'Saga CVT ada masalah ke?', a: 'Saga CVT yang tidak diselenggara dengan betul (tukar minyak setiap 40,000km) boleh ada isu slip. Tanya rekod penggantian minyak CVT sebelum beli.' },
    ],
  },
  'toyota-vios': {
    brand: 'Toyota', model: 'Vios',
    description: 'Toyota Vios ialah sedan Jepun paling popular di Malaysia. Dikenali sebagai kereta tahan lama dengan kos penyelenggaraan rendah dan nilai tukar ganti yang stabil.',
    priceRows: [
      { year: '2014', min: 36000, max: 50000 },
      { year: '2016', min: 40000, max: 56000 },
      { year: '2018', min: 48000, max: 64000 },
      { year: '2019', min: 52000, max: 68000 },
      { year: '2020', min: 55000, max: 72000 },
      { year: '2021', min: 58000, max: 76000 },
      { year: '2022', min: 62000, max: 80000 },
    ],
    buyerTips: [
      'Vios 2019 ke atas (facelift) ada 7 airbag dan VSC sebagai standard — pilih ini jika mampu',
      'Semak rekod servis di Toyota Service Centre — ia sangat mempengaruhi harga jualan semula',
      'Vios yang pernah digunakan untuk e-hailing atau teksi biasanya ada jarak tempuh sangat tinggi',
      'Warna putih dan silver lebih mudah jual semula di Malaysia',
    ],
    faqs: [
      { q: 'Berapa harga Toyota Vios terpakai 2019?', a: 'Vios 2019 biasanya antara RM52,000 hingga RM68,000 bergantung kepada varian (G, J, E) dan jarak tempuh. Varian G dengan rekod servis penuh boleh mencapai harga atas.' },
      { q: 'Vios atau City — mana lebih berbaloi dibeli terpakai?', a: 'Bergantung pada keutamaan. Vios lebih tahan lama dan lebih murah diselenggara. City ada ruang lebih luas dan lebih sporty. Semak harga kedua-dua di Paqar sebelum buat keputusan.' },
    ],
  },
  'honda-city': {
    brand: 'Honda', model: 'City',
    description: 'Honda City adalah sedan Jepun popular di Malaysia dengan ruang dalaman luas dan prestasi enjin yang baik. Nilai tukar ganti yang stabil menjadikannya pilihan pelaburan yang bijak.',
    priceRows: [
      { year: '2014', min: 38000, max: 54000 },
      { year: '2016', min: 44000, max: 60000 },
      { year: '2018', min: 52000, max: 68000 },
      { year: '2019', min: 56000, max: 74000 },
      { year: '2020', min: 60000, max: 80000 },
      { year: '2021', min: 65000, max: 86000 },
      { year: '2022', min: 70000, max: 92000 },
    ],
    buyerTips: [
      'City 2020 (generasi 7) sangat berbeza dari generasi sebelum — lebih besar, lebih selamat, honda sensing standard',
      'Semak rekod servis di Honda Service Centre — penyelenggaraan teratur penting untuk enjin VTEC',
      'Airbag curtain dan Honda Sensing hanya pada City 2020 ke atas — periksa varian sebelum beli',
      'Bunyi ketukan dari enjin pada idle boleh menandakan isu VTC actuator — biasa pada City 2009-2013',
    ],
    faqs: [
      { q: 'Berapa harga Honda City terpakai 2020?', a: 'City 2020 (generasi 7) biasanya antara RM60,000 hingga RM80,000 bergantung kepada varian dan jarak tempuh. City generasi ini adalah yang paling berbaloi kerana ada Honda Sensing.' },
      { q: 'City generasi berapa yang paling berbaloi dibeli terpakai?', a: 'Generasi 7 (2020-2023) paling berbaloi — ada Honda Sensing, lebih selamat, dan enjin lebih efisien. Tapi harga lebih tinggi. Generasi 6 (2014-2019) lebih murah tapi kurang ciri keselamatan.' },
    ],
  },
  'perodua-alza': {
    brand: 'Perodua', model: 'Alza',
    description: 'Perodua Alza adalah MPV 7-tempat duduk paling laris di Malaysia. Alza generasi baru (2022) adalah peningkatan besar dari generasi lama. Semak harga pasaran sebelum beli.',
    priceRows: [
      { year: '2015', min: 30000, max: 44000 },
      { year: '2017', min: 33000, max: 47000 },
      { year: '2019', min: 36000, max: 52000 },
      { year: '2021', min: 40000, max: 56000 },
      { year: '2022', min: 56000, max: 76000 },
      { year: '2023', min: 60000, max: 80000 },
    ],
    buyerTips: [
      'Alza 2022 ke atas berbeza sangat dari generasi lama — lebih besar, ada ADAS, harga berbeza',
      'Alza lama (sebelum 2022) ada isu pintu gelongsor yang kuat — semak semua pintu buka tutup lancar',
      'Baris ketiga Alza lama sangat sempit — pastikan sesuai untuk kegunaan anda',
      'Semak rekod servis kerana Alza yang kerap bawa penumpang ramai ada penggunaan lebih tinggi',
    ],
    faqs: [
      { q: 'Alza lama atau Alza baru yang lebih berbaloi dibeli terpakai?', a: 'Alza 2022 (baru) adalah kereta yang sama sekali berbeza — lebih besar, ada ADAS, lebih selamat. Jika bajet mencukupi, Alza baru lebih berbaloi. Alza lama lebih murah tapi kurang ciri.' },
      { q: 'Berapa harga Alza 2022 terpakai?', a: 'Alza 2022 terpakai biasanya antara RM56,000 hingga RM76,000 bergantung kepada varian (Active atau Advance) dan jarak tempuh.' },
    ],
  },
  'proton-x50': {
    brand: 'Proton', model: 'X50',
    description: 'Proton X50 adalah SUV kompak paling laris di Malaysia sejak dilancarkan pada 2020. Dengan teknologi terkini dari Geely, ia menawarkan nilai yang kompetitif dalam segmen B-SUV.',
    priceRows: [
      { year: '2020', min: 58000, max: 78000 },
      { year: '2021', min: 60000, max: 82000 },
      { year: '2022', min: 63000, max: 86000 },
      { year: '2023', min: 67000, max: 92000 },
    ],
    buyerTips: [
      'X50 ada 4 varian: Standard, Executive, Premium, dan Flagship — ciri keselamatan berbeza mengikut varian',
      'Semak rekod servis di Proton Edar — X50 baru ada waranti 5 tahun yang boleh dipindah',
      'Waranti asal 5 tahun / 150,000km boleh dipindah kepada pembeli baru — semak status waranti',
      'Semak sama ada ada tuntutan insurans kemalangan dalam rekod kerana X50 popular dan sering terlibat kemalangan kecil',
    ],
    faqs: [
      { q: 'Berapa harga Proton X50 terpakai 2021?', a: 'X50 2021 biasanya antara RM60,000 hingga RM82,000 bergantung kepada varian. Flagship dengan sunroof dan ADAS penuh ada harga lebih tinggi.' },
      { q: 'Waranti X50 terpakai masih sah ke?', a: 'Waranti asal Proton X50 adalah 5 tahun / 150,000km dan boleh dipindah kepada pembeli baru. Semak status waranti dengan nombor VIN di Proton Edar sebelum beli.' },
      { q: 'X50 atau Myvi — mana lebih berbaloi?', a: 'Bergantung pada keperluan. X50 adalah SUV dengan ruang lebih, teknologi lebih canggih tapi harga dua kali ganda Myvi. Untuk bandar sahaja, Myvi lebih jimat. Untuk keluarga atau perjalanan jauh, X50 lebih sesuai.' },
    ],
  },
}

type Props = { params: { model: string } }

export function generateStaticParams() {
  return Object.keys(MODELS).map(model => ({ model }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cfg = MODELS[params.model]
  if (!cfg) return {}
  return {
    title:       `Harga ${cfg.brand} ${cfg.model} Terpakai Malaysia 2025 | Paqar`,
    description: `Semak harga pasaran ${cfg.brand} ${cfg.model} terpakai Malaysia — range harga mengikut tahun, tip pembeli, dan verdict harga percuma.`,
    alternates:  { canonical: `https://paqar.my/harga-kereta-terpakai/${params.model}` },
    openGraph: {
      images: [{
        url:    `/api/og?title=Harga%20${encodeURIComponent(cfg.brand + ' ' + cfg.model)}%20Terpakai&subtitle=Semak%20harga%20pasaran%20sebelum%20beli`,
        width:  1200,
        height: 630,
      }],
    },
  }
}

export default function ModelPage({ params }: Props) {
  const cfg = MODELS[params.model]
  if (!cfg) notFound()

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Laman Utama', item: 'https://paqar.my' },
          { '@type': 'ListItem', position: 2, name: 'Harga Kereta Terpakai', item: 'https://paqar.my/harga-kereta-terpakai' },
          { '@type': 'ListItem', position: 3, name: `${cfg.brand} ${cfg.model}`, item: `https://paqar.my/harga-kereta-terpakai/${params.model}` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: cfg.faqs.map(faq => ({
          '@type': 'Question',
          name:    faq.q,
          acceptedAnswer: { '@type': 'Answer', text: faq.a },
        })),
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <Nav />
      <Shell>
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-6">

          {/* Hero */}
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
              {cfg.brand}
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Harga {cfg.brand} {cfg.model} Terpakai Malaysia
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              {cfg.description}
            </p>
          </div>

          {/* Price table */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#F3F4F6]">
              <h2 className="font-heading font-bold text-[14px] text-[#111827]">
                Anggaran harga pasaran {cfg.model} terpakai
              </h2>
              <p className="font-body text-[11px] text-[#9CA3AF] mt-0.5">
                Berdasarkan data pasaran semasa. Harga sebenar bergantung kepada varian, jarak tempuh, dan kondisi.
              </p>
            </div>
            {cfg.priceRows.map((row, i) => (
              <div key={row.year} className={`flex items-center justify-between px-5 py-3 ${i < cfg.priceRows.length - 1 ? 'border-b border-[#F9FAFB]' : ''}`}>
                <span className="font-heading font-bold text-[14px] text-[#111827]">{row.year}</span>
                <span className="font-body text-[13px] text-[#374151]">
                  RM{row.min.toLocaleString()} – RM{row.max.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* Check CTA */}
          <div className="space-y-3">
            <p className="font-heading font-bold text-[14px] text-[#111827]">
              Semak harga kereta {cfg.model} yang nak anda beli:
            </p>
            <DualCheckForm />
          </div>

          {/* Buyer tips */}
          <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5">
            <h2 className="font-heading font-bold text-[15px] text-[#111827] mb-3">
              Tip sebelum beli {cfg.model} terpakai
            </h2>
            <ul className="space-y-3">
              {cfg.buyerTips.map((tip, i) => (
                <li key={i} className="flex gap-2.5 font-body text-[13px] text-[#374151] leading-relaxed">
                  <span className="text-[#064E4A] font-bold flex-shrink-0 mt-0.5">{i + 1}.</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* FAQ */}
          <div className="space-y-2">
            <h2 className="font-heading font-bold text-[15px] text-[#111827] mb-1">Soalan lazim</h2>
            {cfg.faqs.map((faq) => (
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

          {/* Related guides */}
          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Panduan berkaitan</p>
            <Link href="/cara-beli-kereta-terpakai"   className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Cara beli kereta terpakai Malaysia →</Link>
            <Link href="/checklist-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Checklist sebelum bayar deposit →</Link>
            <Link href="/risiko-beli-kereta-terpakai"  className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Risiko beli kereta terpakai →</Link>
            <Link href="/harga-kereta-terpakai"        className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Semua model kereta terpakai →</Link>
          </div>

        </div>
      </Shell>
    </>
  )
}
```

- [ ] **Step 2: Create the hub page**

Create `app/harga-kereta-terpakai/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link              from 'next/link'
import { Nav }           from '@/components/layout/Nav'
import { Shell }         from '@/components/layout/Shell'

export const metadata: Metadata = {
  title: 'Harga Kereta Terpakai Malaysia 2025 — Semak Harga Pasaran | Paqar',
  description: 'Panduan harga pasaran kereta terpakai Malaysia mengikut model — Myvi, Axia, Vios, City, Saga dan lebih. Semak harga percuma sebelum bayar deposit.',
  alternates: { canonical: 'https://paqar.my/harga-kereta-terpakai' },
}

const MODELS = [
  { slug: 'perodua-myvi',  brand: 'Perodua', model: 'Myvi',  range: 'RM33k – RM74k', tag: 'Paling popular' },
  { slug: 'perodua-axia',  brand: 'Perodua', model: 'Axia',  range: 'RM20k – RM48k', tag: 'Paling berpatutan' },
  { slug: 'perodua-bezza', brand: 'Perodua', model: 'Bezza', range: 'RM26k – RM55k', tag: 'Sedan ekonomi' },
  { slug: 'proton-saga',   brand: 'Proton',  model: 'Saga',  range: 'RM20k – RM48k', tag: 'Nasional' },
  { slug: 'toyota-vios',   brand: 'Toyota',  model: 'Vios',  range: 'RM36k – RM80k', tag: 'Paling tahan lama' },
  { slug: 'honda-city',    brand: 'Honda',   model: 'City',  range: 'RM38k – RM92k', tag: 'Ruang luas' },
  { slug: 'perodua-alza',  brand: 'Perodua', model: 'Alza',  range: 'RM30k – RM80k', tag: 'MPV 7-tempat' },
  { slug: 'proton-x50',    brand: 'Proton',  model: 'X50',   range: 'RM58k – RM92k', tag: 'SUV kompak' },
]

export default function HargaKeretaTerpakaiPage() {
  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-6 pb-12 max-w-xl mx-auto space-y-6">
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
              Panduan Harga
            </p>
            <h1 className="font-heading font-extrabold text-[26px] text-[#111827] leading-tight mb-3">
              Harga kereta terpakai Malaysia 2025
            </h1>
            <p className="font-body text-[14px] text-[#6B7280] leading-relaxed">
              Pilih model untuk lihat anggaran harga pasaran mengikut tahun dan semak harga kereta yang anda minat — percuma.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {MODELS.map((m) => (
              <Link
                key={m.slug}
                href={`/harga-kereta-terpakai/${m.slug}`}
                className="flex items-center justify-between bg-white border border-[#E5E7EB] rounded-[12px] px-4 py-3.5 hover:border-[#064E4A] hover:bg-[#F0FDF4] transition-colors group"
              >
                <div>
                  <p className="font-heading font-bold text-[14px] text-[#111827] group-hover:text-[#064E4A] transition-colors">
                    {m.brand} {m.model}
                  </p>
                  <p className="font-body text-[12px] text-[#9CA3AF] mt-0.5">{m.range} · {m.tag}</p>
                </div>
                <span className="font-body text-[#9CA3AF] group-hover:text-[#064E4A] transition-colors flex-shrink-0 ml-3">→</span>
              </Link>
            ))}
          </div>

          <div className="space-y-2">
            <p className="font-heading font-bold text-[11px] uppercase tracking-[.07em] text-[#9CA3AF]">Panduan berkaitan</p>
            <Link href="/cara-beli-kereta-terpakai"      className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Cara beli kereta terpakai Malaysia →</Link>
            <Link href="/checklist-beli-kereta-terpakai" className="block font-body text-[13px] text-[#064E4A] underline underline-offset-2">Checklist sebelum bayar deposit →</Link>
          </div>
        </div>
      </Shell>
    </>
  )
}
```

- [ ] **Step 3: Add model pages to sitemap**

In `app/sitemap.ts`, add before the closing `]`:

```ts
    // Model price pages
    { url: `${base}/harga-kereta-terpakai`, lastModified: new Date('2025-06-19'), changeFrequency: 'monthly' as const, priority: 0.9 },
    ...['perodua-myvi','perodua-axia','perodua-bezza','proton-saga','toyota-vios','honda-city','perodua-alza','proton-x50'].map(m => ({
      url: `${base}/harga-kereta-terpakai/${m}`, lastModified: new Date('2025-06-19'), changeFrequency: 'monthly' as const, priority: 0.85,
    })),
```

Also add `/harga-kereta-terpakai/` and `/harga-kereta-terpakai/` to `robots.ts` allow list.

- [ ] **Step 4: Update robots.ts allow list**

In `app/robots.ts`, add `'/harga-kereta-terpakai/'` and `'/harga-kereta-terpakai'` to the allow array:

```ts
allow: ['/', '/panduan', '/panduan-semak-saman', '/cara-beli-kereta-terpakai', '/checklist-beli-kereta-terpakai', '/risiko-beli-kereta-terpakai', '/cara-semak-geran-kereta', '/cara-semak-roadtax-kereta', '/cara-semak-insurans-kereta', '/harga-kereta-terpakai', '/harga-kereta-terpakai/', '/privasi', '/terma'],
```

- [ ] **Step 5: Add hub link to homepage guide section**

In `app/page.tsx`, in the `PANDUAN PERCUMA` section guides array, add an entry:

```tsx
{ href: '/harga-kereta-terpakai', title: 'Harga kereta terpakai mengikut model', desc: 'Myvi, Axia, Vios, City, Saga & lebih' },
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add app/harga-kereta-terpakai/ app/sitemap.ts app/robots.ts app/page.tsx
git commit -m "feat: add model-specific SEO price pages for top 8 used car models"
```
