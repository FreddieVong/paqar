# Billplz Payment-Security — Deploy & Verify Checklist

The Billplz signature verification was fixed (HMAC algorithm was broken; redirect
verification was missing). Before this reaches customers, walk this checklist.
Code changes: commits `046b732` (foundation) + `7ca0ff4` (selesai integration).

RM12 = 1200 cents = base buyer report (no JomCheck add-on).

---

## PART A — Dashboard pre-flight (DO FIRST — before deploy)

### A1. Billplz dashboard
- [ ] Log in at billplz.com
- [ ] Settings → confirm **X Signature is ENABLED**
- [ ] Copy the **X Signature Key** (distinct from the API Secret Key)
- [ ] ⚠️ Do NOT use the API Secret Key (Settings → API). Wrong key = every signature fails.

### A2. Vercel dashboard
- [ ] vercel.com → Paqar → Settings → Environment Variables
- [ ] `BILLPLZ_X_SIGNATURE_KEY` exists in **Production** (not only Preview/Dev)
- [ ] Its value exactly matches A1 (re-paste to be safe — a trailing space breaks it)
- [ ] `BILLPLZ_API_KEY` + `BILLPLZ_COLLECTION_ID_BUYER` (or `BILLPLZ_COLLECTION_ID`) exist in Production
- [ ] If you edited anything, redeploy so it takes effect

**If A1 X Signature is off, or A2 key is missing/wrong → STOP. Deploying would break checkout.**

---

## PART B — Deploy
- [ ] Push `main` → Vercel deploy green (or deploy to a Preview URL to test off-prod first)

---

## PART C — RM12 live payment
- [ ] Open https://paqar.my on a real device
- [ ] "Saya ada nombor plat" tab → enter a real Malaysian plate → Semak Plat Percuma
- [ ] Choose **RM12 base report** (do NOT add JomCheck — that's RM100)
- [ ] Enter email → pay **RM12** via FPX/card
- [ ] Keep the tab — Billplz redirects back to `/laporan-pembeli/{checkId}/selesai?...`

---

## PART D — Verify both signatures worked

### D1. Redirect page (browser)
- [ ] ✅ Teal **"Pembayaran Berjaya"** card with the plate
- Yellow "Pembayaran sedang disahkan" → signature ok but paid/DB not confirmed (check D3)
- Red "Pembayaran tidak dapat disahkan" → redirect signature failed → key mismatch (recheck A1/A2)

### D2. Webhook log (THE critical check — was 401 before this fix)
- [ ] Vercel → Logs → filter `/api/webhooks/billplz`
- [ ] Find the POST from your payment
- [ ] ✅ **200** with `{ ok: true }`
- ❌ **401 "Invalid signature"** → webhook key still wrong / fix not live

### D3. Supabase
- [ ] Table Editor → buyer_reports → your row
- [ ] `status = 'paid'`, `amount_cents = 1200`
- [ ] Exactly one row, paid once (no duplicate)

### D4. Receipt + analytics
- [ ] Receipt email arrives once
- [ ] PostHog `payment_completed` + Google Ads conversion fire
- Note: GA4 `purchase` event NOT wired yet (GA4PurchaseEvent component is a later task)

---

## PART E — Tamper test (negative — prove fakes are rejected)

Using the same checkId from your real payment:
- [ ] Delete `&billplz[x_signature]=...` from the URL, reload → ✅ red "tidak dapat disahkan"
- [ ] Change one char in `billplz[id]`, reload → ✅ invalid, no new paid row in Supabase
- [ ] Valid signed URL but swap path to a different checkId you own → ✅ invalid

(These three cases are also covered by the unit test suite — this is the E2E confirmation.)

---

## Pass/fail line

| Check | Pass |
|---|---|
| Webhook log | **200** (was 401 before fix) |
| Redirect page | "Pembayaran Berjaya" |
| Supabase | status=paid, one row |
| Receipt | Arrives once |
| Tamper/unsigned URL | Red, no DB change |

When **D2 = 200** and **PART E is rejected**, payment verification is confirmed
fixed — not just unit-tested. Until a live payment shows D2=200, describe it as
"implemented and unit-tested," not "fixed in production."
