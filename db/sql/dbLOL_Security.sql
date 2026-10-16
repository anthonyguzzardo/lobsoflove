-- ============================================================================
-- LobsOfLove security: GRANTs, RLS, helper functions
-- ============================================================================
-- Every new table gets RLS enabled here, or clients see zero rows.
-- Every new table also needs explicit service_role grants (table + sequence).
-- ============================================================================

GRANT USAGE ON SCHEMA lol TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA lol TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA lol TO authenticated;
-- New tables come back granted (Dealifier migration 226: missing default
-- privileges caused "42501 permission denied" outages).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA lol GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA lol GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

-- ----------------------------------------------------------------------------
-- th_ink_reads: server-only. RLS on, no policies: default deny is the whole
-- access story. Only service_role (the read-ink edge function) touches it.
-- ----------------------------------------------------------------------------
ALTER TABLE lol.th_ink_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lol.th_ink_reads FROM authenticated, anon;
GRANT SELECT, INSERT ON lol.th_ink_reads TO service_role;
GRANT USAGE, SELECT ON SEQUENCE lol.th_ink_reads_ink_read_id_seq TO service_role;
