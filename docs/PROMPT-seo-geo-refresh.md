# Task: bring Paqar's SEO and GEO assets in line with the current build

You are working on **Paqar** (paqar.my), a Malaysian used-car buyer product.
Repo root: `/home/freddievong/Paqar`. Branch: `fix/proof-before-paywall`
(which is currently identical to `main`).

**Your job is SEO and GEO only.** Metadata, structured data, `llms.txt`,
sitemap signals, internal linking, and the crawl/recrawl posture. Do not
restructure product surfaces or change pricing.

---

## What Paqar actually is right now

Read this carefully — several SEO assets still describe a product that no
longer exists, and that is most of the work.

A buyer has **already found a car** and sends Paqar **the listing link** (or a
screenshot of the advert). A **person** reads that advert, compares it against
current comparable adverts, and sends back a decision on that one car: proceed,
negotiate, or walk away — with a negotiation target, a ready-to-send script for
that seller, the questions to ask, and what to verify before paying a deposit.

- **Laporan Pembeli — RM29.** One payment, no account. Reviewed by a human
  before release. Normally ~30 minutes during staffed hours, guaranteed within
  24 hours. Full refund if Paqar cannot produce the decision.
- **Semakan Accident/Claim Insurans — +RM88**, total RM117. **Sold only from
  inside the released report**, after the plate has actually resolved to a
  registered vehicle. It is **two payments, not one**. Never describe it as a
  bundle or "satu bayaran".
- The **plate is optional** at intake and is verified **after** payment. The
  field on every intake form asks for a **listing link**, not a plate number.
- Paqar is operated by **TENTEC SDN BHD**, which is also the data controller.
  Do **not** publish a company registration number or registered address —
  those are pending legal review.

**Things that are no longer true and must not appear anywhere:** "instant
valuation", "semak harga percuma" / free price check, "alat" (tool) framing,
plate-first instructions ("masukkan nombor plat untuk semak harga"), RM12,
RM100, and "Paqar tidak jual rekod tuntutan".

---

## What changed recently that your assets have not caught up with

The last eight commits rewrote a lot of on-page content. Read
`git log --oneline -12` and skim those commit messages — they explain the
reasoning, which you will need to keep the metadata truthful.

Highlights that matter to you:

1. **All eight `/faq/*` guides were fact-corrected and re-pointed.** The
   road-tax guide was rewritten wholesale (it had invented a per-state JPJ fee
   table; road tax is federal with two schedules — Peninsular, and
   Sabah/Sarawak). The Honda City guide now renders variants and generations
   from `lib/variant-guides.ts` (S/E/V, Generasi 5/6/7 — it previously invented
   a "1.5 H" variant and numbered generations 1/2/3). The Vios guide moved to
   year ranges. A City-vs-Vios resale contradiction against `/bandingkan` was
   resolved.
2. **JSON-LD `Offer` prices were stale** — `/laporan-pembeli-kereta-terpakai`
   advertised RM12 to Google, the accident page advertised RM100. Both now
   derive from `lib/pricing`. A test forbids literal Offer prices; keep it that
   way.
3. **The homepage FAQ (visible and JSON-LD) claimed Paqar does not sell claim
   records** while selling them. Now derived from `historyUpgradeAvailable()`
   via `competitorComparisonAnswer()` in `lib/history-addon-copy.ts`.
4. **TENTEC SDN BHD** is now named in the footer, terms, About and privacy.
5. `/laporan-pembeli-kereta-terpakai` was repositioned away from "Alat Pembeli
   Kereta Terpakai" toward the human-reviewed decision.

---

## Verified current state — do not re-derive this

- Canonical host is the **apex**, `https://paqar.my`. `www` 308-redirects to
  it, and declared canonicals + `robots.txt`'s Sitemap line all use apex.
  Consistent; leave it alone.
- `app/sitemap.ts` emits **116 URLs** in production, including all 8 `/faq/*`
  guides. `lastModified` is `now` for everything.
- `app/robots.ts` already allows **GPTBot** and **Google-Extended**, with the
  same Disallow list as `*` (`/check/`, `/laporan-pembeli/`, `/dashboard/`,
  `/auth/`, `/api/`, `/admin/`).
- `public/llms.txt` exists (110 lines) and was **last touched 2026-08-22** —
  before the add-on went on sale and before the guide corrections.
- Structured data in use across `app/`: 24 `FAQPage`, 17 `Organization`,
  16 `BreadcrumbList`, 7 `Article`, 3 `Service`, 3 `Offer`, 2 `WebSite`,
  6 `HowToStep`.

---

## The work, in priority order

### 1. `public/llms.txt` is the highest-value GEO asset and it is stale

This is what answer engines read to describe Paqar. Audit every line against
"What Paqar actually is" above. Known problems:

- It does not mention the RM88 add-on or the RM117 total **at all**.
- Line ~37 discusses plate-based variant verification in terms that predate
  the post-payment verification flow. Check it.
- Lines ~74–76 document the public valuation API by plate. Verify those
  endpoints still behave as described before keeping them.
- It should state the two-payment structure explicitly, the human review, the
  refund, and that Paqar is operated by TENTEC SDN BHD.

Write it so a model quoting one paragraph cannot produce a false claim.

### 2. Metadata on the eight rewritten guides

The page *bodies* were corrected; several `title` / `description` /
`openGraph` blocks still summarise the old content. Check all eight in
`app/faq/*/page.tsx` plus the `/faq` index, and reconcile each against what
the page now says. The road-tax guide's metadata was already updated — use it
as the pattern.

### 3. `Article` schema should admit these pages were revised

The rewritten guides carry `datePublished` and no `dateModified`. A guide
dated 2026-06 that was substantially corrected in 2026-08 should say so — it
is both true and a ranking signal. Consider whether `sitemap.ts` should carry
real `lastModified` dates for the corrected guides rather than `now` for
everything, since "everything changed today, every day" is a weak signal.

### 4. Entity clarity for Paqar ↔ TENTEC SDN BHD

17 `Organization` nodes name Paqar. None names the operating company. Adding
`legalName` (or an appropriate `parentOrganization`) helps answer engines and
knowledge panels resolve who is behind the service — which is exactly the
question a cautious buyer asks. **Name only. No registration number, no
address.**

### 5. The road-tax page is now a genuinely differentiated answer — use it

"Roadtax ikut negeri" is a real high-volume Malaysian query, and Paqar now
gives the correct counter-intuitive answer ("it doesn't vary by state in
Peninsular Malaysia; here is what actually decides it"). That is unusually
strong GEO material. Make sure its `FAQPage` answers are self-contained and
quotable out of context, and that internal links point at it from the other
guides where road tax comes up.

### 6. Internal linking

The `/faq` hub is the only internal path into the guides
(see the comment in `app/sitemap.ts`). Now that the guides are factually
sound, look for natural cross-links between them and from the model/brand/year
hubs — but only where a link genuinely helps a reader.

### 7. Request a recrawl

Search results still surface cached "alat", plate-first and RM12 snippets.
The live pages are fixed; this is crawl lag. Prepare the list of URLs worth
submitting for reindexing in Google Search Console and tell Freddie — **he has
to submit it, you cannot.**

---

## Hard constraints

- **Never invent a fact.** This codebase just spent a full session removing
  fabricated JPJ fee tables, a nonexistent Honda variant and invented vehicle
  lifespans. If you cannot verify a claim, leave it out. `__tests__/lib/guide-truthfulness.test.ts`
  guards several of these — read it before touching guide copy.
- **All prices derive from `lib/pricing.ts`.** Never type `29`, `88`, `117`,
  `2900` or `8800` into copy or schema. A test rejects literal `Offer` prices.
- **All add-on claims derive from `lib/history-addon-copy.ts`**, which is
  gated on `historyUpgradeAvailable()`. Never write an add-on claim by hand.
- **Test gotcha that will waste your time:** this repo documents copy changes
  by quoting the removed line in a comment above it. Any test that greps source
  for user-facing copy **must strip comments first** — otherwise it finds the
  forbidden phrase inside the explanation of its own removal. Copy the `code()`
  helper from `__tests__/lib/pricing-contract.test.ts`.
- **Next.js routing gotcha:** partial dynamic segments like `app/harga-[slug]/`
  build locally but resolve to `/_not-found` on Vercel. Use
  `app/harga-model/[slug]/` plus a rewrite.
- Do not change pricing, the intake flow, the review gate, or the add-on's
  sale point.

---

## Verification before you commit

1. `npx tsc --noEmit`
2. `npx vitest run` — full suite, currently **3,292 passing**.
   Two files flake under parallel load and pass in isolation:
   `__tests__/components/proof-before-paywall.test.tsx` and
   `__tests__/components/listing-intake-form.test.tsx`. Re-run the file alone
   before investigating; never wave away a failure in any other file this way.
3. `npm run build` — this is the deploy gate, not `tsc`.
4. **Drive it.** `npx next start -p 3210` (kill by port via
   `ss -lptn 'sport = :3210'`, never `pkill -f "next start"` — that kills your
   own shell). Then check rendered output, not source: every stale claim found
   this session was invisible in source review and obvious in the rendered
   page. Playwright is installed under `scraper/node_modules`.
5. Assert on the **rendered JSON-LD**, e.g.
   `curl -s localhost:3210/<path> | grep -o '"price":"[0-9]*"'`.

Deploying: `main` auto-deploys to production. Pushing needs VS Code askpass —
see `project_git_push_vscode_askpass` in memory for the env vars.

Ask Freddie before anything you cannot verify yourself — particularly company
details and anything that would change what Paqar charges or promises.
