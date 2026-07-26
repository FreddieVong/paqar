-- Real-database smoke test for migration 020.
--
-- Run this in the Supabase SQL Editor IMMEDIATELY AFTER applying
-- 020_meta_ads_operator.sql. Until it passes, migration 020 is UNVERIFIED —
-- the unit tests mock Supabase and prove logic, not schema.
--
-- Every check RAISEs on failure, so the script either completes silently
-- (except the notices) or stops at the first problem. It cleans up after
-- itself and writes nothing permanent.

DO $$
DECLARE
  missing        TEXT;
  bucket_a       TIMESTAMPTZ := '2026-08-01 00:00:00+08';
  bucket_b       TIMESTAMPTZ := '2026-08-01 06:00:00+08';
  bucket_c       TIMESTAMPTZ := '2026-08-01 12:00:00+08';
  bucket_d       TIMESTAMPTZ := '2026-08-01 18:00:00+08';
  inserted_count INT;
  test_exp_id    UUID;
BEGIN
  -- 1. All six tables exist -------------------------------------------------
  SELECT string_agg(t, ', ') INTO missing
  FROM unnest(ARRAY[
    'ad_sessions', 'ad_events', 'checkout_attributions',
    'meta_ads_experiment', 'meta_ads_snapshots', 'meta_ads_actions'
  ]) AS t
  WHERE to_regclass('public.' || t) IS NULL;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: missing tables: %', missing;
  END IF;
  RAISE NOTICE 'PASS: all six tables exist';

  -- 2. Both buyer_reports columns exist -------------------------------------
  SELECT string_agg(c, ', ') INTO missing
  FROM unnest(ARRAY['upgrade_paid_at', 'upgrade_amount_cents']) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'buyer_reports' AND column_name = c
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: buyer_reports missing columns: %', missing;
  END IF;
  RAISE NOTICE 'PASS: buyer_reports upgrade columns exist';

  -- 3. Required unique constraints ------------------------------------------
  -- attname is type `name`, so it must be cast to text before comparing
  -- against a text[] literal.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'ad_events' AND c.contype = 'u'
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname::text)
           FROM pg_attribute a
           WHERE a.attrelid = t.oid AND a.attnum = ANY(c.conkey))
          = ARRAY['event_id', 'event_name']::text[]
  ) THEN
    RAISE EXCEPTION 'FAIL: ad_events UNIQUE(event_name, event_id) missing — dedupe would not work';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'meta_ads_snapshots' AND c.contype = 'u'
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname::text)
           FROM pg_attribute a
           WHERE a.attrelid = t.oid AND a.attnum = ANY(c.conkey))
          = ARRAY['captured_at_bucket', 'level', 'meta_object_id']::text[]
  ) THEN
    RAISE EXCEPTION 'FAIL: meta_ads_snapshots UNIQUE(captured_at_bucket, meta_object_id, level) missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'checkout_attributions' AND c.contype = 'u'
  ) THEN
    RAISE EXCEPTION 'FAIL: checkout_attributions UNIQUE(billplz_bill_id) missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'meta_ads_actions' AND c.contype = 'u'
  ) THEN
    RAISE EXCEPTION 'FAIL: meta_ads_actions UNIQUE(idempotency_key) missing';
  END IF;
  RAISE NOTICE 'PASS: all unique constraints present';

  -- 4. Foreign keys resolve --------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'meta_ads_snapshots' AND c.contype = 'f'
  ) THEN
    RAISE EXCEPTION 'FAIL: meta_ads_snapshots.experiment_id FK missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'meta_ads_actions' AND c.contype = 'f'
  ) THEN
    RAISE EXCEPTION 'FAIL: meta_ads_actions.experiment_id FK missing';
  END IF;
  PERFORM 1 FROM pg_constraint WHERE NOT convalidated AND conrelid IN (
    'meta_ads_snapshots'::regclass, 'meta_ads_actions'::regclass
  );
  IF FOUND THEN
    RAISE EXCEPTION 'FAIL: unvalidated foreign key present';
  END IF;
  RAISE NOTICE 'PASS: foreign keys present and validated';

  -- 5. RLS enabled on all six ------------------------------------------------
  SELECT string_agg(relname, ', ') INTO missing
  FROM pg_class
  WHERE relnamespace = 'public'::regnamespace
    AND relname IN (
      'ad_sessions', 'ad_events', 'checkout_attributions',
      'meta_ads_experiment', 'meta_ads_snapshots', 'meta_ads_actions'
    ) AND NOT relrowsecurity;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: RLS not enabled on: %', missing;
  END IF;
  RAISE NOTICE 'PASS: RLS enabled on all six tables';

  -- 6. A duplicate ad event is ignored ---------------------------------------
  INSERT INTO ad_sessions (session_id, utm_source, utm_content)
  VALUES ('verify_sid_020', 'meta', 'creative_a')
  ON CONFLICT (session_id) DO NOTHING;

  INSERT INTO ad_events (session_id, event_name, event_id, utm_source, utm_content)
  VALUES ('verify_sid_020', 'valuation_started', 'verify_evt_020', 'meta', 'creative_a')
  ON CONFLICT (event_name, event_id) DO NOTHING;

  WITH dup AS (
    INSERT INTO ad_events (session_id, event_name, event_id, utm_source, utm_content)
    VALUES ('verify_sid_020', 'valuation_started', 'verify_evt_020', 'meta', 'creative_a')
    ON CONFLICT (event_name, event_id) DO NOTHING
    RETURNING id
  ) SELECT count(*) INTO inserted_count FROM dup;

  IF inserted_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: duplicate ad_event was inserted — dedupe is broken';
  END IF;
  RAISE NOTICE 'PASS: duplicate ad_event ignored';

  -- 7. First-touch cannot be overwritten -------------------------------------
  INSERT INTO ad_sessions (session_id, utm_source, utm_content)
  VALUES ('verify_sid_020', 'meta', 'creative_b')
  ON CONFLICT (session_id) DO NOTHING;

  IF (SELECT utm_content FROM ad_sessions WHERE session_id = 'verify_sid_020') <> 'creative_a' THEN
    RAISE EXCEPTION 'FAIL: first-touch attribution was overwritten';
  END IF;
  RAISE NOTICE 'PASS: first-touch attribution preserved';

  -- 8. Four six-hour buckets coexist -----------------------------------------
  INSERT INTO meta_ads_experiment (status) VALUES ('verify') RETURNING id INTO test_exp_id;

  INSERT INTO meta_ads_snapshots
    (experiment_id, captured_at_bucket, report_date, level, meta_object_id, spend_cents)
  VALUES
    (test_exp_id, bucket_a, '2026-08-01', 'campaign', 'verify_obj_020', 100),
    (test_exp_id, bucket_b, '2026-08-01', 'campaign', 'verify_obj_020', 200),
    (test_exp_id, bucket_c, '2026-08-01', 'campaign', 'verify_obj_020', 300),
    (test_exp_id, bucket_d, '2026-08-01', 'campaign', 'verify_obj_020', 400);

  SELECT count(*) INTO inserted_count FROM meta_ads_snapshots
  WHERE meta_object_id = 'verify_obj_020';
  IF inserted_count <> 4 THEN
    RAISE EXCEPTION 'FAIL: expected 4 daily snapshots, got % — bucketing is wrong', inserted_count;
  END IF;
  RAISE NOTICE 'PASS: four six-hour buckets coexist';

  -- 9. Duplicate within one bucket is rejected -------------------------------
  BEGIN
    INSERT INTO meta_ads_snapshots
      (experiment_id, captured_at_bucket, report_date, level, meta_object_id, spend_cents)
    VALUES (test_exp_id, bucket_a, '2026-08-01', 'campaign', 'verify_obj_020', 999);
    RAISE EXCEPTION 'FAIL: duplicate snapshot in the same bucket was accepted';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'PASS: duplicate snapshot within a bucket rejected';
  END;

  -- Cleanup -------------------------------------------------------------------
  DELETE FROM meta_ads_snapshots WHERE meta_object_id = 'verify_obj_020';
  DELETE FROM meta_ads_experiment WHERE id = test_exp_id;
  DELETE FROM ad_events   WHERE session_id = 'verify_sid_020';
  DELETE FROM ad_sessions WHERE session_id = 'verify_sid_020';

  RAISE NOTICE '--- ALL CHECKS PASSED. Migration 020 is verified. ---';
END $$;
