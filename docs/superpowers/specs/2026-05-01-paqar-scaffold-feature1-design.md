# Paqar — Scaffold + Feature 1: Saman & Blacklist Check

## Context

Paqar is a mobile-first web app for Malaysian car owners that aggregates saman, blacklist, and document expiry data into a single dashboard. This spec covers the project scaffold and Feature 1 (Saman + Blacklist Check) — the hero acquisition feature and primary SEO wedge.

The goal of this phase is to build a fully functional UI and check flow backed by realistic stub data, so the user experience can be validated end-to-end before any real scrapers are written. Real scrapers come in a separate Phase 2. The architecture must make that swap clean.

---

## Scope

**In scope:**
- Next.js 14 project scaffold with full toolchain
- Supabase schema (all 4 tables + RLS + indexes)
- `/lib/crypto/` encryption module
- `/lib/data-sources/` adapter pattern with 7 stub implementations
- Check form (plate + IC input)
- Streaming results page (progressive card reveal via polling)
- Auth flow (phone OTP primary, email magic link secondary)
- Anonymous → authenticated claim flow via `claim_token`
- Stub scenario library (6 scenarios via plate-prefix triggers)

**Out of scope (Phase 2+):**
- Real scrapers
- Document expiry tracker (Feature 2)
- Health dashboard (Feature 3)
- Payments, paid reports
- Push notifications
- PWA manifest

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript strict |
| Styling | Tailwind CSS, shadcn/ui |
| Database + Auth | Supabase (Postgres 15 + Auth) |
| Cache / rate-limit | Upstash Redis |
| Hosting | Vercel |
| Font | Inter (next/font) |
| Brand colour | Teal-700 `#0F766E` |

---

## Project Structure

```
/app
  page.tsx                        ← landing + check form
  /check/[id]/page.tsx            ← streaming results page
  /auth/page.tsx                  ← sign in
  /auth/callback/route.ts         ← Supabase auth callback (single route handler)
  /dashboard/page.tsx             ← stub post-auth home
  /api/checks/route.ts            ← POST: create check
  /api/checks/[id]/route.ts       ← GET: poll results

/lib
  env.ts                          ← Zod env validation, fails loud at startup
  /crypto/index.ts                ← encrypt / decrypt / hash (AES-256-GCM)
  /supabase/
    client.ts                     ← browser client (anon key)
    server.ts                     ← server client (service role)
    middleware.ts                 ← session refresh
  /data-sources/
    types.ts                      ← DataSourceAdapter interface + all types
    index.ts                      ← getAdapters(country) factory
    /stubs/
      pdrm.ts  jpj.ts  aes.ts
      local-councils.ts  immigration.ts
      lhdn.ts  ptptn.ts
    /real/                        ← empty; Phase 2
  /db/
    checks.ts                     ← createCheck, getCheck, updateCheckResult, claimCheck
    users.ts                      ← getUser, upsertUser
    vehicles.ts                   ← createVehicle, getUserVehicles
  /validation/
    plate.ts                      ← Malaysian plate regex + normalise()
    ic.ts                         ← 12-digit IC validation + normalise()
    phone.ts                      ← +60 format validation

/types
  database.ts                     ← auto-generated: `supabase gen types typescript`
  domain.ts                       ← User, Vehicle, Check, CheckResult (business types)
  api.ts                          ← API shapes + SourceData discriminated union

/components
  /ui/                            ← shadcn primitives (Button, Input, etc.)
  /check/
    CheckForm.tsx                 ← plate + IC inputs, submit
    ResultCard.tsx                ← single source result (pending / clear / hit / unavailable)
    ResultsStream.tsx             ← polling orchestrator, renders card list + progress bar
  /auth/
    PhoneOtpForm.tsx              ← phone input → OTP entry (same component, two states)
    MagicLinkForm.tsx             ← email input
    AuthShell.tsx                 ← wraps both with copy + teal branding
  /layout/
    Nav.tsx                       ← minimal top bar (logo + optional sign-in link)
    Shell.tsx                     ← page wrapper (max-w, padding)
```

---

## Database Schema

### Migration: `supabase/migrations/001_initial_schema.sql`

```sql
-- VEHICLES
create table vehicles (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  plate_encrypted  text not null,
  plate_hash       text not null,
  label            text,
  country          text not null default 'MY',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index vehicles_user_id_idx    on vehicles(user_id)     where deleted_at is null;
create index vehicles_plate_hash_idx on vehicles(plate_hash)  where deleted_at is null;
alter table vehicles enable row level security;
create policy "vehicles: owner access" on vehicles
  for all using (auth.uid() = user_id);

-- CHECKS
create table checks (
  id               text primary key,
  plate_encrypted  text not null,
  plate_hash       text not null,
  ic_encrypted     text not null,
  ic_hash          text not null,
  country          text not null default 'MY',
  user_id          uuid references auth.users(id),
  vehicle_id       uuid references vehicles(id),
  status           text not null default 'pending'
                   constraint checks_status_values
                   -- 'expired' is set by a scheduled cleanup job (Phase 2).
                   -- Queries for "active" checks filter by expires_at > now(), not status.
                   check (status in ('pending','running','complete','expired')),
  claim_token      text unique,
  idempotency_key  text unique,
  expires_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  completed_at     timestamptz,
  deleted_at       timestamptz
);
create index checks_user_id_idx      on checks(user_id, created_at desc)            where deleted_at is null;
create index checks_vehicle_id_idx   on checks(vehicle_id, created_at desc)         where deleted_at is null;
create index checks_cache_lookup_idx on checks(plate_hash, ic_hash, created_at desc) where deleted_at is null;
create index checks_claim_token_idx  on checks(claim_token)  where claim_token is not null;
create index checks_expires_at_idx   on checks(expires_at)   where deleted_at is null;
alter table checks enable row level security;
create policy "checks: owner read" on checks
  for select using (auth.uid() = user_id);

-- CHECK_RESULTS
create table check_results (
  id             uuid primary key default gen_random_uuid(),
  check_id       text not null references checks(id) on delete cascade,
  source         text not null,
  status         text not null default 'pending'
                 constraint check_results_status_values
                 check (status in ('pending','clear','hit','unavailable','timeout','partial','error')),
  label          text not null,
  data           jsonb,
  error_message  text,
  attempt_count  integer not null default 0,
  created_at     timestamptz not null default now(),
  checked_at     timestamptz
);
create index check_results_check_id_idx on check_results(check_id);
alter table check_results enable row level security;
create policy "check_results: owner read" on check_results
  for select using (
    exists (
      select 1 from checks c
      where c.id = check_results.check_id and c.user_id = auth.uid()
    )
  );

-- DOCUMENT_EXPIRIES (schema-ready; Feature 2 populates it)
create table document_expiries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  vehicle_id     uuid references vehicles(id) on delete set null,
  document_type  text not null
                 constraint document_expiries_type_values
                 check (document_type in ('roadtax','insurance','driving_licence')),
  expires_on     date not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint driving_licence_no_vehicle
    check (document_type != 'driving_licence' or vehicle_id is null),
  constraint roadtax_insurance_requires_vehicle
    check (document_type = 'driving_licence' or vehicle_id is not null)
);
create index document_expiries_user_expires_idx
  on document_expiries(user_id, expires_on) where deleted_at is null;
alter table document_expiries enable row level security;
create policy "document_expiries: owner access" on document_expiries
  for all using (auth.uid() = user_id);
```

---

## Encryption Module (`/lib/crypto/index.ts`)

- Algorithm: AES-256-GCM
- Key source: `process.env.AES_KEY` (32-byte hex, validated by `env.ts`)
- `encrypt(value: string): string` — returns `iv:ciphertext` (base64, colon-separated)
- `decrypt(value: string): string` — inverse
- `hash(value: string): string` — SHA-256 of `value.toUpperCase().replace(/\s/g, '')`, hex output
- Anonymous checks: `claim_token` is generated by the API route using `crypto.randomUUID()` — never client-generated

> TODO (key rotation): MVP uses a single `AES_KEY`. Rotation will require a migration script that re-encrypts all `plate_encrypted` / `ic_encrypted` fields. Future path: versioned key identifiers prefixed in the ciphertext (`v1:iv:ct`). Do not block MVP on this.

---

## Adapter Pattern (`/lib/data-sources/`)

### Types (`types.ts`)

```typescript
export type Country  = 'MY' | 'ID' | 'TH'
export type SourceId = 'pdrm' | 'jpj' | 'aes' | 'local_councils'
                     | 'immigration' | 'lhdn' | 'ptptn'

// 'pending' is the pre-check state (matches DB schema)
// 'partial' = within-source partial: the source responded but data is incomplete
//   (e.g. PDRM returned results for 2 of 3 states). NOT cross-source partial —
//   missing sources are 'unavailable' or 'timeout'.
export type SourceStatus =
  | 'pending' | 'clear' | 'hit'
  | 'unavailable' | 'timeout' | 'partial' | 'error'

export interface SourceResult {
  source:       SourceId
  status:       SourceStatus
  label:        string
  data:         SourceData | null
  errorMessage: string | null
  checkedAt:    Date
}

export interface DataSourceAdapter {
  readonly sourceId: SourceId
  readonly label:    string
  check(plate: string, ic: string): Promise<SourceResult>
}

// Retry contract: adapters NEVER retry internally.
// Retries are the responsibility of the calling API route.
// attempt_count on check_results tracks how many times the route has called an adapter.
```

### Discriminated union (`/types/api.ts`)

```typescript
export type SourceData =
  | { source: 'pdrm';           samans: SamanRecord[] }
  | { source: 'jpj';            samans: SamanRecord[] }
  | { source: 'aes';            samans: SamanRecord[] }
  | { source: 'local_councils'; samans: SamanRecord[]; council: string }
  | { source: 'immigration';    blacklisted: boolean; reason: string | null }
  | { source: 'lhdn';           blacklisted: boolean }
  | { source: 'ptptn';          blacklisted: boolean; outstanding: number | null }

export interface SamanRecord {
  offence:    string
  // ISO 8601 date string ("2026-04-15"). Adapters must normalise to this format.
  date:       string
  amount:     number
  currency:   string       // always 'MYR' today; IDR/THB in Year 2
  location:   string | null
  discounted: number | null
  // Always null in stub phase — no fake payment URLs that could render as real CTAs.
  // Real URLs arrive in Phase 2 when scrapers are wired.
  paymentUrl: null
}
```

### Factory (`index.ts`)

```typescript
// Per-source override: DATA_SOURCE_MODE_PDRM=real overrides DATA_SOURCE_MODE=stub
export function getAdapters(country: Country = 'MY'): DataSourceAdapter[] { ... }

// Wraps any adapter — resolves within `ms` or returns { status: 'timeout' }
export function withTimeout(adapter: DataSourceAdapter, ms = 10_000): DataSourceAdapter { ... }
```

### Stub scenarios (trigger via plate prefix)

| Plate prefix | Scenario |
|---|---|
| `TEST-CLEAN` | All 7 sources clear |
| `TEST-SAMAN1` | JPJ: 2 saman RM340 · AES: 1 saman RM150 |
| `TEST-BLACK` | Immigration: blacklisted |
| `TEST-PARTIAL` | LHDN + PTPTN status `unavailable` |
| `TEST-TIMEOUT` | Local councils status `timeout` |
| `TEST-WORST` | 3 sources `hit`, 2 `unavailable` |
| Any other | PDRM clear, JPJ 1 saman RM150 (realistic default) |

Each stub delays 150–800 ms (staggered per source) so streaming UI animates naturally without mocking timers.

---

## Check Flow (end-to-end)

### POST `/api/checks`
1. Validate plate (Malaysian pattern) + IC (12 digits) via `/lib/validation/`
2. Check `idempotency_key` — return existing check if found
3. Check cache: if `plate_hash + ic_hash` has a non-expired `complete` check, return it
4. Generate check `id` (nanoid, prefix `ch_`), `claim_token` (UUID), `expires_at` (now + 24h)
5. Encrypt plate + IC; hash both
6. Insert `checks` row (`status: 'pending'`) + 7 `check_results` rows (`status: 'pending'`)
7. `UPDATE checks SET status='running'`
8. Kick off processing: run all 7 adapters in parallel (each wrapped with `withTimeout`)
9. As each adapter resolves, `UPDATE check_results SET status=..., data=..., checked_at=now()`
10. When all 7 complete, `UPDATE checks SET status='complete', completed_at=now()`
11. Return `{ checkId, claimToken }` immediately (processing is fire-and-forget in the same request via `Promise.all`)

> Note: stub adapters resolve in <1s total; fire-and-forget works fine here. Phase 2 (real scrapers with 10s timeouts) will hit Vercel Hobby's 10s function limit — Phase 2 requires either Vercel Pro (60s timeout) or migrating to the queue-based architecture (Upstash) described in the README.

### GET `/api/checks/[id]`
- Validates `claim_token` query param (service role bypass for anonymous)
- Rate-limited: 60 requests per IP per minute via Upstash (defends against polling storms and claim_token brute-force)
- Returns `{ check, results: CheckResult[] }` — frontend renders whatever is non-pending
- Client polls every 1 500 ms until `check.status === 'complete'`

### Results page (`/check/[id]`)
- Reads `checkId` + `claimToken` from URL params
- Polls `GET /api/checks/[id]?claim_token=...` every 1 500 ms
- Progress bar: `completedCount / 7`
- Cards appear in source order: PDRM → JPJ → AES → Local Councils → Immigration → LHDN → PTPTN
- Each card transitions: pending (grey, "Checking…") → resolved (green/amber/red/grey)
- `unavailable` / `timeout` cards show "Couldn't reach this source right now" — never silently omitted
- On completion:
  - If `check.user_id` is null **and** user is not currently authenticated → show "Save & create account" CTA (teal dashed border card at bottom)
  - If user is already authenticated and `check.user_id` is null → auto-claim silently (call `claimCheck` in the background, no CTA shown)
  - If `check.user_id` matches current user → no CTA needed

---

## Auth Flow

**Page:** `/auth` — single page, two states controlled by local component state.

**State 1 — Phone input:**
- `+60` country code prefix (fixed for MVP), international number input
- "Send OTP →" primary teal button
- "Prefer email? Get a magic link" — small secondary text link below button
- Rate limit: 3 OTP requests per phone per hour (Upstash Redis counter)

**State 2 — OTP entry (same page, replaces input):**
- 6-digit OTP field
- "Verify" button
- "Resend" link (respects rate limit)

**Two auth paths — both attach the check via `claim_token`:**

Path A — Phone OTP (primary):
- `supabase.auth.verifyOtp({ phone, token, type: 'sms' })` — resolves inline, no callback URL
- On success: call `claimCheck(claim_token, user.id)` in the same flow
- Redirect to `/check/[id]`

Path B — Email magic link (secondary):
- `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: '/auth/callback?next=/check/[id]&claim_token=...' } })`
- `/auth/callback/route.ts` exchanges code for session, calls `claimCheck`, redirects to `/check/[id]`

**`claimCheck(claimToken, userId)`** (in `/lib/db/checks.ts`):
- `UPDATE checks SET user_id=$userId, claim_token=null WHERE claim_token=$claimToken AND user_id IS NULL`
- No-op if already claimed (idempotent)

---

## Environment Variables (`/lib/env.ts`)

Validated at startup via Zod. Missing or malformed values throw at boot — never silent.

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
AES_KEY                          # 32-byte hex
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
DATA_SOURCE_MODE                 # 'stub' | 'real' (default: 'stub')
NEXT_PUBLIC_POSTHOG_KEY
NEXT_PUBLIC_POSTHOG_HOST
SENTRY_DSN
```

---

## Idempotency Key Lifecycle

- Client generates a UUID per check attempt and sends it in the POST body as `idempotency_key`
- Server returns the existing check if the key matches (regardless of current status)
- Keys persist indefinitely in the `checks` table — no TTL, no cleanup in Phase 1
- Same key with a different plate/IC still returns the original check (key is the identity, not the input)
- Cleanup of orphaned keys is a Phase 2 concern

---

## PDPA Retention Policy

**Policy (document now, implement Phase 2):**
- Anonymous checks (`user_id IS NULL`) are hard-deleted after `expires_at + 7 days`
- Authenticated checks are retained until the user explicitly deletes their account
- `ic_encrypted` and `plate_encrypted` are the only PII fields; they are deleted on hard-delete
- Implementation: scheduled Supabase Edge Function or pg_cron job running nightly

---

## Error Logging

- **Provider:** Sentry (instrumented in Next.js via `@sentry/nextjs`)
- **PII scrubbing:** Sentry `beforeSend` hook strips `plate`, `ic`, `plate_encrypted`, `ic_encrypted`, `claim_token` from all event payloads before transmission
- **User-facing errors:** always generic — "Couldn't reach this source right now." Detailed errors stay in Sentry only
- **`error_message`** on `check_results` stores the raw error for internal debugging; never exposed in API responses

---

## Validation (`/lib/validation/`)

- `plate.ts` — **Permissive validation for MVP:** accept any 3–9 alphanumeric characters after normalisation (uppercase, strip spaces/hyphens). Worst failure mode is rejecting a valid Malaysian plate; validation can tighten once real traffic data is available. `normalise()` uppercases, strips spaces/hyphens.
- `ic.ts` — 12 digits, valid date prefix (YYMMDD). `normalise()` strips hyphens.
- `phone.ts` — +60 prefix, 9–10 digits after. `normalise()` strips spaces, dashes, leading zero.

---

## Analytics (PostHog)

Instrumented from day one. No PII in any event payload.

| Event | Properties |
|---|---|
| `check_started` | `country`, `is_test` (true if plate starts with `TEST-`) |
| `check_completed` | `country`, `status` (`complete`/`error`), `hit_count`, `unavailable_count`, `is_test` |
| `auth_started` | `method` (`phone`/`email`) |
| `auth_completed` | `method`, `is_new_user` |
| `check_claimed` | `method` (`phone`/`email`) |

`is_test` flag lets dev/test traffic be filtered from production analytics.

---

## Verification

1. **Scaffold:** `pnpm dev` starts without errors; `/` renders check form.
2. **Env validation:** Remove `AES_KEY` from `.env.local` → server throws on startup with a clear message.
3. **Check flow (stub):** Submit plate `TEST-SAMAN1` + any valid IC → results page shows progressive card reveal, JPJ card shows 2 saman, AES shows 1 saman.
4. **Graceful degradation:** Submit `TEST-PARTIAL` → LHDN and PTPTN cards show "Couldn't reach this source" in grey, not missing.
5. **Cache hit:** Submit same plate+IC twice within 24h → second request returns immediately with `status: 'complete'`.
6. **Idempotency:** POST with the same `idempotency_key` twice → second returns same `checkId`.
7. **Auth — phone OTP:** Click "Save & create account" → `/auth` shows phone input as primary, email as small text link.
8. **Claim flow:** Complete auth → redirect back to `/check/[id]`; check row now has `user_id` set, `claim_token` null.
9. **RLS:** Authenticated user cannot read another user's `checks` or `check_results` (test via Supabase SQL editor with different `auth.uid()`).
10. **TypeScript:** `pnpm tsc --noEmit` passes with zero errors.
