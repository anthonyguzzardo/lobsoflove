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

-- ----------------------------------------------------------------------------
-- Shared season tables (migration 002): SELECT through RLS for crew members,
-- every write through the SECURITY DEFINER functions in rpc/rpc_crew.sql.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lol.fn_my_player_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = lol, pg_temp AS $$
    SELECT player_id FROM lol.tb_players WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION lol.fn_my_crew_ids() RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = lol, pg_temp AS $$
    SELECT cp.crew_id FROM lol.tm_crew_players cp
    JOIN lol.tb_players p ON p.player_id = cp.player_id
    WHERE p.user_id = auth.uid()
$$;

-- -------------------------------------------------------------- security ----

ALTER TABLE lol.tb_crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE lol.tb_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE lol.tm_crew_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE lol.tb_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE lol.tb_beacons ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON lol.tb_crews, lol.tb_players, lol.tm_crew_players, lol.tb_matches, lol.tb_beacons FROM anon, authenticated;
GRANT SELECT ON lol.tb_crews, lol.tb_players, lol.tm_crew_players, lol.tb_matches, lol.tb_beacons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON lol.tb_crews, lol.tb_players, lol.tm_crew_players, lol.tb_matches, lol.tb_beacons TO service_role;
GRANT USAGE, SELECT ON SEQUENCE lol.tm_crew_players_crew_player_id_seq TO service_role;

DROP POLICY IF EXISTS crews_select_member ON lol.tb_crews;
CREATE POLICY crews_select_member ON lol.tb_crews FOR SELECT TO authenticated
    USING (crew_id IN (SELECT lol.fn_my_crew_ids()));

DROP POLICY IF EXISTS players_select_self_or_crew ON lol.tb_players;
CREATE POLICY players_select_self_or_crew ON lol.tb_players FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR player_id IN (
        SELECT cp.player_id FROM lol.tm_crew_players cp WHERE cp.crew_id IN (SELECT lol.fn_my_crew_ids())));

DROP POLICY IF EXISTS crew_players_select_member ON lol.tm_crew_players;
CREATE POLICY crew_players_select_member ON lol.tm_crew_players FOR SELECT TO authenticated
    USING (crew_id IN (SELECT lol.fn_my_crew_ids()));

DROP POLICY IF EXISTS matches_select_member ON lol.tb_matches;
CREATE POLICY matches_select_member ON lol.tb_matches FOR SELECT TO authenticated
    USING (crew_id IN (SELECT lol.fn_my_crew_ids()));

DROP POLICY IF EXISTS beacons_select_member ON lol.tb_beacons;
CREATE POLICY beacons_select_member ON lol.tb_beacons FOR SELECT TO authenticated
    USING (crew_id IN (SELECT lol.fn_my_crew_ids()));

REVOKE ALL ON FUNCTION lol.fn_my_player_id(), lol.fn_my_crew_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION lol.fn_my_player_id(), lol.fn_my_crew_ids() TO authenticated;

-- Call-ups (migration 003): SELECT for crew members, writes through functions.
ALTER TABLE lol.tb_callups ENABLE ROW LEVEL SECURITY;
ALTER TABLE lol.tm_callup_players ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lol.tb_callups, lol.tm_callup_players FROM anon, authenticated;
GRANT SELECT ON lol.tb_callups, lol.tm_callup_players TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON lol.tb_callups, lol.tm_callup_players TO service_role;
GRANT USAGE, SELECT ON SEQUENCE lol.tm_callup_players_callup_player_id_seq TO service_role;

DROP POLICY IF EXISTS callups_select_member ON lol.tb_callups;
CREATE POLICY callups_select_member ON lol.tb_callups FOR SELECT TO authenticated
    USING (crew_id IN (SELECT lol.fn_my_crew_ids()));
DROP POLICY IF EXISTS callup_players_select_member ON lol.tm_callup_players;
CREATE POLICY callup_players_select_member ON lol.tm_callup_players FOR SELECT TO authenticated
    USING (callup_id IN (SELECT callup_id FROM lol.tb_callups WHERE crew_id IN (SELECT lol.fn_my_crew_ids())));

-- Push tokens (migration 004): server-only, no policies.
ALTER TABLE lol.tb_push_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lol.tb_push_tokens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON lol.tb_push_tokens TO service_role;
GRANT USAGE, SELECT ON SEQUENCE lol.tb_push_tokens_push_token_id_seq TO service_role;
