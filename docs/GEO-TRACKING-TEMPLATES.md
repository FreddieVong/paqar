# GEO Tracking Templates

**Copy these into spreadsheets or CSV files to track execution and measure results.**

---

## Template 1: Weekly Analytics Report

**File:** `docs/GEO-WEEKLY-ANALYTICS.csv`

```csv
Date,Week_Starting,FAQ_Total_Users,FAQ_Total_Views,Reddit_Clicks,Facebook_Clicks,YouTube_Clicks,LinkedIn_Clicks,App_Button_Clicks,Bounce_Rate,Avg_Session_Duration
2026-07-28,2026-07-28,185,312,45,120,12,8,8,48%,2:15
2026-08-04,2026-08-04,[TBD],[TBD],[TBD],[TBD],[TBD],[TBD],[TBD],[TBD],[TBD]
2026-08-11,2026-08-11,[TBD],[TBD],[TBD],[TBD],[TBD],[TBD],[TBD],[TBD],[TBD]
2026-08-18,2026-08-18,[TBD],[TBD],[TBD],[TBD],[TBD],[TBD],[TBD],[TBD],[TBD]
```

**How to fill:**
1. **Date:** Report date (end of week, Sunday)
2. **FAQ_Total_Users:** From Google Analytics → Behavior → Pages → Filter `/faq/` → Unique Users
3. **FAQ_Total_Views:** Same report → Page Views
4. **Reddit_Clicks:** GA → Acquisition → Source/Medium → Filter utm_source=reddit
5. **Facebook_Clicks:** GA → Acquisition → Source/Medium → Filter utm_source=facebook
6. **YouTube_Clicks:** GA → Acquisition → Source/Medium → Filter utm_source=youtube
7. **LinkedIn_Clicks:** GA → Acquisition → Source/Medium → Filter utm_source=linkedin
8. **App_Button_Clicks:** GA → Events → Filter "get_valuation" button clicks (if tracked)
9. **Bounce_Rate:** GA → Behavior → Pages → `/faq/` average
10. **Avg_Session_Duration:** Same

**Update frequency:** Weekly (every Sunday night)

---

## Template 2: Social Media Posting Log

**File:** `docs/GEO-POSTING-LOG.csv`

```csv
Date,Platform,Topic,Post_Type,Link_URL,Posted,Status,Engagement_Metric,Engagement_Value,Reach,Notes
2026-07-28,Reddit,best-first-car,answer,https://paqar.my/faq/best-first-car?utm_source=reddit,yes,live,upvotes,250,1200,"High engagement, good discussion"
2026-07-28,Reddit,best-first-car,answer,https://paqar.my/faq/best-first-car?utm_source=reddit,yes,live,comments,8,1200,"Q&A about Myvi vs City"
2026-07-29,Facebook,red-flags,comment,https://paqar.my/faq/how-to-spot-flood-cars?utm_source=facebook,yes,live,likes,45,3500,"Posted in 3 car-buying groups"
2026-07-29,Facebook,red-flags,comment,https://paqar.my/faq/how-to-spot-flood-cars?utm_source=facebook,yes,live,comments,12,3500,"Good engagement on listing check"
2026-07-30,Mudah,negotiation,answer,https://paqar.my/faq/how-to-negotiate?utm_source=mudah,yes,live,upvotes,n/a,500,"Q&A platform post"
```

**Columns:**
- **Date:** When posted
- **Platform:** reddit, facebook, linkedin, youtube, instagram, mudah, etc.
- **Topic:** best-first-car, flood-detection, negotiation, etc.
- **Post_Type:** answer, comment, video, post, email
- **Link_URL:** Full URL with UTM parameters
- **Posted:** yes/no (track if actually posted)
- **Status:** draft, live, deleted
- **Engagement_Metric:** upvotes, likes, comments, views, retweets, shares
- **Engagement_Value:** Number
- **Reach:** Estimated impressions from platform
- **Notes:** Anything notable (high engagement, low engagement, why)

**Update frequency:** Daily (after each post)

**Example query:** "Which topics get highest engagement?" → Sort by Engagement_Value, group by Topic

---

## Template 3: Backlink Tracker

**File:** `docs/GEO-BACKLINKS.csv`

```csv
Date_Found,Source_Domain,Source_URL,Source_Title,Paqar_Page,Page_Title,Authority_Score,Link_Type,Manual_Check_Done,Verified,Anchor_Text,Notes
2026-07-28,reddit.com,https://reddit.com/r/malaysia/xyz,Best first car discussion,paqar.my/faq/best-first-car,Best First Car Under RM30k,low,mention,yes,yes,"best car under 30k","High engagement Reddit post"
2026-07-29,mudah.my,https://mudah.my/qa/abc,Q&A - First car buying,paqar.my/faq/best-first-car,Best First Car Under RM30k,medium,inline,yes,yes,"Paqar valuation","Answer to car question"
2026-07-30,automotive-blog.my,https://automotive-blog.my/article-123,Complete car buying guide,paqar.my/faq/how-to-negotiate,How to Negotiate,high,editorial,yes,yes,"[link]","Press release pickup"
2026-08-01,linkedin.com,https://linkedin.com/posts/user-xyz,Market transparency post,paqar.my/faq/best-first-car,Best First Car Under RM30k,medium,social,no,pending,"Market data source","Linkedin influencer share"
```

**Columns:**
- **Date_Found:** When you discovered the backlink
- **Source_Domain:** Domain linking to you
- **Source_URL:** Full URL of page linking to you
- **Source_Title:** Title of source page
- **Paqar_Page:** Which Paqar page is linked
- **Page_Title:** Title of Paqar page
- **Authority_Score:** low (DA 1–20), medium (DA 20–50), high (DA 50+)
  - Check using Moz toolbar or Ahrefs
- **Link_Type:** mention, inline, editorial, social, comment, guest-post
- **Manual_Check_Done:** yes/no (have you verified the link exists)
- **Verified:** yes/no/pending
- **Anchor_Text:** Text of the link
- **Notes:** Context (e.g., which email outreach led to this, which Reddit post)

**Update frequency:** Weekly (from Google Search Console + Ahrefs)

**Monthly calculation:**
```
Total Authority Score = sum of all authority scores
Expected from Phase 3 = 15–20 backlinks, avg 5–8 score each
Quality ranking = high (50+): 1 point, medium (20–50): 2 points, low (1–20): 3 points
```

---

## Template 4: LLM Citation Tracker

**File:** `docs/GEO-LLM-CITATIONS.csv`

```csv
Date,LLM,Query,Paqar_Mentioned,Response_Summary,Quote,Link_Mentioned,Confidence_Level
2026-07-28,Claude,best used car Malaysia,no,"Generic car buying advice, no mention of specific platforms","Most important is to check service history and get an inspection. Popular models are reliable.","no",medium
2026-08-01,Claude,Myvi depreciation rate,yes,"Cites Paqar depreciation data","According to Paqar, Perodua Myvi holds 92% of its value after 5 years, outperforming City.","no",high
2026-08-05,ChatGPT,fair price Honda City,no,"Generic price range, no specific sources","A 2016 Honda City typically costs between RM25,000–RM30,000 in the used market.","no",low
2026-08-10,Gemini,Honda City vs Toyota Vios,no,"Comparison but no mention of Paqar data","Both are reliable. City has modern features, Vios lasts longer.","no",medium
```

**Columns:**
- **Date:** When you ran the test
- **LLM:** Claude, ChatGPT, Gemini, Grok, etc.
- **Query:** Exact question you asked
- **Paqar_Mentioned:** yes/no (did it mention Paqar by name)
- **Response_Summary:** 1-sentence summary of response
- **Quote:** Exact quote if Paqar was mentioned
- **Link_Mentioned:** yes/no (did it include a link to paqar.my)
- **Confidence_Level:** low (generic advice), medium (relevant but not sourced), high (cites Paqar data)

**How to test:**
1. Open Claude/ChatGPT/Gemini
2. Ask the query in the Query column
3. Record whether Paqar is mentioned
4. Copy the exact quote if relevant
5. Note confidence level

**Update frequency:** Weekly (pick 2–3 standard queries each week)

**Standard test queries:**
1. "I'm thinking of buying a used Honda City in Malaysia. What should I look for? What's a fair price?"
2. "Which used car holds value best in Malaysia? Show me depreciation data."
3. "How much should I negotiate off a used car asking price in Malaysia?"
4. "What's the Perodua Myvi depreciation rate compared to Honda City?"
5. "Best budget-friendly used car in Malaysia under RM30,000?"

---

## Template 5: Monthly Performance Summary

**File:** `docs/GEO-MONTHLY-SUMMARY.md`

```markdown
# GEO Performance: July 2026

## Metrics Summary

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| FAQ Traffic | 150–200 users/week | 185 users/week | ✅ Exceeds |
| Backlinks | 3–4/week | 3 new | ✅ On track |
| Social Impressions | 5,000+/week | 5,200/week | ✅ Exceeds |
| LLM Citations | 1–2 by end of month | 1 citation | ⏳ On track |
| App Clicks | 5–10/week | 8/week | ✅ On track |

## Best Performing Content

1. **Reddit answers** (2–3x/week): Myvi buying guide
   - Avg engagement: 200+ upvotes
   - Avg reach: 1,000+ impressions
   - Backlinks: 1–2 per week

2. **Facebook comments** (daily): Car listing price checks
   - Avg engagement: 30 likes, 5 comments
   - Avg reach: 1,200 impressions/day
   - Backlinks: 0 (community engagement, not press)

3. **YouTube videos** (uploaded 1): Best First Car
   - Views: 1,200+
   - CTR: 8% (100 out of 1,250 impressions clicked)
   - Backlinks: 0 (new channel, needs momentum)

## Lowest Performing Content

1. **LinkedIn posts** (1–2x/week): Market data insights
   - Avg engagement: 5 likes
   - Avg reach: 200 impressions
   - Backlinks: 0
   - **Action:** Deprioritize after week 2; pivot to video

2. **Instagram posts** (planned but not posted)
   - **Action:** Skip entirely; Facebook drives more reach

## Backlinks by Authority

| Authority | Count | Expected | Status |
|-----------|-------|----------|--------|
| High (50+) | 0 | 1–2 | ⏳ Waiting on press mentions |
| Medium (20–50) | 2 | 3–5 | ⏳ Close to target |
| Low (1–20) | 1 | 10–15 | ✅ On track |
| **Total** | **3** | **15–20** | ⏳ 1/5 way through month |

## LLM Citation Status

- **Claude:** 1 citation (Paqar Myvi depreciation data)
- **ChatGPT:** 0 citations (not yet indexed for SEO)
- **Gemini:** 0 citations (lower knowledge base adoption)
- **Status:** Early positive sign with Claude; expect 1–2 more by month-end

## Budget & Efficiency

- **Time invested:** ~12 hours (Reddit, Facebook, YouTube)
- **Backlinks per hour:** 0.25 links/hour
- **FAQ clicks per hour:** 15 clicks/hour
- **ROI estimate:** If continues: ~20 backlinks, 1,000 FAQ clicks by month-end

## Adjustments for August

1. **Increase:** Reddit (best ROI) + YouTube (highest engagement)
2. **Decrease:** LinkedIn (low engagement)
3. **Maintain:** Facebook comments (high volume, steady engagement)
4. **Add:** Press release for annual report (expects 5–10 high-authority backlinks)

## Next Steps

- [ ] Publish annual report (mid-August)
- [ ] Send press release to 20+ journalists
- [ ] Record 2 more YouTube videos
- [ ] Continue daily Facebook comments
- [ ] Intensify Reddit answers (2–3x → 3–4x/week)
```

**Update frequency:** Monthly

---

## Consolidated Tracking Spreadsheet

Instead of 5 separate files, you can use one Google Sheet with tabs:

**Google Sheet Tabs:**
1. **Analytics** - Weekly analytics report
2. **Posting Log** - All social posts
3. **Backlinks** - New backlinks discovered
4. **LLM Citations** - Weekly LLM tests
5. **Summary** - Monthly performance summary
6. **Dashboard** - Charts/graphs of trends

**Share link template:** https://docs.google.com/spreadsheets/d/[ID]/edit

---

## Automation Hints

### Google Sheets + Google Analytics
- Use =QUERY() function to auto-pull GA data (requires GA Connector)
- Example: `=QUERY(Analytics!A:Z, "SELECT * WHERE utm_source = 'reddit'")`

### Google Sheets + Google Search Console
- Use Search Console Connector to auto-pull backlink data weekly

### Monthly Dashboard
- Create pivot table: Platform vs Engagement
- Create chart: Traffic trend over time (should be upward curve)
- Create chart: Backlinks by authority (should increase high-authority links)

---

## Success Criteria (End of August)

| Metric | Target | Actual |
|--------|--------|--------|
| Total FAQ traffic | 600–800 users | [TBD] |
| Total backlinks | 15–20 | [TBD] |
| Backlinks high-authority (50+) | 3–5 | [TBD] |
| LLM citations | 3–5 | [TBD] |
| App clicks from FAQ | 20–30 | [TBD] |

If you hit 3+ criteria = **Phase 3 successful**, proceed to Phase 4 (scaled execution or new channels)
If you hit <3 criteria = **Reevaluate strategy** (different platforms, content types, or outreach)
