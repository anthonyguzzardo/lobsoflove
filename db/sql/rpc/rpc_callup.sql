-- ============================================================================
-- rpc_callup: call-ups, answers, leaving and deleting crews (from migration 003)
-- ============================================================================
BEGIN;
-- Post a call-up to the friends you circled (an empty list means the whole crew). It lasts 12 hours.
CREATE OR REPLACE FUNCTION lol.fn_post_callup(p_venue_code TEXT, p_need INT, p_message TEXT, p_players UUID[])
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_me UUID := lol.fn_my_player_id(); v_crew UUID; v_id UUID;
BEGIN
    SELECT crew_id INTO v_crew FROM lol.tm_crew_players WHERE player_id = v_me LIMIT 1;
    IF v_crew IS NULL THEN RAISE EXCEPTION 'join or start a crew first' USING ERRCODE = '42501'; END IF;
    INSERT INTO lol.tb_callups (crew_id, caller_player_id, venue_code, need, message, dttm_expires_utc)
    VALUES (v_crew, v_me, left(p_venue_code, 40), greatest(1, least(7, coalesce(p_need, 1))), left(coalesce(p_message, ''), 200), NOW() + INTERVAL '12 hours')
    RETURNING callup_id INTO v_id;
    INSERT INTO lol.tm_callup_players (callup_id, player_id)
    SELECT v_id, cp.player_id FROM lol.tm_crew_players cp
    WHERE cp.crew_id = v_crew AND cp.player_id <> v_me
      AND (coalesce(array_length(p_players, 1), 0) = 0 OR cp.player_id = ANY (p_players));
    RETURN v_id;
END $$;

-- In or out. Enough in and the call-up is on; answering again changes your answer.
CREATE OR REPLACE FUNCTION lol.fn_answer_callup(p_callup_id UUID, p_in BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_me UUID := lol.fn_my_player_id(); v_c lol.tb_callups%ROWTYPE; v_in INT;
BEGIN
    SELECT * INTO v_c FROM lol.tb_callups WHERE callup_id = p_callup_id AND crew_id IN (SELECT lol.fn_my_crew_ids());
    IF v_c.callup_id IS NULL OR v_c.status_code = 'off' OR v_c.dttm_expires_utc < NOW() THEN
        RAISE EXCEPTION 'that call-up is over' USING ERRCODE = 'P0002';
    END IF;
    IF v_c.caller_player_id = v_me THEN RAISE EXCEPTION 'it is your call-up' USING ERRCODE = '22023'; END IF;
    INSERT INTO lol.tm_callup_players (callup_id, player_id, answer_code, dttm_answered_utc)
    VALUES (p_callup_id, v_me, CASE WHEN p_in THEN 'in' ELSE 'out' END, NOW())
    ON CONFLICT (callup_id, player_id) DO UPDATE SET answer_code = EXCLUDED.answer_code, dttm_answered_utc = NOW();
    SELECT count(*) INTO v_in FROM lol.tm_callup_players WHERE callup_id = p_callup_id AND answer_code = 'in';
    UPDATE lol.tb_callups SET status_code = CASE WHEN v_in >= need THEN 'on' ELSE 'open' END, dttm_modified_utc = NOW()
    WHERE callup_id = p_callup_id RETURNING status_code INTO v_c.status_code;
    RETURN v_c.status_code;
END $$;

-- The caller calls it off.
CREATE OR REPLACE FUNCTION lol.fn_cancel_callup(p_callup_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_n INT;
BEGIN
    UPDATE lol.tb_callups SET status_code = 'off', dttm_modified_utc = NOW()
    WHERE callup_id = p_callup_id AND caller_player_id = lol.fn_my_player_id();
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN v_n > 0;
END $$;

-- Delete a crew and everything in it: matches, beacons, call-ups, invites, pretenders. The caller must be in it.
-- Internal; the app reaches it through fn_delete_crew and fn_leave_crew.
CREATE OR REPLACE FUNCTION lol.fn_wipe_crew(p_crew UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
BEGIN
    DELETE FROM lol.tm_callup_players WHERE callup_id IN (SELECT callup_id FROM lol.tb_callups WHERE crew_id = p_crew);
    DELETE FROM lol.tb_callups WHERE crew_id = p_crew;
    DELETE FROM lol.tb_matches WHERE crew_id = p_crew;
    DELETE FROM lol.tb_beacons WHERE crew_id = p_crew;
    DELETE FROM lol.tb_crew_invites WHERE crew_id = p_crew;
    DELETE FROM lol.tb_players WHERE user_id IS NULL AND NOT is_bot AND player_id IN (SELECT player_id FROM lol.tm_crew_players WHERE crew_id = p_crew);
    DELETE FROM lol.tm_crew_players WHERE crew_id = p_crew;
    DELETE FROM lol.tb_crews WHERE crew_id = p_crew;
END $$;

-- The commissioner deletes the crew for everyone.
CREATE OR REPLACE FUNCTION lol.fn_delete_crew()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_me UUID := lol.fn_my_player_id(); v_crew UUID;
BEGIN
    SELECT crew_id INTO v_crew FROM lol.tm_crew_players WHERE player_id = v_me AND role_code = 'commissioner' LIMIT 1;
    IF v_crew IS NULL THEN RAISE EXCEPTION 'only the commissioner can delete the crew' USING ERRCODE = '42501'; END IF;
    PERFORM lol.fn_wipe_crew(v_crew);
    RETURN true;
END $$;

-- Leave your crew. Your matches stay on the record for the others. If nobody real is left, the crew goes.
-- A commissioner who leaves hands the role to whoever joined next.
CREATE OR REPLACE FUNCTION lol.fn_leave_crew()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_me UUID := lol.fn_my_player_id(); v_crew UUID; v_role TEXT; v_next UUID;
BEGIN
    SELECT crew_id, role_code INTO v_crew, v_role FROM lol.tm_crew_players WHERE player_id = v_me LIMIT 1;
    IF v_crew IS NULL THEN RETURN false; END IF;
    DELETE FROM lol.tm_crew_players WHERE crew_id = v_crew AND player_id = v_me;
    DELETE FROM lol.tb_beacons WHERE player_id = v_me;
    SELECT cp.player_id INTO v_next FROM lol.tm_crew_players cp JOIN lol.tb_players p ON p.player_id = cp.player_id
    WHERE cp.crew_id = v_crew AND p.user_id IS NOT NULL ORDER BY cp.dttm_joined_utc LIMIT 1;
    IF v_next IS NULL THEN PERFORM lol.fn_wipe_crew(v_crew);
    ELSIF v_role = 'commissioner' THEN UPDATE lol.tm_crew_players SET role_code = 'commissioner' WHERE crew_id = v_crew AND player_id = v_next;
    END IF;
    RETURN true;
END $$;

-- Take a pretender back out (whoever added them, or the commissioner). Their matches go with them.
CREATE OR REPLACE FUNCTION lol.fn_remove_pretender(p_player UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_me UUID := lol.fn_my_player_id(); v_crew UUID; v_bot BOOLEAN;
BEGIN
    SELECT crew_id INTO v_crew FROM lol.tm_crew_players WHERE player_id = v_me LIMIT 1;
    SELECT p.is_bot INTO v_bot FROM lol.tb_players p JOIN lol.tm_crew_players cp ON cp.player_id = p.player_id AND cp.crew_id = v_crew
    WHERE p.player_id = p_player AND p.user_id IS NULL
      AND (p.is_bot OR p.added_by_player_id = v_me OR EXISTS (SELECT 1 FROM lol.tm_crew_players WHERE crew_id = v_crew AND player_id = v_me AND role_code = 'commissioner'));
    IF v_bot IS NULL THEN RAISE EXCEPTION 'you can only remove a pretender you added' USING ERRCODE = '42501'; END IF;
    DELETE FROM lol.tb_matches WHERE crew_id = v_crew AND (p1_player_id = p_player OR p2_player_id = p_player);
    DELETE FROM lol.tm_callup_players WHERE player_id = p_player AND callup_id IN (SELECT callup_id FROM lol.tb_callups WHERE crew_id = v_crew);
    DELETE FROM lol.tm_crew_players WHERE player_id = p_player AND crew_id = v_crew;
    IF NOT v_bot THEN DELETE FROM lol.tb_players WHERE player_id = p_player; END IF;
    RETURN true;
END $$;

REVOKE ALL ON FUNCTION
     lol.fn_post_callup(TEXT, INT, TEXT, UUID[]), lol.fn_answer_callup(UUID, BOOLEAN), lol.fn_cancel_callup(UUID)
    ,lol.fn_wipe_crew(UUID), lol.fn_delete_crew(), lol.fn_leave_crew(), lol.fn_remove_pretender(UUID)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
     lol.fn_post_callup(TEXT, INT, TEXT, UUID[]), lol.fn_answer_callup(UUID, BOOLEAN), lol.fn_cancel_callup(UUID)
    ,lol.fn_delete_crew(), lol.fn_leave_crew(), lol.fn_remove_pretender(UUID)
TO authenticated;
COMMIT;
