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
create index vehicles_user_id_idx    on vehicles(user_id)    where deleted_at is null;
create index vehicles_plate_hash_idx on vehicles(plate_hash) where deleted_at is null;
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
                   check (status in ('pending','running','complete','expired')),
  claim_token      text unique,
  idempotency_key  text unique,
  expires_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  completed_at     timestamptz,
  deleted_at       timestamptz
);
create index checks_user_id_idx      on checks(user_id, created_at desc)             where deleted_at is null;
create index checks_vehicle_id_idx   on checks(vehicle_id, created_at desc)          where deleted_at is null;
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
