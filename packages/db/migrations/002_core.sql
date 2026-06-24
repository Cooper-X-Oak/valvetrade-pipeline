-- Core entity subset for the walking skeleton.
-- Canonical enums.
CREATE TYPE entity_type AS ENUM ('manufacturer','distributor','importer','epc','end_user','public');
-- Company pipeline stages raw..verified describe a Company, NOT a Lead.
CREATE TYPE pipeline_state AS ENUM ('raw','deduped','classified','enriched','verified','qualified','rejected','suppressed');
-- A Lead row exists only from 'qualified' onward.
CREATE TYPE lead_state AS ENUM ('qualified','in_outreach','engaged','delivered','dead');
CREATE TYPE verification_status AS ENUM ('unverified','single_source','verified');
CREATE TYPE freshness_flag AS ENUM ('fresh','aging','stale','dead');

-- Tenant/client: pseudonymous; stores a handle, never a real name.
CREATE TABLE customer (
  customer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE engagement (
  engagement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid NOT NULL REFERENCES customer(customer_id),
  label         text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE source (
  source_id                smallint PRIMARY KEY,
  name                     text UNIQUE NOT NULL,   -- canonical snake_case key
  access_mode              text NOT NULL,
  requires_engagement_auth boolean NOT NULL DEFAULT false,
  is_authoritative         boolean NOT NULL DEFAULT false
);

-- Company: a node in the shared buyer/seller identity graph.
-- is_buyer_side is DERIVED from entity_type so "buyer != seller" is enforced by the schema,
-- not by application code.
CREATE TABLE company (
  company_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ko           text NOT NULL,
  name_norm         text NOT NULL,          -- normalized for pg_trgm dedup blocking
  biz_reg_no        text,                   -- 사업자등록번호 when public (dedup rank-1)
  entity_type       entity_type,            -- NULL until classified
  is_buyer_side     boolean GENERATED ALWAYS AS
                      (entity_type IS NOT NULL AND entity_type <> 'manufacturer') STORED,
  pipeline_state    pipeline_state NOT NULL DEFAULT 'raw',
  classification_evidence text,
  phone             text,
  phone_verification verification_status NOT NULL DEFAULT 'unverified',
  website           text,
  freshness         freshness_flag NOT NULL DEFAULT 'fresh',
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_name_norm_trgm ON company USING gin (name_norm gin_trgm_ops);
CREATE UNIQUE INDEX company_biz_reg_no_uniq ON company (biz_reg_no) WHERE biz_reg_no IS NOT NULL;

-- Raw observation from one source, with mandatory provenance.
CREATE TABLE source_record (
  source_record_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id         smallint NOT NULL REFERENCES source(source_id),
  natural_key       text NOT NULL,
  company_id        uuid REFERENCES company(company_id),
  raw_payload       jsonb NOT NULL,
  source_updated_at timestamptz,
  fetched_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, natural_key)
);

-- Lead: an engagement-scoped overlay on a shared Company. Materializes ONLY at qualified.
CREATE TABLE lead (
  lead_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES engagement(engagement_id),
  company_id    uuid NOT NULL REFERENCES company(company_id),
  state         lead_state NOT NULL DEFAULT 'qualified',
  tier          char(1) NOT NULL DEFAULT 'C' CHECK (tier IN ('A','B','C')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, company_id)
);

-- Report: immutable cycle-bound snapshot (write-once) separated from mutable telemetry.
CREATE TABLE report (
  report_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id    uuid NOT NULL REFERENCES engagement(engagement_id),
  cycle_id         text,
  snapshot         jsonb,           -- NULL until frozen; write-once thereafter (trg_report_immutable)
  snapshot_hash    text,
  frozen_at        timestamptz,
  -- mutable telemetry columns, deliberately separate from the frozen snapshot payload:
  token_hash       text UNIQUE,
  conversion_status text NOT NULL DEFAULT 'draft',
  view_count       integer NOT NULL DEFAULT 0,
  first_viewed_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
