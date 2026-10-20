-- ============================================================================
-- rpc_crew: every write the app makes to the shared season
-- ============================================================================
-- SECURITY DEFINER functions. Each one finds the caller's player from
-- auth.uid() and refuses anything the caller may not do. The tables themselves
-- are SELECT-only for authenticated (see migration 002).
--
-- Rules enforced here:
--   - A match is reported by p1 (the caller). Both players must be in the
--     caller's crew. It starts pending.
--   - Only the other player (p2) can confirm or dispute it, once.
--   - A pending match can be withdrawn by its reporter. A confirmed one cannot.
--   - A pretender is a fighter someone added by name. Whoever joins with its
--     claim token takes it over, along with every match it played.
-- IDEMPOTENT: CREATE OR REPLACE throughout; safe to re-paste.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION lol.fn_new_code(p_len INT) RETURNS TEXT
LANGUAGE sql VOLATILE SET search_path = lol, pg_temp AS $$
    -- No 0/O or 1/I/L: these get read aloud and typed.
    SELECT string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::INT, 1), '')
    FROM generate_series(1, p_len)
$$;

-- The caller's player, created on first call. Also saves their fighter.
CREATE OR REPLACE FUNCTION lol.fn_save_me(
     p_name TEXT, p_cast TEXT, p_color TEXT, p_bio TEXT DEFAULT '', p_pro TEXT DEFAULT ''
    ,p_home TEXT DEFAULT '', p_racket TEXT DEFAULT '')
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
    INSERT INTO lol.tb_players (user_id, display_name, cast_code, color_hex, bio, favorite_pro, home_court, racket)
    VALUES (auth.uid(), left(coalesce(nullif(trim(p_name), ''), 'YOU'), 24), left(coalesce(p_cast, 'wall'), 20),
            left(coalesce(p_color, '#d7f205'), 9), left(coalesce(p_bio, ''), 200), left(coalesce(p_pro, ''), 60),
            left(coalesce(p_home, ''), 80), left(coalesce(p_racket, ''), 80))
    ON CONFLICT (user_id) DO UPDATE SET
         display_name = EXCLUDED.display_name, cast_code = EXCLUDED.cast_code, color_hex = EXCLUDED.color_hex
        ,bio = EXCLUDED.bio, favorite_pro = EXCLUDED.favorite_pro, home_court = EXCLUDED.home_court
        ,racket = EXCLUDED.racket, dttm_modified_utc = NOW()
    RETURNING player_id INTO v_id;
    RETURN v_id;
END $$;

-- Start a crew. The caller is its commissioner. One crew per player for now:
-- if the caller already has one, that one comes back.
CREATE OR REPLACE FUNCTION lol.fn_create_crew(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_me UUID := lol.fn_my_player_id(); v_crew UUID; v_code TEXT;
BEGIN
    IF v_me IS NULL THEN RAISE EXCEPTION 'save your fighter first' USING ERRCODE = '42501'; END IF;
    SELECT crew_id INTO v_crew FROM lol.tm_crew_players WHERE player_id = v_me LIMIT 1;
    IF v_crew IS NOT NULL THEN RETURN v_crew; END IF;
    LOOP
        v_code := lol.fn_new_code(6);
        EXIT WHEN NOT EXISTS (SELECT 1 FROM lol.tb_crews WHERE invite_code = v_code);
    END LOOP;
    INSERT INTO lol.tb_crews (crew_name, invite_code, founded_by_player_id)
    VALUES (left(coalesce(nullif(trim(p_name), ''), 'THE CREW'), 40), v_code, v_me)
    RETURNING crew_id INTO v_crew;
    INSERT INTO lol.tm_crew_players (crew_id, player_id, role_code) VALUES (v_crew, v_me, 'commissioner');
    RETURN v_crew;
END $$;

-- Join by invite code. With a claim token, the caller also takes over that
-- pretender: its matches become the caller's and the pretender is removed.
CREATE OR REPLACE FUNCTION lol.fn_join_crew(p_code TEXT, p_claim TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_me UUID := lol.fn_my_player_id(); v_crew UUID; v_old UUID; v_pre UUID;
BEGIN
    IF v_me IS NULL THEN RAISE EXCEPTION 'save your fighter first' USING ERRCODE = '42501'; END IF;
    SELECT crew_id INTO v_crew FROM lol.tb_crews WHERE invite_code = upper(trim(p_code));
    IF v_crew IS NULL THEN RAISE EXCEPTION 'no crew with that code' USING ERRCODE = 'P0002'; END IF;
    SELECT crew_id INTO v_old FROM lol.tm_crew_players WHERE player_id = v_me LIMIT 1;
    IF v_old IS NOT NULL AND v_old <> v_crew THEN
        RAISE EXCEPTION 'already in another crew' USING ERRCODE = '23505';
    END IF;
    INSERT INTO lol.tm_crew_players (crew_id, player_id) VALUES (v_crew, v_me) ON CONFLICT DO NOTHING;

    IF p_claim IS NOT NULL THEN
        SELECT p.player_id INTO v_pre FROM lol.tb_players p
        JOIN lol.tm_crew_players cp ON cp.player_id = p.player_id AND cp.crew_id = v_crew
        WHERE p.claim_token = upper(trim(p_claim)) AND p.user_id IS NULL;
        IF v_pre IS NOT NULL THEN
            -- A match the pretender played against the caller would become a match against themselves: drop it.
            DELETE FROM lol.tb_matches WHERE crew_id = v_crew
                AND ((p1_player_id = v_pre AND p2_player_id = v_me) OR (p1_player_id = v_me AND p2_player_id = v_pre));
            UPDATE lol.tb_matches SET p1_player_id = v_me, dttm_modified_utc = NOW() WHERE p1_player_id = v_pre;
            UPDATE lol.tb_matches SET p2_player_id = v_me, dttm_modified_utc = NOW() WHERE p2_player_id = v_pre;
            UPDATE lol.tb_matches SET reported_by_player_id = v_me WHERE reported_by_player_id = v_pre;
            DELETE FROM lol.tm_crew_players WHERE player_id = v_pre;
            DELETE FROM lol.tb_players WHERE player_id = v_pre;
        END IF;
    END IF;
    RETURN v_crew;
END $$;

-- Add a friend who is not in the app yet. Returns the claim token for their invite link.
CREATE OR REPLACE FUNCTION lol.fn_add_pretender(p_name TEXT, p_cast TEXT DEFAULT 'wall', p_color TEXT DEFAULT '#8f98b3')
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_me UUID := lol.fn_my_player_id(); v_crew UUID; v_id UUID; v_tok TEXT;
BEGIN
    SELECT crew_id INTO v_crew FROM lol.tm_crew_players WHERE player_id = v_me LIMIT 1;
    IF v_crew IS NULL THEN RAISE EXCEPTION 'join or start a crew first' USING ERRCODE = '42501'; END IF;
    LOOP
        v_tok := lol.fn_new_code(8);
        EXIT WHEN NOT EXISTS (SELECT 1 FROM lol.tb_players WHERE claim_token = v_tok);
    END LOOP;
    INSERT INTO lol.tb_players (user_id, display_name, cast_code, color_hex, claim_token, added_by_player_id)
    VALUES (NULL, left(upper(coalesce(nullif(trim(p_name), ''), 'PRETENDER')), 24), left(coalesce(p_cast, 'wall'), 20),
            left(coalesce(p_color, '#8f98b3'), 9), v_tok, v_me)
    RETURNING player_id INTO v_id;
    INSERT INTO lol.tm_crew_players (crew_id, player_id) VALUES (v_crew, v_id);
    RETURN jsonb_build_object('player_id', v_id, 'claim_token', v_tok);
END $$;

-- Report a match. The caller is p1. The client picks match_id so the app can
-- show the card before the server answers; reporting the same id twice is a no-op.
CREATE OR REPLACE FUNCTION lol.fn_report_match(
     p_match_id UUID, p_opponent UUID, p_sets JSONB, p_venue_code TEXT, p_venue_name TEXT
    ,p_played_utc TIMESTAMPTZ, p_minutes INT DEFAULT NULL, p_has_photo BOOLEAN DEFAULT false)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_me UUID := lol.fn_my_player_id(); v_crew UUID;
BEGIN
    SELECT crew_id INTO v_crew FROM lol.tm_crew_players WHERE player_id = v_me LIMIT 1;
    IF v_crew IS NULL THEN RAISE EXCEPTION 'join or start a crew first' USING ERRCODE = '42501'; END IF;
    IF p_opponent = v_me THEN RAISE EXCEPTION 'you cannot play yourself' USING ERRCODE = '22023'; END IF;
    IF NOT EXISTS (SELECT 1 FROM lol.tm_crew_players WHERE crew_id = v_crew AND player_id = p_opponent) THEN
        RAISE EXCEPTION 'that player is not in your crew' USING ERRCODE = '42501';
    END IF;
    IF jsonb_typeof(p_sets) <> 'array' OR jsonb_array_length(p_sets) NOT BETWEEN 1 AND 5 THEN
        RAISE EXCEPTION 'sets must be a list of one to five scores' USING ERRCODE = '22023';
    END IF;
    INSERT INTO lol.tb_matches (match_id, crew_id, venue_code, venue_name, p1_player_id, p2_player_id, sets,
                                minutes, has_photo, dttm_played_utc, reported_by_player_id)
    VALUES (p_match_id, v_crew, left(p_venue_code, 40), left(coalesce(p_venue_name, ''), 80), v_me, p_opponent, p_sets,
            p_minutes, coalesce(p_has_photo, false), coalesce(p_played_utc, NOW()), v_me)
    ON CONFLICT (match_id) DO NOTHING;
    RETURN p_match_id;
END $$;

-- The opponent answers: true confirms, false disputes. Only once, only p2.
CREATE OR REPLACE FUNCTION lol.fn_answer_match(p_match_id UUID, p_confirm BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_me UUID := lol.fn_my_player_id(); v_status TEXT;
BEGIN
    UPDATE lol.tb_matches
    SET status_code = CASE WHEN p_confirm THEN 'confirmed' ELSE 'disputed' END
       ,answered_by_player_id = v_me, dttm_answered_utc = NOW(), dttm_modified_utc = NOW()
    WHERE match_id = p_match_id AND p2_player_id = v_me AND status_code = 'pending'
    RETURNING status_code INTO v_status;
    IF v_status IS NULL THEN RAISE EXCEPTION 'nothing to answer' USING ERRCODE = 'P0002'; END IF;
    RETURN v_status;
END $$;

-- The reporter takes back a match nobody has confirmed yet (the ink "undo").
CREATE OR REPLACE FUNCTION lol.fn_withdraw_match(p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_n INT;
BEGIN
    DELETE FROM lol.tb_matches
    WHERE match_id = p_match_id AND reported_by_player_id = lol.fn_my_player_id() AND status_code <> 'confirmed';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN v_n > 0;
END $$;

-- "I am at this court now", or off every court with null.
CREATE OR REPLACE FUNCTION lol.fn_set_beacon(p_venue_code TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_me UUID := lol.fn_my_player_id(); v_crew UUID;
BEGIN
    SELECT crew_id INTO v_crew FROM lol.tm_crew_players WHERE player_id = v_me LIMIT 1;
    IF v_crew IS NULL THEN RETURN; END IF;
    IF p_venue_code IS NULL THEN
        DELETE FROM lol.tb_beacons WHERE player_id = v_me;
    ELSE
        INSERT INTO lol.tb_beacons (player_id, crew_id, venue_code, dttm_at_utc)
        VALUES (v_me, v_crew, left(p_venue_code, 40), NOW())
        ON CONFLICT (player_id) DO UPDATE SET crew_id = EXCLUDED.crew_id, venue_code = EXCLUDED.venue_code,
            dttm_at_utc = NOW(), dttm_modified_utc = NOW();
    END IF;
END $$;

-- Rename your crew (any member). Migration 005.
CREATE OR REPLACE FUNCTION lol.fn_rename_crew(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_me UUID := lol.fn_my_player_id(); v_crew UUID; v_name TEXT := left(upper(trim(coalesce(p_name, ''))), 40);
BEGIN
    IF v_name = '' THEN RAISE EXCEPTION 'a crew needs a name' USING ERRCODE = '22023'; END IF;
    SELECT crew_id INTO v_crew FROM lol.tm_crew_players WHERE player_id = v_me LIMIT 1;
    IF v_crew IS NULL THEN RAISE EXCEPTION 'you are not in a crew' USING ERRCODE = '42501'; END IF;
    UPDATE lol.tb_crews SET crew_name = v_name, dttm_modified_utc = now() WHERE crew_id = v_crew;
    RETURN true;
END $$;

REVOKE ALL ON FUNCTION
     lol.fn_new_code(INT), lol.fn_save_me(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT), lol.fn_create_crew(TEXT)
    ,lol.fn_join_crew(TEXT, TEXT), lol.fn_add_pretender(TEXT, TEXT, TEXT)
    ,lol.fn_report_match(UUID, UUID, JSONB, TEXT, TEXT, TIMESTAMPTZ, INT, BOOLEAN)
    ,lol.fn_answer_match(UUID, BOOLEAN), lol.fn_withdraw_match(UUID), lol.fn_set_beacon(TEXT), lol.fn_rename_crew(TEXT)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
     lol.fn_save_me(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT), lol.fn_create_crew(TEXT)
    ,lol.fn_join_crew(TEXT, TEXT), lol.fn_add_pretender(TEXT, TEXT, TEXT)
    ,lol.fn_report_match(UUID, UUID, JSONB, TEXT, TEXT, TIMESTAMPTZ, INT, BOOLEAN)
    ,lol.fn_answer_match(UUID, BOOLEAN), lol.fn_withdraw_match(UUID), lol.fn_set_beacon(TEXT), lol.fn_rename_crew(TEXT)
TO authenticated;

COMMIT;
