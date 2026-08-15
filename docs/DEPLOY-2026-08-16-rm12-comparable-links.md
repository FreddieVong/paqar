# Scoped unfreeze — RM12 comparable-link correctness fix

**Recorded 2026-08-15 18:02 UTC / 2026-08-16 02:02 MYT, before deployment.**

The Meta creative experiment runs until **19 August 2026, 12:00 PM MYT**. Deploys
are otherwise frozen for its duration. This is a scoped, authorised exception.

---

## What is unfrozen

Exactly one branch: `fix/rm12-invalid-comparable-links`, a single commit against
`origin/main`.

| File | Change |
|---|---|
| `lib/listing-url.ts` | new — `isIndividualListingUrl()` |
| `components/report/BuyerReportContent.tsx` | one `.map()` callback: chip renders `<a>` only when the URL resolves to an individual advert, otherwise `<span>` |
| `__tests__/components/report-listing-links.test.tsx` | new — 27 regression tests |

## What this corrects

**Post-purchase RM12 evidence navigation only.**

The paid report's "Harga listing dijumpai" chips linked every cached row's URL.
`scraper/src/scrapers/mudah-market.ts` produces URLs that identify no single
advert — the JSON path interpolates an empty `adid` into the literal
`https://www.mudah.my/m/`, and the DOM fallback keeps any link whose surrounding
card mentions a price, so search pages and category pages reach the cache looking
like listings. A buyer who had paid RM12 to see which adverts set the price could
be sent to a search page, or to nothing.

After this change the measured price still renders in every case; only the
hyperlink is withheld when the URL is not an individual advert. No URL is
repaired, substituted or invented.

## What does NOT change

- **No free funnel change.** The free result (verdict, action line, confidence,
  methodology) is untouched. `lib/free-price-evidence.ts` is not in this diff.
- **No landing page or SEO change.** `seo:check` passes unchanged: 116 pages,
  116 sitemap URLs, 122 JSON-LD blocks.
- **No Meta event, pixel, CAPI, campaign, ad set, creative or budget change.**
  Nothing under `lib/meta-ads/`, `lib/meta-capi.ts` or `lib/meta-events.ts` is
  touched, and no experiment row is read or written.
- **No payment, webhook, receipt or entitlement change.** Billplz, JomCheck and
  RM100 paths are untouched.
- **No schema, scraper or data-pipeline change.** The scraper still emits the
  same URLs; this only decides which of them may be presented as a link.

## Pre-deployment production state

| | |
|---|---|
| Production commit | `7adfe0900ddfcf93dfb79af09c43a303180e7775` |
| Deployed | 2026-08-13 05:52 UTC |
| `https://paqar.my` | HTTP 200 |

## Verification completed before deploy

- 27 targeted tests; confirmed failing 6/27 against the pre-fix component.
- Full suite **1690 passed** (112 files); typecheck clean; lint clean.
- Clean production build (`.next` removed; non-routable dummy env, never
  production credentials); `seo:check` green against that fresh output.
- Rendered HTML fixture: 8 chips, 3 valid URLs linked, 5 invalid rendered as
  plain prices, no empty anchors. Screenshotted at 375px and 1280px.
- Vercel preview `dpl_AgJ4mvJZYz5CoCMeRPo5FygPhfkz` **READY**, commit `326554e`,
  build logs clean.
- **Live production data check.** Paid report `ch_GasmP4AWQw` (2016 BMW 730Li)
  currently renders 7 chips, and all 7 URLs are individual adverts ending in a
  6+ digit ad id. This fix therefore removes **zero** links from that report —
  the rollback condition "valid links disappear" was tested against real data,
  not a fixture.

The Vercel preview page itself could not be rendered: preview deployments are
behind Vercel SSO, and creating a protection-bypass secret was declined as an
unnecessary change to project settings. The production-data check above covers
the same risk.

## Rollback

`git revert` the merge commit and push. Triggers if valid advert links disappear
from a paid report, if the price evidence stops rendering, or if any unrelated
behaviour changes.
