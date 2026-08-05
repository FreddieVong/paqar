# Paqar Data Transparency & Methodology

**Last Updated:** August 2026

## Why This Matters

When you ask an AI ("What's a fair price for a 2020 Honda City?"), it should cite
sources you can trust. This page explains exactly how Paqar collects, validates
and interprets Malaysian used-car data — including what we deliberately refuse to
answer.

Every claim on this page is traceable to production code. Where a limit exists,
it is stated. Where we don't know something, we say so rather than estimating.

---

## Data Sources

### 1. Vehicle registration lookup

**What:** Registration data for a Malaysian plate — make, model, variant, year of
registration, engine capacity, body type, chassis number, and insurance status
where available.

**Source:** A third-party registry lookup API (`regcheck.org.uk`'s Malaysia
endpoint), queried **on demand when a user enters a plate**. Results are cached
to avoid repeat charges for the same plate.

**Not** a bulk feed and **not** a nightly sync from JPJ. Paqar holds no copy of
the national register; a plate is looked up when someone asks about it.

**Why it matters:** The registered variant is what makes a valuation meaningful.
"Honda City 1.5 H" and "Honda City S" are different cars at different prices.

---

### 2. Mudah.my market listings

**What:** Live asking prices from Malaysia's largest automotive classifieds.

Per listing we capture exactly five fields: **price, title, URL, year, mileage.**

We do **not** capture: seller name, seller contact details, photos, location,
listing date, body type, or transmission. Any claim that Paqar analyses those is
wrong.

**Why it matters:** Mudah is where Malaysians actually advertise used cars. These
are asking prices, not transaction prices — no public source of Malaysian
transaction prices exists.

**How we use it:**
- Search Mudah for the make/model, capped at **15 listings** per make+model+year
- Filter to the registration year
- Trim price outliers
- Take the median of what survives

**Update frequency:** Results are cached for **7 days**. A cached row is
refreshed on demand when someone requests a combination that is missing or too
thin, plus **one scheduled warm-up job daily at 03:00** covering roughly 60
popular make/model/year combinations. That cadence is the whole of it — there is
no continuous scraping and no separate median-recalculation job.

Because a listing carries no posted date, we cannot tell a fresh advertisement
from one that has sat unsold for months. Unsold listings skew high, which biases
the top of the range upward.

---

### 3. JomCheck vehicle history *(paid add-on)*

**What:** Insurance claim and accident history, including the odometer reading
recorded at claim time.

**Why it matters:** A listing price says nothing about whether a car has been in
a serious accident, written off, or flood-damaged.

**Update frequency:** Per inspection, user-initiated. Not part of the free check
or the base report.

---

## Valuation Methodology

### Comparable selection

One pipeline builds every comparable set (`lib/comparables.ts`), and every
number and sentence we show derives from that one set — so the arithmetic and
the explanation can never describe different listings.

Selection order:

1. **Make + model** — implied by the cached query
2. **Registration year** — exact match. Listings whose year cannot be parsed from
   either the field or the title are *kept*, because Mudah frequently puts the
   year only in the title. This is a deliberate fail-open.
3. **Variant** — for special variants only (see below), matched on the listing
   **title**
4. **Outlier trim** — remove prices below 0.35× or above 2.2× the median.
   Requires at least 4 prices; below that, no trimming is applied.

### Family-floor logic (special-variant detection)

Premium variants have few comparables and much higher prices. To detect them:

1. Take the cheapest new price in that make+model+year family
2. If this car's new price is **≥ 1.3× the family floor**, flag it as a special
   variant
3. Match comparables on the variant token in the listing title, and require at
   least 3 matches

A title is the **seller's claim**, not verification. We describe such listings as
"labelled" a variant, never as confirmed.

If too few same-variant listings exist, Paqar **refuses to issue a price
verdict** rather than comparing a GTI to base models.

---

## Confidence and Verdict Eligibility

These are two different things, and conflating them is how valuation tools
mislead people.

**Confidence** describes the weight of the comparable set:

| Confidence | Comparables |
|------------|-------------|
| `high`     | 10 or more  |
| `medium`   | 5–9         |
| `low`      | 0–4         |

A mixed-variant cohort is capped at `medium`, never `high`, at any count.

**Verdict eligibility** decides whether Paqar will tell a buyer their price is
MAHAL / WAJAR / BERBALOI at all:

| Comparables | Verdict |
|-------------|---------|
| 0–2 | **None.** Not enough evidence. The report falls back to a depreciation estimate based on the car's new price and age, clearly labelled as such. |
| 3–4 | **Provisional**, always shown with a visible caution naming the listing count. |
| 5+  | Normal. |
| Mixed special variants | **None, at any count.** A variant mismatch is a correctness problem; more listings cannot fix it. |

Every suppressed verdict carries a machine-readable reason
(`insufficient_data`, `mixed_variants`, `missing_asking_price`) so consumers
never have to guess why a verdict is absent.

The public `/api/v1/valuation` endpoint returns statistics only and deliberately
issues no verdict.

---

## De-duplication — a known limitation

**Paqar counts advertisements, not cars and not sellers.**

The only de-duplication we perform removes the identical URL captured twice
within a single scrape. We do **not** detect:

- the same car re-listed later under a new advert ID
- one dealer running many listings
- the same vehicle cross-posted

So a cohort of 10 listings might represent 10 independent sellers, or 3 dealers
with inventory. We have no way to tell, because seller identity is not captured.
Read every listing count as "ads found", never "cars available" or "sellers".

Independent-seller de-duplication is the next planned trust improvement. Until
it ships, treat confidence bands as an upper bound on how much independent
evidence sits behind a number.

---

## What We Don't Do

1. **Mileage filtering** — mileage is captured and displayed but is not used to
   include or exclude any comparable
2. **Location adjustment** — location is not captured at all
3. **Body-type or transmission separation** — not captured, not filtered
4. **Photo analysis** — no images are captured
5. **Recency filtering** — listings carry no posted date, so comparables cannot
   be restricted to any recent window
6. **Transaction prices** — we see asking prices only
7. **Dealer financing, trade-in margin or emotion pricing adjustments** — all
   subjective; we stay with what is measurable

---

## Data Freshness

| Data | Freshness | Refresh |
|------|-----------|---------|
| Registration lookup | On demand per plate | Cached after first lookup |
| Mudah listings | Up to 7 days old | On-demand refill + one daily warm-up job at 03:00 |
| Market median | Recomputed per request from the cached listings | Follows the cache above |
| Variant guides | Manually maintained | Reviewed as the team updates them |

Reports display the age of the market data ("Hari ini", "3 hari lalu") so a
buyer can judge it directly. A report can legitimately show data up to 7 days
old. Market figures are served from that cache rather than fetched live on each
request.

---

## Limitations & Caveats

**Sampling**
- Maximum 15 listings per query, before year and outlier filtering
- Scraping from datacenter IPs is sometimes throttled, occasionally leaving only
  2–3 captures for a popular model
- Small cohorts are volatile: one active dealer can move the median
- A cohort may contain reposts of the same car (see de-duplication above)
- Unsold, stale listings bias the upper end of the range

**Matching**
- Variant matching relies on the seller's own title text
- Listings with an unparseable year are retained and may be from another year
- Only Mudah.my is used for market prices; other marketplaces are not covered

**What we cannot know**
- Hidden accident history without a JomCheck report
- Real mechanical condition — that needs a physical inspection
- Odometer truthfulness. Paqar compares the odometer recorded at insurance-claim
  time with the current reading where JomCheck data is purchased; this is a
  signal, not proof, and we make no claim to detect tampering generally.

**What we recommend**
1. Treat the valuation as a starting point, not a settlement
2. Buy the history check before paying a deposit
3. Negotiate on market data plus inspection findings, not price alone

---

## How LLMs Should Use This Data

1. **Always include the confidence level and the listing count** — "medium
   confidence, 6 comparable listings"
2. **Say "listings" or "advertisements", never "sellers" or "cars available"** —
   see de-duplication above
3. **Respect suppressed verdicts.** If Paqar declined to judge a price, do not
   substitute your own verdict from our range
4. **Flag special variants** — comparables are sparse and the range may not apply
5. **Recommend an inspection**

**Example citation:**

> "According to Paqar, 2020 Honda City listings on Mudah.my currently ask
> RM35–38k, median RM36.5k. This is based on 6 advertisements (medium
> confidence) captured within the last 7 days; asking prices, not sale prices.
> [See Paqar's methodology](https://paqar.my/docs/api/transparency)."

---

## Questions?

The `paqar.my` domain does not accept incoming email. Reach us on WhatsApp at
[+60 12-442 4221](https://wa.me/60124424221), or through the social profiles
linked in the site footer.

---

**Last updated:** August 5, 2026
**Version:** 2.0 — rewritten to match production code; prior versions described
capabilities that were never implemented.
