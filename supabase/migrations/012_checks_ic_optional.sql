-- IC number is no longer collected at check creation.
-- Make columns nullable so existing rows are preserved and new inserts don't fail.
alter table checks alter column ic_encrypted drop not null;
alter table checks alter column ic_hash      drop not null;
