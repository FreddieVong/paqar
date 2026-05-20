create table report_feedback (
  id         uuid primary key default gen_random_uuid(),
  check_id   text not null,
  plate      text not null,
  helpful    boolean not null,
  quote      text,
  name       text,
  created_at timestamptz not null default now()
);
