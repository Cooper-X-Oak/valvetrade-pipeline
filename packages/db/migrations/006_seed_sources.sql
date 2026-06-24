-- Example source registry. These placeholder rows demonstrate the access-mode and
-- engagement-auth columns; replace them with your own data sources.
INSERT INTO source (source_id, name, access_mode, requires_engagement_auth, is_authoritative) VALUES
  (1, 'example_source_a', 'public',       false, false),
  (2, 'example_source_b', 'public',       false, false),
  (3, 'example_source_c', 'official_api', false, true),
  (4, 'example_source_d', 'metered_api',  true,  false),
  (5, 'example_source_e', 'paid',         true,  false)
ON CONFLICT (source_id) DO NOTHING;
