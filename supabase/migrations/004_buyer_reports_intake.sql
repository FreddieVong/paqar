-- Add optional buyer intake fields to buyer_reports
alter table buyer_reports
  add column asking_price_rm  integer,
  add column claimed_mileage_km integer,
  add column listing_url      text;
