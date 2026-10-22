-- ============================================================================
-- migration 008: 58 more bot players, and badge colors that stand off their faces
-- ============================================================================
-- Same rules as migration 007 (bots join on invite, agree with every score,
-- never deleted). Faces are drawn in src/lib/faces-dbz.ts, faces-tennis.ts and
-- faces-jjk.ts, checked against reference photos.
-- IDEMPOTENT: inserts skip any bot whose face code already exists.
-- ============================================================================
BEGIN;

INSERT INTO lol.tb_players (user_id, display_name, cast_code, color_hex, bio, favorite_pro, home_court, racket, is_bot, face_code)
SELECT NULL, s.name, s.cast_code, s.color, s.bio, s.pro, s.home, s.racket, true, s.face
FROM (VALUES
    -- Dragon Ball
     ('ANDROID 16',  'wall',    '#2c3e70', 'Gentle giant. Will not hit a drop shot near a bird.',   'BORG',       'Linda Vista Community Park', 'Hell Flash 100',     'android_16')
    ,('ANDROID 17',  'rabbit',  '#1fa5a0', 'Infinite stamina. Still asks for a water break to annoy you.', 'AGASSI', 'Balboa Tennis Club',    'Barrier 98',         'android_17')
    ,('ANDROID 18',  'comet',   '#2f3a8a', 'Never tires. Charges Krillin for every lesson.',        'GRAF',       'North Park Rec Center',      'Infinite 100',       'android_18')
    ,('BEERUS',      'ghost',   '#2f8fd8', 'Destroys anyone who wakes him before a 9am match.',     'FEDERER',    'UCSD North Campus',          'Hakai 95',           'beerus')
    ,('WHIS',        'ghost',   '#2a2a5a', 'Rewinds time on every double fault. Brings snacks.',    'FEDERER',    'Balboa Tennis Club',         'Temporal Do-Over 97','whis')
    ,('CHI-CHI',     'grunter', '#ff8a1f', 'Makes you finish your homework before the third set.',  'GRAF',       'Linda Vista Community Park', 'Frying Pan 110',     'chichi')
    ,('CHIAOTZU',    'ghost',   '#e8b04a', 'Moves the ball with his mind. Not technically illegal.','NAVRATILOVA','North Park Rec Center',      'Dodon Ray 105',      'chiaotzu')
    ,('GOTEN',       'rabbit',  '#ffb347', 'Plays like his dad, but naps between points.',          'NADAL',      'Barnes Tennis Center',       'Kid Saiyan 100',     'goten')
    ,('GOTENKS',     'goblin',  '#ff7a3d', 'Names every shot. Super Ghost Kamikaze Lob.',           'MCENROE',    'Roosevelt',                  'Fusion Dance 98',    'gotenks')
    ,('GOGETA',      'comet',   '#d1203a', 'Thirty minutes of perfect tennis, then he splits.',     'NADAL',      'Barnes Tennis Center',       'Soul Punisher 100',  'gogeta')
    ,('VEGITO',      'grunter', '#2f5bd8', 'Toys with you at 5-0. Calls it a warm-up.',             'MCENROE',    'Balboa Tennis Club',         'Potara 97',          'vegito')
    ,('VIDEL',       'rabbit',  '#d1203a', 'Fights crime on the way to the courts. Still on time.', 'SERENA',     'Roosevelt',                  'Great Saiyaman 100', 'videl')
    ,('YAMCHA',      'junk',    '#2f5bd8', 'Wolf Fang Fist forehand. Loses the tiebreak anyway.',   'KYRGIOS',    'North Park Rec Center',      'Wolf Fang 100',      'yamcha')
    ,('TIEN',        'wall',    '#e8c14a', 'Third eye watches the line. No out call gets past.',    'DJOKOVIC',   'UCSD North Campus',          'Tri-Beam 98',        'tien')
    ,('HERCULE',     'grunter', '#e2562f', 'Takes credit for every winner. Even yours.',            'CONNORS',    'Barnes Tennis Center',       'Champ 110',          'hercule')
    ,('MASTER ROSHI','lobber',  '#2fb5e0', 'Three hundred years of slice. Watches the crowd, not the ball.', 'LAVER', 'Linda Vista Community Park', 'Kame House 105',  'roshi')
    ,('NAPPA',       'grunter', '#3a4a6a', 'Asks if you can dodge this serve. You cannot.',         'SAFIN',      'Barnes Tennis Center',       'Giant Storm 110',    'nappa')
    ,('RADITZ',      'junk',    '#8a2a2a', 'Scouter says your power level is 5. Plays down anyway.','MEDVEDEV',   'Roosevelt',                  'Double Sunday 100',  'raditz')
    ,('DR. GERO',    'bot',     '#5a7a9a', 'Built 20 ball machines. The last one beat him.',        'SAMPRAS',    'UCSD North Campus',          'Red Ribbon 98',      'dr_gero')
    ,('SHENRON',     'ghost',   '#1b1f3a', 'Grants one wish per set. Collect all seven balls first.','NADAL',     'Balboa Tennis Club',         'Eternal Dragon 100', 'shenron')
    -- Tennis
    ,('ZVEREV',      'comet',   '#ff8a1f', 'Serves from the clouds. Man bun never moves.',            'LENDL',      'Barnes Tennis Center',       'Sascha Smash 100',   'zverev')
    ,('MURRAY',      'wall',    '#1f3d99', 'Gets everything back, then tells himself off.',            'AGASSI',     'Balboa Tennis Club',         'Grit Pro 95',        'murray')
    ,('SABALENKA',   'grunter', '#ff3d7f', 'Hits it harder than you thought a ball could go.',         'SERENA',     'North Park Rec Center',      'Tiger Roar 100',     'sabalenka')
    ,('SHELTON',     'comet',   '#3a86ff', 'Lefty rocket serve. Hangs up the phone after.',            'FEDERER',    'UCSD North Campus',          'Dial Tone 98',       'shelton')
    ,('BILLIE JEAN', 'lobber',  '#6b3fa0', 'Won the battle of the sexes. Wins yours too.',             'GIBSON',     'Roosevelt',                  'Equal Pay 100',      'billie_jean')
    ,('ALCARAZ',     'rabbit',  '#ffd23f', 'Drop shot, then a smile, then another drop shot.',         'NADAL',      'Barnes Tennis Center',       'Carlitos Kick 98',   'alcaraz')
    ,('GAUFF',       'rabbit',  '#ff7a3d', 'Runs down everything. Cap stays on.',                      'SERENA',     'Linda Vista Community Park', 'Coco Loco 100',      'gauff')
    ,('MEDVEDEV',    'wall',    '#9b6bff', 'Stands in the parking lot to return. Still gets it back.', 'DJOKOVIC',   'Roosevelt',                  'Octopus Arms 100',   'medvedev')
    ,('RYBAKINA',    'ghost',   '#35d6ff', 'Aces you without changing her face.',                      'SHARAPOVA',  'Balboa Tennis Club',         'Ice Queen 98',       'rybakina')
    ,('RADUCANU',    'comet',   '#ff5fa2', 'Came through qualies and never stopped smiling.',          'LI NA',      'UCSD North Campus',          'Qualifier 100',      'raducanu')
    ,('TIAFOE',      'goblin',  '#e2562f', 'Big Foe energy. The crowd is on his side.',                'DEL POTRO',  'North Park Rec Center',      'Big Foe 100',        'tiafoe')
    ,('SWIATEK',     'rabbit',  '#2fe08a', 'Bagels for breakfast. 6-0 is her love language.',          'NADAL',      'Linda Vista Community Park', 'Bagel Baker 100',    'swiatek')
    ,('SINNER',      'wall',    '#2c6fbb', 'Ginger curls, flat lasers, zero drama.',                   'FEDERER',    'Barnes Tennis Center',       'Fox Hunt 98',        'sinner')
    ,('CONNORS',     'goblin',  '#3fa9ff', 'Flat two-hander and a fist pump for every point.',         'SEGURA',     'Roosevelt',                  'Jimbo T2000',        'connors')
    ,('SHARAPOVA',   'grunter', '#c77dff', 'Every ball gets a scream and a winner.',                   'SELES',      'Balboa Tennis Club',         'Siberian Shriek 98', 'sharapova')
    ,('OSAKA',       'comet',   '#ffd23f', 'Quiet off court. First-strike missile on it.',             'SERENA',     'North Park Rec Center',      'Hard Court Queen',   'osaka')
    ,('KYRGIOS',     'goblin',  '#1aa36f', 'Underarm serve, tweener, argues the call. Wins.',          'AGASSI',     'Linda Vista Community Park', 'Showman 100',        'kyrgios')
    ,('JABEUR',      'junk',    '#e63946', 'Minister of happiness. Slices you into a smile.',          'RODDICK',    'UCSD North Campus',          'Drop Shot Deluxe',   'jabeur')
    ,('TSITSIPAS',   'lobber',  '#2f9be0', 'One-hander, big hair, philosophy between points.',         'FEDERER',    'Balboa Tennis Club',         'Greek Freak 100',    'tsitsipas')
    ,('FRITZ',       'comet',   '#ff9f1c', 'Big serve, bigger forehand, California calm.',             'SAMPRAS',    'Barnes Tennis Center',       'SoCal Cannon 98',    'fritz')
    -- Jujutsu Kaisen
    ,('CHOSO',       'wall',    '#c94a4a', 'Nine brothers in the stands. Every point is personal.',          'DJOKOVIC',  'Roosevelt',                  'Blood Lob 100',      'choso')
    ,('HANAMI',      'wall',    '#3a7a3a', 'Grows a hedge at the net. Nothing gets through.',               'BORG',      'Linda Vista Community Park', 'Root Ball 110',      'hanami')
    ,('JOGO',        'comet',   '#d1203a', 'Erupts on every double fault. Very short fuse.',                'MCENROE',   'Barnes Tennis Center',       'Magma 98',           'jogo')
    ,('JUNPEI',      'junk',    '#ffb347', 'Watches tennis movies. Copies the slow-mo slice.',              'FEDERER',   'North Park Rec Center',      'Moon Dreggs 100',    'junpei')
    ,('MIWA',        'rabbit',  '#ff8fae', 'Simple domain on the baseline. Draws the sword, misses.',       'GRAF',      'UCSD North Campus',          'New Shadow 100',     'miwa')
    ,('KENJAKU',     'lobber',  '#7a6a3a', 'A thousand years of tiebreaks. Swaps brains, not rackets.',     'AGASSI',    'Roosevelt',                  'Body Swap 97',       'kenjaku')
    ,('HAKARI',      'goblin',  '#ff3d7f', 'Plays every point like a jackpot spin. Sometimes hits.',        'KYRGIOS',   'North Park Rec Center',      'Idle Death Gamble',  'hakari')
    ,('MECHAMARU',   'bot',     '#8a9aa8', 'Plays remote from a hospital bed. Ultra cannon serve.',         'SAMPRAS',   'UCSD North Campus',          'Ultra Cannon 100',   'mechamaru')
    ,('MAHITO',      'ghost',   '#2c2f6b', 'Reshapes your swing. Not in a good way.',                       'TSITSIPAS', 'Barnes Tennis Center',       'Idle Transfig 98',   'mahito')
    ,('MAI',         'junk',    '#ff7a3d', 'One bullet a set. Makes it count.',                             'SERENA',    'Balboa Tennis Club',         'Construct 98',       'mai')
    ,('YAGA',        'wall',    '#2f5bd8', 'Knits puppets between sets. Coaches the juniors.',              'LAVER',     'Linda Vista Community Park', 'Puppet Pro 100',     'yaga')
    ,('MOMO',        'lobber',  '#9b6bff', 'Flies over on a broom for every lob.',                          'SWIATEK',   'Roosevelt',                  'Broomstick 105',     'momo')
    ,('NAOYA',       'rabbit',  '#c94a7a', '24 frames per second. Foot faults on every one.',               'MEDVEDEV',  'Balboa Tennis Club',         'Projection 100',     'naoya')
    ,('KAMO',        'moon',    '#d07a2a', 'Blood manipulation slice. Reads every angle.',                  'DJOKOVIC',  'UCSD North Campus',          'Piercing Blood 97',  'kamo')
    ,('RIKA',        'ghost',   '#9bd3ff', 'Follows her doubles partner everywhere. Everywhere.',           'VENUS',     'Linda Vista Community Park', 'Promise Ring 105',   'rika')
    ,('INO',         'comet',   '#ff9f1c', 'Calls his shots before he hits them. Beanie stays on.',         'TIAFOE',    'North Park Rec Center',      'Kaichi 100',         'ino')
    ,('TOJI',        'rabbit',  '#2fe08a', 'No cursed energy, no excuses. Heavenly footwork.',              'NADAL',     'Barnes Tennis Center',       'Split Soul 98',      'toji')
    ,('YUKI',        'grunter', '#d1203a', 'Asks your type before the warmup. Hits with mass.',             'SERENA',    'Balboa Tennis Club',         'Star Rage 100',      'yuki')
) AS s(name, cast_code, color, bio, pro, home, racket, face)
WHERE NOT EXISTS (SELECT 1 FROM lol.tb_players b WHERE b.is_bot AND b.face_code = s.face);

-- Badges that were too close to the face's hair or skin.
UPDATE lol.tb_players p SET color_hex = v.color, dttm_modified_utc = NOW()
FROM (VALUES ('nanami', '#2f5b6b'), ('todo', '#f2c230'), ('maki', '#c9a227'), ('toge', '#5b3f8a'), ('panda', '#2fa36b'), ('yuta', '#7a9cc6')) AS v(face, color)
WHERE p.is_bot AND p.face_code = v.face;

COMMIT;

SELECT count(*) FROM lol.tb_players WHERE is_bot; -- 92
