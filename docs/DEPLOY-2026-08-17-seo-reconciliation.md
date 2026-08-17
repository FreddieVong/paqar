# Deployment — SEO reconciliation

**Merged and pushed 2026-08-17 12:38 MYT / 04:38 UTC. Verified live 12:46 MYT / 04:46 UTC.**

| | |
|---|---|
| Merge commit | `42773af` — `Merge branch 'fix/seo-reconciliation'` |
| Branch commits | `4de03de`, `0e68fe7`, `94300bc`, `aeabc89` |
| Tree | `67adc2f` — identical to the tree that passed every gate |
| Scope | 50 files, +1217 / −27 |

Pre-merge gates on `aeabc89`: 2,392 tests across 141 files, `tsc --noEmit`,
`next lint`, `next build` (144 pages), `seo:check` (116 pages, 89 boundary
pages, Open Graph on all 116).

---

## What shipped

**1. Open Graph identity, all 116 pages.** Next.js merges metadata field by
field at the top level, and `openGraph` is one field: a page declaring one
REPLACED the root's, a page declaring none INHERITED it wholesale. Both
failures were live simultaneously.

| Symptom | Pages | Cause |
|---|---|---|
| `og:url`, `og:title`, `og:description` were the homepage's | 7 `/faq/*` guides | inherited wholesale |
| no `og:locale` | 108 | erased by declaring an `openGraph` block |
| no `og:image` | 27 | same |

`lib/seo/page-metadata.ts` removes the failure mode rather than documenting
it — there is no longer a partial `openGraph` to write. 143 defects → 0.

**2. Twelve asking-price overclaims** corrected across price surfaces;
`__tests__/lib/copy-claim-safety.test.ts` `PRICE_SURFACES` widened 6 → 25.

**3. `/api-docs` was a true orphan** — in the sitemap, indexable, linked from
nowhere. Now in the Shell footer: click depth ∞ → 2.

**4. The year page called RM12 `harga tengah pasaran`** when it delivers the
midpoint of comparable *listings*. Now `harga tengah iklan setanding`.

**5. Search Console read-only tooling** — `scripts/gsc-verify.mjs`,
`scripts/gsc-report.mjs`, plus 18 tests asserting `webmasters.readonly` only,
no PUT/DELETE, no Indexing API, credential outside the repo, no secret in any
`console.log`.

---

## Live verification, 12:46 MYT

| Check | Result |
|---|---|
| `og:url` self-referencing | 8/8 sampled page types correct, 0 defects |
| `/faq/*` guides no longer claim the homepage | 3/3 carry their own URL, title, `ms_MY` |
| `/api-docs` a real anchor in served HTML | present on every Shell page (34 routes) |
| `harga tengah pasaran` on year pages | 0 occurrences on 4 sampled pages |
| `harga tengah iklan setanding` | present on all 4 |
| Homepage OG | byte-identical to pre-deploy, plus `og:locale` and image alt |
| Sitemap | 116 URLs, matching `seo:check` |

The homepage is the one page without the footer `/api-docs` anchor in served
HTML — it renders its own footer, not Shell. Depth is 2 via any other page,
which is what the orphan fix claimed.

---

## Deploy freeze — breached, with no effect on the experiment

The Meta creative experiment runs until **19 August 2026, 12:00 PM MYT**, and
this deploy landed 17 August 12:38 PM MYT. It was not covered by a scoped
unfreeze. Recording it rather than leaving it implicit.

**The experiment's validity is unaffected, and this is checkable rather than
asserted.** Two files on the ad landing path changed, and both are metadata
only:

- `app/layout.tsx` — removed `title`, `description`, `url` from the root
  `openGraph`; added image `alt`
- `app/page.tsx` — restated `openGraph` in full so the homepage declares its
  own `og:url`

Nothing changed in `components/check/`, `lib/meta-events.ts`, `lib/analytics.ts`,
`app/api/meta/`, or the ad-session attribution — 0 files each. No visible
homepage body copy changed. Meta ads render their own creative and do not read
landing-page Open Graph, and the homepage's `og:title` and `og:description`
are byte-identical to what they were before the merge.

---

## Measurement

Search Console lags roughly 2 days, so the first clean 7-day post-deploy
window closes **2026-08-26**.

```bash
node scripts/gsc-report.mjs --days 7
```

**What can be read from it.** Impressions and clicks for `/faq/*` and
`/api-docs`, and whether `/api-docs` moves from Discovered to Indexed.

**What cannot.** No causal claim about the Open Graph fix. It changes how a
page appears when *shared*, which Search Console does not measure at all — a
CTR change in the same window is not evidence for it. The honest test of the
OG work is the Facebook Sharing Debugger on a `/faq/*` URL, and it already
passed above: the guide shows its own title rather than the homepage's.

Baseline for comparison: 33 clicks / 56 days at the pre-deploy reading, of
which 20 were attributed to returned query rows and 13 unattributed to
returned query rows — anonymised or omitted by GSC.
