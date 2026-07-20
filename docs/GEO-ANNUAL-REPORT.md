# GEO Annual Report: 2026 Malaysian Used Car Market

**Template + data collection guide for building annual report.** Use this to amplify Phase 3 impact and build thought-leadership.

---

## What is the Annual Report?

A comprehensive, publicly available report (PDF + webpage) analyzing 50,000+ used-car transactions across Malaysia.

**Why build it:**
- Press release material (5-10 high-authority backlinks)
- Newsworthy findings (journalists cite reports)
- Annual tradition (recurring backlink opportunity)
- Authority signaling (LLMs rank authority highly)

---

## Report Structure

```
📊 2026 Malaysian Used Car Market Report

EXECUTIVE SUMMARY
- Key findings (3-4 bullet points)
- Most valuable cars by budget
- Best depreciation profile

SECTION 1: MARKET OVERVIEW
- Total listings analyzed: 50,000+
- Price range: RM5k–RM500k
- Most common models: Myvi, City, Vios
- Geographic distribution

SECTION 2: PRICE TRENDS
- YoY price changes (+5% model X, -8% model Y)
- Best value segment (budget sweet spot)
- Price history (2014–2026)

SECTION 3: DEPRECIATION ANALYSIS
- Which models hold value best
- Which models lose value fastest
- Lifespan impact on resale

SECTION 4: MODEL BREAKDOWNS (Top 10)
- Perodua Myvi: price range, reliability, depreciation
- Honda City
- Toyota Vios
- Proton Persona
- [etc.]

SECTION 5: BUYING RECOMMENDATIONS
- Best value by budget (< RM15k, RM15-25k, RM25-35k)
- Best reliability
- Best resale potential

METHODOLOGY
- Data sources: Mudah.my listings, JPJ vehicle records
- Outlier filtering: 0.35–2.2× median
- Confidence scoring
- Special case handling

APPENDIX
- Data tables (raw price ranges, depreciation curves)
- Glossary
```

---

## Data Collection Guide

### 1. Pull Data from Supabase

```sql
-- Monthly valuation snapshots (best aggregated data)
SELECT 
  car_make,
  car_model,
  year_of_registration,
  AVG(wm_new_price) as avg_price,
  COUNT(*) as listings_count,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY wm_new_price) as median_price,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY wm_new_price) as q1,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY wm_new_price) as q3
FROM valuations
WHERE created_at >= '2026-01-01'
GROUP BY car_make, car_model, year_of_registration
ORDER BY listings_count DESC;

-- Top 10 models by volume
SELECT 
  car_make,
  car_model,
  COUNT(*) as total_listings
FROM valuations
WHERE created_at >= '2026-01-01'
GROUP BY car_make, car_model
ORDER BY total_listings DESC
LIMIT 10;

-- Depreciation curve (e.g., Honda City)
SELECT 
  year_of_registration,
  AVG(wm_new_price) as avg_price
FROM valuations
WHERE car_make = 'Honda' AND car_model = 'City'
  AND created_at >= '2026-01-01'
GROUP BY year_of_registration
ORDER BY year_of_registration;
```

**Export as CSV:**
```bash
# Via Supabase UI: Query → Export as CSV
# Save to: docs/GEO-annual-data-model-X.csv
```

### 2. Calculate Key Metrics

For each model:

**Average Price:**
```
Average Price = SUM(prices) / COUNT(listings)
```

**Depreciation Rate (annual):**
```
Depreciation % = ((Price_Year_N - Price_Year_N+1) / Price_Year_N) × 100
```

Example:
- 2020 Honda City: RM31,000 avg
- 2021 Honda City: RM27,500 avg
- Depreciation: (31,000 - 27,500) / 31,000 = 11.3% per year

**Value Retention (over 5 years):**
```
Retention % = (Price_Year_5 / Price_Year_0) × 100
```

Example:
- 2016 Honda City purchased for RM30,000
- 2021 market price: RM24,000
- Retention: 24,000 / 30,000 = 80%

### 3. Market Segmentation

Create price bands:

| Budget | Price Range | Best Models | Avg Reliability |
|--------|-------------|-------------|-----------------|
| Ultra Budget | RM5–12k | Myvi Gen 1, Saga | Good |
| Budget | RM12–20k | Myvi Gen 2, Vios Gen 1 | Very Good |
| Sweet Spot | RM20–30k | City, Vios Gen 2, Myvi | Excellent |
| Premium | RM30–50k | Accord, Civic, Camry | Excellent |

---

## Writing the Report

### Section 1: Executive Summary

```markdown
# 2026 Malaysian Used Car Market Report

## Executive Summary

This report analyzes 50,000+ used-car listings across Malaysia to reveal pricing trends, 
depreciation patterns, and value recommendations.

### Key Findings

- **Best Value Retention:** Perodua Myvi holds 92% of its value after 5 years (highest among 
  mainstream cars)
- **Fastest Depreciation:** Chinese brands (Chery, Geely) lose 40% value in first 3 years
- **Sweet Spot Segment:** 2015–2017 models priced RM20–30k offer best reliability-to-price ratio
- **Market Shift:** Used-car prices up 8% YoY as new-car prices remain elevated

### For Buyers

- Best first car under RM30k: **Perodua Myvi 2016–2018** (RM24–28k)
- Best features + reliability: **Honda City 2014–2018** (RM25–30k)
- Best longevity: **Toyota Vios 2013–2018** (RM22–28k)
- Avoid: Chinese brands, pre-2010 cars (maintenance costs exceed value)
```

### Section 2: Price Trends

```markdown
## Market Overview

### Volume & Range
- **Total listings analyzed:** 50,127 cars
- **Date range:** January–July 2026
- **Price range:** RM5,200–RM495,000
- **Median price:** RM24,500

### Most Common Models
1. Perodua Myvi: 8,200 listings (16.4%)
2. Honda City: 7,100 listings (14.2%)
3. Toyota Vios: 5,300 listings (10.6%)
4. Proton Persona: 3,200 listings (6.4%)
5. Perodua Kelisa: 2,100 listings (4.2%)

### Geographic Distribution
- Selangor/KL: 22,000 cars (43.9%)
- Johor: 8,500 cars (17.0%)
- Penang: 5,200 cars (10.4%)
- Others: 14,427 cars (28.7%)
```

### Section 3: Depreciation Analysis

```markdown
## Depreciation Patterns

### Best Value Retention (5-year)
| Model | Original Price | After 5 Years | Retention |
|-------|---|---|---|
| Perodua Myvi | RM28,000 | RM25,700 | 92% ✅ |
| Honda City | RM30,000 | RM24,000 | 80% |
| Toyota Vios | RM26,000 | RM20,800 | 80% |

### Annual Depreciation Rates
- Year 1–2: 15–20% (highest)
- Year 3–5: 5–10% per year (moderate)
- Year 5+: 3–5% per year (stabilizes)

**Insight:** Most depreciation happens in the first 2 years. Buying a 2–3 year old car 
saves 20% vs. new, but near-2016 models (5 years old) stabilize in value.
```

### Section 4: Model Deep-Dives

Create detailed 1-page profiles for top 5 models:

```markdown
## Perodua Myvi

**Overall Rating:** ⭐⭐⭐⭐⭐

### Pricing (2026)
- 2016–2018 (110k km): RM24–28k
- 2018–2020 (70k km): RM28–32k
- 2020+ (< 50k km): RM32–38k

### Reliability
- **Engine:** Rock solid (no major issues reported)
- **Transmission:** Manual/CVT both reliable
- **Common issues:** None at < 200k km
- **Spare parts:** Cheapest in market

### Resale
- **Holds value:** 92% after 5 years (best in class)
- **Easy to sell:** Huge market demand
- **Market depth:** Always 5+ listings

### Verdict
**Best all-around for first car buyers.** Unbeatable reliability, lowest ownership costs, 
strong resale. Trade-off: interior feels basic vs. City. Recommended age: 2015–2018.
```

---

## Turning Data Into Findings

**Formula for key finding:**

Data point + context + implication = finding

**Example:**
- **Data:** Myvi holds 92% value over 5 years
- **Context:** City holds 80%, Vios holds 80%
- **Implication:** Myvi depreciation is lowest → best for resale-minded buyers
- **Finding:** "Perodua Myvi offers best value retention, outperforming City by 12%"

---

## Report Layout (PDF)

**Design specs:**
- Cover page: title, date, logo
- TOC: quick navigation
- Executive summary: 1 page
- Sections: each 2–3 pages
- Appendix: raw data tables
- Back page: CTA ("Get valuations on paqar.my")

**Tools:**
- Google Docs → Export as PDF (free, looks professional)
- Canva (premium): polished design
- HTML + CSS → print as PDF (full control)

---

## Publishing & Promotion

### Phase 1: Launch
1. Write report (2–3 hours)
2. Export PDF + create webpage at `/annual-report-2026/`
3. Draft press release (see GEO-OUTREACH-TEMPLATES.md)

### Phase 2: Outreach
1. Email press release to 20+ automotive journalists
2. Post on Reddit (r/malaysia, r/personalfinance)
3. Share on LinkedIn (professional audience)
4. Contact automotive bloggers

### Phase 3: Measure
1. Track backlinks (Google Search Console, Ahrefs)
2. Monitor traffic from press mentions (UTM params)
3. Expected: 5–10 high-authority backlinks within 2 weeks

---

## Timeline

| Date | Task | Owner |
|------|------|-------|
| 2026-07-25 | Pull & analyze Supabase data | You |
| 2026-07-26 | Draft report + visuals | You |
| 2026-07-27 | Publish PDF + webpage | You |
| 2026-07-28 | Send press release | You |
| 2026-08-01 | Monitor backlinks | You |

---

## Expected Impact

- **Backlinks:** 5–10 high-authority links (news sites, blogs)
- **Traffic:** 200–500 monthly visits from press mentions
- **LLM Citations:** "According to Paqar's 2026 report..." appears in LLM outputs
- **Authority:** Cements Paqar as Malaysia's used-car data source

**ROI:** ~20 hours of work → 1-2 years of recurring monthly traffic + authority boost.
