-- Concurrency-control objects for the collection layer.
-- pg-boss has no native token bucket or per-IP lease, so these are built explicitly.
-- Tables only here; the skeleton wires the pattern and live workers fill it in.

-- Exactly N lease rows per source = hard concurrency cap, via FOR UPDATE SKIP LOCKED.
CREATE TABLE lane_lease (
  source_name text     NOT NULL,
  lease_no    smallint NOT NULL,
  leased_by   text,
  leased_at   timestamptz,
  PRIMARY KEY (source_name, lease_no)
);

-- Per-API daily quota, decremented in the fetch transaction.
CREATE TABLE quota_counter (
  source_name text    NOT NULL,
  window_date date    NOT NULL,
  used        integer NOT NULL DEFAULT 0,
  cap         integer NOT NULL,
  PRIMARY KEY (source_name, window_date)
);

-- Per-source circuit breaker; open => scheduler emits no fetch jobs, downstream serves stale.
CREATE TABLE breaker_state (
  source_name text PRIMARY KEY,
  state       text NOT NULL DEFAULT 'closed' CHECK (state IN ('closed','open','half_open')),
  opened_at   timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON lane_lease, quota_counter, breaker_state TO vt_app;
