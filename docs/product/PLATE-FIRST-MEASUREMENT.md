# Plate-first measurement regime

Read-only. Counts only. No schema change, no cron, no dashboard, no tracking
event, no customer-facing surface.

```bash
pnpm dlx tsx scripts/measure-plate-first.ts
pnpm dlx tsx scripts/measure-plate-first.ts --spend ./spend.json
```

`tsx` is fetched on demand by `dlx`, so `package.json` and `pnpm-lock.yaml` are
unchanged.

- Definition: [lib/measurement/plate-first-cohort.ts](../../lib/measurement/plate-first-cohort.ts)
- Fixtures: [__tests__/lib/plate-first-cohort.test.ts](../../__tests__/lib/plate-first-cohort.test.ts) — 36 tests, never contacts production
- Reader: [scripts/measure-plate-first.ts](../../scripts/measure-plate-first.ts)

The definition lives in a library and the script only reads rows. That split is
the point: the denominator can be argued with in tests, before anyone sees a
result, and it cannot be quietly reshaped afterwards.

---

## Regime

**Start: `2026-08-16T04:47:22Z`** — the instant the plate-first journey went
live in production.

Deployments inside the regime are **annotated, not pooled and not treated as
new experiments**:

| Timestamp | Change |
|---|---|
| `2026-08-16T04:47:22Z` | plate-first journey live (regime start) |
| `2026-08-16T05:01:33Z` | paywall provenance copy corrected |
| `2026-08-16T08:00:46Z` | verdict wording rescoped; plate input 44px |

Data from the abandoned Meta creative experiment is **never** pooled with this
regime.

---

## A qualified plate journey

All of these must hold:

1. **A `checks` row exists.** Only the plate paths create one — the model tab
   calls `/api/price-check` and never `/api/checks` — so a check *is* a plate
   journey.
2. **Created at or after the regime start.**
3. **A valid asking price was supplied.** There is no `asking_price` column on
   `checks`, and none was invented. It isn't needed: since the plate-first
   release `/api/checks` rejects a body without a well-formed `askingPriceRm`
   (400, no row written), so after the regime start *the existence of the row is
   the proof*. Pinned by `__tests__/api/checks-asking-price-gate.test.ts`.
4. **The vehicle lookup resolved** — the per-journey `plate_lookup_succeeded`
   event, which `/api/checks` writes from the *persisted terminal status*.
   Deliberately **not** read from `plate_lookup_cache.lookup_status`, which is
   the plate's current state and can change after the journey ends.
5. **The free result was reached** — `plate_price_evidence_viewed`, or a verdict
   shown **or suppressed**. A suppressed verdict counts: the product saying "we
   cannot judge this" is a delivered outcome, and dropping it would flatter the
   denominator.

### Deduplication

**One journey per `(session_id, plate_hash)`, earliest check wins.**

Justified by the app's own key: `getCachedCheck(plateHash, sessionId)` hands a
returning visitor their existing check for the same plate, so distinct rows
already approximate distinct journeys. This rule closes the residual case where
a re-check after payment forces a fresh row.

It deliberately does **not** collapse by session — **a buyer comparing three
cars is three journeys**, which is exactly the behaviour the product wants.

### Exclusions

| Reason | Rule |
|---|---|
| `before_regime` | created before the regime start |
| `qa_session` | `session_id` starts with `qa_attr_` (the documented attribution QA traffic) |
| `qa_plate` | the repo's documented test-fixture plate, hashed with the app's own `hash()` so the exclusion is auditable rather than an opaque literal |
| `internal_utm` | `ad_sessions.utm_source = 'internal'` |
| `team_purchase` | a linked purchase whose email is `isTeamEmail()` |
| `no_vehicle_resolved` | provider failure, timeout or not-found |
| `no_free_result` | never reached a free result |
| `duplicate_journey` | same `(session, plate)` seen already |

A purchase whose owner is **unknown** (`buyer_email` null) stays in the
denominator but is **not** counted as a purchase. `isTeamEmail()` defaults an
absent address to "internal", which is right for "should I email this person"
and wrong for revenue — so the null case is handled explicitly.

---

## Numerator

Settled external **RM12** purchases (`status = 'paid'`, `amount_cents = 1200`,
non-team) linked to a qualified journey, paid **within 7 days** of the check.

- Purchases after the window are counted and reported **separately**, never
  folded into conversion.
- **Refunds are reported separately** — see the gaps below.

## Right-censoring

A journey is **mature** once it has had the full 7 days to convert. Immature
journeys are counted and shown, but excluded from the conversion denominator.
Including them would understate conversion by counting journeys that have not
yet had their chance.

---

## Predefined decisions

Fixed before any result was read, and pinned by tests.

| Point | Result | Decision |
|---|---|---|
| 100 mature | ≤1 purchase | **Early failure** — 7% floor already excluded |
| 100 mature | ≥2 purchases | Continue to 200 |
| 200 mature | ≤6 purchases | **Floor excluded** |
| 200 mature | 7–21 purchases | **Inconclusive** — the interval spans 7%. Not a win. |
| 200 mature | ≥22 purchases | **Floor cleared** — business break-even still **unproven** |

**7% is the provider-cost floor only** (RM0.81 ÷ RM12). Billplz fees, refunds,
support and per-channel acquisition cash all sit on top of it, so clearing it is
necessary and *not* sufficient.

95% Wilson intervals, which the boundaries above are derived from:

| Result | Interval | Meaning |
|---|---|---|
| 1/100 | upper ≈5.4% | excludes 7% |
| 6/200 | upper ≈6.4% | excludes 7% |
| 14/200 | spans 7% | inconclusive |
| 22/200 | lower ≈7.4% | clears 7% |

---

## Channels

Split by `classifyTrafficSource` (rules **R1–R6** in `lib/traffic-source.ts`):
`paid`, `organic_search`, `ai_assistant`, `referral`, `direct_or_unknown`.

**Cash acquisition cost is never assumed to be zero.** It is not derivable from
any table, so it must be supplied:

```json
{ "organic_search": 0, "referral": 250.00, "direct_or_unknown": 0 }
```

Anything absent prints **`NOT SUPPLIED`**, not `0`. Founder time, creator
arrangements, community effort and partnerships all cost something; treating
them as free is how a channel gets mistaken for profitable.

---

## Measurement gaps

These are limits of the data, not of the script.

- **Refunds — not measurable.** No refund column exists in any table, and the
  Billplz bill object this codebase reads exposes only
  `{paid, state, amount, paid_at}`. **0 recorded is not 0 proven.** Reconcile
  from the Billplz dashboard before quoting net revenue.
- **`plate_form_engaged` — not joinable.** It is PostHog-only and property-free
  by design, so it never reaches `ad_events` and cannot be tied to a journey
  here. Read it in PostHog against `check_started` for the gate-abandonment
  rate. *(Note: PostHog's bot filter drops captures from automated browsers, so
  it cannot be verified with a headless tool — see the delivery audit.)*
- **Team activity in the denominator.** Internal use is identifiable only
  through a purchase email or `utm_source=internal`. Team browsing that never
  buys stays in the denominator.
- **Settlement.** `status='paid'` is Paqar's entitlement, written after Billplz
  signature verification. Billplz is the money truth — run
  `scripts/reconcile-payments.ts` before quoting revenue.
- **Provider cost is an estimate and a floor.** A plate whose cache row was
  fetched at or after the journey started counts as billable; retries are not
  visible per journey, so real spend is higher. Not reconciled to actual
  billing.
- **Channel visibility.** `referrer` has only been recorded since the
  attribution deploy, so pre-regime sessions cannot be reclassified. Browsers
  suppress referrers routinely, so `direct_or_unknown` genuinely mixes typed,
  bookmarked, suppressed and in-app traffic — it is not "direct".
