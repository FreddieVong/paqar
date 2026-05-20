# Homepage Redesign — Donald Miller × Alex Hormozi
**Date:** 2026-05-21  
**Scope:** app/page.tsx + RM12 upsell card (components/check area)

---

## Context

The current homepage describes the product clearly but doesn't speak to the buyer's fear, name the information asymmetry between sellers and buyers, or stack the value of the RM12 report. Three gaps — hero copy, RM12 card, and missing social proof — are the highest-leverage changes to conversion.

---

## Change 1 — Hero Section Copy

**File:** `app/page.tsx` (hero section, lines 20–38)

### Headline
```
Before: "Semak sebelum beli\nkereta terpakai."
After:  "Penjual tahu harga sebenar.\nSekarang anda pun tahu."
```

### Subheadline (new — add below h1, before `<HomeCheckerTabs />`)
```
"Dalam 60 saat, tahu sama ada harga tu patut atau mahal. Percuma. Tanpa daftar."
```

**Rationale:** Current headline describes the action, not the buyer's fear. New headline names the villain (information asymmetry) and positions Paqar as the equaliser. Subheadline surfaces the speed promise and removes the two main friction points (cost + signup) in one sentence.

---

## Change 2 — RM12 Report Upsell Card

**Location:** The "Apa Yang Boleh Disemak" section in `app/page.tsx` (lines 41–67), and any payment gate component that shows the report offering.

Replace the flat "Laporan Pembeli" card with a structured card:

### Structure

**Hero block** (dark green `#14453d` background):
- Eyebrow label: `SKRIP RUNDINGAN HARGA PAQAR`
- Headline: `"Masuk rundingan dengan data. Bukan agak-agak."`
- Subtext: `"Guna skrip siap untuk tanya soalan penting, runding harga, dan elak buat keputusan ikut emosi."`

**Value stack** (4 items with checkmarks):
1. **Skrip rundingan harga** — "Bantu anda bincang harga berdasarkan data, bukan agak-agak."
2. **Harga pasaran sebenar** — "Tahu sama ada harga kereta itu mahal, wajar atau berbaloi."
3. **Data JPJ penuh** — "Semak maklumat penting sebelum buat keputusan."
4. **10 soalan untuk penjual** — "Tanya soalan yang boleh dedahkan masalah tersembunyi."

**Price anchor line:**
```
"Untuk pembelian kereta bernilai ribuan ringgit, laporan penuh hanya RM12."
```

**CTA button:**
```
"Dapatkan Skrip + Laporan — RM12"
```

**Trust microcopy below CTA:**
```
"Sekali bayar. Terus dapat laporan."
```

### Design tokens
- Hero block bg: `#14453d`
- Check icons: `#14453d` filled circle, white SVG checkmark
- RM12 pill on CTA button: `#FACC15` bg, `#14453d` text
- Price anchor bg: `#F8FAF7`
- Card border-radius: `18px`

---

## Change 3 — Stakes Section (new section)

**Location:** New section inserted between "Cara Ia Berfungsi" and the dark CTA banner in `app/page.tsx`.

**Ships immediately — no user data required.**

```
Section background: #1C1917 (near-black warm)

Eyebrow: "Kenapa perlu semak dulu"

Headline:
"Penjual tahu.
Ramai pembeli tidak."
  — "tidak" in amber (#F59E0B)

Body:
"Harga pasaran berubah ikut model, tahun, warna, dan rekod kenderaan. Penjual yang
berpengalaman tahu semua ini. Kebanyakan pembeli tidak — dan perbezaan itu yang
selalu menyebabkan pembeli bayar lebih."

Divider (1px, rgba(255,255,255,0.07))

Two points:
⚠️  "Harga yang 'nampak berpatutan' belum tentu sepadan dengan harga pasaran
     sebenar untuk kereta tu."
✅  "Paqar bagi anda maklumat yang sama — dalam 60 saat, percuma, sebelum anda
     buat sebarang keputusan."
```

---

## Change 4 — Testimonials Section (template, ship when ready)

**Location:** Same position as Change 3, or directly below it once quotes are available. Do not publish with placeholder content.

**Template structure per card:**
- 5-star rating
- 1–2 sentence quote (outcome-focused)
- Author name + city
- Car make/model/year
- Outcome badge (e.g. "Jimat RM3,000" in green)

**Collection prompt for users:**
> "Berapa anda jimat? Atau apa yang paling membantu sebelum beli?"

Minimum 2 real quotes before publishing this section. One strong outcome quote outperforms any stats section.

---

## What was intentionally kept

- "Cara Ia Berfungsi" (3-step section) — strong as-is, no changes
- "Panduan Percuma" guides section — good SEO/trust builder, no changes
- FAQ section — no changes
- "Percuma · Tanpa daftar akaun" trust badge in hero — keep exactly as is
- Footer — no changes

---

## Verification

1. Hero: confirm new h1 and subheadline render correctly on mobile (375px) — headline should not wrap awkwardly
2. RM12 card: confirm hero block, stack items, price anchor, and CTA all visible without scrolling on iPhone SE (375×667)
3. Stakes section: confirm amber text renders at sufficient contrast against dark background
4. Run `next build` to confirm no TypeScript errors from copy changes
5. Check count in hero (`countDisplay`) still wires up correctly — no changes to that logic
