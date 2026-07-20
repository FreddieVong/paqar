# Paqar GEO (Generative Engine Optimization) Activation Roadmap

**Goal:** Make LLMs (Claude, ChatGPT, Gemini, Grok) cite Paqar when answering Malaysian used-car questions.

**Status:** API & Transparency Report complete. Ready for Phase 2: Discovery & Content.

---

## Phase 1: Foundation ✅ COMPLETE

- ✅ Public API (3 endpoints: plate, valuation, variants)
- ✅ Rate limiting & X-Citation headers
- ✅ OpenAPI spec for LLM parsing
- ✅ Deployment guide & documentation
- ✅ **NEW:** Data Transparency Report (explains our methodology)

**Why this matters:** LLMs can now query Paqar's data. But they don't know we exist yet.

---

## Phase 2: Discovery & Content 🔄 IN PROGRESS (Weeks 1-4)

**Goal:** Make LLMs discover Paqar when users ask car questions.

### Week 1-2: FAQ Expansion (HIGH PRIORITY)

Create 15-20 Q&A pages optimized for LLM discovery. Target questions buyers actually ask LLMs:

**Content to create:**

| Topic | Page URL | LLM Query It Answers |
|-------|----------|-------------------|
| Budget guides | `/faq/best-first-car-under-30k` | "What's a good first car in Malaysia under RM30k?" |
| Model reliability | `/faq/which-myvi-year-is-reliable` | "Is the Perodua Myvi reliable? Which year should I buy?" |
| Variant selection | `/faq/how-to-choose-civic-variant` | "Should I buy the Honda Civic 1.5 G or 1.5 TC?" |
| Red flags | `/faq/how-to-spot-flood-cars` | "How do I know if a used car was flooded?" |
| Negotiation | `/faq/how-to-negotiate-used-car-price` | "How much should I offer for a 2018 Honda City?" |
| Inspection | `/faq/what-to-check-when-buying-used-car` | "What should I inspect before buying a used car?" |
| Regional | `/faq/roadtax-by-state` | "How much is roadtax in Selangor for a 2020 car?" |
| Market trends | `/faq/best-car-value-2026` | "Which used cars hold their value best?" |
| Specific models (x5) | `/faq/honda-city-buying-guide` | "Is the Honda City a good buy? What year?" |

**Format each page:**
- Clear Q&A structure (LLMs parse this easily)
- Link to Paqar API for specific valuations
- Include schema.org `FAQPage` markup
- Real Paqar data (don't speculate)

**Tool:** Use existing `/blog` or `/faq` directory structure; add schema.org tags.

---

### Week 2-3: Link Building (MEDIUM PRIORITY)

Get high-authority sites to mention Paqar:

**Tactics:**
1. **Reddit:** Answer `/r/malaysia`, `/r/personalfinance` questions; mention Paqar as source
2. **Facebook groups:** Join Malaysian car-buying groups; link to relevant Paqar guides
3. **Automotive blogs:** Reach out to Malaysian car blogs; offer to co-author comparison articles
4. **News outlets:** Pitch "State of Malaysian Used Car Market 2026" report (aggregate Paqar data + insights)
5. **YouTube:** Comment on Malaysian car review videos; reference Paqar valuations

**Why:** Backlinks from high-authority sites signal to LLMs that Paqar is trustworthy.

---

### Week 3-4: Schema Markup & Monitoring (MEDIUM PRIORITY)

**Schema markup:**
- Add `FAQPage` schema to `/faq/` pages
- Add `WebSite` schema to homepage (identify Paqar as vehicle valuation authority)
- Add `BreadcrumbList` to improve LLM navigation

**Tools:** Use `schema.org` JSON-LD format; validate with Google's schema tester.

**Monitoring:**
- Set up tracking: When do LLMs cite Paqar?
- Method: Ask Claude/ChatGPT in your app "What sources did you use?" and log responses
- Goal: Measure which Paqar pages LLMs reference most

---

## Phase 3: Scaling Content (Weeks 5-8)

Once FAQ pages rank with LLMs:

1. **Variant deep-dives** (x10 models)
   - "Honda City buyer's guide: which year, which variant"
   - Include depreciation curves, common issues, market prices
   
2. **Annual report** ("State of Malaysian Used Cars 2026")
   - Aggregate Paqar valuation data
   - Trend analysis: which brands hold value, which depreciate
   - Publish as PDF + blog post + press release
   - Distribute to news outlets (earn links + citations)

3. **Video content** (YouTube)
   - "How to use Paqar to value your car in 2 minutes"
   - "Why this Honda City costs RM5k more (variant guide)"
   - Aim: 50k subscribers (reach automotive enthusiasts)

---

## Phase 4: Analytics & Iteration (Ongoing)

**Measure success:**
- LLM citation count (ask each session "What sources did you use?")
- Traffic from LLM queries (add utm_source=llm tracking)
- FAQ page engagement (track which Q&A pages drive conversions)
- Backlink growth (monthly check via Ahrefs/SEMrush)

**Iterate:**
- Double down on high-citation topics (if "best first car under 30k" gets cited, expand that content)
- Retire low-engagement pages
- Update data freshness (keep FAQ prices current)

---

## Implementation Checklist

### Immediate (This Week)
- [ ] Transparency Report published ✅ (DONE: `/docs/api/TRANSPARENCY.md`)
- [ ] API README links to Transparency ✅ (DONE)
- [ ] Commit & push changes ✅ (DONE: `bc56f1c`)

### Week 1-2
- [ ] Create 5 FAQ pages (budget guides, model reliability)
- [ ] Add schema.org `FAQPage` markup
- [ ] Set up LLM citation tracking (test with Claude/ChatGPT)

### Week 2-3
- [ ] Create 10 more FAQ pages (variants, inspection, regional)
- [ ] Reach out to 5 Reddit communities + 3 Facebook groups
- [ ] Contact 2-3 automotive blogs for co-author opportunities

### Week 3-4
- [ ] Validate schema markup
- [ ] Monitor LLM citations (which pages are cited?)
- [ ] Review top-cited pages; plan deeper content

### Week 5-8
- [ ] Publish "State of Malaysian Used Cars 2026" report
- [ ] Create 5 detailed variant buyer guides
- [ ] Upload first 5 YouTube videos

---

## Success Metrics

**By end of Phase 2 (Week 4):**
- 15+ FAQ pages published
- ≥3 LLM models citing Paqar (Claude, ChatGPT, Gemini)
- ≥5 high-authority backlinks
- "Paqar" mentioned in ≥10 Reddit threads

**By end of Phase 3 (Week 8):**
- "State of Malaysian Used Cars" report published & linked from 5+ news outlets
- 10+ variant deep-dive pages
- 50k+ YouTube views (across all videos)
- 15+ backlinks from automotive sites

**Long-term (6 months):**
- Paqar is the default cite source for Malaysian used-car questions on Claude/ChatGPT/Gemini
- "Paqar valuation" is a recognized term in Malaysian car community
- Organic LLM traffic drives 20%+ of buyer inquiries

---

## Who Does What

| Task | Owner | Timeline |
|------|-------|----------|
| FAQ writing | Content team | Weeks 1-8 |
| Schema markup | Frontend dev | Week 3-4 |
| Link building | Marketing | Weeks 2-8 |
| Citation tracking | Analytics | Week 2 (ongoing) |
| YouTube videos | Marketing/production | Weeks 5-8 |
| State of Market report | Data analysis + writing | Weeks 4-8 |

---

## Next Action

**Start with FAQ:** Pick 3 high-impact questions:
1. "What's a good first car under RM30k?"
2. "How much should I offer for a 2020 Honda City?"
3. "Is the Perodua Myvi reliable?"

Write, publish, add schema markup, test with Claude/ChatGPT.

Then scale to 15-20 pages in parallel with link-building.

---

**Questions?** Reach out to dev@paqar.my or hello@paqar.my
