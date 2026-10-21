-- ============================================================================
-- migration 006: find players by name and invite them to your crew
-- ============================================================================
-- Search everyone who has the app (real players, not pretenders) by name.
-- Tapping one sends an invite: they get a push, and their crew page offers
-- JOIN. Accepting puts them in the crew; one crew per player still holds.
--
-- ENFORCEMENT: tb_crew_invites is server-only (RLS on, no policies). Reads and
-- writes go through the SECURITY DEFINER functions below.
-- IDEMPOTENT: safe to re-paste the whole file into the Supabase SQL Editor.
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS lol.tb_crew_invites
(
     crew_invite_id               UUID                   PRIMARY KEY DEFAULT gen_random_uuid()
    ,crew_id                      UUID                   NOT NULL
    ,from_player_id               UUID                   NOT NULL
    ,to_player_id                 UUID                   NOT NULL
    ,status_code                  VARCHAR(10)            NOT NULL DEFAULT 'pending'
    ,dttm_created_utc             TIMESTAMPTZ            NOT NULL DEFAULT NOW()
    ,created_by                   VARCHAR(50)            NOT NULL DEFAULT CURRENT_USER
    ,dttm_modified_utc            TIMESTAMPTZ            NOT NULL DEFAULT NOW()
    ,modified_by                  VARCHAR(50)            NOT NULL DEFAULT CURRENT_USER
    ,UNIQUE (crew_id, to_player_id)
    ,CHECK (status_code IN ('pending', 'accepted', 'declined'))
);
CREATE INDEX IF NOT EXISTS idx_crew_invites_to_player_id ON lol.tb_crew_invites (to_player_id);

ALTER TABLE lol.tb_crew_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lol.tb_crew_invites FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON lol.tb_crew_invites TO service_role;

-- Players whose name matches, best first. Each says whether they are already in
-- your crew, in another crew, or already invited by your crew.
CREATE OR REPLACE FUNCTION lol.fn_find_players(p_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_me UUID := lol.fn_my_player_id(); v_crew UUID; v_q TEXT := upper(trim(coalesce(p_query, '')));
BEGIN
    IF v_me IS NULL THEN RAISE EXCEPTION 'save your fighter first' USING ERRCODE = '42501'; END IF;
    IF length(v_q) < 1 THEN RETURN '[]'::jsonb; END IF;
    SELECT crew_id INTO v_crew FROM lol.tm_crew_players WHERE player_id = v_me LIMIT 1;
    RETURN coalesce((
        SELECT jsonb_agg(r ORDER BY r.rank, r.name)
        FROM (
            SELECT p.player_id AS id, p.display_name AS name, p.cast_code AS cast, p.color_hex AS color, p.home_court AS home,
                   CASE WHEN cp.crew_id IS NULL THEN 'free' WHEN cp.crew_id = v_crew THEN 'yours' ELSE 'taken' END AS crew,
                   EXISTS (SELECT 1 FROM lol.tb_crew_invites i WHERE i.crew_id = v_crew AND i.to_player_id = p.player_id AND i.status_code = 'pending') AS invited,
                   CASE WHEN upper(p.display_name) = v_q THEN 0 WHEN upper(p.display_name) LIKE v_q || '%' THEN 1 ELSE 2 END AS rank
            FROM lol.tb_players p
            LEFT JOIN lol.tm_crew_players cp ON cp.player_id = p.player_id
            WHERE p.user_id IS NOT NULL
              AND p.player_id <> v_me
              AND upper(p.display_name) <> 'YOU'
              AND upper(p.display_name) LIKE '%' || replace(replace(v_q, '%', ''), '_', '') || '%'
            LIMIT 25
        ) r
    ), '[]'::jsonb);
END $$;

-- Invite a player to your crew. Inviting again after a no asks again.
CREATE OR REPLACE FUNCTION lol.fn_invite_player(p_player UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_me UUID := lol.fn_my_player_id(); v_crew UUID;
BEGIN
    SELECT crew_id INTO v_crew FROM lol.tm_crew_players WHERE player_id = v_me LIMIT 1;
    IF v_crew IS NULL THEN RAISE EXCEPTION 'start a crew first' USING ERRCODE = '42501'; END IF;
    IF NOT EXISTS (SELECT 1 FROM lol.tb_players WHERE player_id = p_player AND user_id IS NOT NULL) THEN
        RAISE EXCEPTION 'no such player' USING ERRCODE = 'P0002';
    END IF;
    IF EXISTS (SELECT 1 FROM lol.tm_crew_players WHERE player_id = p_player AND crew_id = v_crew) THEN RETURN true; END IF;
    INSERT INTO lol.tb_crew_invites (crew_id, from_player_id, to_player_id) VALUES (v_crew, v_me, p_player)
    ON CONFLICT (crew_id, to_player_id) DO UPDATE SET status_code = 'pending', from_player_id = EXCLUDED.from_player_id, dttm_modified_utc = NOW()
        WHERE lol.tb_crew_invites.status_code <> 'pending';
    RETURN true;
END $$;

-- Invites waiting on the caller, newest first.
CREATE OR REPLACE FUNCTION lol.fn_my_invites()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = lol, pg_temp AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', i.crew_invite_id, 'crew', c.crew_name, 'from', p.display_name, 'color', p.color_hex,
        'size', (SELECT count(*) FROM lol.tm_crew_players cp WHERE cp.crew_id = i.crew_id)
    ) ORDER BY i.dttm_modified_utc DESC), '[]'::jsonb)
    FROM lol.tb_crew_invites i
    JOIN lol.tb_crews c ON c.crew_id = i.crew_id
    JOIN lol.tb_players p ON p.player_id = i.from_player_id
    WHERE i.to_player_id = lol.fn_my_player_id() AND i.status_code = 'pending'
$$;

-- Yes joins the crew (only if you are in no other one). No just closes it.
CREATE OR REPLACE FUNCTION lol.fn_answer_invite(p_invite UUID, p_yes BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_me UUID := lol.fn_my_player_id(); v_crew UUID; v_old UUID;
BEGIN
    SELECT crew_id INTO v_crew FROM lol.tb_crew_invites WHERE crew_invite_id = p_invite AND to_player_id = v_me AND status_code = 'pending';
    IF v_crew IS NULL THEN RAISE EXCEPTION 'that invite is gone' USING ERRCODE = 'P0002'; END IF;
    IF p_yes THEN
        SELECT crew_id INTO v_old FROM lol.tm_crew_players WHERE player_id = v_me LIMIT 1;
        IF v_old IS NOT NULL AND v_old <> v_crew THEN RAISE EXCEPTION 'leave your crew first' USING ERRCODE = '23505'; END IF;
        INSERT INTO lol.tm_crew_players (crew_id, player_id) VALUES (v_crew, v_me) ON CONFLICT DO NOTHING;
    END IF;
    UPDATE lol.tb_crew_invites SET status_code = CASE WHEN p_yes THEN 'accepted' ELSE 'declined' END, dttm_modified_utc = NOW()
    WHERE crew_invite_id = p_invite;
    RETURN true;
END $$;

-- An invite (new, or asked again) pushes to the invited player's phones.
CREATE OR REPLACE FUNCTION lol.tg_crew_invited()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_name TEXT; v_crew TEXT;
BEGIN
    IF NEW.status_code <> 'pending' OR (TG_OP = 'UPDATE' AND OLD.status_code = 'pending') THEN RETURN NEW; END IF;
    SELECT display_name INTO v_name FROM lol.tb_players WHERE player_id = NEW.from_player_id;
    SELECT crew_name INTO v_crew FROM lol.tb_crews WHERE crew_id = NEW.crew_id;
    PERFORM lol.fn_push(NEW.to_player_id, coalesce(v_name, 'A friend') || ' invited you', 'Join ' || coalesce(v_crew, 'their crew') || ' on LobsOfLove. Tap to join.', '/crew');
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_crew_invited ON lol.tb_crew_invites;
CREATE TRIGGER trg_crew_invited AFTER INSERT OR UPDATE ON lol.tb_crew_invites FOR EACH ROW EXECUTE FUNCTION lol.tg_crew_invited();

-- Deleting a crew also clears its invites.
CREATE OR REPLACE FUNCTION lol.fn_wipe_crew(p_crew UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
BEGIN
    DELETE FROM lol.tm_callup_players WHERE callup_id IN (SELECT callup_id FROM lol.tb_callups WHERE crew_id = p_crew);
    DELETE FROM lol.tb_callups WHERE crew_id = p_crew;
    DELETE FROM lol.tb_matches WHERE crew_id = p_crew;
    DELETE FROM lol.tb_beacons WHERE crew_id = p_crew;
    DELETE FROM lol.tb_crew_invites WHERE crew_id = p_crew;
    DELETE FROM lol.tb_players WHERE user_id IS NULL AND player_id IN (SELECT player_id FROM lol.tm_crew_players WHERE crew_id = p_crew);
    DELETE FROM lol.tm_crew_players WHERE crew_id = p_crew;
    DELETE FROM lol.tb_crews WHERE crew_id = p_crew;
END $$;

REVOKE EXECUTE ON FUNCTION lol.fn_find_players(TEXT), lol.fn_invite_player(UUID), lol.fn_my_invites(), lol.fn_answer_invite(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION lol.fn_find_players(TEXT), lol.fn_invite_player(UUID), lol.fn_my_invites(), lol.fn_answer_invite(UUID, BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION lol.tg_crew_invited() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
