-- Vehicle valuation database from VehicleAPI.com.my
-- Keyed by NVIC (returned from lookupVehicle API call)
-- Import the full CSV from VehicleAPI after applying this migration
create table vehicle_valuations (
  nvic          text primary key,
  year          integer,
  make          text,
  family        text,
  variant       text,
  style         text,
  cc            integer,
  wm_new_price  integer,   -- original new price West Malaysia (RM)
  sum_insured   integer,   -- estimated current insured value (RM)
  created_at    timestamptz not null default now()
);

create index vehicle_valuations_make_year_idx on vehicle_valuations(make, year);
