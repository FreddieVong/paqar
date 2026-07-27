# Paqar — RM100 Accident/Claim Fulfilment Runbook

Follow this when a customer buys the **RM100 report** (or adds the **+RM88**
Accident/Claim check). Manual mode: you buy the JomCheck report, screenshot it,
and Paqar reads + emails the customer. Aim to finish **within 24 hours** — that's
what the customer's "sedang disemak" email promises.

---

## The loop (≈5 min per order)

1. **Order alert.** You get a Telegram message: `Order JomCheck baru — Plat / Email / RM…`.
   The customer already got a receipt + a "sedang disemak (24 jam)" email, and their
   report shows a spinner on the accident section — so you're covered while you work.

2. **Open the queue.** Go to **paqar.my/admin/jomcheck** → log in with the admin
   secret. The order card shows the **plate**, buyer email, and amount.
   > The queue is the source of truth. Even if a Telegram ping ever fails, the order
   > is here. Glance at this page daily.

3. **Buy the check.** Tap **"Buka JomCheck untuk plat ini →"**, log in to
   jomcheck.com.my, and buy the check for that plate.

4. **Screenshot** the **accident / claim table** (the rows with Date of Loss, Type of
   Claim, Type of Accident, Mileage, Severity). One or more screenshots is fine.

5. **Read it in.** In the order card: choose the screenshot file(s) → **"Baca dari
   gambar"**. The screenshot appears **side-by-side** with the rows Paqar read.

6. **Verify every row against the image** — Date of Loss, Mileage, Type of Claim,
   Type of Accident, Severity. Fix any misread, **+ Tambah baris** for a missed row,
   **Buang** for a junk one. Never send an unchecked read.

7. **Send.** Tap **"Semak selesai — Simpan & Hantar E-mel."** The customer is emailed
   automatically and their report updates live (with the severity badges, meter-at-claim,
   and the rollback banner if it applies).

---

## The other two outcomes

- **Plate has NO claim record** → tap the green **"Tiada Claim (0) ✓"**. Customer gets
  the clean "Tiada Rekod" result.
- **Plate not found / JomCheck has nothing to show** → tap **"Tidak dapat disemak (plat
  tiada rekod)"**. The order leaves the queue and the report shows the standard fallback.

## If "Baca dari gambar" fails (vision down / no API key)
Expand **"Masukkan bilangan claim secara manual"**, type the count for each category
(Own Damage / Banjir / Windscreen / Total Loss), and **Simpan & Hantar E-mel**. This
sends a count-only result (no meter/severity detail) but still fulfils the order.

---

## Config (set once, in Vercel)

| Variable | Purpose |
|---|---|
| `JOMCHECK_MODE=manual` | You fulfil by hand (no auto API charge) |
| `JOMCHECK_ENABLED=true` / `NEXT_PUBLIC_JOMCHECK_ENABLED=true` | Add-on is sellable |
| `ADMIN_SECRET` | Login for /admin/jomcheck |
| `ANTHROPIC_API_KEY` | Powers "Baca dari gambar" (falls back to manual counts if absent) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Owner order alerts (no-op if unset) |
| `RESEND_API_KEY` | Sends the customer emails |
