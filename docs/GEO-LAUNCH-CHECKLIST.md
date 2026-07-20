# GEO Launch Readiness Checklist

**Before posting to Reddit/Facebook for the first time, verify everything is working.** This checklist ensures the entire flow (social → FAQ → app) operates end-to-end.

---

## Section 1: Deployment Verification (30 min)

### FAQ Pages Live
- [ ] https://paqar.my/faq/best-first-car-under-30k — loads, renders correctly
- [ ] https://paqar.my/faq/how-to-spot-flood-cars — loads
- [ ] https://paqar.my/faq/how-to-negotiate-used-car — loads
- [ ] https://paqar.my/faq/honda-city-buying-guide — loads
- [ ] https://paqar.my/faq/what-to-check-buying-used-car — loads
- [ ] https://paqar.my/faq/roadtax-by-state — loads
- [ ] https://paqar.my/faq/toyota-vios-buying-guide — loads
- [ ] https://paqar.my/faq/honda-city-vs-toyota-vios — loads

**How to verify:** Open each link in browser. Should load in <2 sec, no 404.

**If broken:**
- Check git log: `git log --oneline app/faq/`
- Check build: `npx next build` (must succeed)
- Check deployment: Vercel dashboard for errors
- Rebuild: `git push origin main` (triggers Vercel redeploy)

### API Endpoints Live
- [ ] Plate endpoint: `GET /api/v1/plate/WPH925` returns teaser (make, model, year, color, mileage)
- [ ] Valuation endpoint: `GET /api/v1/valuation?plate=WPH925` returns full valuation with X-Citation header
- [ ] Variants endpoint: `GET /api/v1/variants/Honda/City` returns variant ladder

**How to verify:**
```bash
# Test locally first
curl http://localhost:3000/api/v1/plate/WPH925
curl http://localhost:3000/api/v1/valuation?plate=WPH925
curl http://localhost:3000/api/v1/variants/Honda/City

# Then test production
curl https://paqar.my/api/v1/plate/WPH925
curl https://paqar.my/api/v1/valuation?plate=WPH925
curl https://paqar.my/api/v1/variants/Honda/City
```

**If broken:**
- Check status: `npx next build` (must include API routes)
- Check logs: Vercel dashboard → Runtime logs
- Rollback: `git log --oneline app/api/v1/`

### X-Citation Header Present
- [ ] `curl -I https://paqar.my/api/v1/valuation?plate=WPH925` shows `X-Citation: Paqar.my`

**Command:**
```bash
curl -I https://paqar.my/api/v1/valuation?plate=WPH925 | grep -i "X-Citation"
# Should return: X-Citation: Paqar.my
```

---

## Section 2: Analytics Configuration (20 min)

### Google Analytics Setup

#### 1. Verify property is linked
- [ ] Google Analytics property ID: `G-XXXXXXXX` (get from GA dashboard)
- [ ] Property is receiving data (check Realtime view)

**How to check:**
1. Go to https://analytics.google.com/
2. Click "Realtime"
3. Open paqar.my in another tab
4. Should see 1 active user in Realtime view

#### 2. Create custom parameter for UTM tracking
- [ ] Create dimension: `utm_source` (dimension name: "UTM Source")
- [ ] Create dimension: `utm_medium` (dimension name: "UTM Medium")
- [ ] Create dimension: `utm_campaign` (dimension name: "UTM Campaign")

**How to create:**
1. GA dashboard → Admin → Data Display → Custom Definitions → Create Custom Dimension
2. Name: "UTM Source", Dimension Name: "utm_source", Scope: "Hit"
3. Repeat for utm_medium and utm_campaign

#### 3. Create segment: FAQ traffic
- [ ] Create segment: Pages containing "/faq/"

**How to create:**
1. GA dashboard → Admin → Segments → Create Segment
2. Name: "FAQ Pages"
3. Condition: Page contains "/faq/"

#### 4. Test UTM tracking
- [ ] Send test link: `https://paqar.my/faq/best-first-car-under-30k?utm_source=test&utm_medium=email&utm_campaign=geotest`
- [ ] Open link, verify Google Analytics receives data with UTM parameters

**How to verify:**
1. GA dashboard → Real-time
2. Open the link in new tab
3. Should see traffic with utm_source=test, utm_medium=email, utm_campaign=geotest

### Google Search Console Setup

- [ ] Domain is verified in Search Console
- [ ] FAQ pages are indexed (Search Console → Coverage → Valid)

**How to verify:**
1. Go to https://search.google.com/search-console/
2. Select your property (paqar.my)
3. Check "Coverage" tab: should show all 8 FAQ pages as "Valid"
4. If not indexed, click "Request Indexing" for each FAQ URL

---

## Section 3: Database & Cache Verification (15 min)

### Supabase Connection
- [ ] Can query valuations: `select * from valuations limit 1`
- [ ] Can query market prices: `select * from market_prices limit 1`

**How to verify:**
```bash
# Via Supabase dashboard:
# 1. Go to https://supabase.com/
# 2. Your project → SQL Editor
# 3. Run: SELECT COUNT(*) FROM valuations;
# 4. Should return > 0
```

### Cache: no-store is enforced
- [ ] Service client uses `global.fetch` with `cache: 'no-store'`
- [ ] Check: `grep -r "cache.*no-store" lib/supabase/`

**Should see:**
```typescript
global.fetch(url, { cache: 'no-store' })
```

---

## Section 4: Rate Limiting Test (10 min)

### Rate limiter is working
- [ ] POST 15 requests to `/api/v1/plate/WPH925` within 1 minute
- [ ] 10th–15th requests should return `429 Too Many Requests`

**How to test:**
```bash
#!/bin/bash
for i in {1..15}; do
  echo "Request $i:"
  curl -w "\nStatus: %{http_code}\n" https://paqar.my/api/v1/plate/WPH925
  sleep 2
done
```

**Expected:** Requests 1–10 return 200, requests 11–15 return 429.

---

## Section 5: End-to-End User Flow (20 min)

### Simulate real user journey
1. **User sees FAQ link on Reddit** (simulated)
   - [ ] Click link: `https://paqar.my/faq/best-first-car-under-30k?utm_source=reddit&utm_medium=social&utm_campaign=geo-faq`
   - [ ] Page loads in <2 sec
   - [ ] Page is readable, mobile-friendly

2. **User clicks "Get Valuation"**
   - [ ] Button is visible and clickable
   - [ ] Takes user to homepage with pre-filled search

3. **User enters plate**
   - [ ] Enter plate: `WPH925`
   - [ ] Click "Check Price"
   - [ ] Valuation loads in <2 sec
   - [ ] Shows price, market range, confidence level

4. **Verify analytics capture**
   - [ ] Google Analytics receives page view for `/faq/best-first-car-under-30k` with utm_source=reddit
   - [ ] Google Analytics receives event for "Get Valuation" button click

**How to verify in GA:**
1. GA dashboard → Real-time
2. Should see:
   - Page view for `/faq/best-first-car-under-30k`
   - utm_source = reddit parameter captured

---

## Section 6: Backlink Monitoring Setup (15 min)

### Google Search Console Monitoring
- [ ] Set up notification for new backlinks: Search Console → Settings → Enable email notifications
- [ ] Check current backlinks: Search Console → Links → External links (baseline)

**Record baseline:**
```markdown
### Baseline (July 20, 2026)
- Total backlinks: [NUMBER from Search Console]
- Top referring domains: [LIST top 5]
- Pages with most links: [LIST top 3]
```

### Ahrefs Backlink Checker
- [ ] Bookmark: https://backlink-checker.ahrefs.com/
- [ ] Run weekly check on paqar.my domain
- [ ] Track new backlinks in tracking spreadsheet

---

## Section 7: Data Collection Setup (10 min)

### Create tracking templates

#### 1. Weekly Analytics Report Template
**File:** `docs/GEO-WEEKLY-REPORT.csv`

```csv
Date,Week,FAQ_Clicks_Total,FAQ_Clicks_Reddit,FAQ_Clicks_Facebook,FAQ_Clicks_YouTube,App_Clicks,Backlinks_New,Backlinks_Total,LLM_Citations
2026-07-28,Week 1,185,45,120,12,8,3,3,0
```

#### 2. Social Media Posting Log
**File:** `docs/GEO-POSTING-LOG.csv`

```csv
Date,Platform,Topic,URL,Posted_Status,Impressions,Engagement,Notes
2026-07-28,Reddit,best-first-car,reddit.com/r/malaysia/...,posted,1200,250 upvotes
2026-07-29,Facebook,red-flags,facebook.com/...,posted,3500,45 likes
```

#### 3. Backlink Tracker
**File:** `docs/GEO-BACKLINKS.csv`

```csv
Date,Source_Domain,Source_URL,Paqar_Page,Authority,Notes
2026-07-28,reddit.com,reddit.com/r/malaysia/xyz,paqar.my/faq/best-first-car,low,Comment with link
2026-07-29,mudah.my,mudah.my/qa/123,paqar.my/faq/how-to-negotiate,medium,Q&A answer
```

**How to populate:**
- Weekly from Google Search Console "External links" report
- Monthly from Ahrefs backlink checker
- Check column "Authority" by visiting domain (use Moz toolbar)

---

## Section 8: Staging Test Posts (15 min)

### Before going live, test outreach templates

#### 1. Test Reddit post (in private subreddit or draft)
- [ ] Write Reddit answer using GEO-OUTREACH-TEMPLATES.md template
- [ ] Include FAQ link with UTM: `?utm_source=reddit&utm_medium=social&utm_campaign=geo-faq`
- [ ] Check formatting (code blocks, links display correctly)

#### 2. Test Facebook comment (in test group or your timeline)
- [ ] Write Facebook comment using template
- [ ] Include FAQ link with UTM
- [ ] Check: link preview shows properly, emoji render

#### 3. Test email (blogger outreach)
- [ ] Draft email using Blogger Outreach Email Template
- [ ] Test email deliverability (send to yourself)
- [ ] Check: links work, formatting displays

---

## Pre-Launch Sign-Off

Once all sections are checked off, sign off with:

```markdown
## GEO Launch Sign-Off

Date: 2026-07-28
Checked by: [Your Name]

All sections verified:
- [ ] Deployment verified (8/8 FAQ pages live, 3/3 API endpoints working)
- [ ] Analytics configured (GA properties, custom dimensions, segments set up)
- [ ] Database verified (Supabase queries working, cache enforced)
- [ ] Rate limiting tested (429 response on 10+ req/min)
- [ ] End-to-end flow works (FAQ → button → valuation)
- [ ] Backlink monitoring ready (Search Console + Ahrefs)
- [ ] Tracking templates created (weekly report, posting log, backlink log)
- [ ] Test posts staged and working

Status: ✅ READY FOR LAUNCH

Next: Begin Phase 3 execution (social media posting, outreach, monitoring)
```

---

## Troubleshooting

### FAQ page returns 404
**Cause:** Page not deployed or Next.js build failed
**Fix:** 
```bash
npx next build  # Check for errors
git push origin main  # Trigger Vercel rebuild
```

### API endpoint returns 500
**Cause:** Supabase connection error or query timeout
**Fix:**
```bash
# Check Supabase status
curl https://status.supabase.com/
# Check logs in Vercel dashboard
# Restart: git push origin main
```

### Google Analytics not receiving data
**Cause:** GA property not linked or script not loading
**Fix:**
```bash
# In browser dev tools (F12):
# 1. Console tab: type window.gtag — should be defined
# 2. Network tab: check for analytics.google.com requests
# 3. If missing, GA script not loaded — check Vercel build logs
```

### Backlinks not showing in Search Console
**Cause:** Pages not indexed yet or new backlinks take 1–2 weeks to appear
**Fix:**
```bash
# Request indexing for FAQ pages:
# 1. Google Search Console → URL Inspection
# 2. Enter FAQ URL (e.g., paqar.my/faq/best-first-car-under-30k)
# 3. Click "Request Indexing"
# 4. Wait 1–2 days for crawl
```

---

## Quick Links

- Paqar.my: https://paqar.my/
- Google Analytics: https://analytics.google.com/
- Google Search Console: https://search.google.com/search-console/
- Vercel Dashboard: https://vercel.com/
- Supabase Dashboard: https://supabase.com/
- Ahrefs Backlink Checker: https://backlink-checker.ahrefs.com/
