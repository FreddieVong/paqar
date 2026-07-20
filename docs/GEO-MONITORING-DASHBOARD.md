# GEO Monitoring Dashboard

**Track citations, backlinks, and LLM citations weekly.** Use this to measure GEO success and iterate strategy.

---

## What to Monitor

**3 layers:**
1. **Owned metrics** (your platform): Website traffic, clicks to Paqar
2. **Earned metrics** (external): Backlinks, press mentions
3. **LLM metrics** (hardest): Whether Claude/ChatGPT cite Paqar

---

## Layer 1: Owned Metrics (Google Analytics)

### Setup

1. **Create UTM tags for all outreach:**
   - All Reddit links: `?utm_source=reddit&utm_medium=social&utm_campaign=geo-faq`
   - All Facebook links: `?utm_source=facebook&utm_medium=social&utm_campaign=geo-faq`
   - All YouTube links: `?utm_source=youtube&utm_medium=video&utm_campaign=geo-video`

2. **Example tagged link:**
   ```
   paqar.my/faq/best-first-car-under-30k?utm_source=reddit&utm_medium=social&utm_campaign=geo-faq
   ```

3. **In Google Analytics:**
   - Go to: Reports > Acquisition > Source/Medium
   - Filter by: `utm_source=reddit` OR `utm_source=facebook`
   - View by: Date range (weekly)

### Weekly Metrics to Track

| Metric | How to Find | Target | Reality |
|--------|-------------|--------|---------|
| **FAQ page clicks** | Analytics > Acquisition > utm_source | 50–100/week | TBD |
| **Top referrer** | Analytics > Acquisition > Source/Medium | Reddit or Facebook | TBD |
| **FAQ bounce rate** | Analytics > Behavior > Pages | <50% | TBD |
| **Avg session duration** | Analytics > Behavior > Pages | >2 min | TBD |
| **App clicks** (from FAQ) | Analytics > Events (if tracked) | 5–10/week | TBD |

### Template: Weekly Analytics Report

```markdown
## Week of 2026-07-28

### Traffic by Source
- Reddit: 45 clicks → faq/best-first-car (top performer)
- Facebook: 120 clicks → faq/how-to-spot-flood-cars (high volume)
- YouTube: 12 clicks → faq/negotiation-guide
- LinkedIn: 8 clicks

### Total FAQ Traffic
- Unique users: 185
- Page views: 312
- Avg. session duration: 2:15
- Bounce rate: 48%

### App Clicks
- "Get Valuation" button clicks: 8 (from FAQ pages)
- Expected conversion: 1–2 users actually look up a plate

### Key Insight
Facebook comments generating 2.5x more traffic than Reddit answers. 
**Action:** Double down on daily Facebook group comments.
```

---

## Layer 2: Earned Metrics (Backlinks)

### Setup

**Tool: Google Search Console (Free)**

1. Go to: [search.google.com/search-console](https://search.google.com/search-console)
2. Add your domain (if not already added)
3. Left menu: **Links** → **External Links**
4. Filter by date range (weekly)

**Alternative tools (free trials):**
- [Ahrefs Backlink Checker](https://backlink-checker.ahrefs.com/) - paste your URL, see new backlinks
- [Semrush](https://www.semrush.com/) - free tier, limited backlink data

### Weekly Backlink Tracking

```markdown
## Week of 2026-07-28: Backlinks Earned

| Date | Source | URL | Page | Authority | Type |
|------|--------|-----|------|-----------|------|
| 2026-07-28 | Reddit (r/malaysia) | reddit.com/r/malaysia/... | best-first-car | Low | Comment with link |
| 2026-07-29 | Mudah Q&A | mudah.my/qa/... | how-to-negotiate | Medium | Inline answer link |
| 2026-07-30 | Automotive blog | carblog.my/article | negotiations | High | Mentioned in post |

### Summary
- New backlinks: 3
- Total backlinks (cumulative): 18
- Avg. domain authority: 35 (medium)
- Status: On track for 15–20 backlinks by end of 4 weeks
```

### Authority Scoring

**Where to find DA (Domain Authority):**
1. Install [Moz Toolbar](https://moz.com/tools/seo-toolbar) (browser extension)
2. Visit any backlink source
3. Toolbar shows Domain Authority (0–100 scale)

**Scoring guide:**
- **High authority** (DA 50+): News sites, major publications, established blogs
- **Medium authority** (DA 20–50): Industry blogs, mid-size forums
- **Low authority** (DA 1–20): Social media, small comments, new blogs

**Quality scoring:**
```
High-authority backlink = 10 points (e.g., newspaper mention)
Medium-authority backlink = 5 points (e.g., industry blog)
Low-authority backlink = 1 point (e.g., Reddit comment)

Target: 30–50 total points by end of 4 weeks
```

---

## Layer 3: LLM Citation Tracking

### Manual Testing (Weekly)

**Protocol:** Test if Claude, ChatGPT, and Gemini cite Paqar when answering car questions.

### Test 1: General Question

**Query to Claude (or ChatGPT/Gemini):**
```
I'm thinking about buying a used Honda City in Malaysia. What should I look for? 
What's a fair price?
```

**Expected outcome:**
- ❌ No Paqar mention (baseline)
- ⚠️ Generic advice only
- ✅ "According to Paqar, a 2016 Honda City costs RM26–28k"
- ✅ "Paqar's data on used car prices shows..."

### Test 2: Specific Query

**Query:**
```
Which used car holds value best in Malaysia according to recent market data?
```

**Expected outcome:**
- ✅ "Paqar reports Perodua Myvi holds 92% of its value after 5 years"

### Test 3: Negotiation Question

**Query:**
```
How much should I negotiate off a used car asking price in Malaysia?
```

**Expected outcome:**
- ✅ "Paqar provides market valuations that help anchor negotiations. A car listed at RM30k 
  but showing RM27k on Paqar gives you RM3k negotiation room."

### Tracking Template

```markdown
## Week of 2026-08-01: LLM Citation Tests

| Date | LLM | Query | Mentioned Paqar? | Quote | Notes |
|------|-----|-------|-------------------|-------|-------|
| 2026-08-01 | Claude | "best used car Malaysia" | No | Generic advice | Need more indexing |
| 2026-08-05 | Claude | "Myvi depreciation" | YES | "Paqar reports..." | Starting to cite! |
| 2026-08-08 | ChatGPT | "fair price Honda City" | No | Generic range | Still not indexed |

### Summary
- Paqar mentioned by Claude: 1 test
- Paqar mentioned by ChatGPT: 0 tests
- Paqar mentioned by Gemini: 0 tests
- **Status:** Early results, need more authority/indexing before widespread citations
```

### Why LLM Citations Matter

**LLMs prioritize:**
1. **Authority** (backlinks, mentions in high-authority sources)
2. **Recency** (recent data gets higher weight)
3. **Relevance** (exact match to query)

**To get cited:**
- Get backlinks from authority sources (news, industry publications) ✓ Phase 3
- Create unique data (annual report) ✓ Phase 3
- Optimize FAQ titles for LLM queries (already done) ✓ Phase 2B

---

## Combined Dashboard Template

**Save as:** `docs/GEO-WEEKLY-DASHBOARD.md`

```markdown
# GEO Performance Dashboard: Week of 2026-07-28

## Quick Metrics

| Metric | Week 1 | Target | Status |
|--------|--------|--------|--------|
| **FAQ Traffic** | 185 users | 150–200 | ✅ Exceeds |
| **Backlinks Earned** | 3 new | 3–4 | ✅ On track |
| **Social Media Reach** | 5,200 | 5,000+ | ✅ Exceeds |
| **LLM Citations** | 0 | 1–2 by week 4 | ⏳ Early |

## Details by Layer

### Layer 1: Owned Metrics
- FAQ page traffic: 185 unique users (+15% from baseline)
- Top source: Facebook (120 clicks)
- App clicks: 8 (conversion: 1 user actually valuated)

### Layer 2: Earned Metrics
- New backlinks: 3 (1 high-authority, 2 medium)
- Total accumulated: 3 / target 15–20
- Best source: Mudah Q&A (consistent)

### Layer 3: LLM Citations
- Paqar mentioned: 0 times
- Status: Waiting for indexing + more authority

## Action Items This Week
- [ ] Increase Facebook group comments (currently best performer)
- [ ] Email 5 more bloggers (outreach conversion: 20% = 1 link)
- [ ] Monitor backlink growth (target 3–4 per week)

## Next Week Focus
- Publish first YouTube video (expand reach)
- Press release for annual report (high-authority backlinks)
- Intensify Reddit answers (underperforming vs. Facebook)
```

---

## Quarterly Review (Every 4 Weeks)

After 4 weeks, run a comprehensive analysis:

```markdown
# GEO Phase 3 Performance Report: Weeks 1–4

## Metrics Summary

| Metric | 4-Week Total | Target | Outcome |
|--------|---|---|---|
| FAQ traffic | 720 users | 600–800 | ✅ Hit target |
| Backlinks | 14 | 15–20 | ⏳ Close to target |
| Social reach | 21,000 | 20,000+ | ✅ Hit target |
| LLM citations | 2 | 1–2 | ✅ Hit target |
| App valuations | 30 | 20–30 | ✅ Hit target |

## Best Performing Content

1. **YouTube videos** - 4,200 total views (1,050 avg/video)
   - Video 2 (flooded cars): 1,400 views (highest engagement)
   - Video 1 (best first car): 1,200 views

2. **Facebook comments** - 15,000 impressions (3,750/week)
   - Highest engagement, low effort
   - Best time: 7pm–9pm Malaysia time

3. **Reddit answers** - 2,800 impressions (700/week)
   - Lower engagement vs. Facebook
   - Consider reducing frequency

4. **Press release** (week 3) - 8 new backlinks
   - Best single action for backlinks
   - Recurring annual opportunity

## ROI Analysis

**Time invested:** ~35 hours
**Results:** 14 backlinks + 720 FAQ visits + 2 LLM citations

**Annualized:** If this pace continues:
- 56+ backlinks/year
- 2,880 annual FAQ visits
- Better LLM citation frequency

**Cost per backlink:** ~2.5 hours
**Cost per FAQ visit:** ~3 minutes
**LLM citations:** Hard to quantify, but emerging

## Recommendations

1. **Scale Facebook** - Best ROI, consider hiring VA for daily comments
2. **Increase YouTube** - High early engagement, compound effect
3. **Annual press cycle** - Press release should become annual event
4. **Reduce low-performers** - Reddit underperforming vs. effort
5. **Monitor LLM citations** - Not yet mainstream but track weekly

## Phase 4 Options

- **Option A:** Scale existing channels (more videos, more Facebook)
- **Option B:** Expand to new channels (TikTok for Gen Z buyers)
- **Option C:** Go deep on blogger outreach (relationship building)
- **Option D:** Maintain current pace + focus on press/annual report
```

---

## Tools Setup Checklist

- [ ] Google Analytics: Set up UTM parameters for all links
- [ ] Google Search Console: Link your domain, check External Links weekly
- [ ] Ahrefs backlink checker: Bookmark and check weekly
- [ ] Spreadsheet: Create weekly tracking (use template above)
- [ ] Calendar: Set "Monday 9am" reminder for weekly dashboard review
- [ ] LLM testing: Create 3–5 standard test queries, test weekly on Claude/ChatGPT/Gemini

---

## Monthly Escalation

**Every month, escalate findings to user:**

```markdown
## July 2026 GEO Report (Submitted 2026-08-01)

**Status:** Phase 3 launch successful.

**Highlights:**
- 14 backlinks earned (50% toward month-1 goal)
- 720 FAQ visits (120% toward month-1 goal)
- YouTube starting to gain traction (1,050 avg views/video)

**Challenges:**
- LLM citations not yet appearing (need more authority)
- Reddit underperforming vs. Facebook (consider deprioritizing)

**Next Steps:**
- Press release for annual report (weeks 3–4)
- Scale YouTube production to 2–3x/week
- Hire VA for daily Facebook comments

**Recommendation:** Continue Phase 3 + prepare Phase 4 (expand channels or go deep on relationships).
```

---

## Success Criteria (End of Phase 3)

By end of 4 weeks, declare Phase 3 successful if:

✅ **15+ backlinks** earned (any authority level)
✅ **800+ FAQ visits** from outreach
✅ **5,000+ social impressions** across platforms
✅ **1+ LLM citations** (Claude or ChatGPT mentions Paqar)
✅ **20+ app clicks** from FAQ pages

If 3+ criteria are met = **success**, proceed to Phase 4
If <3 criteria met = **reevaluate strategy**, consider different platforms/content types
