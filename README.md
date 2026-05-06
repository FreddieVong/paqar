I'm building Paqar, a mobile-first car ownership health check app for the Malaysian market. The brand name is a stylised respelling of "pakar" (Malay for "expert"), following the same naming pattern as Bjak (from "bijak"/smart).
The brand promise: the expert who watches your back as a Malaysian car owner.
The product solves the cognitive load and anxiety of car ownership in Malaysia by aggregating fragmented information from government sources into a single dashboard. Users see what needs their attention (saman, expiring documents) and what's safely under control. The app then monetises through two paid products at high-intent moments: pre-purchase verification for used car buyers, and trust-building reports for used car sellers.
I am building this solo with Claude Code as my primary engineering tool. The MVP must be capital-light, solo-operable, and shippable in approximately 12 weeks.
Strategic Context
This is a two-stage business:
Stage 1 (Years 1-2): Build the leading consumer app for Malaysian car ownership through a focused five-feature product. Acquire users through saman/blacklist search intent. Retain through document expiry tracking. Monetise through used car buyer reports and seller trust packs. Reach 100K+ active users and RM150K-400K revenue in Year 1 (honest, achievable without partnership capital; see financial model below).
Stage 2 (Years 2-3+): Once brand and audience are established, extend the same brand into financial wellness for the warm car-owner audience (hire purchase refinancing, debt management, eventually broader PFM).
The current build focuses entirely on Stage 1. Stage 2 is not in scope for the MVP or Year 1 roadmap.
Target Users
Primary acquisition audience: Malaysian car owners aged 25-55, urban and suburban, who experience anxiety about saman, blacklist status, and document expiries. Acquired through search ("semak saman," "blacklist imigresen," etc.).
Buyer monetisation audience: Used car buyers about to purchase from Mudah, Carlist, or Facebook Marketplace. Standard tier at RM12-19; Premium tier (Year 2) at RM39-49. Volume strategy at an honest price beats premium strategy with overpromised data.
Seller monetisation audience: Used car sellers wanting to close sales faster and justify higher prices by attaching a verified trust report to their listing, willing to pay RM29-49 for the report.
Brand and Voice
Voice principles:

Direct, prescriptive, on the user's side (never the dealer's, the bank's, or the regulator's)
Plain-spoken in both Bahasa Malaysia and English; Manglish acceptable when natural
Confident without being arrogant — the expert who explains, not lectures
Honest about limits — refuses to oversell or use scammy tactics
Slightly cheeky but never cruel
Emotionally grounded, not effusive

Visual identity:

Clean, calm, restrained
Generous whitespace, plain typography (Inter or similar sans-serif)
Single accent colour (start with a calm green like emerald-600, or a calm blue)
Avoid: gradients, abstract finance imagery, stock photography of smiling people, neon colours, AI-generated illustrations
Aesthetic target: looks like a product that could be 10 years old and just very well-designed

Trust positioning:

Founder visibility is part of the brand (founder name, photo, story on the site)
Radical transparency about how the business makes money
Substantive security claims with technical detail, never performative
Trust signals must be earned and shown, not claimed

The Complete Feature Set (Year 1)
Wave 1 — Acquisition & Retention (Months 0-3)
Feature 1: Saman + Blacklist Check
The hero feature and primary acquisition channel. User enters plate number and IC; the app fans out to multiple data sources and returns a complete check within 60 seconds covering:

PDRM summons (police)
JPJ summons (road transport department)
AES summons (automated enforcement)
Major local council summons (DBKL, MBPJ, MBSA, MBSJ, MPSJ, MBJB, MBPP, plus 5-10 others by user demand)
Immigration blacklist (status that can prevent leaving the country)
LHDN tax blacklist (where accessible)
PTPTN blacklist (where accessible)

Results presented as clear status cards: green (all clear), amber (attention needed), red (urgent). No signup required for the first check. This is the magic-moment that creates installs and shares.
Data acquisition is via web scraping of government portals. Architecture must be defensive — government sites change without notice, scrapers will break, the system must degrade gracefully when sources are down.
Feature 2: Document Expiry Tracker
After the saman check delivers value, prompt the user to save their details and add document expiries — roadtax, insurance, driving licence. The app sends notifications before expiries: 90, 60, 30, 7, and 1 days out.
This is the conversion moment from anonymous user to account holder, and the primary retention loop. Users return at least monthly to check status, plus get nudged before each expiry. Optional sign-up, never forced.
Wave 2 — Monetisation (Months 3-6)
Feature 3: Health Dashboard
The organising layer that ties everything together. Status cards show green/amber/red across all categories (saman, blacklist, documents). The user opens the app, sees the state of their car at a glance, and either acts or feels relieved.
Notifications fire only on status changes — green to amber to red. No spam, no daily noise. The "all clear" experience is as important as the alert experience.
Feature 4: Used Car Buyer Report (Pre-Purchase Verification Toolkit)
The primary revenue line. Positioned as a verification toolkit that helps buyers confirm what the seller is claiming, spot red flags, and know what to verify themselves — not a Carfax-equivalent history report. Priced honestly to match what free/scraped data can actually deliver.

Three tiers:

FREE — Basic verdict (Green/Amber/Red), saman/blacklist check on the vehicle, market price benchmark vs current listings. Acquisition and lead generation.

STANDARD (RM12-19) — Year 1 primary monetisation. Full report with all sections: market position analysis, outstanding issues, AI document parsing of buyer-uploaded documents, AI photo analysis for repair signs, guided JPJ check with AI parsing of buyer-uploaded printout, listing history, manufacturer recall lookup, public mention scan, specific actionable recommendations.

PREMIUM (RM39-49) — Year 2 unlock. Adds paid accident history from third-party data provider (insurance industry data). Requires partnership research; not committed for Year 1.

Every finding in the report is tagged with a verification status: Verified (confirmed via Paqar's data), Self-declared (seller stated, no proof), Needs proof (supporting document not yet provided), Unable to verify (no source available in Malaysia), or High-risk signal (inconsistency detected). Honesty about what we know vs. what we're taking the seller's word for is the core trust mechanic.

Every report ends with specific, dollar-quantified recommendations: negotiate X amount based on market data, request this document before paying deposit, investigate this inconsistency. The buyer doesn't figure out what to do — Paqar tells them.
Feature 5: Seller Trust Pack (Paid — RM29-49)
The two-sided monetisation feature. Users selling a car (private sale on Mudah, Carlist, Facebook) generate a verified trust report they can attach to their listing. Includes:

Verified clean saman/blacklist status
Verified ownership and no outstanding loan
Verified mileage authenticity
Service history (if user has been logging in Paqar)
A unique verification URL buyers can scan/click to confirm authenticity
A shareable PDF and image card optimised for listing platforms

Solves a real seller pain (closing sales faster, justifying higher prices, standing out in commodity markets). Different audience from the buyer report. Different SEO and acquisition (target sellers via "sell my car Malaysia," "Mudah listing tips," etc.).
How Money Is Made
Year 1 revenue stacks across exactly two transactional products:

Used Car Buyer Reports — Standard tier at RM12-19 (primary revenue line)
Seller Trust Packs — at RM29-49 (second revenue line)

Both are one-time purchases at high-intent moments. No subscriptions, no affiliate revenue, no ad revenue, no transactional fees on third-party services. This is deliberately narrow — the goal is to validate willingness-to-pay on these two products before adding monetisation complexity.

Pricing rationale: Without MyEG/JPJ partnership (RM5K-50K setup capital, not committed in Year 1), we cannot deliver full Carfax-equivalent data. The honest product at the honest price is RM12-19 Standard. Volume strategy at accessible pricing beats premium strategy with overpromised scope. Premium tier (RM39-49) unlocks in Year 2 when paid accident history partnerships are in place.

Realistic Year 1 targets:

100K+ users acquired through saman/blacklist wedge
1-3% of audience purchases a Used Car Buyer Report (Standard tier)
0.5-1.5% of audience purchases a Seller Trust Pack
Average revenue per buying user: RM12-19 (Buyer Report), RM29-49 (Seller Trust Pack)
Year 1 revenue: RM150K-400K (honest, achievable without partnership capital)

Year 2 trajectory: 2-4% conversion as brand trust builds, Premium tier launches → RM800K-2M ARR
Year 3 trajectory: established player, multiple data partnerships secured → RM3-5M ARR

Year 2 monetisation expansion (out of scope for current build but signalled):

Buyer Report Premium tier (RM39-49) — paid accident history via third-party provider
Affiliate revenue (insurance, refinancing, used car platforms)
SMB pro tier for fleet operators
Saman payment routing
API/data products for B2B
Stage 2: Hire purchase refinancing as bridge to financial wellness

How Users Are Acquired
Primary channel: organic search. "Semak saman," "blacklist imigresen," "AES saman," and similar terms have substantial monthly Malaysian search volume. Paqar competes by being the fastest, cleanest, most useful destination.
Secondary acquisition (Used Car Buyer Report): Different SEO targeting buyer intent — "check car history Malaysia," "semak sejarah kereta," "Mudah scam check," "verify used car Malaysia."
Secondary acquisition (Seller Trust Pack): Different SEO and channels — content for sellers, partnerships with listing platforms, "how to sell car Malaysia" content.
Tertiary channels:

TikTok and Facebook content (POV-style fear content does well in Malaysia)
Reddit /r/MalaysianPF, /r/Malaysia, and Lowyat community presence (founder as helpful contributor, not promoter)
Word of mouth through shareable Reality Check screens
Founder-led media presence (LinkedIn, podcast appearances)

Explicitly avoided:

Paid Google Ads bidding wars against MyEG and Touch n Go
Influencer marketing with scripted endorsements
Aggressive notification spam

Technical Architecture
Stack:

Frontend: Next.js 14 (App Router), TypeScript strict mode, Tailwind CSS, shadcn/ui
Backend: Next.js API routes plus separate Node.js workers for scraping
Database: Supabase (Postgres + Auth + Storage)
Cache and queue: Upstash Redis
Scraping: Playwright workers running on Hetzner or Fly.io
Document parsing (Used Car / Seller features): Anthropic Claude API
Email: Resend
Push notifications: Web Push API initially
Payments: Stripe + iPay88 (for FPX bank transfer, essential in Malaysia)
Analytics: PostHog
Errors: Sentry
Hosting: Vercel for app, Hetzner for workers

Architecture principles:

Defensive scraping. Government sites break. Build for graceful degradation — when one source is down, the rest still work, and users see an honest "couldn't check this source right now."
Aggressive caching. Saman data updates daily at most. Cache for 12-24 hours. Protects against rate limiting and makes the user experience feel instant.
Multi-country architecture from day one. Schema supports multiple countries even though we launch only Malaysia. Costs almost nothing now, saves enormous pain when expanding to Indonesia and Thailand.
Privacy by design. Encryption at rest, minimal data retention, clear deletion paths. PDPA compliance is non-negotiable.
Progressive trust. Every feature has an "all clear" experience as important as its alert experience. Notifications are rare and meaningful.

Data sensitivity:
The app handles plate numbers and IC numbers. Field-level encryption for sensitive fields. Minimum data retention. Clear user-controlled deletion. Audit logs for sensitive data access.
Honest Risk Assessment
Government data source dependence. If MyEG locks down exclusive integration with PDRM/JPJ, scraping becomes harder. Mitigation: diversify across many sources, build genuine partnerships in Year 2.
Incumbent improvement. MyEG modernising or Touch n Go shipping deeper car features would compress differentiation. Mitigation: out-execute on UX velocity.
PDPA/regulatory exposure. Storing IC numbers and plate numbers is sensitive. One breach is catastrophic. Mitigation: invest in security from day one, professional review of policies.
Used car report market smaller than expected. This is the largest revenue line. Mitigation: validate willingness-to-pay through landing page tests before full feature build. Have a pre-launch waitlist with payment intent capture.
Seller Trust Pack adoption uncertain. Sellers may not believe a verified report helps them sell faster. Mitigation: launch with money-back guarantee for first 100 sellers, collect data on whether listings with Paqar reports actually sell faster, use that data for credibility.
Solo founder operational load. Customer support, scraper maintenance, and security monitoring compound as users grow. Mitigation: AI-first support, robust monitoring, plan first hire for Year 2.
What This Business Is Not
It is not a fintech app handling money on behalf of users beyond simple payment collection for reports.
It is not an insurance broker, a marketplace, or a super-app.
It is not subscription-dependent. The Year 1 business works through transactional revenue only.
It is not a generalist e-government app like MyEG. It stays vertically focused on car ownership.
What Success Looks Like
Year 1: 100K+ users acquired, 5 features shipped, RM150K-400K revenue, profitable solo operation at honest pricing, brand and audience established. Validation of willingness-to-pay on both Used Car Buyer Report (Standard tier) and Seller Trust Pack. Volume data to justify Premium tier and partnership investments in Year 2.
Year 2: Premium Buyer Report tier launches (RM39-49 with paid accident history). Wave 3 features added (Loan Health Check, Roadtax Renewal Bundle, or Affiliate Layer). 500K+ users. RM800K-2M ARR. First hire likely. Indonesia or Thailand expansion mapped.
Year 3: 1M+ users in Malaysia, second market launching, RM3-5M ARR, full data partnership stack in place, possible Stage 2 financial wellness expansion to warm audience, possible acquisition interest from regional players.
Year 5+: Regional player with multi-market presence, potential RM20-50M revenue or strategic exit.

Year 2 Upgrade Paths
These are options the business holds, not commitments it has made. Year 1 plan does not depend on any of them.

A. MyEG / JPJ Partnership
Trigger: 5,000+ monthly Buyer Reports sustained for 3+ months.
Investment: RM5K-50K setup, RM2-10 per query, possible monthly minimum.
Unlocks: deeper JPJ ownership/encumbrance data integration (currently handled via guided self-service check).
Decision criteria: monthly volume × premium pricing increase must exceed setup amortisation.

B. Paid Accident History Provider
Trigger: research phase identifies viable provider with reasonable per-query cost.
Investment: per-query cost passed through to buyer in Premium tier pricing.
Unlocks: insurance claim and accident history data for Premium tier (RM39-49).
Path: investigate Bjak's data sources, PIAM, ISM, Allianz/Etiqa B2B data products.
Decision criteria: provider availability + pricing that supports Premium tier margin.

C. Insurance Industry Direct Partnerships
Trigger: established brand + significant volume + relationships built over Year 1-2.
Unlocks: deeper accident/claim data, possibly real-time.
Path: PIAM relationships, individual insurer partnerships.

D. Manufacturer Service Record Access
Trigger: partnerships with specific manufacturers.
Unlocks: verified service history beyond user-supplied documents.
Path: individual manufacturer business development conversations.

E. Full Carfax-Equivalent (Year 3+)
Combination of all above partnerships. Long-term ambition, not Year 1-2 plan.