-- ============================================================================
-- migration 001: lol schema + th_ink_reads (AI handwriting reader log and cap)
-- ============================================================================
-- First migration for the LobsOfLove project. Creates the lol schema (the app's
-- own schema, per the Dealifier standard; not public) and th_ink_reads, the
-- append-only log the read-ink edge function writes for every AI read.
--
-- WHY: read-ink calls a paid model. Until accounts exist anyone with the app
-- could call it, so the function counts today's rows here before every call and
-- refuses past a daily cap (global and per device).
--
-- ENFORCEMENT: server-only table. RLS enabled with no policies; anon and
-- authenticated have no grants; only service_role reads/inserts.
--
-- ALSO REQUIRED (Dashboard -> Project Settings -> API -> Data API):
--   add "lol" to Exposed schemas, so the edge function can reach it.
--
-- IDEMPOTENT: safe to re-paste the whole file into the Supabase SQL Editor.
-- AFTER RUNNING: from db/, run  ./sync-types.sh
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS lol;

CREATE TABLE IF NOT EXISTS lol.th_ink_reads
(
     ink_read_id                  BIGSERIAL              PRIMARY KEY
    ,device_id                    VARCHAR(64)            NOT NULL
    ,input_text                   VARCHAR(500)           NOT NULL
    ,action                       VARCHAR(40)            NOT NULL
    ,result                       JSONB                  NULL
    ,model                        VARCHAR(60)            NULL
    ,input_tokens                 INT                    NULL
    ,output_tokens                INT                    NULL
    ,is_error                     BOOLEAN                NOT NULL DEFAULT false
    ,dttm_created_utc             TIMESTAMPTZ            NOT NULL DEFAULT NOW()
    ,created_by                   VARCHAR(50)            NOT NULL DEFAULT CURRENT_USER
);

CREATE INDEX IF NOT EXISTS idx_ink_reads_dttm_created_utc ON lol.th_ink_reads (dttm_created_utc);
CREATE INDEX IF NOT EXISTS idx_ink_reads_device_id_dttm_created_utc ON lol.th_ink_reads (device_id, dttm_created_utc);

GRANT USAGE ON SCHEMA lol TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA lol TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA lol TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA lol GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA lol GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

ALTER TABLE lol.th_ink_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lol.th_ink_reads FROM authenticated, anon;
GRANT SELECT, INSERT ON lol.th_ink_reads TO service_role;
GRANT USAGE, SELECT ON SEQUENCE lol.th_ink_reads_ink_read_id_seq TO service_role;

COMMIT;

-- ----------------------------------------------------------------------------
-- Verification (expected results in comments)
-- ----------------------------------------------------------------------------
SELECT relrowsecurity FROM pg_class WHERE oid = 'lol.th_ink_reads'::regclass;          -- true
SELECT count(*) FROM pg_policies WHERE schemaname = 'lol' AND tablename = 'th_ink_reads'; -- 0
SELECT has_table_privilege('anon', 'lol.th_ink_reads', 'SELECT');                        -- false
SELECT has_table_privilege('service_role', 'lol.th_ink_reads', 'INSERT');                -- true
