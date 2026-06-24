-- pg_trgm powers the fuzzy-dedup blocking index on company.name_norm.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
