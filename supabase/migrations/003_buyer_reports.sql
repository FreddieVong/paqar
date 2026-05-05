create table buyer_reports (
  id               uuid primary key default gen_random_uuid(),
  check_id         text not null references checks(id),
  buyer_email      text not null,
  status           text not null default 'pending'
                   constraint buyer_reports_status_values
                   check (status in ('pending', 'paid', 'expired')),
  billplz_bill_id  text unique,
  amount_cents     integer not null default 1900,
  paid_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index buyer_reports_check_id_idx   on buyer_reports(check_id);
create index buyer_reports_billplz_id_idx on buyer_reports(billplz_bill_id)
  where billplz_bill_id is not null;
alter table buyer_reports enable row level security;
-- All access via service_role API routes only — no client-side RLS needed
