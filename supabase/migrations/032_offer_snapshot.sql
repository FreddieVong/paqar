-- ============================================================================
-- DEPLOYMENT BLOCKER — PREPARED, NOT APPLIED.
--
-- Migrations here are applied by hand in the Supabase dashboard (there is no
-- config.toml, so `supabase db push` does not work), which is what keeps this
-- file inert until someone deliberately runs it.
-- ============================================================================
--
-- WHY A SNAPSHOT EXISTS AT ALL
--
-- The paywall promises a negotiation target. Checkout recomputes offer
-- availability server-side before a bill can exist, which closes the
-- paywall→bill window. It does NOT close the rest:
--
--     paywall  →  bill creation  →  payment  →  paid-report rendering
--
-- The paid report recomputes from the LIVE cache at render time, and re-scrapes
-- when it comes back empty. Between the bill and the render the cohort can
-- change: the warm-cache cron overwrites it, another visitor's request
-- refreshes it, or CACHE_TTL_DAYS expires. So a buyer can be shown an offer,
-- pay for it, and receive a report without one.
-- __tests__/lib/offer-fulfilment-lifecycle.test.tsx proves exactly that.
--
-- WHY A SEPARATE TABLE, AND NOT A COLUMN ON `checks`
--
-- `checks` carries RLS with an owner-read policy (001_initial_schema.sql):
--
--     create policy "checks: owner read" on checks
--       for select using (auth.uid() = user_id);
--
-- A browser-side Supabase client is shipped (lib/supabase/client.ts, anon key),
-- so a SIGNED-IN owner can select their own check row directly — including any
-- new column — before paying. The snapshot is paid evidence (accepted prices,
-- median, range, offer band), so a column on `checks` would leak it.
--
-- Postgres has no column-level RLS. A column REVOKE would not help either:
-- `authenticated` holds table-level SELECT on `checks`, and a table privilege
-- covers every column. Revoking at table level and re-granting the existing
-- columns would be brittle and could break the working browser journey.
--
-- So the snapshot lives in its own table that anon and authenticated cannot
-- reach at all — deny by default, with no policy written for them.
--
-- WRITE-ONCE IS THE PRIMARY KEY
--
-- check_id is the primary key, so a second insert for the same check conflicts.
-- The application does INSERT ... ON CONFLICT DO NOTHING, re-reads, validates,
-- and reuses. Concurrency therefore resolves to "the first valid snapshot
-- wins", with no update path to race on. UPDATE and DELETE are revoked even
-- from service_role, so an accepted snapshot cannot be replaced by a newer
-- cohort — the buyer keeps the evidence they were shown.
--
-- PRIVACY
--
-- Market aggregates and public advert references only: accepted comparable
-- prices, canonical advert URLs, cohort mode, variant token, the derived offer
-- band, and the provenance timestamps. No plate, email, IC, VIN, claim token,
-- session id, seller name, phone number, contact detail, location, listing
-- description or tracking parameter. The allowlist is enforced in
-- lib/offer-snapshot and pinned by tests.
--
-- ROLLBACK
--
--     drop table if exists public.check_offer_snapshots;
--
-- Reverting the application code alone is safe: nothing reads or writes the
-- table, and the renderer's null path is the pre-snapshot behaviour. Dropping
-- the table alone is also safe, for the same reason. Neither order breaks a
-- report, and no existing row in any other table is touched.
-- ============================================================================

create table if not exists public.check_offer_snapshots (
  check_id   text primary key references public.checks(id) on delete cascade,
  snapshot   jsonb       not null,
  created_at timestamptz not null default now()
);

comment on table public.check_offer_snapshots is
  'Market evidence frozen at checkout, so a paid report cannot lose the offer it was sold on. Write-once: check_id is the primary key and UPDATE/DELETE are revoked. Paid evidence — never exposed to anon or authenticated, and never returned by a free API.';

-- RLS on, and DELIBERATELY NO POLICY for anon or authenticated. With RLS
-- enabled and no policy, those roles match nothing: deny by default rather
-- than by omission.
alter table public.check_offer_snapshots enable row level security;

-- Belt as well as braces: RLS governs row visibility, GRANTs govern whether the
-- role may reach the table at all. Revoke first, so nothing is inherited from a
-- prior `grant all on all tables` and nothing depends on default privileges.
revoke all on public.check_offer_snapshots from public;
revoke all on public.check_offer_snapshots from anon;
revoke all on public.check_offer_snapshots from authenticated;

-- The server writes it once and reads it back. Nothing else.
grant select, insert on public.check_offer_snapshots to service_role;

-- No mutation path, even for the server. This is what makes "never overwritten"
-- a property of the database rather than a property of the code.
revoke update, delete on public.check_offer_snapshots from service_role;
