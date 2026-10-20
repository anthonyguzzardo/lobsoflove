-- ============================================================================
-- migration 005: rename a crew
-- ============================================================================
-- Anyone in a crew can rename it (it is a friend group, not an org chart).
-- Called from the crew page: tap the name, type or write the new one.
--
-- ENFORCEMENT: writes only through this SECURITY DEFINER function.
-- IDEMPOTENT: safe to re-paste the whole file into the Supabase SQL Editor.
-- ============================================================================
BEGIN;

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

REVOKE EXECUTE ON FUNCTION lol.fn_rename_crew(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION lol.fn_rename_crew(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
