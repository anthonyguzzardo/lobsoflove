-- ============================================================================
-- LobsOfLove database schema (canonical CREATE TABLE source of truth)
-- ============================================================================
-- Follows the Dealifier standard (../Dealifier/db). Every change goes in BOTH a
-- migration (sql/migrations/NNN_*.sql) AND this file. No ALTERs here: rewrite
-- the CREATE TABLE. Run order on a fresh project: Tables, Seed, Security, rpc/*, Views.
--
-- Standards:
-- - schema lol (not public)
-- - te_ = enumeration tables, td_ = dictionary tables, tb_ = normal tables,
--   tm_ = matrix tables, th_ = history tables (append-only)
-- - Surrogate keys: table_name_id (NEVER just "id")
-- - Logical foreign keys (no physical constraints)
-- - Timestamps: dttm_<event>_utc TIMESTAMPTZ
-- - Bracketed logging: [TRCE] [DEBG] [@INFO] [WARN] [ERRO] [FATL] [AUDT]
-- - No vendor or proper nouns in column names
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS lol;

-- ----------------------------------------------------------------------------
-- th_ink_reads
-- ----------------------------------------------------------------------------
-- PURPOSE: One row per line of handwriting sent to the AI reader (read-ink
--   edge function), with the action it returned.
-- USE CASE: "How many AI reads ran today, from which device, and what did each
--   one decide?" Also the daily spend cap: read-ink counts today's rows before
--   calling the model and refuses past the cap.
-- MUTABILITY: Immutable - append-only
--   WHAT CHANGES: Nothing (historical record)
-- VALUES: action is the model's chosen action, or 'error' / 'capped'
-- REFERENCES: none (devices are anonymous until accounts exist)
-- REFERENCED BY: None (leaf table)
-- FOOTER: Created only (immutable)
-- [@INFO] Server-only: RLS on with no policies; only service_role reads/writes.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lol.th_ink_reads
(
     ink_read_id                  BIGSERIAL              PRIMARY KEY

    -- CALLER
    ,device_id                    VARCHAR(64)            NOT NULL   -- random per install, from the app

    -- READ
    ,input_text                   VARCHAR(500)           NOT NULL
    ,action                       VARCHAR(40)            NOT NULL
    ,result                       JSONB                  NULL       -- the full action object
    ,model                        VARCHAR(60)            NULL
    ,input_tokens                 INT                    NULL
    ,output_tokens                INT                    NULL
    ,is_error                     BOOLEAN                NOT NULL DEFAULT false

    -- FOOTERS
    ,dttm_created_utc             TIMESTAMPTZ            NOT NULL DEFAULT NOW()
    ,created_by                   VARCHAR(50)            NOT NULL DEFAULT CURRENT_USER
);

CREATE INDEX IF NOT EXISTS idx_ink_reads_dttm_created_utc ON lol.th_ink_reads (dttm_created_utc);
CREATE INDEX IF NOT EXISTS idx_ink_reads_device_id_dttm_created_utc ON lol.th_ink_reads (device_id, dttm_created_utc);

-- ----------------------------------------------------------------------------
-- Shared season (migration 002). A crew is a friend group with an invite code.
-- tb_players: user_id NULL means a pretender, a friend added by name who has not
--   installed yet; claim_token is in their invite link, and claiming moves their
--   matches to the real account. tb_matches: reported by p1, counts only when p2
--   confirms (status_code pending|confirmed|disputed). venue_code is the baked
--   venue id from src/data/venues.json. tb_beacons: one row per player, "I am at
--   this court now"; the app treats rows older than 3 h as over.
-- [@INFO] Clients SELECT through RLS and write only through rpc/rpc_crew.sql.
-- ----------------------------------------------------------------------------
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
