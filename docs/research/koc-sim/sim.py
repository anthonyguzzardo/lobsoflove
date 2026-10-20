"""
LobsOfLove season simulator: a friend group playing the feudal king-of-the-court game for a season.

Everything here is a model with made-up but stated constants. It is good for comparing mechanics against each other under the
same assumptions, not for predicting absolute numbers. The goal every result is judged against: friends keep logging confirmed
scores week after week, losers keep playing, and new people get pulled in.

Run:  python sim.py            (writes results.json; report.py turns it into charts and report.md)
"""
from __future__ import annotations

import json
import math
import random
import sys
import time
from dataclasses import dataclass, field

# ----------------------------------------------------------------------------------------------------------------- strategies
STRATS = [
    'casual', 'loyalist', 'ghost', 'grinder', 'aggressor', 'turtle', 'ducker', 'betrayer', 'kingmaker', 'recruiter',
    'mercenary', 'sandbagger', 'chaos', 'alliance', 'sniper', 'farmer', 'kingslayer', 'collector',
]
# A realistic friend group is mostly people who just want to hit; the schemers are the minority.
STRAT_W = {
    'casual': 18, 'loyalist': 8, 'ghost': 6, 'grinder': 6, 'aggressor': 6, 'turtle': 5, 'ducker': 5, 'betrayer': 4,
    'kingmaker': 3, 'recruiter': 4, 'mercenary': 4, 'sandbagger': 3, 'chaos': 4, 'alliance': 4, 'sniper': 4, 'farmer': 4,
    'kingslayer': 4, 'collector': 4,
}
NEWCOMER_W = {'casual': 50, 'loyalist': 15, 'ghost': 15, 'grinder': 10, 'aggressor': 5, 'chaos': 5}

MECHS = [
    'laws', 'fealty', 'bounties', 'banners', 'revolt', 'decay', 'gods', 'defense_cap', 'duck_rule', 'tribute', 'power_cards',
    'siege', 'houses', 'fog', 'pretender_loop', 'weekly_show', 'belt_last_winner',
]

CROWNS = [
    'none', 'rotation', 'curse_potato', 'wand_relay', 'underdog', 'renown_lottery', 'pity_lottery', 'effort', 'assassin',
    'election', 'kingmakers_choice', 'comet', 'streak', 'newcomer', 'jester', 'thunderdome',
]


def wpick(rng, weights: dict):
    tot = sum(weights.values())
    r = rng.random() * tot
    for k, w in weights.items():
        r -= w
        if r <= 0:
            return k
    return k


def poisson(rng, lam):
    if lam <= 0:
        return 0
    L = math.exp(-lam)
    k, p = 0, 1.0
    while True:
        p *= rng.random()
        if p < L:
            return k
        k += 1


def clip(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def logistic(x):
    return 1 / (1 + math.exp(-x))


# ----------------------------------------------------------------------------------------------------------------- rankings
# Each ranking: a score from a player's stats, plus how it steers behavior.
#   vol: more matches raise your score            protect: losing hurts a rate, so careful players play less
#   land: holding courts pays                     loss: a loss still earns something (losers confirm, sting less)
#   upset / distinct / streak: what else it pays  soft: how much it softens being near the bottom (0 none, 1 no shame)
#   visible: False means no leaderboard at all
def _r(score, vol=0.0, protect=0.0, land=0.0, loss=0.0, upset=0.0, distinct=0.0, streak=0.0, soft=0.0, visible=True, chaos=0.0):
    return dict(score=score, vol=vol, protect=protect, land=land, loss=loss, upset=upset, distinct=distinct, streak=streak,
                soft=soft, visible=visible, chaos=chaos)


def _wins(p, c): return p.W
def _pct(p, c): return (p.W + 1) / (p.W + p.L + 2)


RANKINGS = {
    'win_pct': _r(_pct, protect=1.0),
    'total_wins': _r(_wins, vol=0.6),
    'atp_points': _r(lambda p, c: p.atp, vol=0.7, loss=0.4, upset=0.3),
    'elo_visible': _r(lambda p, c: p.elo, protect=0.6),
    'hidden_skill': _r(lambda p, c: p.elo, visible=False),
    'renown_doc': _r(lambda p, c: 30 * p.land_weeks + 25 * p.taken + 15 * p.defenses + 20 * p.betrayals + 20 * p.bounties + 10 * p.crown_weeks + 4 * p.matches + 3 * p.L, vol=0.4, land=1.0, loss=0.3),
    'land_weeks': _r(lambda p, c: p.land_weeks, land=1.0),
    'land_now': _r(lambda p, c: p.courts_now, land=1.0),
    'crown_weeks': _r(lambda p, c: p.crown_weeks + 0.01 * p.W),
    'effort_volume': _r(lambda p, c: p.matches, vol=1.0, loss=1.0),
    'grit': _r(lambda p, c: p.matches + 0.6 * p.L + 0.4 * p.close_losses, vol=0.9, loss=1.0, soft=0.3),
    'streak': _r(lambda p, c: p.best_streak + 0.5 * p.streak, streak=1.0, loss=0.8, soft=0.3),
    'distinct_opps': _r(lambda p, c: len(p.opps) + 0.1 * p.W, distinct=1.0, loss=0.6),
    'upset_hunter': _r(lambda p, c: 3 * p.upsets + p.W, upset=1.0),
    'handicap_elo': _r(lambda p, c: p.hcp, loss=0.3, upset=0.6, soft=0.2),
    'form_last4': _r(lambda p, c: sum(p.form[-4:]), vol=0.3, protect=0.4),
    'rolling_atp4': _r(lambda p, c: sum(p.atp_week[-4:]), vol=0.7, loss=0.4, soft=0.2),
    'drama_score': _r(lambda p, c: p.drama, vol=0.3, land=0.5, upset=0.5, chaos=0.3),
    'king_of_hill': _r(lambda p, c: 1000 * p.courts_now + p.land_weeks - 0.1 * (c['week'] - p.last_lost_belt), land=1.0),
    'ladder': _r(lambda p, c: -p.ladder, land=0.3, upset=0.4),
    'pyramid_ladder': _r(lambda p, c: -p.ladder + 0.001 * p.matches, land=0.3, upset=0.4, soft=0.2),
    'improvement': _r(lambda p, c: p.elo - p.elo_start, loss=0.2, soft=0.5),
    'house_points': _r(lambda p, c: c['house_score'].get(p.house, 0) + 0.01 * p.matches, vol=0.4, loss=0.5, soft=0.6),
    'bounty_hunter': _r(lambda p, c: 5 * p.bounties + p.taken, land=0.8, upset=0.4),
    'chaos_lottery': _r(lambda p, c: p.atp + p.jackpot, vol=0.5, loss=0.4, soft=0.3, chaos=1.0),
    'loser_points': _r(lambda p, c: 60 * p.W + 50 * p.L, vol=1.0, loss=1.0, soft=0.4),
    'capped_weekly': _r(lambda p, c: p.capped, vol=0.3, loss=0.4, soft=0.2),
    'opp_quality': _r(lambda p, c: p.sos, upset=0.6, distinct=0.3),
    'divisions': _r(lambda p, c: p.div_score, vol=0.5, loss=0.4, soft=0.6),
    'multi_track': _r(lambda p, c: p.best_track, vol=0.5, land=0.4, loss=0.6, streak=0.3, soft=0.6),
    'personal_best': _r(lambda p, c: p.elo - p.elo_start + 5 * p.streak, streak=0.5, loss=0.5, soft=1.0),
    'hybrid_reco': _r(lambda p, c: 3 * p.weeks_logged + 2 * min(p.W, 3 * max(1, p.weeks_logged)) + 6 * p.courts_now + p.L + 2 * p.streak, vol=0.6, land=0.6, loss=0.7, streak=0.6, soft=0.5),
}

# ----------------------------------------------------------------------------------------------------------------- model


@dataclass
class Player:
    id: int
    skill: float
    freq: float
    loyalty: float
    tilt: float
    comp: float
    base: float
    strat: str
    joined: int = 0
    original: bool = True
    m: float = 0.7
    active: bool = True
    quit_week: int = -1
    low: int = 0
    elo: float = 1000.0
    elo_start: float = 1000.0
    hcp: float = 0.0
    W: int = 0
    L: int = 0
    matches: int = 0
    unlogged: int = 0
    close_losses: int = 0
    atp: float = 0.0
    atp_week: list = field(default_factory=list)
    form: list = field(default_factory=list)
    opps: set = field(default_factory=set)
    land_weeks: int = 0
    courts_now: int = 0
    taken: int = 0
    defenses: int = 0
    crown_weeks: int = 0
    upsets: int = 0
    betrayals: int = 0
    bounties: int = 0
    recruits: int = 0
    streak: int = 0
    best_streak: int = 0
    weeks_logged: int = 0
    drama: int = 0
    lord: int = -1
    house: int = -1
    banners: int = 3
    merc: bool = False
    ally: int = -1
    coins: int = 0
    jackpot: float = 0.0
    ladder: int = 0
    last_lost_belt: int = 0
    sos: float = 0.0
    capped: float = 0.0
    div_score: float = 0.0
    best_track: float = 0.0
    week_conf: int = 0
    week_w: int = 0
    week_l: int = 0
    week_events: int = 0
    lost_to: dict = field(default_factory=dict)
    idle: int = 0
    rank_prev: float = 0.5
    bullied: bool = False
    crowned_quit: bool = False


@dataclass
class Court:
    holder: int = -1
    fog: bool = False
    defenses: int = 0
    walls: int = 0
    regulars: dict = field(default_factory=dict)
    beat_regs: dict = field(default_factory=dict)  # siege: challenger -> distinct regulars they beat here
    beaten: list = field(default_factory=list)  # (week, challenger) the holder beat here, for revolts
    revolt: bool = False
    last_active: int = 0


class World:
    def __init__(self, cfg: dict, seed: int):
        self.cfg = cfg
        self.rng = random.Random(seed)
        self.mech = {k: bool(cfg['mech'].get(k, False)) for k in MECHS}
        # the belt rule is a variant, not an extra thing to learn
        self.n_mech = sum(v for k, v in self.mech.items() if k != 'belt_last_winner') + (cfg['crown'] != 'none')
        self.rank = RANKINGS[cfg['ranking']]
        self.players: list[Player] = []
        n = cfg['n']
        for i in range(n):
            self.players.append(self.new_player(0, original=True, strat=cfg.get('force', {}).get(i)))
        k = max(3, round(n / 3))
        self.courts = [Court(fog=self.mech['fog'] and j >= 2) for j in range(k)]
        for p in self.players:
            p.home = self.rng.randrange(k)
        if self.mech['houses']:
            nh = max(2, min(4, n // 5))
            leaders = [p for p in self.players if p.strat == 'alliance'][:nh]
            for h, p in enumerate(leaders):
                p.house = h
            for p in self.players:
                if p.house < 0:
                    p.house = self.rng.randrange(nh)
        for p in self.players:
            if p.strat == 'kingmaker':
                others = [q for q in self.players if q.id != p.id]
                p.ally = min(others, key=lambda q: q.skill + self.rng.random()).id  # props up a weak friend
        for i, p in enumerate(sorted(self.players, key=lambda q: self.rng.random())):
            p.ladder = i
        self.week = 0
        self.crown = -1
        self.comet = -1
        self.thunder = None
        self.god = None
        self.events = []  # (week, kind, players)
        self.weekly = []  # per-week metrics
        self.leader_hist = []
        self.rank_moves = []

    # ------------------------------------------------------------------ players
    def new_player(self, week, original, strat=None):
        r = self.rng
        dist = STRAT_W if original else NEWCOMER_W
        s = strat or wpick(r, dist)
        skill = r.gauss(0, self.cfg.get('spread', 1.0)) if original else r.gauss(-0.3, self.cfg.get('spread', 1.0))
        freq = {'ghost': 0.35, 'grinder': 2.6, 'casual': 1.0}.get(s, 1.3) * r.uniform(0.6, 1.4)
        p = Player(
            id=len(self.players), skill=skill, freq=freq, loyalty=r.random(), tilt=r.uniform(0.5, 1.6), comp=r.random(),
            base=clip(r.gauss(0.56, 0.15), 0.2, 0.95), strat=s, joined=week, original=original,
        )
        if s in ('aggressor', 'kingslayer', 'sniper', 'sandbagger', 'farmer', 'ducker', 'turtle'):
            p.comp = max(p.comp, 0.6)
        if s == 'loyalist':
            p.loyalty = max(p.loyalty, 0.8)
        if s == 'betrayer':
            p.loyalty = min(p.loyalty, 0.2)
        p.m = clip(p.base + r.gauss(0.08, 0.08), 0.3, 1)
        p.home = r.randrange(len(self.courts)) if hasattr(self, 'courts') else 0
        p.ladder = len(self.players)
        return p

    def act(self):
        return [p for p in self.players if p.active]

    def ev(self, kind, *ids, weight=1):
        self.events.append((self.week, kind, ids))
        for i in ids:
            if i >= 0:
                self.players[i].drama += weight
                self.players[i].week_events += 1

    # ------------------------------------------------------------------ choices
    def eff_skill(self, p: Player):
        s = p.skill
        if p.strat == 'sandbagger' and self.week < self.cfg['weeks'] // 3:
            s -= 0.9  # throws early to sink the table and the hidden rating
        return s

    def perceived(self, p):  # what others think: the rating built from logged results
        return p.elo

    def holders(self):
        return [(j, c) for j, c in enumerate(self.courts) if c.holder >= 0 and not c.fog]

    def choose(self, p: Player, act: list):
        """Who p plays and where. Returns (opponent, court) or None."""
        r = self.rng
        others = [q for q in act if q.id != p.id]
        if not others:
            return None
        R = self.rank
        land_pull = 1 + p.comp * R['land']
        hs = [(j, c) for j, c in self.holders() if c.holder != p.id and self.players[c.holder].active]
        bounty = lambda j, c: 2.0 if (self.mech['bounties'] and (self.players[c.holder].courts_now >= 2 or c.holder == self.crown)) else 1.0
        s = p.strat
        def court_of(q):
            return q.home if self.rng.random() < 0.7 else p.home
        # thunderdome crown: the drawn pair must play
        if self.thunder and p.id in self.thunder:
            q = self.players[self.thunder[1] if p.id == self.thunder[0] else self.thunder[0]]
            if q.active:
                return q, p.home
        if s == 'kingmaker' and p.ally >= 0 and self.players[p.ally].active and r.random() < 0.45:
            return self.players[p.ally], self.players[p.ally].home
        if s in ('aggressor', 'kingslayer') and r.random() < 0.6 * land_pull:
            if s == 'kingslayer' and self.crown >= 0 and self.crown != p.id and self.players[self.crown].active:
                q = self.players[self.crown]
                return q, q.home
            if hs:
                j, c = max(hs, key=lambda jc: self.perceived(self.players[jc[1].holder]) * bounty(*jc) + r.random() * 50)
                return self.players[c.holder], j
        if s in ('mercenary', 'sniper', 'collector', 'bounty') or (hs and r.random() < 0.18 * land_pull):
            cands = hs
            if s == 'sniper':
                cands = [(j, c) for j, c in hs if logistic((p.elo - self.players[c.holder].elo) / 200) > 0.55 or self.players[c.holder].idle >= 1]
            if s == 'collector' and self.mech['fog']:
                fogged = [j for j, c in enumerate(self.courts) if c.fog]
                if fogged and r.random() < 0.5:
                    return r.choice(others), r.choice(fogged)
            if cands:
                j, c = max(cands, key=lambda jc: bounty(*jc) + r.random())
                return self.players[c.holder], j
        if s == 'farmer':
            q = min(others, key=lambda q: q.elo + r.random() * 30)
            return q, p.home
        if s in ('ducker', 'turtle'):
            weaker = [q for q in others if q.elo <= p.elo + 20]
            if weaker:
                q = r.choice(weaker)
                return q, p.home
            return None
        if s == 'recruiter':
            new = [q for q in others if not q.original]
            if new and r.random() < 0.6:
                return r.choice(new), p.home
        if s == 'chaos':
            q = r.choice(others)
            return q, r.randrange(len(self.courts))
        if self.mech['houses'] and s == 'alliance':
            foes = [q for q in others if q.house != p.house]
            if foes:
                q = r.choice(foes)
                return q, court_of(q)
        # default: someone you get along with, new faces if the ranking pays for them
        if R['distinct'] and p.comp * R['distinct'] > r.random():
            fresh = [q for q in others if q.id not in p.opps]
            if fresh:
                q = r.choice(fresh)
                return q, court_of(q)
        # friends play friends: weight toward similar level and people you have played
        q = min(others, key=lambda q: abs(q.elo - p.elo) / 120 + r.random() * 2.2 - (0.4 if q.id in p.opps else 0))
        return q, court_of(q)

    def accepts(self, q: Player, p: Player, belt: bool):
        """Does q take p's match? Duckers and turtles dodge stronger challengers, more so when the ranking punishes losses."""
        r = self.rng
        if self.thunder and {p.id, q.id} == set(self.thunder):
            return True
        protect = q.comp * self.rank['protect']
        stronger = p.elo > q.elo + 30
        dodge = 0.02 + 0.25 * protect * stronger
        if q.strat == 'ducker':
            dodge += 0.6 if stronger else 0.1
        if q.strat == 'turtle' and belt:
            dodge += 0.55
        if q.m < 0.35:
            dodge += 0.25
        if belt and self.courts_for_holder_revolt(q.id):
            dodge = 0.0
        return r.random() > clip(dodge)

    def courts_for_holder_revolt(self, qid):
        return any(c.revolt and c.holder == qid for c in self.courts)

    # ------------------------------------------------------------------ a match
    def play(self, p: Player, q: Player, j: int):
        r = self.rng
        cfg = self.cfg
        c = self.courts[j]
        belt_match = c.holder in (p.id, q.id) and not c.fog
        holder = self.players[c.holder] if c.holder >= 0 else None
        # siege: you have to beat two different regulars of the court before its land can change hands at all.
        # A closed gate blocks the last-winner rule too.
        sieged = False
        if self.mech['siege'] and c.holder >= 0 and not c.fog:
            if belt_match:
                chal = p if c.holder == q.id else q
                sieged = len(c.beat_regs.get(chal.id, ())) < 2
            else:
                sieged = True  # nobody here is the holder: only the gate-opened can take it, and only from the holder
        if sieged:
            belt_match = False
        # knights defend their lord at the lord's court
        defender = None
        if self.mech['fealty'] and belt_match:
            lord = holder
            chal = p if lord.id == q.id else q
            knights = [k for k in self.act() if k.lord == lord.id and k.skill > lord.skill and k.id != chal.id]
            if knights and r.random() < 0.5:
                defender = max(knights, key=lambda k: k.skill)
                if lord.id == q.id:
                    q = defender
                else:
                    p = defender
        x = 1.1 * (self.eff_skill(p) - self.eff_skill(q))
        # home court, laws and walls favor the side defending the court (the holder, or the knight standing in for them)
        home = None
        if c.holder >= 0 and not c.revolt:
            if c.holder == q.id or defender is q:
                home = q
            elif c.holder == p.id or defender is p:
                home = p
        if home is not None:
            adv = (0.25 if self.mech['laws'] else 0.08) + 0.08 * c.walls
            x += adv if home is p else -adv
        if self.cfg['crown'] == 'curse_potato':
            if self.crown == p.id: x -= 0.3
            if self.crown == q.id: x += 0.3
        variance = 1.0
        if (self.mech['power_cards'] and belt_match) or self.god == 'chaos':
            variance = 0.72
        if p.strat == 'chaos' or q.strat == 'chaos':
            variance *= 0.9
        pw = logistic(x * variance)
        if p.strat == 'kingmaker' and q.id == p.ally:
            pw = 0.15  # throws it for the friend
        elif q.strat == 'kingmaker' and p.id == q.ally:
            pw = 0.85
        win = r.random() < pw
        w, l = (p, q) if win else (q, p)
        close = r.random() < 0.35 + 0.4 * (1 - abs(pw - 0.5) * 2)
        # ------------- logging: the winner logs, the loser confirms. Stakes push the winner; a sore loss pushes the loser away.
        R = self.rank
        fr = cfg['friction'] * self.n_mech
        stakes = 0.15 if belt_match else 0.0
        stakes += 0.06 if (self.crown in (w.id, l.id) and cfg['crown'] != 'none') else 0.0
        stakes += 0.06 if self.thunder and {w.id, l.id} == set(self.thunder) else 0.0
        show = 0.05 if self.mech['weekly_show'] else 0.0
        p_log = 0.5 + 0.4 * w.m + stakes + show + 0.08 * R['vol'] * w.comp - fr + cfg.get('log_boost', 0.0)
        loses_belt = belt_match and c.holder == l.id
        bullied = l.lost_to.get(w.id, 0) >= 2
        p_conf = 0.42 + 0.45 * l.m + 0.14 * R['loss'] + show + (0.1 if l.strat == 'loyalist' else 0) - (0.12 if loses_belt else 0) - (0.1 if bullied else 0) - fr
        p_conf += cfg.get('confirm_boost', 0.0)  # e.g. a push to the loser and a one-tap confirm
        if self.mech['houses'] and w.house == l.house:
            p_conf += 0.05
        if l.strat == 'loyalist':
            p_conf = max(p_conf, 0.93)
        confirmed = r.random() < clip(p_log, 0.05, 0.98) and r.random() < clip(p_conf, 0.05, 0.98)
        for z in (w, l):
            z.m = clip(z.m + 0.01)  # playing tennis is fun even if nobody writes it down
        # you feel the result on court, logged or not
        w.m = clip(w.m + 0.04 * (1 + 0.5 * w.comp))
        l.m = clip(l.m - cfg.get('sting', 0.05) * l.tilt * (1 - 0.35 * self.rank['loss']) - (0.03 if bullied else 0))
        if not confirmed:
            w.unlogged += 1
            l.unlogged += 1
            return
        self.confirmed_week += 1
        # ------------- the record
        exp = 1 / (1 + 10 ** ((l.elo - w.elo) / 400))
        upset = w.skill < l.skill - 0.3
        k = 32
        w.elo += k * (1 - exp)
        l.elo -= k * (1 - exp)
        w.hcp += 30 * (1 - exp) * 1.4
        l.hcp += 6 - 30 * (1 - exp) * 0.6
        for z, o, won in ((w, l, True), (l, w, False)):
            z.matches += 1
            z.week_conf += 1
            z.opps.add(o.id)
            if won:
                z.W += 1; z.week_w += 1
            else:
                z.L += 1; z.week_l += 1
        w.sos += l.elo / 1000
        if upset:
            w.upsets += 1
            self.ev('upset', w.id, l.id)
        if close and not win:
            pass
        if close:
            l.close_losses += 1
        l.lost_to[w.id] = l.lost_to.get(w.id, 0) + 1
        if l.lost_to[w.id] >= 3:
            l.bullied = True
        ld = len(self.week_losses.setdefault(l.id, []))
        self.week_losses[l.id].append(1)
        loss_pts = [25, 15, 5][min(ld, 2)]
        w.atp += 100 + (20 if upset else 0)
        l.atp += loss_pts
        w.week_atp += 100
        l.week_atp += loss_pts
        # ladder: the winner takes the loser's rung if it is higher
        if w.ladder > l.ladder and (self.cfg['ranking'] != 'pyramid_ladder' or w.ladder - l.ladder <= 2):
            w.ladder, l.ladder = l.ladder, w.ladder
        c.last_active = self.week
        c.regulars[w.id] = c.regulars.get(w.id, 0) + 1
        c.regulars[l.id] = c.regulars.get(l.id, 0) + 1
        if self.mech['siege'] and c.holder >= 0 and l.id != c.holder and w.id != c.holder and c.regulars.get(l.id, 0) >= 2:
            c.beat_regs.setdefault(w.id, set()).add(l.id)
        if self.mech['tribute'] and c.holder >= 0:
            h = self.players[c.holder]
            h.coins += 2 if self.god == 'harvest' else 1
            for kn in self.act():
                if kn.lord == h.id and self.rng.random() < 0.3:
                    kn.coins += 1
            if h.coins >= 4 and c.walls < 3:
                h.coins -= 4
                c.walls += 1
        # ------------- the land
        landless = self.mech['banners'] and w.merc
        if c.fog:
            c.fog = False
            c.holder = -1 if landless else w.id
            self.ev('founded', w.id, weight=2)
            w.taken += 1
        elif self.god == 'freeze':
            pass
        elif belt_match:
            if c.holder == w.id or (defender is not None and defender.id == w.id):
                keeper = self.players[c.holder]  # the lord keeps the court even when a knight won it for them
                c.defenses += 1
                keeper.defenses += 1
                c.beaten.append((self.week, l.id))
                if self.mech['revolt'] and self.mech['laws']:
                    recent = {x for (wk, x) in c.beaten if wk >= self.week - 2}
                    if len(recent) >= 3 and not c.revolt:
                        c.revolt = True
                        self.ev('revolt', keeper.id, *list(recent)[:3], weight=2)
                if self.mech['defense_cap'] and c.defenses >= cfg['cap']:
                    self.lose_court(j, 'abdicated')
            else:
                self.take(j, w, l, staked=False)
        elif sieged:
            pass
        elif cfg['mech'].get('belt_last_winner') and not c.fog:
            # doc rule: whoever won the last confirmed match at a court holds it
            if c.holder != w.id:
                self.take(j, w, l if c.holder == l.id else None, staked=False)
        elif c.holder < 0 and not landless:
            c.holder = w.id
            w.taken += 1
            self.ev('claim', w.id)
        # ------------- fealty: a beaten challenger can swear to the winner
        if self.mech['fealty'] and belt_match and c.holder == w.id and l.lord < 0 and l.id != w.id:
            if r.random() < (0.9 if l.strat == 'betrayer' else 0.5 * l.loyalty):
                l.lord = w.id
                self.ev('fealty', l.id, w.id)
        # ------------- banners: losing a staked challenge above your weight costs one
        if self.mech['banners'] and belt_match and l.id != c.holder and w.elo > l.elo + 50:
            l.banners -= 1
            if l.banners <= 0 and not l.merc:
                l.merc = True
                l.m = clip(l.m - 0.03)
                self.ev('mercenary', l.id)
        if self.mech['banners'] and w.merc and l.elo > w.elo + 50:
            w.merc = False
            w.banners = 1
            self.ev('banner_won_back', w.id)
        # ------------- crowns that move on matches
        cv = cfg['crown']
        if cv == 'curse_potato' and self.crown in (w.id, l.id):
            self.set_crown(l.id if self.crown == w.id else w.id, 'passed')
        elif cv == 'wand_relay' and self.crown in (w.id, l.id):
            self.set_crown(l.id if self.crown == w.id else w.id, 'passed')
        elif cv == 'assassin' and self.crown == l.id:
            self.set_crown(w.id, 'assassinated')
        elif cv == 'comet' and j == self.comet:
            self.set_crown(w.id, 'comet')
            self.comet = -1
        elif cv == 'thunderdome' and self.thunder and {w.id, l.id} == set(self.thunder):
            self.set_crown(w.id, 'thunderdome')
            self.thunder = None

    def take(self, j, w, l, staked):
        c = self.courts[j]
        old = c.holder
        if self.mech['banners'] and w.merc:
            # a mercenary can't hold land: it goes to whoever they fight for, or stays open
            c.holder = w.lord if w.lord >= 0 else -1
        else:
            c.holder = w.id
        c.defenses = 0
        c.beaten = []
        c.revolt = False
        w.taken += 1
        if old >= 0:
            o = self.players[old]
            o.last_lost_belt = self.week
            o.m = clip(o.m - 0.05 * o.tilt)
            if self.mech['bounties'] and (o.courts_now >= 2 or o.id == self.crown):
                w.bounties += 1
                w.m = clip(w.m + 0.04)
                self.ev('bounty', w.id, old, weight=2)
            self.ev('belt', w.id, old, weight=2)
        w.m = clip(w.m + 0.05)

    def lose_court(self, j, why):
        c = self.courts[j]
        if c.holder >= 0:
            self.ev(why, c.holder)
        c.holder = -1
        c.defenses = 0
        c.beaten = []
        c.revolt = False

    def set_crown(self, pid, why):
        if pid == self.crown:
            return
        old = self.crown
        self.crown = pid
        if pid >= 0:
            self.players[pid].m = clip(self.players[pid].m + (0.0 if self.cfg['crown'] == 'curse_potato' else 0.05))
            self.ev('crown', pid, old, weight=1)

    # ------------------------------------------------------------------ the crown, at the start of a week
    def crown_week(self):
        cv = self.cfg['crown']
        r = self.rng
        act = self.act()
        if cv == 'none' or not act:
            return
        prev = {p.id: p for p in act}
        if cv == 'rotation':
            self.set_crown(act[self.week % len(act)].id, 'rotation')
        elif cv in ('curse_potato', 'wand_relay', 'assassin'):
            if self.crown < 0 or self.crown not in prev or (self.players[self.crown].week_conf == 0 and self.week > 0):
                self.set_crown(r.choice(act).id, 'dropped')
        elif cv == 'underdog':
            played = [p for p in act if p.week_conf > 0]
            pool = played or act
            self.set_crown(min(pool, key=lambda p: (p.week_w + 0.5) / (p.week_conf + 1) + r.random() * 0.01).id, 'underdog')
        elif cv in ('renown_lottery', 'pity_lottery'):
            sc = self.scores(act)
            lo = min(sc.values())
            if cv == 'renown_lottery':
                wts = {pid: (s - lo) + 1 for pid, s in sc.items()}
            else:
                order = sorted(sc, key=sc.get)
                wts = {pid: (len(order) - i) ** 1.5 for i, pid in enumerate(order)}
            self.set_crown(wpick(r, wts), 'lottery')
        elif cv == 'effort':
            self.set_crown(max(act, key=lambda p: p.week_conf + r.random() * 0.1).id, 'effort')
        elif cv == 'election':
            votes = {}
            for p in act:
                if p.lord >= 0 and self.players[p.lord].active:
                    v = p.lord
                elif self.mech['houses']:
                    mates = [q for q in act if q.house == p.house and q.strat == 'alliance'] or [q for q in act if q.house == p.house]
                    v = max(mates, key=lambda q: q.drama + r.random()).id
                else:
                    v = max(act, key=lambda q: (q.id in p.opps) + r.random()).id
                votes[v] = votes.get(v, 0) + 1 + (1.5 if self.players[v].strat == 'alliance' else 0)
            self.set_crown(max(votes, key=votes.get), 'elected')
        elif cv == 'kingmakers_choice':
            if self.crown < 0 or self.crown not in prev:
                self.set_crown(r.choice(act).id, 'appointed')
            else:
                k = self.players[self.crown]
                if k.strat == 'kingmaker' and k.ally in prev:
                    nxt = k.ally
                else:
                    friends = [q for q in act if q.id in k.opps and q.id != k.id]
                    nxt = (max(friends, key=lambda q: q.lost_to.get(k.id, 0) + r.random()).id if friends else r.choice(act).id)
                self.set_crown(nxt, 'appointed')
        elif cv == 'comet':
            self.comet = r.randrange(len(self.courts))
        elif cv == 'streak':
            self.set_crown(max(act, key=lambda p: p.streak + r.random() * 0.1).id, 'streak')
        elif cv == 'newcomer':
            self.set_crown(max(act, key=lambda p: (p.joined, r.random())).id, 'newcomer')
        elif cv == 'jester':
            sc = self.scores(act)
            self.set_crown(min(sc, key=sc.get), 'jester')
        elif cv == 'thunderdome':
            if len(act) >= 2:
                a, b = r.sample(act, 2)
                self.thunder = (a.id, b.id)
                self.ev('thunderdome', a.id, b.id)

    def scores(self, ps):
        ctx = {'week': self.week, 'house_score': self.house_score}
        f = self.rank['score']
        return {p.id: f(p, ctx) for p in ps}

    # ------------------------------------------------------------------ a week
    def run_week(self):
        r = self.rng
        cfg = self.cfg
        # the crown is decided on last week's results, so it goes before the weekly counters reset
        self.crown_week()
        self.confirmed_week = 0
        self.week_losses = {}
        for p in self.players:
            p.week_conf = p.week_w = p.week_l = 0
            p.week_events = 0
            p.week_atp = 0
        self.god = None
        if self.mech['gods'] and r.random() < 0.35:
            self.god = r.choice(['freeze', 'double', 'chaos', 'harvest'])
            self.ev('god', weight=0)
        act = self.act()
        R = self.rank
        # opportunities to play this week
        slots = []
        for p in act:
            lam = p.freq * (0.3 + p.m)
            lam *= 1 + p.comp * (0.35 * R['vol'] - 0.35 * R['protect'] + 0.15 * R['streak'])
            if self.god == 'double':
                lam *= 1.25
            bump = cfg.get('crown_bump', 1.0)  # 0 turns off every crown's effect on how much people play (assumption under test)
            if self.crown == p.id:
                lam *= 1 + bump * ({'curse_potato': 1.7, 'wand_relay': 0.75}.get(cfg['crown'], 1.15) - 1)
            if cfg['crown'] != 'none' and self.crown >= 0 and self.players[self.crown].active:
                lam *= 1 + 0.03 * bump  # the decree: something to talk about
            if p.strat == 'ghost':
                lam *= 0.6
            slots += [p] * poisson(r, lam)
        r.shuffle(slots)
        played_with = {}
        for p in slots:
            if not p.active:
                continue
            pick = self.choose(p, act)
            if not pick:
                continue
            q, j = pick
            if not q.active or played_with.get((p.id, q.id), 0) >= 2:
                continue
            c = self.courts[j]
            belt = c.holder == q.id
            if self.mech['banners'] and belt and q.elo > p.elo + 50 and p.banners <= 0:
                continue  # no banner left to stake on a challenge above your weight
            if not self.accepts(q, p, belt):
                p.m = clip(p.m - 0.01)
                self.ducks += 1
                if belt and self.mech['duck_rule']:
                    # didn't answer in a week: the belt is stripped and handed over, but nothing got played or logged
                    if r.random() < 0.6:
                        self.take(j, p, q, staked=False)
                        self.ev('duck', p.id, q.id, weight=2)
                continue
            played_with[(p.id, q.id)] = played_with.get((p.id, q.id), 0) + 1
            played_with[(q.id, p.id)] = played_with.get((q.id, p.id), 0) + 1
            self.play(p, q, j)
        self.end_week()

    def end_week(self):
        r = self.rng
        cfg = self.cfg
        act = self.act()
        # betrayals first, so this week's holdings credit whoever holds the land now
        if self.mech['fealty']:
            for p in act:
                if p.lord >= 0 and p.strat == 'betrayer':
                    lord = self.players[p.lord]
                    held = [j for j, c in enumerate(self.courts) if c.holder == lord.id]
                    if len(held) >= 2 or (held and r.random() < 0.15):
                        for j in held[: max(1, len(held) // 2)]:
                            c = self.courts[j]
                            c.holder = p.id
                            c.defenses = 0
                            c.beaten = []
                            c.revolt = False
                        p.betrayals += 1
                        lord.m = clip(lord.m - 0.06 * lord.tilt)
                        p.m = clip(p.m + 0.05)
                        self.ev('betrayal', p.id, lord.id, weight=3)
                        p.lord = -1
                elif p.lord >= 0 and r.random() < 0.03 * (1 - p.loyalty):
                    p.lord = -1
        # holdings and decay
        for p in self.players:
            p.courts_now = 0
        for j, c in enumerate(self.courts):
            if c.holder >= 0:
                h = self.players[c.holder]
                idle = 0 if h.week_conf else h.idle + 1
                # decay: a lord who stops playing (or quit) loses the court. Without decay, land stays with the absent.
                if self.mech['decay'] and (not h.active or idle >= cfg['decay']):
                    self.lose_court(j, 'decayed')
                    continue
                h.courts_now += 1
        for p in act:
            if p.courts_now:
                p.land_weeks += p.courts_now
        # crown time
        if self.crown >= 0 and self.players[self.crown].active:
            self.players[self.crown].crown_weeks += 1
        # houses
        self.house_score = {}
        if self.mech['houses']:
            for p in act:
                self.house_score[p.house] = self.house_score.get(p.house, 0) + p.week_w * 3 + p.week_conf + 2 * p.courts_now
        # jackpot (chaos lottery ranking): a random logger hits it each week
        if self.cfg['ranking'] == 'chaos_lottery':
            loggers = [p for p in act if p.week_conf]
            if loggers:
                r.choice(loggers).jackpot += 150
        # per-player bookkeeping
        for p in act:
            p.atp_week.append(p.week_atp)
            p.form.append(p.week_w - p.week_l)
            p.capped += 100 * min(p.week_w, 2) + 25 * min(p.week_l, 2)
            if p.week_conf:
                p.weeks_logged += 1
                p.streak += 1
                p.best_streak = max(p.best_streak, p.streak)
                p.idle = 0
            else:
                p.streak = 0
                p.idle += 1
        # the visible ranking, and what it does to people. Rankings that depend on derived state update it first.
        n = len(act)
        R = self.rank
        if cfg['ranking'] == 'divisions':
            # promotion and relegation: you are ranked inside a division of similar elo
            byelo = sorted(act, key=lambda p: -p.elo)
            size = max(3, math.ceil(n / 3))
            for i, p in enumerate(byelo):
                p.div = i // size
                p.div_score = p.atp
        if cfg['ranking'] == 'multi_track':
            tracks = [
                {p.id: p.elo for p in act}, {p.id: p.matches for p in act}, {p.id: p.land_weeks for p in act},
                {p.id: p.streak for p in act},
            ]
            pct = {}
            for t in tracks:
                ids = list(t)
                rk = _ranks([-t[i] for i in ids])  # tied scores share an average rank
                for pid, rr in zip(ids, rk):
                    pct[pid] = max(pct.get(pid, 0), 1 - rr / max(1, n - 1))
            for p in act:
                p.best_track = pct[p.id]
        sc = self.scores(act)
        order = sorted(act, key=lambda p: (-sc[p.id], r.random()))
        leader = order[0].id if order else -1
        self.leader_hist.append(leader)
        moves = 0
        ev_week = sum(1 for e in self.events if e[0] == self.week and e[1] != 'god')
        buzz = min(ev_week / max(1, n), 1.0) * (2.0 if self.mech['weekly_show'] else 1.0)
        for i, p in enumerate(order):
            pct = 1 - i / max(1, n - 1)
            if cfg['ranking'] == 'divisions':
                peers = [q for q in order if q.div == p.div]
                k = peers.index(p)
                pct = 1 - k / max(1, len(peers) - 1)
            moves += abs(pct - p.rank_prev)
            dm = 0.0
            # pull back toward how much you just like tennis
            dm += 0.12 * (p.base - p.m)
            if R['visible']:
                shame = cfg.get('shame', 0.04) * p.tilt * (1 - R['soft'])
                if pct < 0.25 and n >= 4:
                    dm -= shame
                if cfg['ranking'] == 'personal_best':
                    dm += 0.01 if p.form[-1:] and p.form[-1] >= 0 else 0
                dm += clip((pct - p.rank_prev) * 0.08, -0.04, 0.04)
            # being in the story, and the group chat buzzing about it
            story = cfg.get('story', 1.0)  # how much being in the story matters (assumption under test)
            dm += story * min(p.week_events, 3) * (0.012 if not self.mech['weekly_show'] else 0.02)
            dm += story * 0.008 * buzz
            if self.mech['weekly_show'] and pct < 0.34 and p.week_conf:
                dm += story * 0.01  # the show tells the comeback story too
            if p.courts_now:
                dm += 0.02 * min(p.courts_now, 2)
            if self.crown == p.id:
                dm += -0.02 if cfg['crown'] == 'curse_potato' else 0.04 if cfg['crown'] == 'jester' else 0.03
            if p.lord >= 0:
                dm += 0.015
            if self.mech['houses']:
                dm += 0.01
            if p.idle >= 2:
                dm -= 0.04
            if p.bullied:
                dm -= 0.05
                p.bullied = False
            # every rule is one more thing to keep in your head
            dm -= cfg['complexity'] * self.n_mech * (1.5 if p.strat in ('casual', 'ghost') else 1.0)
            p.m = clip(p.m + dm + r.gauss(0, 0.02))
            p.rank_prev = pct
        self.rank_moves.append(moves / max(1, n))
        # quitting, and coming back
        for p in act:
            if p.m < cfg['quit_at']:
                p.low += 1
            else:
                p.low = 0
            if p.low >= 2:
                p.active = False
                p.quit_week = self.week
                if p.id == self.crown:
                    p.crowned_quit = True
                self.ev('quit', p.id, weight=0)
        for p in self.players:
            # comebacks start the week after quitting; seeing the show in the group chat helps a little (an assumption)
            if not p.active and 0 <= p.quit_week < self.week and r.random() < 0.02 + (0.02 if self.mech['weekly_show'] else 0):
                p.active = True
                p.m = 0.45
                p.low = 0
                self.ev('returned', p.id, weight=0)
        # recruiting: new people get pulled in
        if len(self.players) < 45:
            for p in self.act():
                rate = 0.006 + (0.06 if p.strat == 'recruiter' else 0)
                if self.mech['pretender_loop']:
                    rate += 0.01 * min(p.week_conf, 3)
                if self.mech['weekly_show']:
                    rate += 0.004 * min(ev_week, 5) / 5
                if r.random() < rate:
                    np_ = self.new_player(self.week, original=False)
                    np_.m = 0.72
                    self.players.append(np_)
                    p.recruits += 1
                    self.ev('recruit', p.id, np_.id)
        self.thunder = None if self.cfg['crown'] == 'thunderdome' else self.thunder
        # weekly metrics
        act2 = self.act()
        self.weekly.append({
            'confirmed': self.confirmed_week,
            'loggers_orig': sum(1 for p in self.players if p.original and p.week_conf > 0),
            'loggers': sum(1 for p in self.players if p.week_conf > 0),
            'active': len(act2),
            'events': ev_week,
            'leader': leader,
        })
        self.week += 1

    def run(self):
        self.ducks = 0
        self.house_score = {}
        for _ in range(self.cfg['weeks']):
            self.run_week()
        return self.summary()

    # ------------------------------------------------------------------ results
    def summary(self):
        W = self.weekly
        n0 = self.cfg['n']
        weeks = len(W)
        first = sum(w['loggers_orig'] for w in W[:2]) / 2
        last = sum(w['loggers_orig'] for w in W[-3:]) / 3
        log_last = sum(w['confirmed'] for w in W[-3:]) / 3 / n0
        log_first = sum(w['confirmed'] for w in W[:2]) / 2 / n0
        # logging retention: half "are the original people still logging", half "is the volume holding up" (end vs start)
        # floors keep a tiny group that barely logged in its first fortnight from dividing by nearly zero
        retention = min(2.0, 0.5 * last / max(1.0, first) + 0.5 * log_last / max(0.1, log_first))
        orig = [p for p in self.players if p.original]
        bottom = sorted(orig, key=lambda p: p.skill)[: max(1, len(orig) // 3)]
        # "quit" = quit at any point in the season, even if they came back later; "inactive" = not playing at the end
        bottom_quit = sum(1 for p in bottom if p.quit_week >= 0) / len(bottom)
        bottom_inactive = sum(1 for p in bottom if not p.active) / len(bottom)
        quit_all = sum(1 for p in orig if p.quit_week >= 0) / len(orig)
        newbies = [p for p in self.players if not p.original]
        growth = sum(1 for p in newbies if p.active and p.weeks_logged >= 2) / n0
        drama = sum(1 for e in self.events if e[1] not in ('god', 'quit', 'returned', 'recruit')) / weeks / n0
        # final visible ranking vs true skill (originals who stuck around half the season)
        sc = self.scores(self.players)
        stay = [p for p in orig if p.weeks_logged >= max(2, weeks // 3)]
        fair = spearman([sc[p.id] for p in stay], [p.skill for p in stay]) if len(stay) >= 4 else 0.0
        leader_changes = sum(1 for a, b in zip(self.leader_hist, self.leader_hist[1:]) if a != b) / max(1, weeks - 1)
        churn = sum(self.rank_moves) / max(1, len(self.rank_moves))
        top = sorted(sc.values(), reverse=True)[:3]
        close = 0.0
        if len(top) >= 2 and top[0] != 0:
            close = clip(1 - (top[0] - top[1]) / (abs(top[0]) + 1e-9))
        # each player's place, for strategy analysis
        everyone = sorted(self.players, key=lambda p: -sc[p.id])
        rank_pct = {p.id: 1 - i / max(1, len(everyone) - 1) for i, p in enumerate(everyone)}
        sk = sorted(self.players, key=lambda p: -p.skill)
        skill_pct = {p.id: 1 - i / max(1, len(sk) - 1) for i, p in enumerate(sk)}
        land_total = sum(p.land_weeks for p in self.players) or 1
        crown_total = sum(p.crown_weeks for p in self.players) or 1
        ps = [{
            's': p.strat, 'o': p.original, 'sk': round(p.skill, 3), 'rp': round(rank_pct[p.id], 3), 'kp': round(skill_pct[p.id], 3),
            'q': not p.active, 'lw': p.land_weeks / land_total, 'cw': p.crown_weeks / crown_total, 'm': p.matches,
            'W': p.W, 'L': p.L, 'un': p.unlogged, 'top': everyone[0].id == p.id, 'b': p.betrayals, 'cq': p.crowned_quit,
        } for p in self.players]
        kinds = {}
        for e in self.events:
            kinds[e[1]] = kinds.get(e[1], 0) + 1
        holders_end = [c.holder for c in self.courts if c.holder >= 0]
        weird = self.weird(sc, everyone, kinds, holders_end)
        return {
            'retention': retention, 'log_first': log_first, 'log_last': log_last, 'bottom_quit': bottom_quit, 'quit_all': quit_all,
            'bottom_inactive': bottom_inactive,
            'growth': growth, 'drama': drama, 'fair': fair, 'leader_changes': leader_changes, 'churn': churn, 'close': close,
            'players': ps, 'events': kinds, 'weeks': weeks, 'ducks': self.ducks,
            'weekly_confirmed': [w['confirmed'] for w in W], 'weekly_active': [w['active'] for w in W],
            'courts': len(self.courts), 'holders_end': holders_end, 'n_end': len(self.act()), 'n_total': len(self.players),
            'unlogged': sum(p.unlogged for p in self.players) / 2, 'confirmed': sum(p.matches for p in self.players) / 2,
            'weird': weird,
        }

    def weird(self, sc, everyone, kinds, holders_end):
        """The strange things that can happen in a season. Each is True or False for this run."""
        P = self.players
        weeks = len(self.weekly)
        orig = [p for p in P if p.original]
        third = sorted(orig, key=lambda p: p.skill)
        bottom = {p.id for p in third[: max(1, len(third) // 3)]}
        top = everyone[0]
        land = sum(p.land_weeks for p in P) or 1
        landlord = max(P, key=lambda p: p.land_weeks)
        king = max(P, key=lambda p: p.crown_weeks)
        per_week = {}
        for (wk, kind, ids) in self.events:
            per_week.setdefault((wk, kind), 0)
            per_week[(wk, kind)] += 1
        late_belts = sum(1 for (wk, kind, ids) in self.events if kind in ('belt', 'claim', 'founded') and wk >= weeks // 2)
        allies = {p.ally for p in P if p.strat == 'kingmaker'}
        W = self.weekly
        grow = sum(w['confirmed'] for w in W[-3:]) / 3 > 1.3 * max(0.5, sum(w['confirmed'] for w in W[:2]) / 2)
        ducks = kinds.get('duck', 0)
        return {
            'loser_monarchy': self.cfg['crown'] != 'none' and king.crown_weeks > 0 and king.id in bottom,
            'frozen_map': late_belts == 0 and len(holders_end) > 0,
            'duck_dynasty': landlord.strat in ('ducker', 'turtle') and landlord.land_weeks / land > 0.35,
            'betrayal_cascade': any(v >= 2 for (wk, kind), v in per_week.items() if kind == 'betrayal'),
            'ghost_kingdom': any(not P[h].active for h in holders_end),
            'recruit_pyramid': sum(1 for p in P if not p.original and p.active) > sum(1 for p in orig if p.active),
            'mercenary_empire': top.strat == 'mercenary',
            'puppet_king': top.id in allies and top.id in bottom,
            'sandbag_heist': top.strat == 'sandbagger',
            'land_monopoly': landlord.land_weeks / land > 0.6,
            'extinction': len(self.act()) < 0.5 * len(P),
            'crown_curse': any(p.crowned_quit for p in P),
            'revolution_loop': kinds.get('revolt', 0) >= max(2, weeks // 3),
            'ghost_champion': not top.active,
            'weakest_wins': top.id in bottom,
            'grinder_throne': top.strat == 'grinder' and top.W < top.L,
            'bully_farm': any(max(p.lost_to.values(), default=0) >= 4 for p in P),
            'logging_boom': grow,
            'forfeit_storm': ducks > 0.2 * max(1, sum(p.matches for p in P) / 2),
            'betrayer_on_top': top.strat == 'betrayer',
        }


def spearman(a, b):
    n = len(a)
    if n < 3:
        return 0.0
    ra = _ranks(a)
    rb = _ranks(b)
    ma = sum(ra) / n
    mb = sum(rb) / n
    num = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    den = math.sqrt(sum((x - ma) ** 2 for x in ra) * sum((y - mb) ** 2 for y in rb))
    return num / den if den else 0.0


def _ranks(v):
    o = sorted(range(len(v)), key=lambda i: v[i])
    r = [0.0] * len(v)
    i = 0
    while i < len(o):
        j = i
        while j + 1 < len(o) and v[o[j + 1]] == v[o[i]]:
            j += 1
        for k in range(i, j + 1):
            r[o[k]] = (i + j) / 2
        i = j + 1
    return r


# ----------------------------------------------------------------------------------------------------------------- scenarios
DEFAULTS = dict(weeks=12, friction=0.012, complexity=0.004, quit_at=0.23, cap=4, decay=2, spread=1.0, sting=0.04)


def goal(s):
    """One number for the real goal: logging that lasts (45), losers who stay (25), new people (15), a story (10), a fair-ish table (5)."""
    return (0.45 * clip(s['retention'], 0, 1.2) / 1.2 + 0.25 * (1 - s['bottom_quit']) + 0.15 * clip(s['growth'] / 0.3)
            + 0.10 * clip(s['drama'] / 0.6) + 0.05 * clip((s['fair'] + 1) / 2))


def random_scenario(rng, i):
    mech = {m: rng.random() < 0.5 for m in MECHS}
    return dict(
        DEFAULTS, id=i, n=rng.randint(6, 30), weeks=rng.choice([8, 12, 16]), mech=mech, crown=rng.choice(CROWNS),
        ranking=rng.choice(list(RANKINGS)), cap=rng.choice([2, 3, 4, 6]), decay=rng.choice([1, 2, 3, 4]),
        spread=rng.choice([0.6, 1.0, 1.4]),
    )


def run_cfg(cfg, seeds):
    out = []
    for s in seeds:
        res = World(cfg, s).run()
        res['goal'] = goal(res)
        out.append(res)
    return out


def mean(xs):
    xs = list(xs)
    return sum(xs) / len(xs) if xs else 0.0


def slim(res):
    """Drop per-player rows for storage, keep the rest."""
    return {k: v for k, v in res.items() if k != 'players'}


def main(quick=False):
    t0 = time.time()
    rng = random.Random(20261020)
    S = 2 if quick else 6
    out = {'meta': {'defaults': DEFAULTS, 'mechs': MECHS, 'crowns': CROWNS, 'rankings': list(RANKINGS), 'strats': STRATS}}

    # 1) 150 scenarios, everything random, 4 seeds each
    scen = [random_scenario(rng, i) for i in range(150)]
    main_runs = []
    strat_rows = []
    for cfg in scen:
        rs = run_cfg(cfg, range(1000 * cfg['id'], 1000 * cfg['id'] + S))
        for r_ in rs:
            for p in r_['players']:
                strat_rows.append(p)
        main_runs.append({'cfg': cfg, 'runs': [slim(x) for x in rs]})
    out['scenarios'] = main_runs
    print(f'scenarios done {time.time() - t0:.0f}s', file=sys.stderr)

    # 2) rankings: every ranking on the same 50 scenarios (mechanics and crown as drawn), 3 seeds
    rank_res = {}
    rank_strat = {}
    base50 = scen[:60]
    for name in RANKINGS:
        rows = []
        srows = []
        for cfg in base50:
            c2 = dict(cfg, ranking=name)
            rs = run_cfg(c2, range(7000 + 100 * cfg['id'], 7000 + 100 * cfg['id'] + (2 if quick else 4)))
            for r_ in rs:
                srows += [(p['s'], p['rp'] - p['kp'], p['top'], p['kp']) for p in r_['players']]
            rows += [slim(x) for x in rs]
        rank_res[name] = rows
        rank_strat[name] = srows
    print(f'rankings done {time.time() - t0:.0f}s', file=sys.stderr)

    # 3) mechanic ablation: 40 base configs, each mechanic flipped off and on, everything else equal (common random numbers)
    abl = {m: [] for m in MECHS}
    pure = {m: [] for m in MECHS}
    bases = []
    for i in range(60):
        b = random_scenario(rng, 1000 + i)
        b['crown'] = 'none'
        b['ranking'] = 'renown_doc'
        bases.append(b)
    for m in MECHS:
        for b in bases:
            seeds = range(9000 + 10 * b['id'], 9000 + 10 * b['id'] + (2 if quick else 4))
            off = run_cfg(dict(b, mech=dict(b['mech'], **{m: False})), seeds)
            on = run_cfg(dict(b, mech=dict(b['mech'], **{m: True})), seeds)
            abl[m].append({k: mean(x[k] for x in on) - mean(x[k] for x in off) for k in ('retention', 'bottom_quit', 'growth', 'drama', 'goal', 'log_last', 'fair')})
            # the same flip with no complexity tax: the mechanic's own effect, if learning it were free
            b0 = dict(b, complexity=0.0, friction=0.0)
            off = run_cfg(dict(b0, mech=dict(b['mech'], **{m: False})), seeds)
            on = run_cfg(dict(b0, mech=dict(b['mech'], **{m: True})), seeds)
            pure[m].append({k: mean(x[k] for x in on) - mean(x[k] for x in off) for k in ('retention', 'bottom_quit', 'growth', 'drama', 'goal')})
    out['ablation'] = abl
    out['ablation_pure'] = pure
    # complexity: everything on vs a lean core, at three friction levels (how sure are we that more rules cost logging?)
    lean = {m: False for m in MECHS}
    full = {m: True for m in MECHS}
    sens = {}
    for cx in (0.0, 0.004, 0.008):
        for fr in (0.0, 0.012, 0.024):
            vals = {}
            for label, mech in (('lean', lean), ('full', full)):
                rs = []
                for b in bases[:20]:
                    rs += run_cfg(dict(b, mech=mech, complexity=cx, friction=fr), range(500 + b['id'], 502 + b['id']))
                vals[label] = {k: mean(x[k] for x in rs) for k in ('retention', 'bottom_quit', 'goal', 'drama')}
            sens[f'{cx}|{fr}'] = vals
    out['complexity'] = sens
    print(f'ablation done {time.time() - t0:.0f}s', file=sys.stderr)

    # 4) crowns: every crown on the same 40 bases (renown_doc ranking), 3 seeds
    crown_res = {}
    crown_players = {}
    for cv in CROWNS:
        rows = []
        prow = []
        for b in bases:
            rs = run_cfg(dict(b, crown=cv), range(11000 + 10 * b['id'], 11000 + 10 * b['id'] + (2 if quick else 4)))
            rows += [slim(x) for x in rs]
            for r_ in rs:
                prow += [(p['s'], p['kp'], p['cw'], p['q'], p['cq']) for p in r_['players']]
        crown_res[cv] = rows
        crown_players[cv] = prow
    out['crowns'] = crown_res
    print(f'crowns done {time.time() - t0:.0f}s', file=sys.stderr)

    # 4b) assumption sensitivity: rerun the verdicts with each load-bearing assumption switched off
    variants = {
        'as built': {},
        'rules cost nothing': {'complexity': 0.0, 'friction': 0.0},
        'no bottom-of-table sting': {'shame': 0.0},
        'no story bonus': {'story': 0.0},
        'crowns do not change play': {'crown_bump': 0.0},
    }
    sb = bases[:30]
    sens2 = {}
    for vn, extra in variants.items():
        mres = {}
        for m in MECHS:
            ds = []
            for b in sb:
                seeds = range(13000 + 10 * b['id'], 13000 + 10 * b['id'] + 2)
                off = run_cfg(dict(b, **extra, mech=dict(b['mech'], **{m: False})), seeds)
                on = run_cfg(dict(b, **extra, mech=dict(b['mech'], **{m: True})), seeds)
                ds.append(mean(x['goal'] for x in on) - mean(x['goal'] for x in off))
            mres[m] = mean(ds)
        cres = {}
        for cv in CROWNS:
            rs = []
            for b in sb:
                rs += run_cfg(dict(b, **extra, crown=cv), range(14000 + 10 * b['id'], 14000 + 10 * b['id'] + 2))
            cres[cv] = mean(x['goal'] for x in rs)
        rres = {}
        for name in RANKINGS:
            rs = []
            for cfg in scen[:30]:
                rs += run_cfg(dict(cfg, **extra, ranking=name), range(15000 + 10 * cfg['id'], 15000 + 10 * cfg['id'] + 2))
            rres[name] = {k: mean(x[k] for x in rs) for k in ('goal', 'retention', 'bottom_quit')}
        sens2[vn] = {'mech': mres, 'crown': cres, 'rank': rres}
        print(f'  sensitivity {vn} {time.time() - t0:.0f}s', file=sys.stderr)
    out['sensitivity'] = sens2

    # 5) strategy head-to-head: one of each strategy at median skill dropped into otherwise random groups
    duel = {s: [] for s in STRATS}
    for i in range(40 if quick else 400):
        b = random_scenario(rng, 3000 + i)
        b['n'] = max(b['n'], len(STRATS))
        b['force'] = {k: s for k, s in enumerate(STRATS)}
        w = World(b, 40000 + i)
        for k in range(len(STRATS)):
            w.players[k].skill = 0.0 + rng.gauss(0, 0.05)
        res = w.run()
        for k, s in enumerate(STRATS):
            p = res['players'][k]
            duel[s].append({'rp': p['rp'], 'top': p['top'], 'lw': p['lw'], 'cw': p['cw'], 'q': p['q'], 'm': p['m'], 'W': p['W'], 'L': p['L']})
    out['duel'] = duel

    # compact strategy table from every player in the 150 scenarios
    agg = {}
    for p in strat_rows:
        a = agg.setdefault(p['s'], {'n': 0, 'lift': 0.0, 'top': 0, 'quit': 0, 'land': 0.0, 'crown': 0.0, 'wins': 0, 'games': 0, 'm': 0, 'un': 0})
        a['n'] += 1
        a['lift'] += p['rp'] - p['kp']
        a['top'] += p['top']
        a['quit'] += p['q']
        a['land'] += p['lw']
        a['crown'] += p['cw']
        a['wins'] += p['W']
        a['games'] += p['W'] + p['L']
        a['m'] += p['m']
        a['un'] += p['un']
    out['strategy'] = agg
    # rankings: per-strategy lift for exploitability
    rx = {}
    for name, rows in rank_strat.items():
        by = {}
        for s, lift, top, kp in rows:
            b_ = by.setdefault(s, [0, 0.0, 0])
            b_[0] += 1
            b_[1] += lift
            b_[2] += top
        rx[name] = {s: {'n': v[0], 'lift': v[1] / v[0], 'top': v[2] / v[0]} for s, v in by.items()}
    out['ranking_runs'] = rank_res
    out['ranking_strat'] = rx
    cp = {}
    for cv, rows in crown_players.items():
        holders = [r_ for r_ in rows if r_[2] > 0]
        cp[cv] = {
            'bottom_share': sum(r_[2] for r_ in rows if r_[1] < 0.34) / max(1e-9, sum(r_[2] for r_ in rows)),
            'top_share': sum(r_[2] for r_ in rows if r_[1] > 0.66) / max(1e-9, sum(r_[2] for r_ in rows)),
            'holder_quit': mean(r_[3] for r_ in holders), 'crowned_quit': mean(r_[4] for r_ in rows),
            'by_strat': {},
        }
        tot = sum(r_[2] for r_ in rows) or 1
        for s in STRATS:
            cp[cv]['by_strat'][s] = sum(r_[2] for r_ in rows if r_[0] == s) / tot
    out['crown_players'] = cp
    out['meta']['seconds'] = time.time() - t0
    return out


if __name__ == '__main__':
    quick = '--quick' in sys.argv
    res = main(quick)
    path = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else 'results.json'
    with open(path, 'w') as f:
        json.dump(res, f)
    print(f"wrote {path} in {res['meta']['seconds']:.0f}s", file=sys.stderr)
