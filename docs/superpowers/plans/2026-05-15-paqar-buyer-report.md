# Paqar — Wave 2: Used Car Buyer Report

> **STATUS: DRAFT** — This document reflects strategic decisions made as of 2026-05-03. Review before implementation begins. Wave 1 (scaffold + saman/blacklist check) is unaffected and continues as planned.

---

## Context

The Used Car Buyer Report is Paqar's primary monetisation feature. This document supersedes the original RM39-69 single-tier spec from the README with a revised positioning, pricing, and product structure based on honest data availability constraints for Year 1.

**Core insight:** Without a MyEG/JPJ partnership (RM5K-50K setup capital, not committed in Year 1), we cannot deliver a Carfax-equivalent history report. The honest product at the honest price is RM12-19. Positioning as a "pre-purchase verification toolkit" rather than a "comprehensive history report" matches what we can actually deliver with free/scraped data and user-uploaded documents — and is more defensible from a trust perspective.

---

## Positioning

**Old:** "Comprehensive used car history report"
**New:** "Pre-purchase verification toolkit"

The toolkit helps the buyer:
1. Verify what the seller is claiming
2. Spot red flags and inconsistencies
3. Know exactly what to verify themselves before committing
4. Negotiate from an informed position

This framing is honest about limits, doesn't over-promise, and still delivers real value. The report's credibility comes from the verification status taxonomy (see below) — being explicit about what we know vs. what we're taking on faith is the trust mechanic.

---

## Three-Tier Product Structure

### Free Tier — Acquisition + Lead Generation

- Basic verdict (Green / Amber / Red)
- Saman/blacklist check on the vehicle (reuses Wave 1 infrastructure)
- Market price benchmark vs current listings (scraped from Mudah, Carlist, MyTukar, Carsome)

Purpose: create a magic moment, demonstrate value, capture the buyer's intent, upsell to Standard.

### Standard Tier — RM12-19 (Year 1 primary monetisation)

Full report including all sections in the Report Structure below. Delivered as a one-time purchase at the moment of highest buyer intent (about to pay deposit).

Delivered with:
- AI document parsing of all buyer-uploaded documents (Claude API)
- AI photo analysis for repair signs and panel inconsistency (Claude vision API)
- Guided JPJ check with AI parsing of buyer-uploaded printout
- Specific actionable recommendations, dollar-quantified where possible
- Listing history (whether this exact car has been listed before, at what prices)
- Manufacturer recall lookup
- Public mention scan (forums, news — best effort)

### Premium Tier — RM39-49 (Year 2 unlock)

Adds paid accident history report from a third-party data provider.

**Blocked on:** research and partnership with insurance industry data providers. Paths to investigate: Bjak's data sources, PIAM, ISM, Allianz/Etiqa B2B data products.

Do not build Premium tier infrastructure in Year 1. Document it as the unlock condition for the MyEG/JPJ partnership evaluation trigger (see README — Year 2 Upgrade Paths).

---

## Buyer Input Flow

Captured upfront before any evidence upload or analysis. All fields used to improve downstream analysis accuracy, especially market pricing (a 2018 Civic 1.5T Premium has different pricing from base 1.5T).

**Required:**
- Plate number

**Strongly recommended (improves analysis):**
- Brand / model / year / variant
- Claimed mileage
- Asking price
- Seller type (private owner / dealer)
- Location (state)

Design principle: collect what's needed, no more. Don't turn the intake form into a bureaucratic hurdle.

---

## Evidence Upload Step

Buyer uploads what they have. Each document is optional. The system gracefully degrades when documents are missing — missing items become "Needs proof" findings in the report rather than blockers.

**Documents:**
- VOC / grant photo
- Puspakom B5 report
- Latest roadtax / insurance documents
- Service receipts / service book photos
- Loan settlement letter (if seller claims fully paid)

**Photos:**
- Odometer (required for mileage verification)
- Chassis number (VIN plate)
- Engine bay
- Exterior — multiple angles (front, rear, both sides, all four corners)
- Interior

Each missing document surfaces as a specific finding: "Seller declares no outstanding loan — no settlement letter provided to verify" (status: Self-declared / Needs proof).

---

## Verification Status Taxonomy

Every finding in the report carries exactly one of these labels. Applied per-finding, not as a footnote. This taxonomy is the core honesty mechanic — it's what makes the report credible.

| Status | Meaning |
|---|---|
| ✅ Verified | Directly confirmed via Paqar's own data sources |
| 📝 Self-declared | Seller stated this; no independent proof available or provided |
| ⚠️ Needs proof | Supporting document was requested; not yet provided by buyer |
| ❓ Unable to verify | No data source available in Malaysia for this claim |
| 🚨 High-risk signal | Inconsistency or concern detected between sources |

Implementation note: the report renderer must enforce this taxonomy consistently. Every finding must map to one status. "We checked and it's fine" looks different from "the seller told us and we have no way to verify." Buyers deserve to know the difference.

---

## Specific Actionable Recommendations

Every report ends with a dedicated recommendations section. Each recommendation is:
- **Specific** — not "consider negotiating" but "negotiate RM4,000-RM6,000 lower"
- **Dollar-quantified** where data supports it
- **Actionable** — tells the buyer exactly what to do or what to say to the seller

Examples:
- "Negotiate RM4,000-RM6,000 lower based on market benchmark — similar listings range RM65K-78K, asking RM72K is at the upper end of the market"
- "Request the latest loan settlement letter from the seller before paying any deposit — seller declared no outstanding loan but provided no document to verify"
- "Inconsistency detected: service book shows 92,000 km in June 2025 but odometer photo shows 87,453 km now. Ask the seller to explain this before proceeding"
- "AI detected possible front-right quarter panel replacement based on paint texture inconsistency. Recommend physical pre-purchase mechanic inspection before committing"
- "This plate was listed on Mudah in March 2025 at RM68,000 — current asking price of RM74,000 is RM6,000 higher. Seller has not explained the price increase"

This section is the product's highest-value output. It transforms the report from diagnostic to advisory. It's what justifies the price and what the buyer will share with friends.

---

## Data Sources

### In scope for Year 1 (free or near-free)

| Source | What it provides | Method |
|---|---|---|
| Wave 1 saman/blacklist system | Outstanding saman and blacklist status on the vehicle | Existing infrastructure |
| Mudah, Carlist, MyTukar, Carsome, Facebook Marketplace | Market price benchmark, listing history | Scraping |
| Manufacturer announcements | Recall lookup | Scraping |
| Forums, news sites | Public mention scan | Scraping (best effort) |
| Claude API (document parsing) | Parse Puspakom B5, grants, service books, loan letters | AI |
| Claude vision API (photo analysis) | Detect repair signs, panel inconsistency, mileage display verification | AI |
| Buyer-uploaded JPJ printout | Ownership history, outstanding charges, grant authenticity | Guided self-service + AI parsing |

### Out of scope for Year 1

| Source | What it would provide | Why deferred |
|---|---|---|
| Direct JPJ API via MyEG | Ownership history without buyer self-service | Requires RM5K-50K partnership setup — not justified until 5,000+ monthly reports |
| Insurance/accident history DB | Claim and accident records | Requires paid third-party partnership — Year 2 path (Premium tier unlock) |
| Manufacturer service records | Verified service history | Partnership-dependent — Year 2-3 path |

---

## Guided JPJ Check

Rather than waiting for a MyEG partnership, JPJ verification is positioned as a guided self-service flow. This sidesteps the partnership requirement entirely while still getting JPJ-verified data into the report.

**Flow:**
1. Paqar shows the buyer exactly how to query JPJ themselves:
   - Visit any JPJ counter, OR
   - Use MySIKAP online (walk through the exact steps)
   - Provide the plate number, pay the small fee (approx RM5-10)
   - Receive the printout or digital report
2. Buyer uploads the JPJ printout to Paqar
3. Claude API parses it and integrates findings into the report with ✅ Verified status

**Upgrade path:** When MyEG partnership is triggered (5,000+ monthly reports sustained), replace the self-service flow with direct API integration. The buyer no longer needs to visit JPJ — we query directly. All downstream report sections remain identical; only the data acquisition method changes.

---

## Report Structure

### Top-level verdict
Overall Green / Amber / Red — single orientation before any detail. Derived algorithmically from the findings across all sections.

### Section 1: Market Position
- Asking price vs market median ✅ Verified (scraped data, cite the sources)
- Listing history — has this exact plate been listed before, at what prices, for how long ✅ Verified (our scraped data over time)
- Days on market analysis (longer = more room to negotiate) ✅ Verified

### Section 2: Outstanding Issues on Vehicle
- Saman against this plate ✅ Verified (Wave 1 system)
- Active manufacturer recalls ✅ Verified (scraped from manufacturer sites)
- Public mentions of concern (forum complaints, news incidents) ✅ Verified or ❓ Unable to verify

### Section 3: Document Verification
- Puspakom B5 mileage — cross-check against odometer photo and service book ✅ Verified / ⚠️ Needs proof / ❓ Unable to verify
- Grant authenticity — AI analysis of uploaded grant photo 📝 Self-declared / ✅ Verified (if JPJ printout uploaded)
- Service history consistency — cross-check dates, mileage entries, stamps ✅ Verified / 📝 Self-declared / 🚨 High-risk signal
- Insurance status ✅ Verified / ⚠️ Needs proof
- Loan settlement — outstanding encumbrance check ✅ Verified (if JPJ printout uploaded) / 📝 Self-declared / ⚠️ Needs proof

### Section 4: Photo Analysis
- AI accident repair detection — paint texture, panel gaps, colour matching inconsistencies (with confidence level, e.g. "Moderate confidence — recommend physical inspection") ✅ Verified
- Body panel consistency ✅ Verified
- Mileage display verification — cross-check odometer photo reading against claimed mileage ✅ Verified / 🚨 High-risk signal

### Section 5: JPJ Check (only shown if buyer uploaded printout)
- Ownership history — number of previous owners, dates of transfer ✅ Verified
- Outstanding charges / encumbrances ✅ Verified
- Grant authenticity ✅ Verified

### Section 6: Recommendations
- Specific negotiation guidance with dollar amounts
- Documents still needed from seller before committing
- What to ask the seller to explain
- What to verify physically before handing over deposit
- Overall buy / proceed with caution / walk away guidance

---

## MyEG Application — Deferred

**Previous plan:** begin application during Wave 1 build.
**Updated plan:** evaluate when 5,000+ monthly Buyer Reports are sustained for 3+ consecutive months.

Rationale: don't invest setup capital (RM5K-50K) until volume justifies the amortisation. Year 1 launch does not require MyEG partnership — guided JPJ check covers the data need without the upfront cost.

Trigger conditions for revisiting:
- Sustained volume that justifies setup amortisation
- Premium tier demand indicating willingness to pay more for direct data
- Competitive pressure requiring deeper data integration

---

## Technical Implementation Notes (for when Wave 2 build begins)

- Report generation is async — buyer submits, gets a "report in progress" state, receives notification when complete
- Claude API document parsing: use Claude Sonnet for cost efficiency; Claude Opus for complex multi-document cross-checks
- Photo analysis: batch all photos in a single Claude vision call with structured output; specify exactly what inconsistencies to look for
- Market scraping: schedule regular scraping runs (daily or near-daily); store historical listing data with plate as key — this is what enables "listing history" feature
- Report storage: generate PDF server-side; store in Supabase Storage; link expires after 30 days (buyer can re-download within window)
- Payment: Stripe for card, iPay88 for FPX — FPX is essential for Malaysian market

---

## Open Questions (resolve before Wave 2 build begins)

1. **Paid accident history providers:** Who can we partner with for Premium tier? Research PIAM, ISM, individual insurers. What's the per-query cost? What's the API surface? This determines whether Premium tier is viable at RM39-49.

2. **Puspakom B5 data access:** Can Puspakom B5 records be accessed directly, or is upload-and-parse the only path? Is there a scraping target?

3. **Pricing validation:** Run a landing page test for the Standard tier at RM12-19 before building the full feature. Capture payment intent (not actual payment) to validate willingness-to-pay at the new price point.

4. **Seller Trust Pack interaction:** Can a buyer report feed into a seller trust pack for the same vehicle? If the buyer becomes a seller later, the report data could be re-used with consent. Explore the data model implications.

5. **Report delivery UX:** Push notification vs email vs in-app. For a RM12-19 product, the delivery experience matters. Explore what "done" looks like from the buyer's perspective.
