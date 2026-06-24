-- Multi-tenant isolation: the app connects as a NON-OWNER role and every
-- engagement-scoped table is filtered by RLS on a transaction-scoped GUC. FORCE makes the
-- policy apply even to the table owner; fail-closed when app.engagement_id is unset.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vt_app') THEN
    CREATE ROLE vt_app LOGIN PASSWORD 'vt_app';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO vt_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vt_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vt_app;

ALTER TABLE lead ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead FORCE ROW LEVEL SECURITY;

-- NULLIF(...,'') is load-bearing: a custom GUC that was set-then-reset in a pooled connection
-- reads back as '' (not NULL), and ''::uuid would raise instead of failing closed. Coercing ''
-- to NULL makes `engagement_id = NULL` -> no rows, the intended fail-closed behavior.
CREATE POLICY lead_engagement_isolation ON lead
  USING       (engagement_id = NULLIF(current_setting('app.engagement_id', true), '')::uuid)
  WITH CHECK  (engagement_id = NULLIF(current_setting('app.engagement_id', true), '')::uuid);
