# Integrated buyer-decision audit — 2026-08-15

Run 2026-08-16 on branch `product/integrated-buyer-decision-audit`, worktree
`.claude/worktrees/integrated-buyer-decision-audit`, based on production
`origin/main` = `43e12dd`.

Evidence markers: `[repository-proven]` read from code on `43e12dd` ·
`[measured]` observed this session from production aggregates or live public
sources · `[user-supplied]` given in the brief · `[inference]` reasoned from
the two · `[unsupported]` cannot be established with what is available.

Supersedes nothing. Reads, but does not merge,
`product/listing-decision-audit` (`2c6c635`) and
`feat/lower-priced-comparable-count` (`b9985b7`).

---

## 1. Executive verdict

**Gate C.** The integrated journey — *listing price → official vehicle identity
→ fair offer → claim/history risk → deposit decision* — is **not** Paqar's
defensible product, because a competitor already ships it, from a plate,
instantly, today.

SCRUT (scrut.my) accepts a **registration number or VIN** and returns, in one
report: insurance claim history with dates and severity, total-loss flag, flood
flag, theft flag, last reported mileage with a tampering warning, chassis and
engine number, a **current market valuation**, and the **latest 10 comparable
vehicles for sale with pricing and mileage** — delivered instantly after payment
`[measured]`. That is the brief's five-stage journey, minus the negotiation and
deposit steps.

The claim/history leg is worse than commodity — it is **resold commodity at an
uncompetitive price and speed**:

| | Input | Claim/history source | Price | Turnaround |
|---|---|---|---|---|
| **Paqar RM100 / +RM88** | plate | JomCheck (MRC), bought by hand | **RM100** | **≤24 h, manual** `[repository-proven]` |
| METACAR | registration no. | **JomCheck (MRC)** — same upstream | **RM80** | instant `[measured]` |
| Otofacts Premium | VIN/chassis **only** | industry claims | RM89.99 | instant `[measured]` |
| SCRUT (SUR) | plate **or** VIN | industry claims | 80 credits | instant `[measured]` |

Paqar sells the *same* Bank-Negara-concession data as METACAR, for **RM20 more**,
**24 hours slower**, fulfilled by a human `[measured]` + `[repository-proven]`.

The production numbers agree, and they are unambiguous:

- **Every purchase Paqar has ever taken came through the plate journey.** All 27
  paid rows carry a `check_id` `[measured]`.
- **The model-price journey is 65.3% of all journeys and 0% of all revenue**
  `[measured]`.
- **The claim/history product has never been bought by anyone outside the team.**
  Zero external RM100 sales; the +RM88 upgrade path has **never been used by
  anybody, once** `[measured]`.
- Lifetime external revenue is **RM36** (3 × RM12). Plate-provider spend is
  **≈RM132** `[measured]` + `[inference]`. Paqar has spent roughly **3.7× its
  entire revenue** on free plate lookups.

What survives the audit is narrower than the brief's hypothesis and is **not a
moat**: it is a *packaging and workflow advantage on commodity data*. Nobody
else converts a plate into **a fair offer band, a copy-paste BM negotiation
script, seller questions, and a deposit checklist** — SCRUT and Otofacts
explicitly do not `[measured]`. That layer is easily copied, so it is defended
by focus and speed, never by data.

**Recommended wedge: plate-anchored *decision*, not plate-anchored *data*.**
Keep the plate as the entry. Sell RM12 as "what to offer and what to check
before you pay deposit". Demote claim/history from the thesis to a clearly
labelled, honestly-priced add-on. Do not build the integrated journey as a
differentiator; it is already someone else's product.

---

## 2. Paqar capability truth

### 2.0 Production versus prepared local work — a correction that matters

The prior audit (`product/listing-decision-audit`) was based on `b9985b7`, the
tip of `feat/lower-priced-comparable-count`, which is **5 commits ahead of
`origin/main` and unmerged** `[measured]`.

Consequently `lib/free-price-evidence.ts` and `lib/lower-priced-listings.ts`
**do not exist in production** `[repository-proven]`. The
"`Kami jumpa N iklan … harga lebih rendah`" count that the prior audit spent
§12 criticising **never shipped**. Production's free tier is *thinner* than that
audit's boundary table (§11) describes.

Production free tier, enforced at the type level in
[types/api.ts:72-86](types/api.ts#L72-L86): a verdict, a verdict status, a
suppression reason, a confidence band, a cohort mode, a variant token and a
fetch timestamp. **No median, no range, no count, no number of any kind**
`[repository-proven]`.

### 2.1 Manual free check (model tab)

| | Truth |
|---|---|
| Inputs | brand, model, year, askingPrice — all free text/number `[repository-proven]` |
| Verdict | `good_deal` / `fair_price` / `slightly_high` / `overpriced`, from asking vs cohort min/max, with an 8% band above max `[repository-proven]` — [route.ts:36-41](app/api/price-check/route.ts#L36-L41) |
| Confidence | counts **adverts**, not sellers: ≥10 high, ≥3 medium, else low `[repository-proven]` |
| Cohort quality | built by `buildComparableCohort`, same pipeline as the paid report — year filter, outlier trim, recon and performance-variant exclusion `[repository-proven]` |
| Comparable sources | **Mudah only.** `scraper/src/scrapers/` contains exactly one scraper `[repository-proven]` |
| Data freshness | `CACHE_TTL_DAYS = 7`; no liveness or sold check anywhere `[repository-proven]` |
| Buyer next action | a verdict badge and a sub-line; the model tab creates **no check**, so it can never reach the teaser or the paywall `[repository-proven]` |

**The finding that decides Phase 7.** Of model-journey results that emitted an
outcome, **70 were `model_result_no_data` against 59 `model_result_shown` —
54.3% of the time the free model checker cannot answer at all** `[measured]`.
Both events were instrumented together, so the ratio is valid even though the
absolute counts sit inside a shorter window than `valuation_started`.

### 2.2 Plate journey

| | Truth |
|---|---|
| Provider | **RegCheck / `CheckMalaysia`**, operated by Infinite Loop Development Ltd (Ireland) `[measured]` — [vehicleapi.ts:22](lib/vehicleapi.ts#L22) |
| Cost | **£0.15 per lookup**, min. blocks of 100, published by the provider `[measured]`; recorded in-repo as RM0.81 `[repository-proven]` |
| Official fields returned | description, registrationYear, make, model, body, engineCc, **VIN**, **NVIC**, insurance {insurer, coverType, policyStatus}, imageUrl `[repository-proven]` |
| Variant/year resolution | registration year is authoritative; **variant is inferred from the `description` string**, not a structured field `[repository-proven]` |
| Compared against buyer/listing claims | `Semakan Varian` (record vs advertised variant, curated ladder), `Semakan Mileage` (claimed reading vs plausible km/year), insurance status `[repository-proven]` |
| Failure/suppression states | `found` / `not_found` / `provider_timeout` / `provider_error`, kept strictly apart; one retry on transient only `[repository-proven]` |
| Second provider call required? | **No** for identity. **Yes** for claim history — that is a separate JomCheck purchase `[repository-proven]` |
| Buyer friction | one field, no account, no email `[repository-proven]` |
| Persistence | `plate_lookup_cache` keyed by plate; not-found retried after 7 days `[repository-proven]` |
| Abuse guard | 5 **new** plates per IP per day (`Ratelimit.slidingWindow(5,'1 d')`); cached plates never re-bill `[repository-proven]` |

**Measured resolution quality — this is Paqar's strongest operational fact.**
Across 152 distinct plates in `plate_lookup_cache`, 127 carry a terminal status
`[measured]`:

| Terminal status | Count | Share of terminal |
|---|---:|---:|
| `found` | 113 | **89.0%** |
| `provider_timeout` | 11 | 8.7% |
| `provider_error` | 3 | 2.4% |
| **`not_found`** | **0** | **0.0%** |
| (null / pre-instrumentation) | 25 | — |

**Official vehicle identity has never once failed to exist for a plate a real
buyer typed.** The only failure mode is provider unavailability, which a retry
already addresses. "The buyer's plate isn't on record" is a problem Paqar does
not have.

**Copy defect — provenance.** Both the paid report and the public sample label
the vehicle block **`Sumber: JPJ`**
([BuyerReportContent.tsx:832](components/report/BuyerReportContent.tsx#L832),
[SampleReportPreview.tsx:290](components/report/SampleReportPreview.tsx#L290))
`[repository-proven]`. The provider names **no** Malaysian source, stating only
that "data is requested in real time from official government data sources"
`[measured]`. Paqar cannot substantiate "JPJ". This is an unsupported
provenance claim and should be corrected to something Paqar can defend.

### 2.3 RM12 — Laporan Pembeli

Delivered `[repository-proven]`:

- **Fair-price evidence** — median ("Harga tengah pasaran"), min–max range, and
  the individual advert prices as chips. Aggregates render **only** when
  `evaluateVerdictEligibility` passes, so a one-advert cohort cannot print a
  "market median".
- **Exact gap and suggested offer** — `offerHigh = floorClean(median)`;
  `offerLow = 0.90 × offerHigh` when overpriced, else `0.93 ×`
  ([BuyerReportContent.tsx:153-158](components/report/BuyerReportContent.tsx#L153-L158)).
  Anchored to the **median**, not the max — the correct negotiation anchor.
- **Negotiation range + script** — four verdict-specific BM scripts, plus a
  *follow-up* script for when the seller says the price is final. Copy-paste.
- **Trade-in** — 80–85% of median, suppressed for special variants.
- **Clickable comparables** — price chips link out **only** when the URL
  resolves to a single advert; otherwise the price still renders, unlinked
  ([listing-url.ts](lib/listing-url.ts)). Fix landed on `main` via `4c7ecc7`.
- **Questions / checklist** — `Soalan Wajib Tanya Seller` (base + car-specific)
  and `Checklist sebelum bayar deposit`.
- **JPJ-linked information** — year, engine cc, body, masked VIN, insurance
  status, `Semakan Varian` ladder, `Semakan Mileage` plausibility.

Source quality and freshness: **Mudah only**, ≤15 adverts per cohort, relevance-
ordered, up to 7 days stale, no liveness check `[repository-proven]`.

**Measured cache state — better than the prior audit found, and still capped.**

| | Prior audit (`b9985b7`) | Now `[measured]` |
|---|---:|---:|
| Cohorts cached | 58 | **335** |
| Distinct models | 17 | **151** |
| Cohorts **within the 7-day TTL** (actually serveable) | — | **155 of 335 (46.3%)** |
| Of those fresh cohorts, at the 15 cap | — | **135 (87.1%)** |
| Fresh cohorts below the verdict minimum | — | **0** |
| Mean listings per fresh cohort | 14.36 | 14.03 |

Coverage has widened a lot. The **cap has not moved**: 87.1% of serveable
cohorts are truncated at 15, so Paqar still judges a market through a
relevance-ordered slot of fifteen adverts.

**Copy defect — overclaim, unfixed.** The methodology line still reads
`Berdasarkan {n} listing serupa di pasaran`
([BuyerReportContent.tsx:594-597](components/report/BuyerReportContent.tsx#L594-L597)),
and the negotiation scripts the buyer *pastes to a seller* say
`Saya dah semak {n} listing serupa di pasaran`
([:776-778](components/report/BuyerReportContent.tsx#L776-L778))
`[repository-proven]`. Over a ≤15, relevance-capped, single-site, 7-day-stale
sample, "di pasaran" claims a market Paqar has not seen. The prior audit
flagged this as item #3; it is still live on `main`.

### 2.4 RM100 / +RM88 — Semakan Accident/Claim

| | Truth |
|---|---|
| Evidence delivered | per-incident date of loss, claim category (accident/flood/windscreen/total_loss), accident type, **mileage at claim**, severity band, constructive-total-loss flag `[repository-proven]` |
| Derived findings | `assessHistoryRisk` elevates CTL/total-loss/`severe`/**odometer rollback** above the price verdict; `detectMileageRollback` compares claim mileage to current odometer `[repository-proven]` |
| Fulfilment | **manual**: owner buys the JomCheck report, screenshots the claim table, Paqar vision-parses it, owner verifies **every row** against the image, then sends `[repository-proven]` — [RUNBOOK.md](RUNBOOK.md) |
| Provider | JomCheck, operated by **Motordata Research Consortium**, which holds a **Bank Negara Malaysia concession** to collect industry-wide insurance claim data since 2000 `[measured]` |
| Marginal cost | JomCheck's own per-check price is **not public** `[unsupported]`. METACAR resells the same data at **RM80** `[measured]`, which bounds the retail cost of a check |
| Turnaround | **≤24 hours**, promised in the customer's email `[repository-proven]` |
| Claim categories | accident · flood · windscreen · total loss `[repository-proven]` |
| Limitations | dedupes JomCheck's multi-approval rows into real incidents (WPH925: 3, not 7); `amount` is always null and renders "—", never 0 `[repository-proven]` |

**Language discipline — verified sound.** The homepage FAQ states plainly:
*"tidak semua kemalangan mempunyai rekod claim insurans, dan rekod bersih tidak
bermakna kereta tiada isu"*, and *"Paqar tidak mengesahkan bacaan odometer
sebenar"* `[repository-proven]`. Nothing in the report claims accident-free
certification. **This must not regress**; it is the most credible thing Paqar
says.

---

## 3. Aggregate buyer-funnel evidence

Read-only aggregate queries against production Supabase via the repository's
existing configured service client — the same mechanism as
[scripts/check-cache.ts](scripts/check-cache.ts). **SELECT only. Counts only.**
`buyer_email` was folded into a boolean in memory (the technique
`scripts/reconcile-payments.ts` already uses) and never printed. No plate, email,
token, session, check or bill identifier left the query process.

### 3.1 Journey starts and completion

Unique journeys (`journey_id` distinct), `[measured]`:

| Path | `valuation_started` | Share |
|---|---:|---:|
| `model_price` | **296** | **65.3%** |
| `plate_report` | 123 | 27.2% |
| `plate_check` | 34 | 7.5% |
| **Total** | **453** | |

`plate_submitted` = 123 (`plate_report`) + 34 (`plate_check`) = **157**.

**Completion rates are only computed within a path**, per
[lib/funnel-stages.ts](lib/funnel-stages.ts) — `valuation_completed` can only
fire on `plate_report`. Cross-path completion is meaningless and is not
reported here.

`valuation_completed` on `plate_report` = 96 unique journeys against 123 starts.
This is **not** a clean 78% completion rate: `plate_lookup_succeeded` is keyed on
`journeyId ?? checkId` while `plate_submitted` is keyed client-side on the
journey, so the denominators are not guaranteed to be the same population
`[repository-proven]`. Treat the direction as sound and the precise ratio as
`[unsupported]`.

### 3.2 Provider success and identity resolution

Per §2.2: **89.0% of terminal lookups resolve**, `not_found` has **never**
occurred, and the residual 11.0% is provider unavailability (14 events:
`provider_timeout` 14, `provider_error` 5, `poll_timeout` 1 in `ad_events`)
`[measured]`.

### 3.3 Variant context availability

Variant is **not** a captured field on either side `[repository-proven]`:
listings carry a title string; the record carries a `description` string.
`cohortMode` therefore reports `same_variant` when comparable *titles* mention
the token — a label, never a verification.

Measured suppression on the plate path is small but the window is short:
`plate_price_evidence_viewed` 17, `plate_verdict_viewed` 16,
`plate_verdict_suppressed` 1 `[measured]`. **17 observations is too few to
generalise** — how often variant context is genuinely available across the
whole cohort base is `[unsupported]`.

### 3.4 RM12 CTA exposure, clicks and paywall behaviour

`[measured]`, event counts:

| Stage | `plate_report` | `plate_check` | Total |
|---|---:|---:|---:|
| `paid_report_cta_viewed` | 31 | 0 | 31 |
| `paid_report_cta_clicked` | **4** | 0 | **4** |
| `paywall_viewed` | 99 | 30 | **129** |
| `payment_form_focused` | 19 | 7 | **26** |
| `checkout_started` | — | — | 23 |
| `billplz_navigation_started` | 2 | 2 | 4 |
| `purchase` | — | — | 6 |

- RM12 CTA click-through: **4 / 31 = 12.9%**
- Paywall → form engagement: **26 / 129 = 20.2%**

This reproduces the known paywall bottleneck: roughly a fifth engage, and
almost none pay.

### 3.5 Purchases by journey — the decisive measurement

`buyer_reports`: 67 rows, 27 paid, 40 unpaid `[measured]`.

| Paid rows | amount | internal | count |
|---|---:|---|---:|
| RM12 | 1200 | team | 16 |
| RM12 | 1200 | **external** | **3** |
| RM19 (legacy) | 1900 | team | 6 |
| RM100 | 10000 | team | 1 |
| RM1 (test) | 100 | team | 1 |

- **All 27 paid rows carry a `check_id`** — i.e. **100% of revenue, internal and
  external, originated in the plate journey** `[measured]`.
- **External lifetime revenue = 3 × RM12 = RM36.**
- The model journey — 65.3% of starts — has produced **zero** purchases, ever.

Unpaid intents: RM12 team 20 / **external 9**; RM100 team 2 / **external 4**;
RM19 team 5 `[measured]`.
External checkout intents = 3 paid + 13 abandoned = 16 → **18.8% intent→paid**.

### 3.6 RM100 interest and purchases

- External RM100 purchases: **0** `[measured]`.
- External RM100 intents abandoned: **4** — real demand signal, zero conversion.
- `add_jomcheck = true`: 6 unpaid, 1 paid (team).
- **`upgrade_amount_cents` is set on no row in the table. The +RM88 upgrade has
  never been purchased by anyone** `[measured]`.
- `jomcheck_status = success`: 1 (team).

### 3.7 Time from free result to checkout

Check creation → payment, `[measured]`:

| Bucket | All paid | External only |
|---|---:|---:|
| < 5 min | 15 | **2** |
| 5–15 min | 4 | **1** |
| 15–60 min | 4 | 0 |
| 1–24 h | 4 | 0 |

**Every external purchase happened within 15 minutes of the check.** There is no
delayed-conversion behaviour to design for: the buyer decides in-session or
never. Retargeting email exists but has converted nobody `[repository-proven]`.

### 3.8 Attribution limitations

`ad_sessions` = 1169 rows. **`referrer` is NULL on 100% of them** `[measured]` —
organic and direct remain one indistinguishable bucket. The fix exists on the
unmerged `seo/organic-attribution` branch.

`utm_source`: fb 470, meta 381, ig 82, th 70, null 150, chatgpt.com 9,
`{{site_source_name}}` 5 (unexpanded Meta macro), internal 1, an 1. **≈80% of
sessions are paid Meta traffic** `[measured]`, so every conversion rate here
describes cold paid traffic, not intent-led organic traffic.

### 3.9 Questions the data cannot answer — marked unanswered

- Whether sellers will supply a plate on request — **no instrumentation exists**
  `[unsupported]`.
- Whether the plate journey converts better *because* it is the plate journey,
  or because people who already have a plate are further along and more
  committed. **This is observational; causation is not established** and must
  not be claimed `[unsupported]`.
- True model-journey completion rate — result events post-date
  `valuation_started` `[unsupported]`.
- Organic versus direct performance `[unsupported]`.
- Per-listing variant ambiguity, repost and sold-listing rates `[unsupported]`.

---

## 4. Current competitor audit

Sources are current public pages, fetched this session. **No report was
purchased, no account created, no access control bypassed.** Carlist returned
**HTTP 403** behind Cloudflare bot verification, as it did for the prior audit —
that avenue was abandoned rather than worked around, so Carlist rows lean on
search-index and prior measurement and are marked accordingly.

### Marketplaces

| | **Mudah** | **Carlist** |
|---|---|---|
| Primary customer | buyer + seller, classifieds | buyer + dealer |
| Entry method | browse / search / structured URL paths | browse / search |
| Plate required | No | No |
| Price comparison | **Yes — full result set, price sort, native year/price/transmission filters** `[measured]` | Yes, smart filters `[measured]` |
| Official vehicle identity | **No** | **No** |
| Variant/spec info | seller's title only | seller's title only |
| Accident/claim records | **No** | **No** |
| Flood / total loss | **No** | **No** |
| Odometer info | seller-claimed band | seller-claimed |
| Clickable listings | Yes — the whole product | Yes |
| Negotiation guidance | No | No |
| Deposit guidance | No | No |
| Pricing | Free | Free |
| Turnaround | Instant | Instant |
| Major limitations | no record data of any kind | **mixes New, Used & Recon**; prominently displays **monthly instalment** figures, inviting price confusion `[measured, prior audit]` |
| Combines listing price + vehicle history? | **No** | **No** |

Mudah natively separates used from new (`/used-cars-for-sale/`), filters by year
(`mfg-year-2022`), bands price, and sorts the **complete** result set
`[measured]`. Paqar's cohort work partly exists to repair its own fuzzy `?q=`
query, which discards those filters at source `[repository-proven]`.

### Plate / history providers

| | **JomCheck (MRC)** | **Otofacts** | **SCRUT** | *(METACAR — reseller)* |
|---|---|---|---|---|
| Primary customer | buyer / trade | buyer | buyer | buyer |
| Entry method | plate | **VIN / chassis** | **plate or VIN** | registration no. |
| **Plate required/accepted** | Yes | **Explicitly refused** `[measured]` | **Yes** | Yes |
| Price comparison | No | **Standard+: market value**; Premium: similar vehicles for sale | **Yes — market valuation + latest 10 similar listings** | No |
| Official vehicle identity | limited | Yes — spec, engine, transmission | Yes — VIN, engine | No |
| Variant/spec info | No | Yes (Standard+) | Yes | No |
| Accident/claim records | **Yes — the source** | Premium only | **Yes — dates, severity, approved parts** | **Yes** |
| Flood / total loss | Yes | Premium / Basic (total loss) | **Yes, both** | Yes |
| Odometer info | mileage at claim | Premium: mileage from claims | **Yes + tampering warning** | mileage at claim |
| Clickable listings | No | Premium: similar vehicles | **Yes** | No |
| Negotiation guidance | **No** | **No** | **No** | **No** |
| Deposit guidance | **No** | **No** | **No** | **No** |
| Pricing | not public `[unsupported]` | **RM19.99 / RM49.99 / RM89.99** | 80 credits (SUR), 120 (ASUR); RM value not public `[unsupported]` | **RM80** |
| Turnaround | — | instant | **instant** (SUR) | instant |
| Major limitations | claims only | **no plate lookup** — unreachable from an advert | credit top-up model | claims only |
| **Combines listing price + vehicle history?** | No | **Yes (Premium)** | **Yes** | No |

**Authority note.** MRC holds a **Bank Negara Malaysia concession** to collect
industry-wide insurance claim data since 2000 `[measured]`. Paqar's RM100 is a
**manual resale of that concession-holder's data**. Every claim-history player
above draws on the same industry pool. Nobody in this market owns claim data
except MRC, and Paqar is a customer of it.

**Marketing claims are not treated as verified coverage.** Otofacts' own caveat
— *"the absence of accident claims DOES NOT necessarily mean the vehicle is
accident-free"* `[measured]` — is the same limitation Paqar states, and it
applies to every provider here.

---

## 5. Buyer-stage simulation

### Stage A — Browsing (model/year/price, no plate, no commitment)

| | |
|---|---|
| Trigger | scrolling Mudah, wondering if a price is sane |
| User input | brand, model, year, asking price |
| Paqar answer | a verdict word + confidence, no numbers |
| Next action | none defined — the model tab creates no check `[repository-proven]` |
| Paid transition | **none exists** |
| Main friction | 54.3% of the time Paqar answers "not enough data" `[measured]` |
| Trust requirement | low — nothing is asked of the buyer |
| Competitor alternative | **Mudah's own price sort — free, complete, live, better** |

**Why would they use Paqar instead of marketplace sorting?** On current
evidence, they largely should not. Paqar sees ≤15 relevance-ordered adverts up
to 7 days stale; Mudah sorts the full live set `[repository-proven]` +
`[measured]`.

**What can Paqar truthfully add here?** Only two things: exclusion of recon
imports and performance variants from the comparison, and the **refusal** to
judge a cohort that mixes variants. Both are real and neither is a number.

**Is RM12 useful yet?** No — and this is measured, not argued: 65.3% of journeys
start here and **none has ever produced a sale** `[measured]`.

### Stage B — Interested in one listing (plate may be hidden)

| | |
|---|---|
| Trigger | one advert, seller contact, considering a viewing |
| User input | the advert; possibly no plate |
| Paqar answer | **nothing plate-specific until a plate exists** |
| Next action | obtain the plate |
| Paid transition | none |
| Main friction | **the plate itself** |
| Trust requirement | the seller's willingness — outside Paqar's control |
| Competitor alternative | ask the seller directly; or Otofacts if they somehow have the VIN |

**What should Paqar help them request?** The full plate, and — worth more — the
**variant as written in the geran**, which is the single field that most changes
price and which `Semakan Varian` exists to check.

**Would a one-tap message asking for the plate be natural?** Plausibly. The
proposed message —

> *Hi, saya berminat dengan kereta ini. Boleh kongsi nombor plat penuh untuk
> saya buat semakan sebelum viewing?*

— is polite, gives a reason, and is normal Malaysian buyer behaviour.
**But this is a hypothesis, not a finding.** Paqar has **no instrumentation of
seller compliance whatsoever** `[unsupported]`. It must not be designed around
as if it converts.

**What can official identity confirm?** Make, model, registration year, engine
cc, body, VIN, NVIC, insurer and policy status — and, against those, whether the
advert's variant badge and claimed mileage are plausible `[repository-proven]`.

**What remains unknowable?** Condition, service history, true odometer, whether
the car is still available, whether an unclaimed accident occurred, and — from
price alone — anything about the car at all.

### Stage C — Before deposit (has plate, asking price, has viewed)

| | |
|---|---|
| Trigger | about to pay a deposit |
| User input | plate + asking price |
| Paqar answer | identity, variant position, mileage plausibility, insurance status, price verdict → RM12 for offer + script + checklist |
| Next action | make an offer, or walk |
| Paid transition | **RM12 — the only one that has ever converted** `[measured]` |
| Main friction | the paywall: 20.2% engage, ~2% pay `[measured]` |
| Trust requirement | high — money changes hands |
| Competitor alternative | SCRUT / METACAR for records; nobody for the offer |

**Which Paqar product is most valuable?** RM12, unambiguously. It is the only
product with external revenue and it sits exactly where the buyer's decision is.

**What exact uncertainty does RM12 resolve?** *"Am I about to overpay, by how
much, and what do I say?"* — median, range, an offer band anchored to the
median, a copy-paste script, a follow-up script for pushback, the questions to
ask, and the checklist to run before money moves.

**What exact uncertainty does RM100 resolve?** *"Was this car recorded as
crashed, flooded, written off, or has the meter been wound back?"* — genuinely
valuable, and genuinely available cheaper and faster elsewhere `[measured]`.

**What could prevent a bad purchase?** In descending measured value: the
odometer-rollback detection (claim mileage > current odometer), the
constructive-total-loss flag, the variant mismatch, and the deposit checklist.
Note the first two require RM100.

### Stage D — Negotiation

**Does Paqar provide a concrete offer?** Yes — `offerLow`–`offerHigh`, anchored
to the median `[repository-proven]`.

**Does it explain the offer?** Yes — median, range, sample size, and a
provisional note when the cohort is only 3–4 adverts.

**Can the buyer act immediately?** Yes — copy-paste BM WhatsApp script plus a
follow-up for "harga dah final".

**Does marketplace sorting already solve this?** **No.** Sorting shows prices; it
never produces an offer, a script or a checklist. **This is the one stage where
no competitor — marketplace or history provider — offers anything at all**
`[measured]`.

---

## 6. Integrated capability matrix

✅ present · ⚠️ partial/qualified · ❌ absent

| Capability | Mudah | Carlist | JomCheck | Otofacts | SCRUT | Paqar Free | Paqar RM12 | Paqar RM100 |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Listing discovery | ✅ | ✅ | ❌ | ⚠️ Prem. | ✅ 10 | ❌ | ⚠️ ≤15 | ⚠️ ≤15 |
| Price sorting | ✅ full | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Variant-safe fair-price judgement | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ labelled | ⚠️ labelled | ⚠️ labelled |
| Official registered identity | ❌ | ❌ | ⚠️ | ✅ VIN | ✅ | ⚠️ teaser | ✅ | ✅ |
| Advert-vs-record mismatch | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** | **✅** |
| Suggested offer | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** | **✅** |
| Negotiation ceiling | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** | **✅** |
| Comparable evidence | ✅ | ✅ | ❌ | ⚠️ | ✅ | ❌ | ⚠️ ≤15 | ⚠️ ≤15 |
| Seller questions | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** | **✅** |
| Deposit checklist | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** | **✅** |
| Claim/history evidence | ❌ | ❌ | ✅ | ✅ Prem. | ✅ | ❌ | ❌ | ✅ |
| Flood / total-loss evidence | ❌ | ❌ | ✅ | ✅ Prem. | ✅ | ❌ | ❌ | ✅ |
| **One continuous buyer workflow** | ❌ | ❌ | ❌ | ⚠️ VIN-gated | **✅** | ⚠️ | ⚠️ | ⚠️ |
| Price | Free | Free | n/a | RM19.99–89.99 | credits | Free | RM12 | RM100 |
| Time and effort | browse | browse | 1 field | **needs VIN** | 1 field | 1 field | 1 field + pay | **+24 h manual** |

### Classification — what kind of advantage each row is

**Commodity data** (bought, not owned):
- Official registered identity — RegCheck, £0.15/lookup, resellable by anyone.
- Claim/flood/total-loss/odometer-at-claim — MRC concession data, resold by
  JomCheck, METACAR, SCRUT and Otofacts alike.
- Comparable listings — Mudah's public pages.

**Packaging advantage** (same data, better assembled):
- BM-first, mobile-first, one field, no account, RM12 price point.
- Free verdict before any payment — no history provider offers this.

**Workflow advantage** (Paqar does a *step* others don't):
- Advert-versus-record mismatch (`Semakan Varian` + `Semakan Mileage`).
- Suggested offer, negotiation ceiling, follow-up script, seller questions,
  deposit checklist. **No competitor audited offers any of these.**
- Honest refusal (`mixed_variants` / `insufficient_data`) — a product that
  declines to answer.

**Genuine proprietary advantage:** **none.** Every input is purchasable by a
competitor at list price. This must be stated plainly and not dressed up.

**Unsupported marketing claim (Paqar's own, to fix):**
- `Sumber: JPJ` on the vehicle block — provenance Paqar cannot substantiate.
- `di pasaran` in the methodology line and negotiation scripts — a market claim
  over ≤15 stale single-site adverts.

Per the brief: nothing is called a moat merely because one competitor lacks it.
The negotiation/deposit layer is absent from **all five** competitors, which
makes it a *market gap*, not a *moat* — it is writing, and writing is copyable.

---

## 7. Economics and operational viability

Conservative, using only costs the repository or a provider's public page
establishes. Nothing invented.

### Known costs

| Item | Value | Basis |
|---|---|---|
| Plate lookup | **£0.15 ≈ RM0.81** per call | provider list price `[measured]` + `[repository-proven]` |
| RM100 fulfilment — data | **≤RM80**, exact figure unknown | METACAR's retail resale of the same MRC data `[measured]`; JomCheck's own price `[unsupported]` |
| RM100 fulfilment — labour | ≈5 min/order, owner | [RUNBOOK.md](RUNBOOK.md) `[repository-proven]` |
| Billplz / FPX fee | **not recorded anywhere in the repository** | `[unsupported]` — must be confirmed from the Billplz account, not guessed |

### Gross contribution

| | RM12 | RM100 | +RM88 |
|---|---:|---:|---:|
| Gross | RM12.00 | RM100.00 | RM88.00 |
| Plate lookup | −RM0.81 | −RM0.81 | −0 (already paid) |
| Claim data (at METACAR retail bound) | — | **−RM80.00** | **−RM80.00** |
| Payment fee | `[unsupported]` | `[unsupported]` | `[unsupported]` |
| **Contribution before payment fee** | **≈RM11.19** | **≈RM19.19** | **≈RM8.00** |
| Manual labour | none | ≈5 min | ≈5 min |

**The +RM88 add-on is the weakest unit in the product.** At the observable upper
bound of claim-data cost it contributes ≈RM8 before payment fees, for five
minutes of irreplaceable owner time and a 24-hour promise. If MRC's wholesale
price to a reseller is anywhere near METACAR's retail, **the add-on may be
loss-making**. It has also **never been purchased** `[measured]`. Its true cost
must be established before it is promoted at all.

### Cost of failed and duplicate checks

- Transient failures retry **once**; `not_found`, malformed and non-OK are
  answers and are never retried `[repository-proven]`. Correct.
- 11 timeouts × 2 attempts + 3 errors + 113 found + 25 legacy ⇒ **≥163 billed
  calls ≈ RM132** `[measured]` + `[inference]`.
- `plate_lookup_cache` means a repeat plate never re-bills; `getCachedCheck` is
  scoped to the visitor's own session `[repository-proven]`.

### The economics finding that matters

> **Lifetime external revenue RM36. Plate-provider spend ≈RM132.
> Paqar has spent ≈3.7× its total revenue on free plate lookups**
> `[measured]` + `[inference]` — before any Meta spend, which is not counted here.

Conversion from a paid lookup to a paid customer is **3 / 152 ≈ 2.0%**.

### Could a free plate feature become uneconomic or abused?

**Abuse: bounded but not cheap.** The 5-new-plates-per-IP-per-day sliding window
caps a single IP at **RM4.05/day** `[repository-proven]`. IPs are cheap, so
exposure scales with hostile traffic, not with genuine demand. The guard is
adequate for today's volume and would need a second dimension (session or
device) before any campaign that widens free plate access.

**Uneconomic: already true.** At 2.0% lookup→purchase and RM0.81 a lookup, the
provider cost per external customer is **≈RM40 against RM12 of revenue**. Making
the plate lookup *more* free without moving conversion makes the loss larger,
linearly. **Any proposal to widen free plate access must move conversion first,
or it is simply buying strangers a free lookup.**

### Support and refund risk

Receipt delivery is **manually reconciled daily** and carries the only durable
copy of an anonymous buyer's report link `[repository-proven]`. Combined with a
24-hour manual RM100 promise, operational load per RM100 order is high relative
to ≈RM19 of contribution.

---

## 8. Choosing the wedge

| | **1 Price-first** | **2 Plate-first** | **3 Integrated** | **4 History-first** |
|---|:--:|:--:|:--:|:--:|
| Fit with buyer behaviour | 1 — 65% of starts, **0% of revenue** | **5** — 100% of revenue | 3 — needs plate anyway | 2 — late-stage only |
| Uniqueness | 1 — Mudah sorts better | 3 — SCRUT also takes a plate | **1 — SCRUT already ships it** | 1 — 4 sellers, same data |
| Ease of use | 4 | **5** — one field | 2 — most steps | 3 |
| Trust | 3 | **4** — record beats advert | 3 | 4 |
| Conversion potential | **1 — measured zero** | **5 — measured all of it** | 3 | 1 — measured zero |
| Data quality | 2 — ≤15, 7-day, one site | **4** — 89%, no not_found | 2 — weakest leg governs | 4 |
| Economics | 3 — no provider cost | 3 — RM0.81, 2% conversion | 2 | **1 — ≈RM8–19, beaten on price** |
| Operational burden | **5** — none | 4 | 2 | 1 — manual, 24 h |
| One-sentence explanation | 3 | **5** | 2 | 4 |
| **Total (/45)** | **23** | **38** | **20** | **21** |

**Chosen: Option 2 — plate-first.**

One sentence: **"Masukkan nombor plat — kami beritahu harga patut dan apa nak
tanya sebelum bayar deposit."**

Chosen because every purchase in Paqar's history came through it, because
identity resolves 89% of the time and has never returned *not found*, and
because the plate is what makes every downstream output about **this car**
rather than about a model.

**Explicitly not chosen, and why:**

- **Option 3 (integrated)** is rejected *because SCRUT already ships it*
  `[measured]`. Building it would be entering a race already run, with a weaker
  price leg (≤15 adverts, 7 days stale, one site) and a slower history leg.
- **Option 4 (history-first)** is rejected on economics and speed: METACAR
  RM80 instant, Otofacts RM89.99 instant, SCRUT instant, versus Paqar RM100 at
  24 hours by hand — with **zero external sales and zero RM88 upgrades ever**.
- **Option 1 (price-first)** is rejected as measured: 65.3% of journeys, 54.3%
  "no data", zero revenue.

**The wedge is the decision, not the data.** Plate-first is chosen as the
*entry*, and the *paid* value is the offer band, the script, the questions and
the deposit checklist — the four things no competitor in this audit sells.

---

## 9. The cleanest buyer journey

Designed to Paqar's north star: clean, extremely easy, useful at the moment a
buyer must decide. **One tool on the homepage, not four.** The journey stays
useful with no plate, and **never** triggers a paid provider lookup before the
buyer understands why it helps.

### H1 and supporting line

> **H1:** `Jangan bayar deposit sebelum semak.`
>
> **Supporting:** `Masukkan nombor plat — kami beritahu harga patut, dan apa
> yang perlu anda tanya penjual.`
>
> **Sub-support:** `Percuma. Tanpa daftar. Laporan penuh RM12.`

`Percuma` is scoped to the check, never to the report — per the standing
copy-claim rule.

### Structure

**Primary input** — one field, plate, autofocused. Not a tab. Not a choice.
`Nombor plat` · placeholder `WXY 1234` · button `Semak Percuma →`

**Secondary path** — one quiet line beneath, not a competing tab:
`Tiada nombor plat? Semak ikut model dahulu →`

This inverts today's homepage, where the model tab is the **default** and
carries 65.3% of journeys into a path that has never sold anything
`[measured]`.

**Progressive plate request** — the model path answers first, then asks:

> `Kami dah beri keputusan harga untuk model ini. Untuk tahu apa kereta ini
> sebenarnya mengikut rekod — varian, enjin, tahun daftar — kami perlukan
> nombor plat.`

The plate is requested **only after** the buyer has received something, and only
with the reason attached. Never before.

**Free result** (plate path) — in mobile order:

1. `Kenderaan Dijumpai` — description + registration year *(already built)*
2. Price verdict badge + one-line explanation
3. Confidence chip + methodology line
4. **`Rekod vs Iklan`** — one line stating whether the record's variant matches
   what the advert claims. *This is the free result's job: it is the only free
   answer no competitor gives.*
5. Single CTA

**RM12 transition** — earned, and named for what it unlocks:

> `Lihat harga patut, tawaran dan skrip rundingan — RM12`
> `Termasuk soalan untuk penjual dan checklist sebelum bayar deposit.`

**RM100 transition** — moved **after** the RM12 report is open, never on the
free result, and stated with honest turnaround:

> `Tambah Semakan Accident/Claim Insurans — +RM88`
> `Rekod claim insurans: accident, banjir, windscreen, total loss — jika
> direkodkan. Keputusan dalam 24 jam.`

**Missing-plate fallback** — the model path must remain genuinely useful, which
today it is not 54.3% of the time. When there is no data, say so and give the
one thing that still helps:

> `Belum cukup iklan setanding untuk beri keputusan harga.`
> `Yang paling mengubah harga ialah varian. Sahkan varian dalam geran dahulu —
> atau masukkan nombor plat dan kami semak rekod rasminya.`

**One-tap seller message** — offered on the free result when there is **no**
plate, as a copy button:

> `Hi, saya berminat dengan kereta ini. Boleh kongsi nombor plat penuh untuk
> saya buat semakan sebelum viewing?`

**Labelled a hypothesis.** Ship it with an event on copy *and* on subsequent
plate submission, so seller compliance stops being `[unsupported]`. Do **not**
build the journey on the assumption that it works.

**Trust / privacy copy**

> `Nombor plat digunakan sekali untuk semakan ini sahaja. Tiada akaun
> diperlukan.`
> `Paqar perkhidmatan pihak ketiga — bukan afiliasi JPJ atau PDRM.`

**Failure states** — all four already exist and are good; keep them exactly
`[repository-proven]`: `searching`, `not_found` (with both recovery routes),
`error` (with a real retry that re-asks the provider), `timed_out`.

**Mobile hierarchy** — one screen to the CTA: H1 → support → plate field →
button → (result) verdict → `Rekod vs Iklan` → single CTA. Social proof and
"how it works" stay below the fold; the how-it-works strip already hides once a
result is showing `[repository-proven]`.

---

## 10. Free / RM12 / RM100 boundary

| | Free | RM12 | RM100 |
|---|:--:|:--:|:--:|
| Price verdict (word) | ✅ | ✅ | ✅ |
| Confidence + methodology | ✅ | ✅ | ✅ |
| Official identity — make/model/year | ✅ | ✅ | ✅ |
| **Variant match: record vs advert (yes/no + which)** | **✅ new** | ✅ full ladder | ✅ |
| Engine, body, VIN, NVIC, insurance status | ❌ | ✅ | ✅ |
| Median / range / gap | ❌ | ✅ | ✅ |
| Offer band + negotiation + follow-up script | ❌ | ✅ | ✅ |
| Trade-in estimate | ❌ | ✅ | ✅ |
| Comparable price chips | ❌ | ✅ | ✅ |
| `Semakan Mileage` plausibility | ❌ | ✅ | ✅ |
| Seller questions + deposit checklist | ❌ | ✅ | ✅ |
| Accident/claim record, flood, total loss, odometer rollback | ❌ | ❌ | ✅ |

**The one change: move the variant match into free.**

Rationale, held against the brief's two constraints:

- *Do not withhold information necessary to understand a free claim.* Today free
  says "this price is fair" while silently withholding the fact that the price
  was compared against a **possibly different variant**. The buyer cannot
  evaluate the free verdict without knowing which car it judged. Publishing the
  match is **required** for the free claim to be honest.
- *Do not give away the full paid product.* Free gets **one boolean and the
  record's variant name**. RM12 keeps the ladder, the position marker, the
  price consequence and everything numeric. The paid product is unharmed.

**What is protected, and why:** every RM12 number stays paid because numbers are
what the buyer acts on; the type-level withholding in
[types/api.ts](types/api.ts) stays exactly as it is — a field never serialised
cannot leak through a markup change. Claim/history stays wholly behind RM100
because it is bought per-plate at real cost.

**Truthful limitations that must appear wherever the claim check is sold** —
already correct, must not regress:
*tidak semua kemalangan mempunyai rekod claim insurans · rekod bersih tidak
bermakna kereta tiada isu · Paqar tidak mengesahkan bacaan odometer sebenar.*

---

## 11. Exact BM copy

**Homepage**

- H1: `Jangan bayar deposit sebelum semak.`
- Support: `Masukkan nombor plat — kami beritahu harga patut, dan apa yang perlu anda tanya penjual.`
- Sub: `Percuma. Tanpa daftar. Laporan penuh RM12.`
- Field label: `Nombor plat` · placeholder: `WXY 1234`
- Button: `Semak Percuma →`
- Secondary: `Tiada nombor plat? Semak ikut model dahulu →`
- Privacy: `Nombor plat digunakan sekali untuk semakan ini sahaja. Tiada akaun diperlukan.`

**Free result**

- Found: `Kenderaan Dijumpai` / `Didaftar {tahun}` *(unchanged)*
- Verdict sub-lines *(unchanged)*: `MAHAL — Jangan bayar deposit dulu.` ·
  `WAJAR` · `BERBALOI — Tapi semak condition dan dokumen sebelum deposit.`
- Variant match: `Varian mengikut rekod: {varian}. Iklan menyebut "{tuntutan}" — sepadan.`
- Variant mismatch: `Varian mengikut rekod: {varian}. Iklan menyebut "{tuntutan}" — tidak sepadan. Sahkan dalam geran sebelum bayar apa-apa.`
- Variant unavailable: `Rekod varian rasmi tiada untuk kenderaan ini. Sahkan varian dengan ciri fizikal — bukan emblem atau iklan.`
- Suppressed: `Belum cukup iklan setanding untuk beri keputusan harga.`
- Mixed variants: `Varian bercampur dalam iklan — harga tidak boleh dibanding lagi. Sahkan varian rasmi dahulu.`

**CTAs**

- RM12: `Lihat harga patut, tawaran dan skrip rundingan — RM12`
- RM12 sub: `Termasuk soalan untuk penjual dan checklist sebelum bayar deposit.`
- RM100 (inside the paid report only): `Tambah Semakan Accident/Claim Insurans — +RM88`
- RM100 sub: `Rekod claim insurans: accident, banjir, windscreen, total loss — jika direkodkan. Keputusan dalam 24 jam.`

**Seller message (copy button)**

> `Hi, saya berminat dengan kereta ini. Boleh kongsi nombor plat penuh untuk saya buat semakan sebelum viewing?`

**Copy that must be corrected**

| Now | Should be | Why |
|---|---|---|
| `Sumber: JPJ` | `Sumber: rekod pendaftaran kenderaan` | provider names no Malaysian source `[measured]` |
| `Berdasarkan {n} listing serupa di pasaran` | `Berdasarkan {n} iklan setanding yang kami jumpa` | ≤15, one site, ≤7 days — not "the market" |
| `Saya dah semak {n} listing serupa di pasaran` (script the buyer sends a seller) | `Saya dah semak {n} iklan setanding untuk model ini` | the buyer must not repeat an overclaim to a seller |

---

## 12. Gate conclusion

### **Gate C — plate/history plus pricing is not differentiated enough.**

Stated plainly: **the integrated journey is not Paqar's defensible product.**

1. **SCRUT already ships it** — plate or VIN in; claims, total loss, flood,
   theft, odometer with tampering warning, market valuation and the latest 10
   comparable listings out; instantly `[measured]`.
2. **Otofacts Premium ships most of it for RM89.99** instantly — though
   VIN-only, which is a real gap Paqar's plate entry exploits `[measured]`.
3. **The history leg is resold commodity at a worse price and speed** —
   METACAR RM80 instant versus Paqar RM100 at 24 hours by hand, on the *same*
   MRC concession data `[measured]`.
4. **The price leg is the weakest in the market** — Mudah-only, 87.1% of
   serveable cohorts capped at 15, 7 days stale `[measured]` +
   `[repository-proven]`.
5. **The market has voted** — zero external RM100 purchases, zero +RM88
   upgrades ever, three external RM12 purchases `[measured]`.

Not Gate A: there is nothing meaningfully differentiated to specify, and
building prototypes of a journey a competitor already sells would be exactly the
attractive-but-weak product concept the brief warns against.

Not Gate B: the blocker is **not** data, economics or plate availability — plate
availability is in fact Paqar's *best* number (89%, zero not-found). The blocker
is that the chosen destination is already occupied. More data would not fix
that.

### Strongest alternative wedge

**Sell the decision, not the dossier.**

Paqar's only unoccupied ground is the two stages every competitor skips: **what
to offer** and **what to check before paying a deposit**. Anchor them to the
plate, because that is where 100% of revenue has come from, and price them at
RM12, an order of magnitude below every history provider.

This is a **packaging and workflow advantage on commodity data, with no moat.**
It is defensible only by focus and speed, and it should be stated that way
internally. It is nonetheless the only position in this audit that is both
unoccupied and already proven to convert real money.

### No prototype was built

Gate A alone authorises prototypes. Under Gate C, building homepage / free
result / RM12 / RM100 mockups would be cosmetic UI for a rejected thesis. **No
prototype, no route, no component and no copy change was made.** This document
is the entire deliverable.

---

## 13. Adversarial review

Every challenge run against the recommendation before finalising. Three changed
the conclusion.

| Challenge | Outcome |
|---|---|
| Can marketplaces add this easily? | **Yes, and it would not be hard.** Mudah has the adverts and the traffic; a "fair price" band is a feature, not a moat. Conceded — the recommendation does not depend on marketplaces staying still, only on Paqar's speed. |
| Can JomCheck or Otofacts already do it? | **JomCheck yes** (it owns the data). **Otofacts partly** — blocked from plate entry by its own design choice. **SCRUT already does.** *This changed the gate from B to C.* |
| Is Paqar merely reselling commodity data? | **Yes. Conceded outright.** RegCheck identity, MRC claims and Mudah listings are all purchasable. There is no proprietary advantage and §6 says so. |
| Does the buyer naturally have the plate? | Only sometimes — 34.7% of journeys start with one `[measured]`. But those journeys carry **100%** of revenue. The journey is therefore designed to stay useful without a plate, not to assume one. |
| Will the seller provide it? | **Unknown and uninstrumented** `[unsupported]`. The one-tap message ships **with events attached** and is labelled a hypothesis; nothing in the recommendation's value rests on it. |
| Is RM12 value strong without better comparables? | **Partly.** The offer band derives from the median of ≤15 stale adverts. The *script, questions and checklist* do not depend on comparables at all — and they are the part no competitor sells. The recommendation deliberately leans on the comparable-independent half. |
| Does the flow create too many steps? | It removes one: the homepage tab choice disappears, plate becomes the default, model becomes a link. Net fewer decisions. |
| Does free cost Paqar money? | **Yes — ≈RM132 against RM36 revenue, ≈3.7×** `[measured]`. §7 states it and makes "move conversion before widening free access" an explicit precondition. |
| Does any language imply accident-free certification? | **No**, and the existing disclaimers are correct. §10 pins them as non-regressible. The RM100 CTA carries the honest 24-hour turnaround rather than implying instant certification. |
| Does the recommendation depend on unsupported assumptions? | Checked line by line. Seller compliance — flagged, not depended on. Causation of plate-vs-model conversion — **explicitly not claimed**; it is observational and §3.9 says so. Billplz fee — marked `[unsupported]`, not guessed. |
| Is "move the variant match into free" giving away the paid product? | **Nearly caught one.** First draft put the whole `Semakan Varian` ladder in free, which is a large part of what RM12 sells. Corrected to **one boolean plus the record's variant name**; ladder, position and price consequence stay paid. |
| Is Gate C too pessimistic — is the negotiation layer a moat after all? | **No, and I tested this hardest.** It is writing. Any competitor can add a script and a checklist in a sprint. Calling it a moat would be the exact overreach the brief forbids. It is called a market gap, defended by speed. |

**Corrections made as a result:** the gate moved from B to C on the SCRUT
finding; the free/paid boundary was narrowed after the ladder overreach; and the
RM100 CTA gained an explicit turnaround statement so speed is never implied.

---

## 14. Highest-priority next action

**Invert the homepage: make the plate the single default input, and demote the
model checker to one secondary link.**

Chosen over every alternative because it is the only action that moves the
largest measured waste in the funnel directly onto the only path that has ever
produced revenue: **65.3% of journeys currently start on a path with a 54.3%
no-answer rate and a 0% purchase rate** `[measured]`.

- **Cost:** one component change (`HomeCheckerTabs` → single input + link).
- **Risk:** low; no schema, no provider, no pricing change.
- **Provider-cost exposure:** more plate submissions means more RM0.81 calls.
  **Ship the rate-limit second dimension (session or device, alongside IP) in
  the same change**, per §7.
- **Measurement:** compare within-path RM12 CTA click and purchase rate before
  and after. Do **not** read it as proof that the plate *causes* conversion —
  §3.9 stands.

Second and third, both small and both already specified: fix the `Sumber: JPJ`
provenance claim, and fix the `di pasaran` overclaim — including in the script
the buyer pastes to a seller.

**Do not** build the integrated journey. **Do not** promote the +RM88 add-on
until its true wholesale cost is established; on current evidence it may be
loss-making and it has never sold.

---

## 15. What remains unsupported

- **Seller compliance with a plate request** — no instrumentation exists.
- **Causation** between the plate journey and conversion — observational only;
  buyers who hold a plate are further along by construction.
- **JomCheck's wholesale price to Paqar** — not public; RM80 is METACAR's
  retail, used only as an upper bound.
- **Billplz/FPX per-transaction fee** — recorded nowhere in the repository.
- **SCRUT's credit-to-ringgit rate** — 80 credits is published, its RM value is
  not.
- **Carlist's current on-page behaviour** — HTTP 403 behind Cloudflare; not
  bypassed. Carlist rows rest on search-index data and prior measurement.
- **True model-journey completion rate** — outcome events post-date
  `valuation_started`.
- **Organic versus direct performance** — `referrer` NULL on all 1,169 sessions.
- **Variant-availability rate across the cohort base** — 17 observations is too
  few to generalise.
- **Any conversion forecast** — none is manufactured anywhere in this document.

---

## 16. Git status and local commits

- Branch: `product/integrated-buyer-decision-audit`, created from
  **`origin/main` = `43e12dd`**.
- Worktree: `.claude/worktrees/integrated-buyer-decision-audit` (isolated).
- Starting state recorded: working tree **clean** on
  `fix/meta-experiment-reporting` (`05d8c67`); 7 worktrees; no stashes.
- Read without merging: `product/listing-decision-audit` (`2c6c635`),
  `feat/lower-priced-comparable-count` (`b9985b7`).
- Every unrelated branch, worktree and user change preserved untouched.
- Files added: this document only. **No code, test, route, component, schema or
  copy file was modified.**
- The aggregate query instruments were written to the session scratchpad, **not**
  to the repository, and are not committed.

## 17. Confirmation

Nothing was pushed, merged, deployed or released. No production write, no schema
change, no migration. No Meta campaign, ad set, creative, budget or experiment
row was read or altered. No GSC credential or script was accessed. **No paid
plate-provider call and no paid JomCheck call was made.** No competitor report
was purchased, no account created, no false identity used, and no login, paywall,
Cloudflare control or access control was bypassed — Carlist's 403 was accepted as
a stop. Production database access was **read-only and aggregate**; only counts
appear in this document, and no plate, email, token, session or other row-level
identifier was printed at any point.
