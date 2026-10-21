-- ============================================================================
-- migration 007: bot players with faces (DBZ, tennis legends, JJK)
-- ============================================================================
-- Bots are players nobody signs in as. They show up in FIND PLAYERS, join a
-- crew the moment they are invited (they can be in any number of crews), and
-- a match reported against one is confirmed on the spot. Every player gets a
-- face code: the drawn face the app shows (src/lib/faces.ts); '' is the plain
-- jelly face.
--
-- Wiping a crew or removing a fighter never deletes a bot, only its place in
-- that crew and the matches it played there.
--
-- IDEMPOTENT: safe to re-paste the whole file into the Supabase SQL Editor.
-- ============================================================================
BEGIN;

ALTER TABLE lol.tb_players ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE lol.tb_players ADD COLUMN IF NOT EXISTS face_code VARCHAR(24) NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_players_bot_face ON lol.tb_players (face_code) WHERE is_bot;

-- ----------------------------------------------------------------- search ---
-- Empty query: everyone (up to 60), so there is something to circle straight away.
CREATE OR REPLACE FUNCTION lol.fn_find_players(p_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_me UUID := lol.fn_my_player_id(); v_crew UUID;
        v_q TEXT := replace(replace(upper(trim(coalesce(p_query, ''))), '%', ''), '_', '');
BEGIN
    IF v_me IS NULL THEN RAISE EXCEPTION 'save your fighter first' USING ERRCODE = '42501'; END IF;
    SELECT crew_id INTO v_crew FROM lol.tm_crew_players WHERE player_id = v_me LIMIT 1;
    RETURN coalesce((
        SELECT jsonb_agg(r ORDER BY r.rank, r.name)
        FROM (
            SELECT p.player_id AS id, p.display_name AS name, p.cast_code AS cast, p.color_hex AS color, p.home_court AS home,
                   p.face_code AS face, p.is_bot AS bot,
                   CASE WHEN EXISTS (SELECT 1 FROM lol.tm_crew_players m WHERE m.player_id = p.player_id AND m.crew_id = v_crew) THEN 'yours'
                        WHEN p.is_bot OR NOT EXISTS (SELECT 1 FROM lol.tm_crew_players m WHERE m.player_id = p.player_id) THEN 'free'
                        ELSE 'taken' END AS crew,
                   EXISTS (SELECT 1 FROM lol.tb_crew_invites i WHERE i.crew_id = v_crew AND i.to_player_id = p.player_id AND i.status_code = 'pending') AS invited,
                   CASE WHEN v_q = '' THEN 0 WHEN upper(p.display_name) = v_q THEN 0 WHEN upper(p.display_name) LIKE v_q || '%' THEN 1 ELSE 2 END AS rank
            FROM lol.tb_players p
            WHERE (p.user_id IS NOT NULL OR p.is_bot)
              AND p.player_id <> v_me
              AND upper(p.display_name) <> 'YOU'
              AND (v_q = '' OR upper(p.display_name) LIKE '%' || v_q || '%')
            ORDER BY rank, name
            LIMIT 60
        ) r
    ), '[]'::jsonb);
END $$;

-- Inviting a bot puts it straight in; anyone else gets an invite to answer.
CREATE OR REPLACE FUNCTION lol.fn_invite_player(p_player UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
DECLARE v_me UUID := lol.fn_my_player_id(); v_crew UUID; v_bot BOOLEAN;
BEGIN
    SELECT crew_id INTO v_crew FROM lol.tm_crew_players WHERE player_id = v_me LIMIT 1;
    IF v_crew IS NULL THEN RAISE EXCEPTION 'start a crew first' USING ERRCODE = '42501'; END IF;
    SELECT is_bot INTO v_bot FROM lol.tb_players WHERE player_id = p_player AND (user_id IS NOT NULL OR is_bot);
    IF v_bot IS NULL THEN RAISE EXCEPTION 'no such player' USING ERRCODE = 'P0002'; END IF;
    IF v_bot THEN
        INSERT INTO lol.tm_crew_players (crew_id, player_id) VALUES (v_crew, p_player) ON CONFLICT DO NOTHING;
        RETURN true;
    END IF;
    IF EXISTS (SELECT 1 FROM lol.tm_crew_players WHERE player_id = p_player AND crew_id = v_crew) THEN RETURN true; END IF;
    INSERT INTO lol.tb_crew_invites (crew_id, from_player_id, to_player_id) VALUES (v_crew, v_me, p_player)
    ON CONFLICT (crew_id, to_player_id) DO UPDATE SET status_code = 'pending', from_player_id = EXCLUDED.from_player_id, dttm_modified_utc = NOW()
        WHERE lol.tb_crew_invites.status_code <> 'pending';
    RETURN true;
END $$;

-- A bot always agrees with the score.
CREATE OR REPLACE FUNCTION lol.tg_bot_confirms()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = lol, pg_temp AS $$
BEGIN
    IF NEW.status_code = 'pending' AND EXISTS (SELECT 1 FROM lol.tb_players WHERE player_id = NEW.p2_player_id AND is_bot) THEN
        NEW.status_code := 'confirmed';
        NEW.answered_by_player_id := NEW.p2_player_id;
        NEW.dttm_answered_utc := NOW();
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_bot_confirms ON lol.tb_matches;
CREATE TRIGGER trg_bot_confirms BEFORE INSERT ON lol.tb_matches FOR EACH ROW EXECUTE FUNCTION lol.tg_bot_confirms();

-- ---------------------------------------------------- never delete a bot ---
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

-- Take a pretender or a bot back out. Any member can drop a bot; a pretender needs whoever added it, or the commissioner.
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

REVOKE ALL ON FUNCTION lol.fn_wipe_crew(UUID), lol.tg_bot_confirms() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------ seeds ---
INSERT INTO lol.tb_players (user_id, display_name, cast_code, color_hex, bio, favorite_pro, home_court, racket, is_bot, face_code)
SELECT NULL, s.name, s.cast_code, s.color, s.bio, s.pro, s.home, s.racket, true, s.face
FROM (VALUES
    -- Dragon Ball Z
     ('GOKU',        'comet',   '#ff8a1f', 'Hits every ball like it owes him a fight.',            'NADAL',      'Barnes Tennis Center',       'Power Pole 98',      'goku')
    ,('VEGETA',      'grunter', '#2f5bd8', 'Prince of all serves. Never shakes hands first.',      'MCENROE',    'Balboa Tennis Club',         'Saiyan Pro 100',     'vegeta')
    ,('GOHAN',       'lobber',  '#9b6bff', 'Studies the draw. Then destroys it.',                  'FEDERER',    'UCSD North Campus',          'Scholar 97',         'gohan')
    ,('PICCOLO',     'wall',    '#2fe08a', 'Gets everything back. Says nothing.',                  'DJOKOVIC',   'Linda Vista Community Park', 'Namek Classic',      'piccolo')
    ,('FRIEZA',      'ghost',   '#b05be0', 'Calls the lines. All of them. In his favor.',          'BORG',       'Roosevelt',                  'Final Form 95',      'frieza')
    ,('TRUNKS',      'rabbit',  '#35d6ff', 'From the future. Already knows your serve.',           'SAMPRAS',    'North Park Rec Center',      'Time Blade 100',     'trunks')
    ,('KRILLIN',     'junk',    '#ffb347', 'Dinks, slices, and survives. Somehow.',                'NAVRATILOVA','Linda Vista Community Park', 'Destructo Disc 105', 'krillin')
    ,('CELL',        'moon',    '#7bc043', 'Absorbed everyone''s best shots. Uses them on you.',   'AGASSI',     'Barnes Tennis Center',       'Perfect 98',         'cell')
    ,('MAJIN BUU',   'goblin',  '#ff7eb6', 'Bounces back from everything. Eats the balls.',        'GRAF',       'North Park Rec Center',      'Candy Beam 110',     'buu')
    ,('BROLY',       'grunter', '#9be22d', 'Only hits one speed. Maximum.',                        'SERENA',     'Barnes Tennis Center',       'Legendary 100',      'broly')
    ,('BULMA',       'bot',     '#00b3b3', 'Built her own ball machine. It is better than you.',   'GRAF',       'UCSD North Campus',          'Capsule Corp 100',   'bulma')
    -- Tennis legends
    ,('FEDERER',     'wall',    '#c8102e', 'Never seen sweating. Never seen missing.',             'EDBERG',     'Balboa Tennis Club',         'Pro Staff 97',       'federer')
    ,('NADAL',       'grunter', '#d7f205', 'Lefty topspin to the moon. Fixes the bottles.',        'MOYA',       'Barnes Tennis Center',       'Pure Aero',          'nadal')
    ,('DJOKOVIC',    'rabbit',  '#1f3d99', 'Slides on hard courts. Returns everything.',           'SAMPRAS',    'UCSD North Campus',          'Speed Pro',          'djokovic')
    ,('SERENA',      'comet',   '#e0218a', 'First-strike tennis. Serve, then it is over.',         'GRAF',       'Balboa Tennis Club',         'Blade 104',          'serena')
    ,('VENUS',       'comet',   '#ffd23f', 'Long arms, long rallies, long career.',                'GRAF',       'Roosevelt',                  'Wilson 105',         'venus')
    ,('AGASSI',      'rabbit',  '#ff5fa2', 'Takes it on the rise. Image is everything.',           'CONNORS',    'North Park Rec Center',      'Radical OS',         'agassi')
    ,('MCENROE',     'goblin',  '#ff5252', 'You cannot be serious. Touch at the net.',             'LAVER',      'Balboa Tennis Club',         'Max 200G',           'mcenroe')
    ,('BORG',        'wall',    '#f4f1e6', 'Ice in his veins. Headband since forever.',            'LAVER',      'Linda Vista Community Park', 'Donnay Allwood',     'borg')
    ,('GRAF',        'rabbit',  '#ff9f1c', 'The forehand. Just the forehand.',                     'EVERT',      'Roosevelt',                  'Steffi Classic',     'graf')
    ,('SAMPRAS',     'comet',   '#3a86ff', 'Serve, volley, shower. Done in an hour.',              'LAVER',      'UCSD North Campus',          'Pro Staff 85',       'sampras')
    ,('NAVRATILOVA', 'lobber',  '#06d6a0', 'Owns the net. Always has.',                            'KING',       'North Park Rec Center',      'Yonex R-22',         'navratilova')
    -- Jujutsu Kaisen
    ,('GOJO',        'ghost',   '#3fa9ff', 'Infinity on the baseline. Nothing gets through.',      'FEDERER',    'UCSD North Campus',          'Limitless 98',       'gojo')
    ,('SUKUNA',      'grunter', '#b3261e', 'Cuts every ball. Four eyes on the line.',              'MCENROE',    'Barnes Tennis Center',       'Malevolent 100',     'sukuna')
    ,('ITADORI',     'comet',   '#e2562f', 'Divergent fist forehand. Hits twice.',                 'NADAL',      'Linda Vista Community Park', 'Black Flash 100',    'itadori')
    ,('MEGUMI',      'moon',    '#2c2f6b', 'Plays the angles. Brings the dogs.',                   'DJOKOVIC',   'Roosevelt',                  'Ten Shadows 97',     'megumi')
    ,('NOBARA',      'junk',    '#ff7a3d', 'Nails every drop shot. Hammer overhead.',              'SERENA',     'North Park Rec Center',      'Straw Doll 100',     'nobara')
    ,('NANAMI',      'wall',    '#c9b037', 'Plays exactly 7 to 3. Overtime costs extra.',          'BORG',       'Balboa Tennis Club',         'Ratio 7:3',          'nanami')
    ,('TODO',        'grunter', '#8d5524', 'Asks your type before the coin toss.',                 'SERENA',     'Barnes Tennis Center',       'Boogie Woogie 110',  'todo')
    ,('MAKI',        'rabbit',  '#3c8d4f', 'No cursed energy. Pure footwork.',                     'GRAF',       'UCSD North Campus',          'Playful Cloud 98',   'maki')
    ,('TOGE',        'ghost',   '#c7c9d9', 'Only says "salmon". Wins anyway.',                     'BORG',       'Linda Vista Community Park', 'Cursed Speech 100',  'toge')
    ,('PANDA',       'wall',    '#f4f1e6', 'Big, soft, and impossible to hit through.',            'NADAL',      'North Park Rec Center',      'Gorilla Mode 110',   'panda')
    ,('GETO',        'lobber',  '#5b4b8a', 'Collects your best shots. Sends them back.',           'AGASSI',     'Roosevelt',                  'Uzumaki 100',        'geto')
    ,('YUTA',        'moon',    '#e8e8f0', 'Quiet. Then Rika shows up in the third set.',          'FEDERER',    'Balboa Tennis Club',         'Katana 97',          'yuta')
) AS s(name, cast_code, color, bio, pro, home, racket, face)
WHERE NOT EXISTS (SELECT 1 FROM lol.tb_players b WHERE b.is_bot AND b.face_code = s.face);

NOTIFY pgrst, 'reload schema';
COMMIT;

SELECT count(*) FROM lol.tb_players WHERE is_bot; -- 34
