# Marketing Phase 2 — Design Spec

**Approved:** 2026-06-19

## 1. Email capture on free verdict
After the verdict card renders in `OverpricedCheckerForm`, show an inline email form ("Simpan keputusan ini"). Calls `/api/capture-model-lead` which inserts into new `model_leads` table `(id, email, brand, model, year, asking_price, verdict, listing_count, created_at)`. No email sent immediately — just lead capture. New Supabase migration required.

## 2. Brand hub pages
Four static pages: `/harga-perodua-terpakai`, `/harga-toyota-terpakai`, `/harga-honda-terpakai`, `/harga-proton-terpakai`. Each lists that brand's models with price ranges, links to model pages. Added to sitemap + robots.

## 3. `/panduan` hub update
Add "Harga Mengikut Model" section at bottom of `/panduan/page.tsx` with cards for all 8 model pages.

## 4. Comparison pages
Four pages at `/bandingkan/[slug]`: `myvi-vs-axia`, `vios-vs-city`, `bezza-vs-saga`, `alza-vs-x50`. Side-by-side price table, pros/cons, DualCheckForm CTA. FAQPage + BreadcrumbList schema. Added to sitemap.
