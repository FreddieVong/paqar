create table seller_trust_cards (
  id               uuid primary key default gen_random_uuid(),
  check_id         text not null references checks(id),
  seller_email     text not null,
  public_token     text not null unique,
  status           text not null default 'pending'
                   constraint seller_trust_cards_status_values
                   check (status in ('pending', 'paid', 'expired')),
  billplz_bill_id  text unique,
  amount_cents     integer not null default 2900,
  paid_at          timestamptz,
  expires_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index seller_trust_cards_public_token_idx on seller_trust_cards(public_token);
create index seller_trust_cards_billplz_id_idx   on seller_trust_cards(billplz_bill_id)
  where billplz_bill_id is not null;
alter table seller_trust_cards enable row level security;
-- All access via service_role only
