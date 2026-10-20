-- ============================================================================
-- migration 004: push notifications (confirm your match, you got called up)
-- ============================================================================
-- Phones register an Expo push token. When a match is reported against you, or
-- a friend calls you up, a trigger posts to Expo's push service through pg_net.
-- Nothing else runs: no edge function, no queue.
--
-- ENFORCEMENT: tb_push_tokens is server-only (RLS on, no policies); the app writes
-- its token through fn_save_push_token. The triggers are SECURITY DEFINER.
-- ALSO REQUIRED: the pg_net extension (Dashboard -> Database -> Extensions), created below.
-- IDEMPOTENT: safe to re-paste the whole file into the Supabase SQL Editor.
-- AFTER RUNNING: from db/, run  ./sync-types.sh
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS lol.tb_push_tokens
(
     push_token_id                BIGSERIAL              PRIMARY KEY
    ,player_id                    UUID                   NOT NULL
    ,token                        VARCHAR(200)           NOT NULL UNIQUE
    ,platform                     VARCHAR(10)            NOT NULL DEFAULT ''
    ,dttm_created_utc             TIMESTAMPTZ            NOT NULL DEFAULT NOW()
    ,created_by                   VARCHAR(50)            NOT NULL DEFAULT CURRENT_USER
    ,dttm_modified_utc            TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_player_id ON lol.tb_push_tokens (player_id);

ALTER TABLE lol.tb_push_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lol.tb_push_tokens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON lol.tb_push_tokens TO service_role;
GRANT USAGE, SELECT ON SEQUENCE lol.tb_push_tokens_push_token_id_seq TO service_role;

-- The caller's phone. A token moves to whoever registered it last (a shared or handed-down phone).
CREATE OR REPLACE FUNCTION lol.fn_save_push_token(p_token TEXT, p_platform TEXT DEFAULT '')
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_me UUID := lol.fn_my_player_id();
BEGIN
    IF v_me IS NULL OR p_token IS NULL OR p_token !~ '^ExponentPushToken\[.+\]$' THEN RETURN false; END IF;
    INSERT INTO lol.tb_push_tokens (player_id, token, platform) VALUES (v_me, p_token, left(coalesce(p_platform, ''), 10))
    ON CONFLICT (token) DO UPDATE SET player_id = EXCLUDED.player_id, platform = EXCLUDED.platform, dttm_modified_utc = NOW();
    RETURN true;
END $$;

-- Send one push to every phone a player has. `url` is the app route the tap opens.
CREATE OR REPLACE FUNCTION lol.fn_push(p_player UUID, p_title TEXT, p_body TEXT, p_url TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, extensions, pg_temp AS $$
DECLARE v_msgs JSONB;
BEGIN
    SELECT jsonb_agg(jsonb_build_object('to', token, 'title', p_title, 'body', p_body, 'sound', 'default', 'data', jsonb_build_object('url', p_url)))
    INTO v_msgs FROM lol.tb_push_tokens WHERE player_id = p_player;
    IF v_msgs IS NULL THEN RETURN; END IF;
    PERFORM net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        body := v_msgs,
        headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
END $$;

-- A match reported against you: confirm it.
CREATE OR REPLACE FUNCTION lol.tg_match_reported()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_name TEXT; v_score TEXT; v_won INT;
BEGIN
    IF NEW.status_code <> 'pending' THEN RETURN NEW; END IF;
    SELECT display_name INTO v_name FROM lol.tb_players WHERE player_id = NEW.p1_player_id;
    SELECT string_agg((s ->> 0) || '-' || (s ->> 1), ' '), sum(CASE WHEN (s ->> 0)::INT > (s ->> 1)::INT THEN 1 WHEN (s ->> 0)::INT < (s ->> 1)::INT THEN -1 ELSE 0 END)
    INTO v_score, v_won FROM jsonb_array_elements(NEW.sets) s;
    PERFORM lol.fn_push(
        NEW.p2_player_id,
        'Confirm your match',
        coalesce(v_name, 'A friend') || ' logged ' || CASE WHEN v_won > 0 THEN 'a win over you' ELSE 'a loss to you' END || ' ' || coalesce(v_score, '')
            || CASE WHEN NEW.venue_name <> '' THEN ' at ' || NEW.venue_name ELSE '' END || '. Tap to confirm.',
        '/confirm'
    );
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_match_reported ON lol.tb_matches;
CREATE TRIGGER trg_match_reported AFTER INSERT ON lol.tb_matches FOR EACH ROW EXECUTE FUNCTION lol.tg_match_reported();

-- A friend called you up.
CREATE OR REPLACE FUNCTION lol.tg_called_up()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_name TEXT; v_msg TEXT;
BEGIN
    IF NEW.answer_code IS NOT NULL THEN RETURN NEW; END IF;
    SELECT p.display_name, c.message INTO v_name, v_msg
    FROM lol.tb_callups c JOIN lol.tb_players p ON p.player_id = c.caller_player_id
    WHERE c.callup_id = NEW.callup_id;
    PERFORM lol.fn_push(NEW.player_id, coalesce(v_name, 'A friend') || ' called you up', coalesce(nullif(v_msg, ''), 'Tap if you are in.'), '/crew');
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_called_up ON lol.tm_callup_players;
CREATE TRIGGER trg_called_up AFTER INSERT ON lol.tm_callup_players FOR EACH ROW EXECUTE FUNCTION lol.tg_called_up();

REVOKE ALL ON FUNCTION lol.fn_save_push_token(TEXT, TEXT), lol.fn_push(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION lol.fn_save_push_token(TEXT, TEXT) TO authenticated;

COMMIT;

SELECT relrowsecurity FROM pg_class WHERE oid = 'lol.tb_push_tokens'::regclass;                -- true
SELECT has_function_privilege('authenticated', 'lol.fn_push(uuid,text,text,text)', 'EXECUTE'); -- false
SELECT count(*) FROM pg_trigger WHERE tgname IN ('trg_match_reported', 'trg_called_up');         -- 2
