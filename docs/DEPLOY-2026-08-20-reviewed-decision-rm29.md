# Reviewed decision — RM12 free-verdict product → RM29 human-reviewed report

**Recorded 2026-08-20, before deployment. Branch `fix/proof-before-paywall`.**

This is a product change, not a fix. It removes the free verdict, raises the base
report to RM29, and makes every paid report pass a human before the buyer sees it.

---

## Why

A Reddit tester asked three questions the product could not answer: why pay RM12
when Mudah is free, why pay RM100 when SCRUT is RM80, and what Paqar offers that
the majors do not. The funnel agreed — 3 genuine customers, RM36 lifetime, ~21%
paywall engagement, 0% payment.

The cause was the free/paid boundary. **Free returned the verdict** (MAHAL /
WAJAR / BERBALOI); **RM12 returned the median behind it.** Paqar gave away the
answer and charged for the footnotes, and the footnotes were exactly what a
buyer can eyeball on Mudah. Every free check also burned RM0.81 of RegCheck
credit on a stranger converting at roughly zero.

## The new shape

```
brand + model + year + price  (plate now OPTIONAL)
  → coverage check — cache read only, RM0, NO verdict
  → RM29, 24h wait disclosed BEFORE the button
  → RegCheck RM0.81 fires HERE, from the Billplz webhook
  → internal draft — the buyer sees a waiting screen
  → human reviews in /admin/review, writes a note, releases
  → report unlocks + email; or one-click refund
```

## ⚠️ Manual step — apply BEFORE deploying

`supabase db push` does not work on this project. Paste
`supabase/migrations/032_concierge_review.sql` into the Supabase SQL editor.

It adds `checks.listing_url`, `checks.buyer_concern`, `checks.brand/model/year`,
`buyer_reports.released_at/reviewer_note/refund_state`, drops NOT NULL from
`checks.plate_encrypted` and `checks.plate_hash`, and adds a partial index for
the review queue.

**Deploying the code without the migration breaks check creation**: the route
writes `brand`/`model`/`year` on insert.

`ADMIN_SECRET` must be set, or `/admin/review` 404s and nothing can be released.

## Key files

| File | Change |
|---|---|
| `lib/report-release.ts` | new — `mayRenderReport` requires paid **and** released |
| `lib/pricing.ts` | new — single source for every price, in both units |
| `lib/listing-intake.ts` | new — http/https allowlist; the URL becomes an `href` in an authenticated admin page |
| `lib/vehicle-lookup-trigger.ts` | new — the RM0.81 call, extracted out of `/api/checks` |
| `lib/db/report-review.ts` | new — guarded release write |
| `lib/email/report-ready.ts` | new — delivery message, led by the human note |
| `components/check/ListingIntakeForm.tsx` | new — one form; `DualCheckForm` is now a wrapper over it |
| `components/report/UnderReviewNotice.tsx` | new — the waiting screen |
| `components/report/ReviewerNote.tsx` | new — the human note, above the machine output |
| `app/admin/review/` | new — the release queue |
| `app/api/price-check/route.ts` | rewritten — returns `{ eligible, modelLabel }`, never a verdict |
| `app/api/checks/route.ts` | plate optional; **no provider call at all** |
| `app/laporan-pembeli/[checkId]/page.tsx` | release gate + authenticated `?admin_preview=1` |
| `lib/admin-auth.ts` | cookie path `/admin` → `/` so the reviewer can read drafts |
| `vitest.config.ts` | exclude `.claude/worktrees/**` |

## Behaviour changes worth watching

- **`/api/price-check` no longer returns `verdict`, `confidence` or `hasData`.**
  Any external consumer of that shape breaks.
- **Every paid report is invisible until released.** If nobody works the queue,
  buyers wait and the 24-hour promise is broken. `/admin/review` shows overdue
  rows in red.
- **`analytics.paymentFormSubmitted` tier** now emits `rm29`; `rm12` is retained
  in the type so funnels spanning the change can tell the products apart.
- **The RM88/RM100 JomCheck add-on is unchanged and still dormant.** The
  tester's second objection remains live on
  `/semak-accident-claim-insurans-kereta` and inside the paid report.

## Verification performed

- `npx tsc --noEmit` — clean
- `npx vitest run` — 121 files, 1917 tests, all passing
- `npx next build` — succeeds; `/` still prerenders static with the intake form
  in the HTML (load-bearing for organic search)

## Not verified

No end-to-end run against a real Billplz sandbox payment, and no migration
applied yet — so the release gate, the webhook lookup and the refund flag have
not been exercised against a live database.

---

## Since then — recorded 2026-08-23

This note was written before deployment and left uncommitted for three days.
Committing it as the record of a deploy that did happen; the two sections above
that have gone stale are corrected here rather than edited, so the note stays a
snapshot of what was known on the 20th.

**"Not verified" is now closed.** Migration 032 was applied by hand in the
Supabase editor. A real RM29 payment ran end to end on 2026-08-22 — Billplz
charged, the webhook signature verified against a genuine payload, the report
released, and the write-up took 2 minutes against the 30-minute estimate.

**"The RM88/RM100 add-on is unchanged and still dormant" is no longer true.**
The second human review it was missing now exists — records arrive at
`jomcheck_status = 'success'`, a reviewer reads them against the decision
already written, and only their release reaches the buyer. It is live at RM117
(29 + 88, derived rather than typed; the old RM100 was a leftover from the RM12
base and would have shown one price while billing another).

**What the deploy did not survive contact with**, all found by using the live
site rather than reading it:

- No release email had ever been sent. The notifications were floating promises
  in a Server Action, and the invocation freezes once its response is sent.
- Five of the six cron jobs were never registered — the plan allows two — so
  the 30-day screenshot deletion `/privasi` promises had never run once.
- Coverage refused every first visitor to an uncached model-year, then warmed
  the cache behind them.
- The report token was reaching PostHog, Google and Meta on every view.

Each is fixed and guarded by a test. The lesson worth carrying forward is the
shape they share: every one was a mechanism that was built, never exercised,
and reported success from the half that worked.
