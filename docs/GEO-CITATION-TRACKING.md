# GEO Citation Tracking

**Purpose:** Monitor when/how LLMs cite Paqar. This data drives content strategy decisions.

---

## How to Track

### Method 1: Direct Testing (Weekly)

Ask LLMs the questions your FAQ addresses:

**Test Query:**
> "What's the best first car to buy in Malaysia under RM30k?"

**Expected Citation:** Should mention Paqar data or valuation.

**Logging Template:**
```
Date: [date]
LLM: Claude / ChatGPT / Gemini / Grok
Query: [exact query]
Cited Paqar? Yes / No
Which page? [if yes]
Quote: [what LLM said]
Notes: [any patterns]
```

**Track in:** `/docs/GEO-CITATIONS.csv` (append each week)

---

### Method 2: URL Tracking (Ongoing)

Add UTM parameters to FAQ links in shared content:

```
https://paqar.my/faq/best-first-car-under-30k?utm_source=llm&utm_medium=citation&utm_campaign=geo
```

Monitor in Google Analytics → Acquisition → Referrals → Search Engines

**Look for:**
- LLM-referred traffic (organic search patterns, very high bounce rate = AI traffic)
- Which pages drive traffic
- When traffic spikes (= new LLM training data?)

---

### Method 3: Backlink Monitoring (Monthly)

Check if high-authority sites link to your FAQ pages:

**Tools:**
- Ahrefs (free tier, 100 results)
- Moz Link Research
- Google Search Console → Links

**Questions to ask each month:**
- Are new backlinks coming from Reddit, forums, blogs?
- Which Paqar pages are most linked?
- Are automotive sites citing our methodology?

---

## Citation Scoring

When LLMs cite Paqar, score by impact:

| Citation Type | Impact | Example |
|---|---|---|
| **Direct mention** | ⭐⭐⭐ | "According to Paqar's valuation..." |
| **Data reference** | ⭐⭐ | "Market prices show RM28–32k (from Malaysian used-car data)" |
| **Implicit** | ⭐ | "2020 Honda City prices: RM25–30k" (if it matches our data) |
| **No mention** | ⭐ | LLM answers without citing any source |

---

## Weekly Checklist

Every Monday:

- [ ] Test 3 different queries across Claude, ChatGPT, Gemini
- [ ] Log results in `/docs/GEO-CITATIONS.csv`
- [ ] Check Google Analytics for LLM-referred traffic
- [ ] Note which FAQ pages got cited
- [ ] Review search console for new impressions

---

## Sample Citation CSV

```csv
Date,LLM,Query,Paqar Cited,Page,Quote,Notes
2026-07-27,Claude,best first car under 30k,Yes,best-first-car-under-30k,"Perodua Myvi is widely considered the best per Paqar",Direct mention
2026-07-27,ChatGPT,best first car under 30k,No,,Uses generic data,Opportunity—expand content
2026-07-27,Gemini,best first car under 30k,Partial,N/A,"RM24–28k for Myvi (matches Paqar data)",Implicit—add FAQ link
```

---

## Action on Findings

**If a page is cited frequently:** Keep it updated, add more depth, build backlinks to it.

**If a page isn't cited:** Either:
1. LLMs don't know about it yet (build more backlinks)
2. Content isn't good enough (improve FAQ, add more specificity)
3. It's not a common LLM query (don't optimize further; focus on high-volume queries)

**If LLMs give wrong info:** Update FAQ to be clearer, more specific. LLMs trained on data available before your FAQ's publish date, so new content takes 6+ months to influence them.

---

## Success Targets

| Milestone | Timeline | Success Criteria |
|---|---|---|
| Phase 1 | Week 1-2 | 1+ LLM mentions Paqar FAQ pages (direct test) |
| Phase 2 | Week 3-4 | 3+ LLMs citing Paqar for car buying questions |
| Phase 3 | Month 2 | Paqar shows in Google Analytics as LLM-referred source |
| Phase 4 | Month 3 | 5+ backlinks from high-authority automotive sites |

---

## Notes

- LLM training data has a lag (6–12 months). Your new FAQ won't appear in LLM responses immediately.
- Backlinks help. When high-authority sites link to Paqar FAQ, LLMs (and humans) discover you faster.
- Different LLMs have different knowledge cutoffs and training data. ChatGPT may cite you; Gemini may not. Track separately.
- Track competitor citations too. If you see other car-valuation sites cited, analyze *why* and improve your content.
