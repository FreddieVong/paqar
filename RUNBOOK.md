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

## Receipt delivery — interim daily routine

The receipt carries the **only** durable copy of an anonymous buyer's report
link (no account is required to purchase, and the claim token is not stored in
their browser). There is no automatic retry yet, so this is checked by hand.

**Who / how often:** the owner, once daily while volume is low. It takes under
a minute. Skip a day only if there were no purchases.

1. Open `https://paqar.my/admin/receipts` (sign in via `/admin/jomcheck` first).
2. **If it shows "Queue unavailable"** — that is a database error, NOT an empty
   queue. Fix that before assuming nothing is outstanding.
3. **Retry anything with `failed`.** Read `receipt_last_error` first:
   - `missing_claim_token` — the check was claimed into an account. The buyer
     can reach the report by signing in; retrying will not help. Contact them.
   - `send_failed: …` — a provider problem. Retry is the right action.
   - `claim_failed` — a database error during the claim. Retry.
4. **Do not use Force** on a row already `sent` unless the buyer has told you
   they never received it. Plain Retry is refused for a delivered row on
   purpose; Force exists to override that deliberately and will mail them again.
5. **If retry keeps failing,** contact the buyer on WhatsApp
   (+60 12-442 4221) using the `check_id` shown on the row as the reference.
   Never send them the claim token in a message — send the full report URL only
   if they ask for the link directly.
6. **Verify the recovery** by opening the report URL in a private window. It
   must load; the bare URL without `?claim_token=` must stay 404.

Rows with status `untracked (pre-026)` predate delivery tracking (before
2026-08-05). They are not evidence of a failure — leave them unless a buyer
reports a problem.

Full reconciliation, including which paid reports still have a route back:

```bash
set -a; . ./.env.local; set +a
npx tsx scripts/reconcile-receipts.ts
```
