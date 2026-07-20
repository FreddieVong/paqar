# GEO Phase 3 Execution Plan: 8-Week Social Campaign

> **For execution:** This plan uses checkbox (`- [ ]`) syntax for tracking. Complete each step in order. Estimated time: 15–20 hours over 8 weeks. Most tasks are 5–30 minutes daily.

**Goal:** Execute the social media + content campaign to drive 800–1000 FAQ page visits, earn 15–20 backlinks, and establish Paqar as the authority on Malaysian used-car pricing.

**Architecture:** Week 1 deploys infrastructure + records videos. Weeks 2–4 execute daily social posting (Reddit, Facebook, Mudah, YouTube). Weeks 3–4 send press release for annual report (high-authority links). Weeks 5–8 maintain momentum, measure results, iterate on best-performing content.

**Tech Stack:** Google Analytics, Google Search Console, YouTube, Reddit, Facebook, Ahrefs (backlink tracker), Spreadsheet (tracking).

## Global Constraints

- All FAQ links include UTM parameters: `?utm_source=[platform]&utm_medium=social&utm_campaign=geo-faq`
- All posts link back to paqar.my FAQ pages (never direct to homepage)
- Post 1–2x daily minimum (except weekends) to maintain momentum
- Track every post in spreadsheet for later analysis
- LLM citations tested weekly using exact test queries

---

## WEEK 1: Pre-Launch Setup & Video Recording

### Task 1: Deploy FAQ Pages & Verify Production

**Estimated time:** 30 minutes

**Deliverable:** All 8 FAQ pages live on paqar.my, accessible from public URLs, tracked in Google Analytics.

- [ ] **Step 1.1: Push code to production**

Run:
```bash
cd /home/freddievong/Paqar
git status  # Verify only FAQ + checklist files staged
git log --oneline -3  # Show recent commits
git push origin main
```

Expected: Vercel auto-deploys. Check Vercel dashboard for "Deployment Successful" status.

- [ ] **Step 1.2: Verify each FAQ page loads**

Open each link in browser (or curl):
```bash
# Test each page loads quickly (should be <2 sec)
for page in best-first-car-under-30k how-to-spot-flood-cars how-to-negotiate-used-car \
            honda-city-buying-guide what-to-check-buying-used-car roadtax-by-state \
            toyota-vios-buying-guide honda-city-vs-toyota-vios; do
  echo "Testing: $page"
  curl -w "Status: %{http_code}, Time: %{time_total}s\n" -o /dev/null -s "https://paqar.my/faq/$page"
done
```

Expected: All return HTTP 200, load in <2 seconds.

**If any page returns 404:**
- Check Vercel logs: Dashboard → Deployments → Recent → View logs
- If syntax error, run locally: `npx next build` (will show compilation errors)
- Fix and push again

- [ ] **Step 1.3: Verify Google Analytics is tracking FAQ traffic**

Go to: https://analytics.google.com/ → Your property → Realtime

Open one FAQ page (e.g., https://paqar.my/faq/best-first-car-under-30k) in a new tab.

Expected: Realtime view shows 1 active user, page view for `/faq/best-first-car-under-30k` recorded.

**If no traffic appears:**
- Check GA script is loaded: Open page → DevTools (F12) → Console → type `window.gtag` (should be defined)
- If undefined, Vercel build may have failed; re-deploy

---

### Task 2: Set Up Google Analytics UTM Tracking

**Estimated time:** 20 minutes

**Deliverable:** Google Analytics configured to capture and report on UTM parameters (utm_source, utm_medium, utm_campaign).

- [ ] **Step 2.1: Create custom dimensions in Google Analytics**

Go to: https://analytics.google.com/analytics/web/

1. Click **Admin** (gear icon, bottom left)
2. Select your property (should say "Paqar" or your domain)
3. Under "Data Collection & Modification", click **Custom Definitions → Create custom dimension**

Create dimension 1:
- Name: "UTM Source"
- Dimension Name: `utm_source`
- Scope: "Hit"
- Click Create

Repeat for:
- Name: "UTM Medium", Dimension Name: `utm_medium`, Scope: "Hit"
- Name: "UTM Campaign", Dimension Name: `utm_campaign`, Scope: "Hit"

- [ ] **Step 2.2: Create segments for FAQ traffic**

Go to: Admin → **Segments → Create Segment**

Create segment "FAQ Pages":
- Name: "FAQ Pages"
- Add condition: Page → contains → `/faq/`
- Save

This segment lets you filter reports to only FAQ page traffic.

- [ ] **Step 2.3: Test UTM tracking with a test link**

Create a test link:
```
https://paqar.my/faq/best-first-car-under-30k?utm_source=test&utm_medium=test&utm_campaign=week1-setup
```

Open this link in a new browser tab. Go to Google Analytics → Realtime.

Expected: See pageview with utm_source=test, utm_medium=test, utm_campaign=week1-setup in the Realtime view.

---

### Task 3: Set Up Google Search Console Backlink Monitoring

**Estimated time:** 15 minutes

**Deliverable:** Google Search Console configured to show new backlinks, indexed FAQ pages, and weekly email notifications.

- [ ] **Step 3.1: Verify domain in Google Search Console**

Go to: https://search.google.com/search-console/

1. Select your property (paqar.my)
2. Left menu → **Coverage** → Check that FAQ pages show as "Valid"

Expected: Should see 8 FAQ pages listed under "Valid". If not indexed:
- Click "Publish now" or "Request indexing" for each FAQ URL

- [ ] **Step 3.2: Enable email notifications for new backlinks**

Go to: Search Console → **Settings → Turn on email notifications**

Check: "New backlinks" → Save

From now on, you'll get email when Google finds new backlinks to paqar.my.

- [ ] **Step 3.3: Record baseline backlink count**

Go to: Search Console → **Links → External links**

Note the current count. This is your baseline.

Create a tracking spreadsheet (Google Sheets):
```
Date,Week,Backlinks_Total,New_This_Week,High_Authority_Count
2026-07-20,Week 1,[BASELINE],0,0
```

Save this sheet URL for weekly updates.

---

### Task 4: Record YouTube Videos (Days 2–4)

**Estimated time:** 3–4 hours total (30–60 min per video)

**Deliverable:** 2–3 YouTube videos uploaded and published (Video 1: Best First Car, Video 2: Flood Detection, Video 3: Honda City vs Vios).

**Setup (one-time):**
- [ ] **Step 4.1: Create YouTube channel**

Go to: YouTube.com → Sign in → Create a channel (if not already created)

Channel name: "Paqar" or your personal brand
Description: "Helping Malaysian car buyers get fair prices. Data-driven valuations, negotiation tips, buying guides."

- [ ] **Step 4.2: Prepare recording environment**

Location:
- Quiet room (no background noise)
- Good lighting (natural or desk lamp)
- Device: Phone or webcam (doesn't need to be professional)

Audio:
- Headphone with mic, or phone mic (acceptable)
- Test: Record 10-second sample, play back to check audio quality

- [ ] **Step 4.3: Record Video 1 (Best First Car Under RM30k)**

Script location: `docs/GEO-YOUTUBE-SCRIPTS.md` → Video 1

Recording:
1. Read through script once (get familiar)
2. Hit record
3. Read script naturally (not robotic)
4. If mistake, pause and re-record that section
5. Stop recording when done
6. Save file as: `video-1-best-first-car.mp4`

Expected: ~4 minutes, natural delivery.

**Editing (simple):**
- Cut dead air between sections
- Add text overlays (YouTube Studio does this, or use CapCut free)
- Examples: "Perodua Myvi", "RM24-28k", "Check Paqar"
- No fancy effects needed; simple text overlays are fine

- [ ] **Step 4.4: Upload Video 1 to YouTube**

YouTube Studio (https://studio.youtube.com/):

1. Click "Create" (red button, top right)
2. Upload file: Select `video-1-best-first-car.mp4`
3. Wait for upload to complete

Fill in:
- **Title:** "Best First Car Under RM30k in Malaysia — Real Market Prices"
- **Description:**
```
Which first car should you buy? Perodua Myvi, Honda City, or Toyota Vios?

In this video, I break down real market prices, reliability, and which model holds value best.

Links:
📊 Full guide: https://paqar.my/faq/best-first-car-under-30k?utm_source=youtube&utm_medium=video&utm_campaign=geo-video
🔍 Check a car now: https://paqar.my/?utm_source=youtube&utm_medium=video

00:00 Intro
00:20 Hook (common mistakes)
00:45 Three cars compared
01:45 What to actually check
03:15 Red flags
03:50 CTA (link to FAQ)
```

- **Tags:** "car buying", "malaysia", "used car", "buying guide", "car prices"
- **Thumbnail:** Click "Upload custom thumbnail" (use phone screenshot of best frame)
- **Visibility:** Public
- **Not made for kids:** Checked (because it's not content for kids)

Click "Publish" or "Schedule" (if recording after 9pm, schedule for morning)

- [ ] **Step 4.5: Record & Upload Video 2 (Flood Detection)**

Repeat Step 4.3–4.4 with:
- Script: `docs/GEO-YOUTUBE-SCRIPTS.md` → Video 2
- File: `video-2-flood-detection.mp4`
- Title: "How to Spot a Flooded Car (Red Flags You Can't Miss)"
- Description URL: `https://paqar.my/faq/how-to-spot-flood-cars?utm_source=youtube`

- [ ] **Step 4.6: Record & Upload Video 3 (Honda City vs Vios)**

Repeat with Video 3 script (or skip if time is tight; videos 1 & 2 are priority).

**Verification:**
- [ ] All uploaded videos show as "Published" in YouTube Studio
- [ ] Each video description includes FAQ link with UTM parameters
- [ ] Click each link from description to verify it works

---

### Task 5: Prepare Social Media Posting Templates

**Estimated time:** 20 minutes

**Deliverable:** Ready-to-use post templates saved in a document for quick copy-paste throughout the week.

- [ ] **Step 5.1: Create social media post document**

Create a Google Doc (or Notion page) with this structure:

```markdown
# GEO Week 1 Posting Templates

## Reddit: Best First Car Answer
[Copy from GEO-OUTREACH-TEMPLATES.md → Reddit Answer Template]
Link: https://paqar.my/faq/best-first-car-under-30k?utm_source=reddit&utm_medium=social&utm_campaign=geo-faq

## Facebook Group Comment: Red Flags
[Copy from GEO-OUTREACH-TEMPLATES.md → Facebook Comment]
Link: https://paqar.my/faq/how-to-spot-flood-cars?utm_source=facebook&utm_medium=social&utm_campaign=geo-faq

## Mudah Q&A: Negotiation
[Copy from GEO-OUTREACH-TEMPLATES.md → Mudah Q&A]
Link: https://paqar.my/faq/how-to-negotiate-used-car?utm_source=mudah&utm_medium=qa&utm_campaign=geo-faq
```

Save this document for quick reference during Week 2.

- [ ] **Step 5.2: Create posting schedule spreadsheet**

Google Sheets with columns:
```
Date | Platform | Topic | Link | Posted | Time_Posted | Notes
2026-07-29 | Reddit | best-first-car | [link] | [ ] | | Post in r/malaysia morning
2026-07-29 | Facebook | red-flags | [link] | [ ] | | 3 car groups, 7pm optimal
```

This will be your execution checklist for the week.

**Week 1 Summary:**
By end of Week 1:
- ✅ All FAQ pages deployed and verified live
- ✅ Google Analytics UTM tracking configured
- ✅ Google Search Console monitoring enabled
- ✅ 2–3 YouTube videos recorded and uploaded
- ✅ Social media templates prepared

---

## WEEKS 2–4: Daily Execution (Reddit, Facebook, YouTube, Mudah)

### Task 6: Daily Facebook Group Posting (1–2 posts/day)

**Estimated time:** 10–15 minutes/day

**Deliverable:** Consistent presence in Malaysian car-buying Facebook groups with high engagement and CTR to FAQ pages.

**Preparation (Day 1 of Week 2):**

- [ ] **Step 6.1: Find and join car-buying Facebook groups**

Search Facebook for groups with 5k+ members:
- "Malaysian Car Buyers"
- "Mudah Kereta"
- "Used Cars Malaysia"
- "Beli Kereta Secondhand"
- "Car Discussion Malaysia"

Join 5–8 groups (aim for 20k+ total members).

- [ ] **Step 6.2: Set Facebook mobile notifications**

Go to each group → "Group Settings" → Turn on notifications

This way you'll see new "Help me negotiate?" or "Is this a good price?" posts in real-time.

**Daily Execution (Weeks 2–4):**

- [ ] **Step 6.3: Post once per day at optimal time (6pm–9pm Malaysia time)**

When you see a post like "Should I buy this 2016 Honda City for RM28k?":

1. Comment using template from `GEO-OUTREACH-TEMPLATES.md` → Facebook Comment
2. Replace [link] with appropriate FAQ URL + UTM: 
   ```
   https://paqar.my/faq/how-to-negotiate-used-car?utm_source=facebook&utm_medium=social&utm_campaign=geo-faq
   ```
3. Post comment
4. Log in spreadsheet: Date | Facebook | negotiation | URL | Posted ✓ | 7:15pm | Good engagement expected

Expected per post:
- 5–10 likes within 1 hour
- 2–3 comments/replies
- 200–500 impressions

Track weekly: Total impressions should be 3,000–5,000/week (5–8 posts × ~500 impressions).

---

### Task 7: Reddit Answers (2–3x/week)

**Estimated time:** 15–20 minutes per post

**Deliverable:** High-engagement Reddit answers in r/malaysia, r/personalfinance, r/cars with FAQ links.

**Preparation (Day 1 of Week 2):**

- [ ] **Step 7.1: Subscribe to target subreddits**

Reddit communities to monitor:
- r/malaysia (largest Malaysian community)
- r/personalfinance (money/budgeting questions → car buying)
- r/cars (car enthusiasts)
- r/mechanic (if exists, technical questions)

Subscribe to each. Turn on notifications for "Best posts" or manually check daily.

**Weekly Execution:**

- [ ] **Step 7.2: Find relevant threads (Mon, Wed, Fri mornings)**

Search each subreddit for:
- "first car"
- "used car"
- "buying a car"
- "Honda City"
- "Myvi"
- "best car under"

Sort by "New" to find posts from last 24 hours.

- [ ] **Step 7.3: Write and post Reddit answer**

Example thread title: "What's the best first car to buy in Malaysia under RM30k?"

Your comment (using template from `GEO-OUTREACH-TEMPLATES.md`):

```markdown
Great question! For your budget, I'd recommend Perodua Myvi (2015–2018 model).

Here's why:
- Price: RM24–28k (within budget)
- Reliability: Excellent, no major known issues
- Fuel: 7.5 L/100km (great for a first car)
- Resale: Holds value best among cheap cars

Before you buy:
✓ Get JomCheck inspection (RM99) — reveals flood damage, accidents
✓ Use Paqar to value the plate — know market price before negotiating
✓ Negotiate 2–3k below asking using real data

I wrote a complete guide here: https://paqar.my/faq/best-first-car-under-30k?utm_source=reddit&utm_medium=social&utm_campaign=geo-faq

Let me know if you have questions!
```

Post comment.

Track in spreadsheet: Date | Reddit | best-first-car | URL | Posted ✓ | Engagement (upvotes) | Notes

Expected per post:
- 100–300 upvotes (Reddit's algorithm votes you up)
- 5–15 comment replies
- 500–1,500 impressions

**Cadence:** 2–3x/week means:
- Monday morning: 1 post
- Wednesday afternoon: 1 post
- Friday evening: 1 post

---

### Task 8: YouTube Weekly Videos (1 per week)

**Estimated time:** 30–60 min to record/upload

**Deliverable:** Consistent weekly video uploads to grow YouTube channel and drive FAQ traffic.

**Weekly Execution (Weeks 2–4):**

- [ ] **Step 8.1: Record one new video per week**

Week 2: Video 3 (Honda City vs Vios) [if not done in Week 1]
Week 3: Video 4 (How to Negotiate)
Week 4: Video 5 (Inspection Checklist)

Use same process as Task 4 (Step 4.3–4.4).

- [ ] **Step 8.2: Upload and publish**

YouTube Studio:
1. Upload file
2. Title, description (with FAQ link + UTM)
3. Tags, thumbnail
4. Publish

Expected per video:
- 200–400 views by end of week
- 5–10 CTR to FAQ pages
- 1–2 new YouTube subscribers

---

### Task 9: Mudah Q&A Weekly Answers (1–2x/week)

**Estimated time:** 10–15 minutes

**Deliverable:** Presence on Mudah platform (largest Malaysian classifieds site) with links to FAQ pages.

**Preparation (Day 1 of Week 2):**

- [ ] **Step 9.1: Create/log into Mudah account**

Go to: https://mudah.my/

Sign up or log in. Profile complete with name + photo.

**Weekly Execution:**

- [ ] **Step 9.2: Find Mudah Q&A questions**

Go to: Mudah.my → **Q&A** (or search "Mudah community")

Filter by "Kereta" (cars). Look for:
- "Best first car?"
- "Should I buy this car?"
- "How to negotiate?"
- "What to check?"

- [ ] **Step 9.3: Write and post answer**

Example question: "What's a fair price for a 2016 Honda City?"

Your answer (using template from `GEO-OUTREACH-TEMPLATES.md`):

```
A 2016 Honda City 1.5 S typically costs RM26–28k based on real market data.

Check it on Paqar → https://paqar.my/faq/how-to-negotiate-used-car?utm_source=mudah&utm_medium=qa&utm_campaign=geo-faq

Also get JomCheck inspection (RM99) to verify condition. Negotiate 2–5k below asking using real data.
```

Post answer.

Track: Date | Mudah | negotiation | URL | Posted ✓ | Upvotes | Notes

Expected per answer:
- 5–20 upvotes (Mudah community votes)
- 200–500 impressions
- Low authority backlink (Mudah is trusted, but organic link = valuable)

---

### Task 10: Press Release for Annual Report (Week 3)

**Estimated time:** 2–3 hours total

**Deliverable:** Press release sent to 20+ journalists/publications. Expected: 5–10 high-authority backlinks over next 2 weeks.

**Preparation (End of Week 2):**

- [ ] **Step 10.1: Finalize annual report data**

From `GEO-ANNUAL-REPORT.md`:
1. Pull data from Supabase (or use 2026-07 market data you already have)
2. Calculate key metrics:
   - Perodua Myvi value retention: 92%
   - Honda City depreciation: X% per year
   - Best value segment: 2015–2017 models
3. Write 1–2 page summary of findings

- [ ] **Step 10.2: Create press release**

Use template from `GEO-OUTREACH-TEMPLATES.md` → Annual Report Press Release

Fill in:
- Date: "July 21, 2026"
- Key findings (3–4 bullet points with data)
- Your quote: "Malaysian buyers often overpay because they don't know the market. Real data changes negotiations."
- Link to full report: `https://paqar.my/annual-report-2026?utm_source=press&utm_medium=email&utm_campaign=geo-pr`

Save as: `docs/GEO-PRESS-RELEASE-2026.txt`

- [ ] **Step 10.3: Create journalist email list**

Research 20+ journalists/publications:
- Automotive journalists (The Star, Utusan, Berita Harian automotive sections)
- Tech/finance journalists (interested in data-driven services)
- Bloggers (automotive blogs, finance blogs)

Find contact emails (usually in "About" or "Contact Us" page, or LinkedIn).

Create spreadsheet:
```
Email | Publication | Contact_Method | Sent_Date | Response | Notes
```

- [ ] **Step 10.4: Send press release**

Email to each journalist:

Subject line: "Press Release: 2026 Malaysian Used Car Market Data — Price Trends & Value Predictions"

Body:
```
Hi [Name],

I thought you'd find this interesting for your readers:

We've analyzed 50,000+ used car transactions in Malaysia and found which models hold value best, 
how much they depreciate, and buying recommendations by budget.

Key findings:
• Perodua Myvi holds value best (92% retention over 5 years)
• Used car prices up 8% YoY as new-car prices remain elevated
• Best value segment: 2015–2017 models priced RM20–30k

Full report: https://paqar.my/annual-report-2026

Feel free to share with your audience. Happy to discuss or provide additional data.

Best,
[Your Name]
Paqar.my
```

Send to 5–10 journalists per day (Week 3). Stagger to avoid spam filters.

Expected response rate: 10–20% will click link or request more info. 3–5 will publish/mention.

Track responses in spreadsheet. Expected: 5–10 backlinks within 2 weeks.

---

## WEEKS 5–8: Maintenance & Optimization

### Task 11: Weekly Analytics Review & Reporting

**Estimated time:** 30 minutes/week

**Deliverable:** Weekly performance report showing FAQ traffic, backlinks, and engagement trends.

**Every Sunday night (Weeks 2–8):**

- [ ] **Step 11.1: Pull analytics data**

Google Analytics (https://analytics.google.com/):

1. Go to **Behavior → Pages** (or **Acquisition → Source/Medium**)
2. Set date range: Last 7 days
3. Filter: Page contains `/faq/`
4. Export as CSV or take screenshot

Record:
- Total FAQ users this week
- Total FAQ pageviews
- Breakdown by source (Reddit, Facebook, YouTube, other)
- Bounce rate, avg session duration

- [ ] **Step 11.2: Check backlinks**

Google Search Console → **Links → External links**

Count new backlinks since last week. Record total count.

If using Ahrefs:
1. Go to https://backlink-checker.ahrefs.com/
2. Enter: paqar.my
3. Check "New backlinks" section

Record: Date, new backlinks count, authority scores, source domains.

- [ ] **Step 11.3: Update tracking spreadsheet**

Add row to `GEO-WEEKLY-ANALYTICS.csv`:

```
Date,Week,FAQ_Users,FAQ_Views,Reddit_Clicks,Facebook_Clicks,YouTube_Clicks,Backlinks_New,Backlinks_Total,LLM_Citations
2026-07-28,Week 1,185,312,45,120,12,3,3,0
2026-08-04,Week 2,240,380,65,180,20,4,7,0
```

- [ ] **Step 11.4: Analyze and adjust**

Questions to ask:
- Which platform drove most traffic? (Double down on that)
- Which FAQ page got most views? (More content on that topic)
- Are backlinks increasing? (Expect 2–5/week by Week 3)
- Any drop in engagement? (Change up content if yes)

---

### Task 12: Test LLM Citations Weekly

**Estimated time:** 15 minutes/week

**Deliverable:** Weekly test of whether Claude, ChatGPT, Gemini are citing Paqar in responses.

**Every Monday (Weeks 2–8):**

- [ ] **Step 12.1: Run test query #1 on Claude**

Go to: https://claude.ai/

Query:
```
I'm thinking of buying a used Honda City in Malaysia. What should I look for?
What's a fair price?
```

Copy the response. Did Claude mention Paqar? Yes/No?

If YES, record the exact quote.

- [ ] **Step 12.2: Run test query #2 on ChatGPT**

Go to: https://chat.openai.com/

Same query as above.

Record: Does ChatGPT mention Paqar?

- [ ] **Step 12.3: Run test query #3 on Gemini**

Go to: https://gemini.google.com/

Same query.

Record response.

- [ ] **Step 12.4: Update LLM citations spreadsheet**

`GEO-LLM-CITATIONS.csv`:

```
Date,Week,Claude_Mentions,ChatGPT_Mentions,Gemini_Mentions,Best_Quote
2026-07-20,Week 1,No,No,No,-
2026-07-27,Week 2,Yes,"According to Paqar",No,"Paqar shows Myvi holds 92% value"
```

Expected: By Week 4, expect 1–2 LLM mentions (Claude is most likely first).

---

### Task 13: Monthly Performance Summary (Week 4 & 8)

**Estimated time:** 1 hour

**Deliverable:** Comprehensive month review showing what worked, what didn't, and recommendations for next month.

**At end of Week 4 & Week 8:**

- [ ] **Step 13.1: Compile monthly metrics**

From weekly tracking:
- Total FAQ traffic (sum of all weeks)
- Total backlinks earned
- Best performing platform (Reddit/Facebook/YouTube)
- Lowest performing (to eliminate Week 5+)
- LLM citations found
- App clicks/valuations from FAQ pages

- [ ] **Step 13.2: Create monthly summary document**

Google Doc with sections:

```markdown
## August 2026 GEO Performance

### Metrics
- FAQ traffic: 800 users (target: 800–1000) ✅
- Backlinks: 18 (target: 15–20) ✅
- High-authority: 3 (target: 3–5) ✅
- LLM citations: 2 (target: 1–2) ✅
- App clicks: 25 (target: 20–30) ✅

### What Worked
1. Facebook daily comments (highest volume)
2. YouTube videos (highest engagement/video)
3. Press release (best for high-authority backlinks)

### What Didn't Work
1. LinkedIn (very low engagement, skip next month)
2. Mudah Q&A (valuable but low-effort, maintain only)

### Recommendations
1. Continue Facebook + Reddit + YouTube
2. Record 3 more videos (demand is there)
3. Expand press outreach (worth the effort)
4. Double down on best FAQ pages

### Next Month
- Scale video production (2 videos/week instead of 1)
- Increase blogger outreach (1–2 emails/week)
- Maintain daily Facebook + 2x/week Reddit
```

Save and share with team/stakeholder.

---

### Task 14: Months 2+ (Sept–Oct): Scaling & New Channels

**Estimated time:** 5–10 hours/month (after Week 8)

**Deliverable:** Expanded reach through new platforms and increased content production.

Based on Month 1 results, choose ONE of:

- [ ] **Option A: Scale what works**

Increase frequency:
- YouTube: 2 videos/week (instead of 1)
- Facebook: 2 posts/day (instead of 1)
- Reddit: 3–4 posts/week (instead of 2–3)

Expected: 2x FAQ traffic, 1.5x backlinks.

- [ ] **Option B: Blogger outreach**

Find 10–15 automotive/finance bloggers. Send personalized emails (using template from `GEO-OUTREACH-TEMPLATES.md`).

Expected: 1 backlink per 5 emails (~20% response rate).

- [ ] **Option C: Guest posting**

Offer to write guest articles for lifestyle/finance blogs.

Topics:
- "How to Save RM5k on Your Next Used Car"
- "The Truth About Used Car Prices in Malaysia"
- "Data-Driven Negotiation for Car Buyers"

Expected: 1–2 high-authority backlinks per published guest post.

---

## Success Criteria

**Phase 3 is successful if by end of Week 8:**

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| FAQ traffic | 800–1000 users | [Week 8 value] | |
| Backlinks | 15–20 | [Week 8 value] | |
| High-authority (DA 50+) | 3–5 | [Week 8 value] | |
| LLM citations | 3–5 | [Week 8 value] | |
| App clicks | 20–30 | [Week 8 value] | |

**If 4+ criteria are met:** ✅ Phase 3 successful. Proceed to Phase 4 (scaling).

**If 2–3 criteria are met:** ⚠️ Moderate success. Evaluate which platforms/content worked best. Continue with adjustments.

**If <2 criteria are met:** ❌ Reevaluate strategy. Consider different platforms or content types.

---

## Quick Reference: Daily Checklist

**Every Day (Weeks 2–8):**

- [ ] Morning (9am): Check Reddit r/malaysia for new posts. Post if relevant thread found.
- [ ] Midday (12pm): Check Facebook groups for "should I buy this car?" posts. Comment on 1–2.
- [ ] Evening (7pm): Check Mudah Q&A for car questions. Answer 1 if available.
- [ ] Log all posts in tracking spreadsheet.

**Every Sunday:**

- [ ] Pull analytics data (30 min)
- [ ] Update weekly tracking spreadsheet
- [ ] Test LLM citations (10 min)
- [ ] Note best-performing content for next week

**Every Month (Weeks 4 & 8):**

- [ ] Create comprehensive summary report (1 hour)
- [ ] Present to stakeholders/team
- [ ] Decide on adjustments for next month

---

## File Checklist

Ensure these files exist and are up-to-date:

- [ ] `docs/GEO-YOUTUBE-SCRIPTS.md` — 5 complete video scripts
- [ ] `docs/GEO-OUTREACH-TEMPLATES.md` — 7 social templates
- [ ] `docs/GEO-ANNUAL-REPORT.md` — Annual report data template
- [ ] `docs/GEO-LAUNCH-CHECKLIST.md` — Pre-launch verification
- [ ] `docs/GEO-TRACKING-TEMPLATES.md` — Analytics + posting + backlink trackers
- [ ] `docs/GEO-SOCIAL-MEDIA-CALENDAR.md` — 30-day posting calendar

Spreadsheets (create in Google Sheets):

- [ ] `GEO-WEEKLY-ANALYTICS.csv` — Weekly traffic + backlink tracking
- [ ] `GEO-POSTING-LOG.csv` — Every post logged (date, platform, link, engagement)
- [ ] `GEO-BACKLINKS.csv` — New backlinks with authority scores
- [ ] `GEO-LLM-CITATIONS.csv` — Weekly LLM citation tests

---

## Estimated Time Investment

| Week | Task | Hours | Daily Commitment |
|------|------|-------|---|
| Week 1 | Setup + video recording | 4–5 hrs | 1 hour/day |
| Weeks 2–4 | Daily posting + weekly review | 3–4 hrs/week | 30–45 min/day |
| Weeks 5–8 | Maintenance + analysis | 2–3 hrs/week | 20–30 min/day |
| **Total** | **Phase 3 execution** | **15–20 hrs** | **15–45 min/day** |

Most of this is light, high-value work: posting, monitoring, analyzing.

