-- ============================================================================
-- migration 002: crews, players, matches, beacons (the shared season)
-- ============================================================================
-- Moves the season off the phone. A crew is a friend group with an invite code.
-- A player is a fighter: either a real account (user_id set) or a pretender
-- (user_id null), a friend someone added by name who has not installed yet.
-- A match is reported by one player and counts only once the other confirms.
-- A beacon is "I am at this court now", one row per player.
--
-- WHY: the two-week friend test needs one season shared across phones, and the
-- king-of-the-court belt needs confirmed results.
--
-- ENFORCEMENT: clients read through RLS (crew members see their crew only) and
-- write only through SECURITY DEFINER functions in rpc/rpc_crew.sql, which check
-- who is calling. authenticated has SELECT only on these tables.
--
-- ALSO REQUIRED (Dashboard -> Authentication -> Sign In / Providers):
--   turn on "Allow anonymous sign-ins". Every phone signs in anonymously.
--
-- IDEMPOTENT: safe to re-paste the whole file into the Supabase SQL Editor.
-- AFTER RUNNING: from db/, run  ./sync-types.sh
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------- tables ----

CREATE TABLE IF NOT EXISTS lol.tb_crews
(
     crew_id                      UUID                   PRIMARY KEY DEFAULT gen_random_uuid()
    ,crew_name                    VARCHAR(40)            NOT NULL
    ,invite_code                  VARCHAR(8)             NOT NULL UNIQUE
    ,founded_by_player_id         UUID                   NOT NULL
    ,dttm_created_utc             TIMESTAMPTZ            NOT NULL DEFAULT NOW()
    ,created_by                   VARCHAR(50)            NOT NULL DEFAULT CURRENT_USER
    ,dttm_modified_utc            TIMESTAMPTZ            NOT NULL DEFAULT NOW()
    ,modified_by                  VARCHAR(50)            NOT NULL DEFAULT CURRENT_USER
);

CREATE TABLE IF NOT EXISTS lol.tb_players
(
     player_id                    UUID                   PRIMARY KEY DEFAULT gen_random_uuid()
    ,user_id                      UUID                   NULL UNIQUE
    ,display_name                 VARCHAR(24)            NOT NULL
    ,cast_code                    VARCHAR(20)            NOT NULL DEFAULT 'wall'
    ,color_hex                    VARCHAR(9)             NOT NULL DEFAULT '#d7f205'
    ,bio                          VARCHAR(200)           NOT NULL DEFAULT ''
    ,favorite_pro                 VARCHAR(60)            NOT NULL DEFAULT ''
    ,home_court                   VARCHAR(80)            NOT NULL DEFAULT ''
    ,racket                       VARCHAR(80)            NOT NULL DEFAULT ''
    ,claim_token                  VARCHAR(16)            NULL UNIQUE
    ,added_by_player_id           UUID                   NULL
    ,dttm_created_utc             TIMESTAMPTZ            NOT NULL DEFAULT NOW()
    ,created_by                   VARCHAR(50)            NOT NULL DEFAULT CURRENT_USER
    ,dttm_modified_utc            TIMESTAMPTZ            NOT NULL DEFAULT NOW()
    ,modified_by                  VARCHAR(50)            NOT NULL DEFAULT CURRENT_USER
);

CREATE TABLE IF NOT EXISTS lol.tm_crew_players
(
     crew_player_id               BIGSERIAL              PRIMARY KEY
    ,crew_id                      UUID                   NOT NULL
    ,player_id                    UUID                   NOT NULL
    ,role_code                    VARCHAR(12)            NOT NULL DEFAULT 'player'
    ,dttm_joined_utc              TIMESTAMPTZ            NOT NULL DEFAULT NOW()
    ,created_by                   VARCHAR(50)            NOT NULL DEFAULT CURRENT_USER
    ,UNIQUE (crew_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_crew_players_player_id ON lol.tm_crew_players (player_id);

CREATE TABLE IF NOT EXISTS lol.tb_matches
(
     match_id                     UUID                   PRIMARY KEY
    ,crew_id                      UUID                   NOT NULL
    ,venue_code                   VARCHAR(40)            NULL
    ,venue_name                   VARCHAR(80)            NOT NULL DEFAULT ''
    ,p1_player_id                 UUID                   NOT NULL
    ,p2_player_id                 UUID                   NOT NULL
    ,sets                         JSONB                  NOT NULL
    ,minutes                      INT                    NULL
    ,has_photo                    BOOLEAN                NOT NULL DEFAULT false
    ,dttm_played_utc              TIMESTAMPTZ            NOT NULL
    ,reported_by_player_id        UUID                   NOT NULL
    ,status_code                  VARCHAR(12)            NOT NULL DEFAULT 'pending'
    ,answered_by_player_id        UUID                   NULL
    ,dttm_answered_utc            TIMESTAMPTZ            NULL
    ,dttm_created_utc             TIMESTAMPTZ            NOT NULL DEFAULT NOW()
    ,created_by                   VARCHAR(50)            NOT NULL DEFAULT CURRENT_USER
    ,dttm_modified_utc            TIMESTAMPTZ            NOT NULL DEFAULT NOW()
    ,modified_by                  VARCHAR(50)            NOT NULL DEFAULT CURRENT_USER
    ,CHECK (status_code IN ('pending', 'confirmed', 'disputed'))
    ,CHECK (p1_player_id <> p2_player_id)
);
CREATE INDEX IF NOT EXISTS idx_matches_crew_id_dttm_played_utc ON lol.tb_matches (crew_id, dttm_played_utc);

CREATE TABLE IF NOT EXISTS lol.tb_beacons
(
     player_id                    UUID                   PRIMARY KEY
    ,crew_id                      UUID                   NOT NULL
    ,venue_code                   VARCHAR(40)            NOT NULL
    ,dttm_at_utc                  TIMESTAMPTZ            NOT NULL DEFAULT NOW()
    ,dttm_modified_utc            TIMESTAMPTZ            NOT NULL DEFAULT NOW()
    ,modified_by                  VARCHAR(50)            NOT NULL DEFAULT CURRENT_USER
);
CREATE INDEX IF NOT EXISTS idx_beacons_crew_id ON lol.tb_beacons (crew_id);

-- --------------------------------------------------------------- helpers ----

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

-- -------------------------------------------------------------- realtime ----
-- The app refetches when any of these change. Realtime applies the RLS above.
DO $$
DECLARE t TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        FOREACH t IN ARRAY ARRAY['tb_matches', 'tb_players', 'tm_crew_players', 'tb_beacons'] LOOP
            IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'lol' AND tablename = t) THEN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE lol.%I', t);
            END IF;
        END LOOP;
    END IF;
END $$;

COMMIT;

-- The write functions live in rpc/rpc_crew.sql. Paste that file next.

-- ----------------------------------------------------------------------------
-- Verification (expected results in comments)
-- ----------------------------------------------------------------------------
SELECT count(*) FROM pg_class WHERE relnamespace = 'lol'::regnamespace AND relrowsecurity
    AND relname IN ('tb_crews','tb_players','tm_crew_players','tb_matches','tb_beacons');  -- 5
SELECT has_table_privilege('authenticated', 'lol.tb_matches', 'INSERT');                  -- false
SELECT has_table_privilege('authenticated', 'lol.tb_matches', 'SELECT');                  -- true
