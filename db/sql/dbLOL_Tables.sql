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
