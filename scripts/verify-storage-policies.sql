-- Storage-policy inspection. Run in the SQL Editor of the Paqar project.
--
-- Reasoning from a policy NAME is how the previous audit reached a wrong
-- conclusion. These queries read the actual semantics: command, roles,
-- permissive vs restrictive, and both expressions.

-- 1. Every policy on storage.objects, with what it actually does.
--    `permissive` is the column that decides meaning: a PERMISSIVE policy
--    returning false GRANTS NOTHING AND DENIES NOTHING; a RESTRICTIVE one
--    returning false is a hard refusal.
SELECT
  policyname,
  cmd,
  permissive,                      -- PERMISSIVE | RESTRICTIVE
  roles,                           -- {anon,authenticated} vs {public}
  qual        AS using_expression,
  with_check  AS with_check_expression,
  (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%listing-screenshots%'
              AS is_bucket_scoped
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- 2. The bucket must be private, and must accept only real image types.
SELECT name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE name = 'listing-screenshots';

-- 3. RLS must be enabled on the objects table at all. A policy on a table with
--    RLS disabled is decorative.
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE oid = 'storage.objects'::regclass;

-- EXPECTED after migration 033:
--   Query 1 -> exactly one row for this bucket:
--             listing_screenshots_deny_client_roles
--             cmd=ALL  permissive=RESTRICTIVE  roles={anon,authenticated}
--             is_bucket_scoped=true
--             and NO rows named "listing-screenshots: no anon read/write"
--   Query 2 -> one row, public=false
--   Query 3 -> relrowsecurity=true
