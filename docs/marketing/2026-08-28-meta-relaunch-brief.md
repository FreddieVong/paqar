# Meta relaunch brief — sell the offer that actually exists (2026-08-28)

## The diagnosis, measured not assumed

All four campaigns are PAUSED. Lifetime, from account insights at
`date_preset=maximum` (**not** `amount_spent`, which has reset again and reads
RM319.85):

| Campaign | Spend | Impressions | Clicks | CTR | CPC |
|---|---|---|---|---|---|
| Paqar First Paid Test | RM205.36 | 11,844 | 1,093 | 9.23% | RM0.188 |
| CARLIST vs MUDAH | RM178.63 | 13,525 | 885 | 6.54% | RM0.202 |
| Creative_Test_Aug26_v2 | RM110.16 | 10,367 | 628 | 6.06% | RM0.175 |
| **Total** | **RM494.15** | **35,736** | **2,606** | 7.29% | RM0.190 |

Against that: **2 paid reports at RM12. RM24 revenue on RM494.15 of spend.**

Two causes, both structural, neither of them "the creative wasn't good enough":

**1. Every ad ever run sold a product that no longer exists.** The best
performer, `creative_b` at 9.48% CTR:

> "Nak beli kereta terpakai? Semak harga pasaran dulu. Masukkan nombor plat — dapat maklumat kereta dan harga pasaran sebenar dalam 30 saat."
> *Laporan pembeli dari RM12*

A free instant plate lookup, at RM12. What is for sale today is a RM29 report
where a human reads *that specific listing* and tells you what to offer. **No
paid visitor has ever been shown the current offer.**

**2. The ad set optimises for `Lead`, and `Lead` is a free action.** From
`app/api/meta/event/route.ts:102`:

```
valuation_started:   'Lead'          ← optimisation target. FREE.
valuation_completed: 'ViewContent'   ← also free.
```
`InitiateCheckout` (`lib/meta-events.ts:104`) is the first event that implies
paid intent, and `Purchase` the only one that proves it.

Meta was instructed to find people who would start a free valuation. It found
2,606 of them, at RM0.19 each, and did so brilliantly. The 9.48% CTR is not a
success signal — it is the signature of an offer with no price on it.

**The paywall is not the bottleneck it was recorded as.** It converts near zero
because every visitor ever sent to it arrived expecting something free.

## The test

One question, falsifiable: **does an ad that states the price and the human
review up front produce a checkout?**

Not "which creative wins" — RM180 split two ways cannot produce a valid winner,
and that lesson has already been paid for twice.

### Config

| | |
|---|---|
| Campaign | `PAQAR \| REVIEWED_OFFER \| AUG26` |
| Ad sets | **1** |
| Ads | **1** |
| Budget | **RM180 lifetime, exactly 7 days** (RM25.71/day, under the RM30 ceiling) |
| Objective | Sales |
| Optimisation event | **Leave on `Lead`** — see below |
| Geo | Malaysia |
| Age | 25–45 |
| Interest | **`6832284024121` — "Vehicle sales websites (websites)"** |
| Landing | `https://paqar.my/?utm_source=meta&utm_medium=paid_social&utm_campaign=reviewed_offer_aug26&utm_content=price_stated` |

**On the interest**: validated against this ad account, not the global search —
per the standing rule that global `/search` returns interests that aren't
targetable. `6832284024121` is real, targetable here, and 850k–1M worldwide,
which narrows hard against Malaysia geo. It is the closest thing Meta has to
"currently browsing car sales sites". **There is no Mudah.my or Carlist brand
interest** — both queries return only generic fallbacks. Don't let anyone tell
you otherwise.

**On leaving optimisation at `Lead`**: moving it to `InitiateCheckout` is the
theoretically right answer and the practically wrong one. There are ~4 IC events
a month; Meta needs roughly 50 a week to leave the learning phase, so RM180 on
IC optimisation buys an under-delivering ad set and no data. `ViewContent` is no
better — it is also a free action. Fix the intent in the **creative and the
audience**, where the money is enough to move something, and revisit the event
only once IC volume justifies it.

**On RM180 and one ad set, not RM300 and two.** The first draft of this brief
asked for RM300 over 10 days. That would have moved
`MAX_ADSET_LIFETIME_BUDGET_MYR`, `MAX_NEW_COMMITMENT_MYR` and
`TEST_DURATION_DAYS` at once — three safety constants loosened for one
experiment, which is exactly what `guards.ts` exists to catch. RM180 is what a
single creation run may already commit and 7 days is already the schedule, so
the test was refitted to the envelope instead. One constant moved:
`MAX_ADSET_LIFETIME_BUDGET_MYR` 90 → 180, because this is a **one-arm** test and
the whole commitment has to sit in a single ad set. `MAX_NEW_COMMITMENT_MYR`
stays at 180, so two ad sets at the new ceiling are still refused by
`authoriseNewSpend` before either is created. The shape changed; the total did not.

### The prediction, written before spending

**CTR will fall — from 9.48% to somewhere near 1.5–2.5%. That is the point.**
Putting RM29 in the ad is the cheapest intent filter available, and a click that
costs more but knows the price is the entire hypothesis. CPC will rise, probably
from RM0.19 to RM0.30–0.40.

**Judge it on `checkout_started / landing_page_view`.** Not CTR, not CPC, not
cost per lead. RM180 at a risen CPC buys roughly 450–500 clicks and **~350
landing views**. The existing checkout rate is roughly 1%; anything at or above
**3%** justifies more budget, and 1 purchase would be the first paid customer
this channel has ever produced at the current price.

**Kill it early** if 200 landing views produce zero `checkout_started`. That is
enough to say the ad is not the problem, and it saves half the budget.

### Budget — the code half is DONE

```
  RM494.15   true lifetime spend (account insights, maximum)
+ RM180.00   this test
= RM674.15   projected, so RM675 is the minimum that fits
  RM700      authorised
```

Already changed and verified in the repo:

- `MAX_TOTAL_SPEND_MYR` **625 → 700**, with the raise recorded in the history
  comment in the established style, including why this test differs from the
  three before it.
- `MAX_ADSET_LIFETIME_BUDGET_MYR` **90 → 180**, with the one-arm reasoning and
  an explicit note that it does not widen what a creation run may spend.
- Pinned assertions in `__tests__/lib/meta-ads-safety.test.ts` updated. One of
  them, `isLifetimeBudgetAllowed(9001, 7)`, had the old RM90 ceiling baked into
  a test whose actual subject is the *daily* rate — it now derives from the
  constant and asserts the daily property at both ceilings.
- **222 meta-ads tests pass.**

**The one thing only you can do:** set Meta's **account** spending limit to
**RM700 exactly** in Ads Manager. `isSpendCapAllowed()` requires an exact match,
so preflight fails until it is set — and Meta's limit, not the constant, is the
primary protection. Campaign-level limits remain unusable; the MYR minimum is
RM500.

---

## Creative brief

The winner was **video** (9.48%) over static graphics (6.06%), so lead with
video.

### Do this first — it beats any generated asset

A 12-second screen recording of the real thing on a phone:

1. Paste a Mudah link into the box on paqar.my (2s)
2. Cut to the released report's verdict card (3s)
3. Hold on the numbers — **MAHAL · Seller minta RM39,800 · Julat RM29,900–37,800 · Target RM34,000–36,500** (5s)
4. End card: **RM29 · Disemak oleh manusia · Biasanya 30 minit** (2s)

No voiceover, no music, no stock footage. Thumb-shot, screen-recorded, slightly
imperfect. It is unfakeable, it costs nothing, and it shows the product instead
of describing it. Generated video cannot show a real verdict card.

### Ad copy (Malay-first, checked against the standing copy rules)

**Primary text**
> Dah jumpa kereta di Mudah atau Carlist, tapi tak pasti harga tu berpatutan?
>
> Hantar link iklan tu. Orang kami baca iklan yang itu, banding dengan iklan setanding yang ada sekarang, dan beritahu berapa patut anda tawar — dan bila patut jalan.
>
> RM29. Biasanya siap dalam 30 minit. Bukan robot, bukan laporan auto.

**Headline**
> Berbaloi ke harga tu? RM29, disemak orang.

**Description**
> Semak sebelum bayar deposit

**CTA button:** `Learn More` (not Shop Now — the landing page is an intake form)

Claim-safety check against `feedback_copy_claim_safety`: says "deposit" alone
(not "booking atau deposit"); says **"seller"**, not "penjual"; the flat
`RM29` form is correct here because it names the base report exactly, not a
"from" range; no "Percuma" anywhere near a feature list; no odometer or
tampering claim. Pull the figure from `BASE_REPORT_LABEL` when this reaches
code — do not retype it.

### ChatGPT / image-gen prompts, if you want a static backup

Static lost to video by 3.4 points, so treat these as the B option.

**Prompt 1 — the verdict card**
```
A clean, calm mobile app screenshot mockup, portrait 1080x1350, for a
Malaysian used-car app. White background, generous whitespace, plain
sans-serif (Inter). A single card with a soft red-tinted background
(#FEF2F2) containing, top to bottom:

  small grey uppercase label: "KEPUTUSAN PAQAR"
  large bold red word: "MAHAL"
  bold black line: "Jangan bayar deposit dulu."
  three label/value rows in grey and black:
    "Seller minta"                RM39,800
    "Julat iklan setanding"       RM29,900 - RM37,800
    "Lebih tinggi dari harga tengah"  RM4,900   (in red)
  a thin divider, then:
    "Cadangan"
    "Target RM34,000-RM36,500"

No gradients, no glow, no drop shadows, no stock photography, no smiling
people, no abstract finance imagery, no neon. Restrained and slightly
under-designed, like a well-made banking app that has existed for ten
years. Single accent colour only.
```

**Prompt 2 — the contrast frame**
```
Portrait 1080x1350 split-screen graphic, minimal flat design, calm and
restrained. Left half, muted grey: a generic used-car listing page with a
large price and the small caption "Harga yang seller minta". Right half,
white with one deep-green accent (#3D472F): the same car with a price
band and the caption "Harga iklan setanding hari ini". Between them, one
thin vertical rule and a small red tag reading "RM4,900".

No photographs of people, no gradients, no 3D, no neon, no AI-looking
illustration style. Plain sans-serif. Lots of whitespace.
```

**Prompt 3 — video, if you won't screen-record**
```
12-second vertical 9:16 video, no people on camera. A hand holds a phone
showing a Malaysian car listing; the hand copies the link and pastes it
into a simple white form. Cut to a clean report card appearing on the
same phone with the word "MAHAL" in red and a price range beneath it.
Hold. End on a plain white card: "RM29 - Disemak oleh manusia".

Calm, quiet, documentary-plain. Natural indoor light. No music sting, no
zoom effects, no motion graphics, no stock-footage look, no smiling
actors, no neon or gradient overlays.
```

Every prompt carries the DESIGN.md prohibitions explicitly (no gradients, no
stock people, no abstract finance imagery, no neon, no AI-illustration look) —
generators default to exactly those and will drift there unless told not to.

---

## Order of operations

Run the Reddit post **first**. It costs nothing, it produces the public proof
and the customer language, and any line that lands in that thread is a tested
ad headline. Launching Meta before it means writing creative from a guess for
the fourth time.
