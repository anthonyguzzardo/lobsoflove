"""
Turns results.json (from sim.py) into charts/*.png, tables.md (every table in the report) and digest.json (the headline numbers).
Run:  python report.py results.json
"""
from __future__ import annotations

import json
import sys

import matplotlib

matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402

INK = '#16181d'
CLAY = '#e2562f'
PAPER = '#efece5'
GREEN = '#3f8f5a'
GREY = '#9a958b'
plt.rcParams.update({
    'font.family': 'monospace', 'font.size': 9, 'axes.facecolor': PAPER, 'figure.facecolor': PAPER, 'axes.edgecolor': INK,
    'axes.labelcolor': INK, 'xtick.color': INK, 'ytick.color': INK, 'axes.titleweight': 'bold', 'axes.titlesize': 11,
})


def mean(xs):
    xs = list(xs)
    return sum(xs) / len(xs) if xs else 0.0


def table(headers, rows, fmt=None):
    out = ['| ' + ' | '.join(headers) + ' |', '|' + '|'.join('---' for _ in headers) + '|']
    for r in rows:
        out.append('| ' + ' | '.join(str(x) for x in r) + ' |')
    return '\n'.join(out)


def pct(x, d=0):
    return f'{100 * x:.{d}f}%'


def sgn(x, d=1, scale=100):
    return f'{x * scale:+.{d}f}'


def save(fig, name):
    fig.tight_layout()
    fig.savefig(f'charts/{name}', dpi=160)
    plt.close(fig)


def main(path):
    d = json.load(open(path))
    T = {}
    D = {}

    # ------------------------------------------------------------------ strategies
    agg = d['strategy']
    duel = d['duel']
    trials = len(next(iter(duel.values())))
    best_of = {s: 0 for s in duel}
    for i in range(trials):
        b = max(duel, key=lambda s: duel[s][i]['rp'])
        best_of[b] += 1
    srows = []
    for s, a in agg.items():
        du = duel[s]
        srows.append(dict(
            s=s, n=a['n'], lift=a['lift'] / a['n'], top=a['top'] / a['n'], quit=a['quit'] / a['n'], land=a['land'] / a['n'],
            crown=a['crown'] / a['n'], wr=a['wins'] / max(1, a['games']), logged=a['m'] / a['n'], unlogged=a['un'] / a['n'],
            d_best=best_of[s] / trials, d_top=mean(x['top'] for x in du), d_rank=mean(x['rp'] for x in du), d_land=mean(x['lw'] for x in du),
            d_crown=mean(x['cw'] for x in du), d_quit=mean(x['q'] for x in du), d_m=mean(x['m'] for x in du),
        ))
    srows.sort(key=lambda r: -r['d_best'])
    n_strats = len(srows)
    T['strategy'] = table(
        ['strategy', 'best of the 18 (fair share 5.6%)', 'avg finish (1=top)', 'land share', 'crown share', 'quit rate', 'matches logged', 'lift over skill (all games)', 'win rate'],
        [[r['s'], pct(r['d_best'], 1), f"{r['d_rank']:.2f}", pct(r['d_land'], 1), pct(r['d_crown'], 1), pct(r['d_quit']), f"{r['d_m']:.1f}",
          sgn(r['lift'], 1) + ' pts', pct(r['wr'])] for r in srows])
    D['strategy'] = srows
    fig, ax = plt.subplots(1, 2, figsize=(11, 5.6))
    ys = [r['s'] for r in srows][::-1]
    ax[0].barh(ys, [100 * r['d_best'] for r in srows][::-1], color=[CLAY if r['d_best'] > 1 / n_strats else GREY for r in srows][::-1])
    ax[0].axvline(100 / n_strats, color=INK, lw=1, ls='--')
    ax[0].set_title('Best finish among the 18 (equal skill, 400 seasons)')
    ax[0].set_xlabel('% of seasons finishing best of the 18 (dashed = fair share)')
    lifts = sorted(srows, key=lambda r: r['lift'])
    ax[1].barh([r['s'] for r in lifts], [100 * r['lift'] for r in lifts], color=[GREEN if r['lift'] > 0 else CLAY for r in lifts])
    ax[1].axvline(0, color=INK, lw=1)
    ax[1].set_title('Finish vs skill, all 900 random seasons')
    ax[1].set_xlabel('percentile points above (right) or below where skill alone puts you')
    save(fig, 'strategy_win_rates.png')
    fig, ax = plt.subplots(figsize=(9, 5.2))
    q = sorted(srows, key=lambda r: r['d_quit'])
    ax.barh([r['s'] for r in q], [100 * r['d_quit'] for r in q], color=[CLAY if r['d_quit'] > 0.25 else INK for r in q])
    ax.set_title('Quit rate by strategy (equal skill)')
    ax.set_xlabel('% who quit before the season ended')
    save(fig, 'strategy_quit.png')

    # ------------------------------------------------------------------ rankings
    rr = d['ranking_runs']
    rx = d['ranking_strat']
    rk = []
    for name, rows in rr.items():
        ex = {s: v for s, v in rx[name].items() if v['n'] >= 150}
        worst = max(ex.items(), key=lambda kv: kv[1]['lift'])
        rk.append(dict(
            name=name, retention=mean(r['retention'] for r in rows), bottom=mean(r['bottom_quit'] for r in rows),
            fair=mean(r['fair'] for r in rows), leader=mean(r['leader_changes'] for r in rows), churn=mean(r['churn'] for r in rows),
            close=mean(r['close'] for r in rows), goal=mean(r['goal'] for r in rows), log_last=mean(r['log_last'] for r in rows),
            exploit=worst[1]['lift'], exploiter=worst[0], quit_all=mean(r['quit_all'] for r in rows),
        ))
    def norm(key, invert=False):
        vals = [r[key] for r in rk]
        lo, hi = min(vals), max(vals)
        for r in rk:
            v = (r[key] - lo) / (hi - lo) if hi > lo else 0.5
            r['n_' + key] = 1 - v if invert else v
    for r in rk:
        r['drama'] = 0.5 * r['leader'] / max(x['leader'] for x in rk) + 0.3 * r['churn'] / max(x['churn'] for x in rk) + 0.2 * r['close']
    norm('retention'); norm('bottom', invert=True); norm('fair'); norm('drama'); norm('exploit', invert=True)
    for r in rk:
        r['score'] = 0.35 * r['n_retention'] + 0.25 * r['n_bottom'] + 0.10 * r['n_fair'] + 0.15 * r['n_drama'] + 0.15 * r['n_exploit']
    rk.sort(key=lambda r: -r['goal'])
    T['rankings'] = table(
        ['#', 'ranking', 'goal score', 'ranking score', 'logging retention', 'bottom third quit', 'fairness (rank vs skill)', 'drama index', 'exploit: best strategy lift', 'who breaks it'],
        [[i + 1, r['name'], f"{100 * r['goal']:.1f}", f"{100 * r['score']:.0f}", f"{r['retention']:.3f}", pct(r['bottom']), f"{r['fair']:+.2f}", f"{r['drama']:.2f}",
          sgn(r['exploit'], 1) + ' pts', r['exploiter']] for i, r in enumerate(rk)])
    D['rankings'] = rk
    fig, ax = plt.subplots(figsize=(9.5, 10))
    norm('goal')
    keys = [('n_retention', 'retention'), ('n_bottom', 'losers stay'), ('n_fair', 'fairness'), ('n_drama', 'drama'), ('n_exploit', 'unexploitable'), ('score', 'ranking score'), ('n_goal', 'GOAL')]
    M = [[r[k] for k, _ in keys] for r in rk]
    im = ax.imshow(M, cmap='RdYlGn', vmin=0, vmax=1, aspect='auto')
    ax.set_xticks(range(len(keys)), [k[1] for k in keys], rotation=30, ha='right')
    ax.set_yticks(range(len(rk)), [f"{i + 1}. {r['name']}" for i, r in enumerate(rk)])
    for i, row in enumerate(M):
        for j, v in enumerate(row):
            ax.text(j, i, f'{100 * v:.0f}', ha='center', va='center', fontsize=7, color=INK)
    ax.set_title(f'{len(rk)} rankings, ordered by the goal score (0-100 per column, best = 100)')
    fig.colorbar(im, ax=ax, fraction=0.03)
    save(fig, 'ranking_scores.png')
    fig, ax = plt.subplots(1, 2, figsize=(12, 7))
    rr2 = sorted(rk, key=lambda r: r['retention'])
    ax[0].barh([r['name'] for r in rr2], [r['retention'] for r in rr2], color=[GREEN if r['retention'] >= sorted(x['retention'] for x in rk)[len(rk) // 2] else CLAY for r in rr2])
    ax[0].set_title('Logging retention (end of season / start)')
    rb = sorted(rk, key=lambda r: -r['bottom'])
    ax[1].barh([r['name'] for r in rb], [100 * r['bottom'] for r in rb], color=[CLAY if r['bottom'] > 0.35 else INK for r in rb])
    ax[1].set_title('% of the weakest third who quit')
    save(fig, 'ranking_retention_bottom.png')

    # ------------------------------------------------------------------ mechanics
    ab = d['ablation']
    pu = d['ablation_pure']
    mk = []
    for m in ab:
        mk.append(dict(
            m=m, ret=mean(r['retention'] for r in ab[m]), bq=mean(r['bottom_quit'] for r in ab[m]), growth=mean(r['growth'] for r in ab[m]),
            drama=mean(r['drama'] for r in ab[m]), goal=mean(r['goal'] for r in ab[m]), log=mean(r['log_last'] for r in ab[m]),
            p_ret=mean(r['retention'] for r in pu[m]), p_bq=mean(r['bottom_quit'] for r in pu[m]), p_goal=mean(r['goal'] for r in pu[m]),
            p_drama=mean(r['drama'] for r in pu[m]),
            hurt=sum(1 for r in ab[m] if r['goal'] < 0) / len(ab[m]),
        ))
    mk.sort(key=lambda r: -r['goal'])
    T['mechanics'] = table(
        ['mechanic', 'goal score', 'logging retention', 'bottom third quit', 'new people kept', 'drama', 'goal if learning it were free', 'retention if free', 'hurts in % of groups'],
        [[r['m'], sgn(r['goal'], 1), sgn(r['ret'], 1), sgn(r['bq'], 1) + ' pts', sgn(r['growth'], 1) + ' per 100', sgn(r['drama'], 2, 1),
          sgn(r['p_goal'], 1), sgn(r['p_ret'], 1), pct(r['hurt'])] for r in mk])
    D['mechanics'] = mk
    fig, ax = plt.subplots(1, 2, figsize=(12, 6))
    o = sorted(mk, key=lambda r: r['ret'])
    y = range(len(o))
    ax[0].barh([i + 0.2 for i in y], [100 * r['ret'] for r in o], height=0.4, color=[GREEN if r['ret'] > 0 else CLAY for r in o], label='as designed (each rule costs a little to learn)')
    ax[0].barh([i - 0.2 for i in y], [100 * r['p_ret'] for r in o], height=0.4, color=GREY, label='if learning it were free')
    ax[0].set_yticks(list(y), [r['m'] for r in o])
    ax[0].axvline(0, color=INK, lw=1)
    ax[0].set_title('Turning a mechanic ON: logging retention')
    ax[0].set_xlabel('change in retention, points (on minus off, same groups)')
    ax[0].legend(fontsize=7, loc='upper left')
    o2 = sorted(mk, key=lambda r: -r['bq'])
    ax[1].barh([r['m'] for r in o2], [100 * r['bq'] for r in o2], color=[CLAY if r['bq'] > 0 else GREEN for r in o2])
    ax[1].axvline(0, color=INK, lw=1)
    ax[1].set_title('Turning a mechanic ON: weakest third quitting')
    ax[1].set_xlabel('change in % of the weakest third who quit (left is better)')
    save(fig, 'mechanic_retention.png')
    fig, ax = plt.subplots(figsize=(9, 6))
    o = sorted(mk, key=lambda r: r['goal'])
    ax.barh([r['m'] for r in o], [100 * r['goal'] for r in o], color=[GREEN if r['goal'] > 0 else CLAY for r in o])
    ax.axvline(0, color=INK, lw=1)
    ax.set_title('Turning a mechanic ON: the goal score (0-100 scale)')
    ax.set_xlabel('change in goal score points')
    save(fig, 'mechanic_goal.png')
    cx = d['complexity']
    rows = []
    for k, v in cx.items():
        c_, f_ = k.split('|')
        rows.append([c_, f_, f"{v['lean']['retention']:.3f}", f"{v['full']['retention']:.3f}", pct(v['lean']['bottom_quit']), pct(v['full']['bottom_quit']),
                     f"{100 * v['lean']['goal']:.1f}", f"{100 * v['full']['goal']:.1f}"])
    T['complexity'] = table(['weekly cost per rule', 'logging friction per rule', 'retention: lean', 'retention: everything on', 'bottom quit: lean', 'bottom quit: everything on', 'goal: lean', 'goal: everything on'], rows)
    D['complexity'] = cx

    # ------------------------------------------------------------------ assumption sensitivity
    sv = d['sensitivity']
    key_m = ['weekly_show', 'belt_last_winner', 'pretender_loop', 'houses', 'fealty', 'laws', 'duck_rule', 'banners', 'gods', 'tribute', 'siege']
    rows = []
    for vn, v in sv.items():
        rows.append([vn] + [sgn(v['mech'][m], 1) for m in key_m])
    T['sens_mech'] = table(['assumption'] + key_m, rows)
    rows = []
    for vn, v in sv.items():
        cr = v['crown']
        top = sorted((c for c in cr if c != 'none'), key=lambda c: -cr[c])[:3]
        worst = min((c for c in cr if c != 'none'), key=lambda c: cr[c])
        rk3 = sorted(v['rank'], key=lambda n: -v['rank'][n]['goal'])[:4]
        rows.append([vn, ', '.join(f"{c} {sgn(cr[c] - cr['none'], 1)}" for c in top), f"{worst} {sgn(cr[worst] - cr['none'], 1)}",
                     ', '.join(f"{n} {100 * v['rank'][n]['goal']:.1f}" for n in rk3),
                     f"{100 * v['rank']['personal_best']['goal']:.1f} / {100 * v['rank']['multi_track']['goal']:.1f} / {100 * v['rank']['renown_doc']['goal']:.1f}"])
    T['sens_other'] = table(['assumption', 'best 3 crowns (vs no crown)', 'worst crown', 'best 4 rankings by goal', 'personal_best / multi_track / renown_doc'], rows)
    D['sensitivity'] = sv

    # ------------------------------------------------------------------ crowns
    cr = d['crowns']
    cp = d['crown_players']
    crw = []
    for c, rows in cr.items():
        bs = cp[c]['by_strat']
        hog = max(bs.items(), key=lambda kv: kv[1]) if c != 'none' else ('-', 0)
        crw.append(dict(
            c=c, ret=mean(r['retention'] for r in rows), bq=mean(r['bottom_quit'] for r in rows), growth=mean(r['growth'] for r in rows),
            drama=mean(r['drama'] for r in rows), goal=mean(r['goal'] for r in rows), bottom_share=cp[c]['bottom_share'],
            top_share=cp[c]['top_share'], hog=hog[0], hog_share=hog[1], holder_quit=cp[c]['holder_quit'],
        ))
    base = next(r for r in crw if r['c'] == 'none')
    crw.sort(key=lambda r: -r['goal'])
    T['crowns'] = table(
        ['crown', 'goal', 'vs no crown', 'logging retention', 'bottom third quit', 'drama', 'crown time to weakest third', 'to strongest third', 'most crowned strategy'],
        [[r['c'], f"{100 * r['goal']:.1f}", sgn(r['goal'] - base['goal'], 1), f"{r['ret']:.3f}", pct(r['bq']), f"{r['drama']:.2f}",
          pct(r['bottom_share']) if r['c'] != 'none' else '-', pct(r['top_share']) if r['c'] != 'none' else '-',
          f"{r['hog']} ({pct(r['hog_share'])})" if r['c'] != 'none' else '-'] for r in crw])
    D['crowns'] = crw
    fig, ax = plt.subplots(1, 2, figsize=(12, 5.5))
    o = sorted(crw, key=lambda r: r['goal'])
    ax[0].barh([r['c'] for r in o], [100 * (r['goal'] - base['goal']) for r in o], color=[GREEN if r['goal'] > base['goal'] else CLAY for r in o])
    ax[0].axvline(0, color=INK, lw=1)
    ax[0].set_title('Crown variants: goal score vs no crown')
    ax[0].set_xlabel('goal score points')
    o = sorted(crw, key=lambda r: r['bq'])
    ax[1].barh([r['c'] for r in o], [100 * r['bq'] for r in o], color=[CLAY if r['bq'] > base['bq'] else INK for r in o])
    ax[1].axvline(100 * base['bq'], color=CLAY, lw=1, ls='--')
    ax[1].set_title('Crown variants: % of weakest third who quit')
    ax[1].set_xlabel('dashed = no crown')
    save(fig, 'crown_variants.png')

    # ------------------------------------------------------------------ weird outcomes
    runs = []
    for sc in d['scenarios']:
        runs += sc['runs']
    for rows in d['ranking_runs'].values():
        runs += rows
    for rows in d['crowns'].values():
        runs += rows
    keys = list(runs[0]['weird'].keys())
    wr = []
    for k in keys:
        yes = [r for r in runs if r['weird'][k]]
        no = [r for r in runs if not r['weird'][k]]
        if not yes:
            wr.append(dict(k=k, freq=0, dgoal=0, dret=0, dbq=0, n=0))
            continue
        wr.append(dict(
            k=k, n=len(yes), freq=len(yes) / len(runs), dgoal=mean(r['goal'] for r in yes) - mean(r['goal'] for r in no),
            dret=mean(r['retention'] for r in yes) - mean(r['retention'] for r in no),
            dbq=mean(r['bottom_quit'] for r in yes) - mean(r['bottom_quit'] for r in no),
        ))
    wr.sort(key=lambda r: r['dgoal'])
    def verdict(r):
        if r['n'] < 60:
            return f"too rare to call ({r['n']} seasons)"
        return 'HURTS' if r['dgoal'] < -0.02 else 'HELPS' if r['dgoal'] > 0.02 else 'neutral'
    T['weird'] = table(
        ['outcome', 'how often', 'seasons', 'goal when it happens', 'retention', 'bottom third quit', 'verdict'],
        [[r['k'], pct(r['freq'], 1), r['n'], sgn(r['dgoal'], 1), sgn(r['dret'], 1), sgn(r['dbq'], 1) + ' pts', verdict(r)] for r in wr])
    D['weird'] = wr
    D['n_runs_weird'] = len(runs)
    fig, ax = plt.subplots(1, 2, figsize=(12, 6))
    o = sorted(wr, key=lambda r: r['freq'])
    ax[0].barh([r['k'] for r in o], [100 * r['freq'] for r in o], color=INK)
    ax[0].set_title('How often each weird outcome shows up')
    ax[0].set_xlabel(f'% of {len(runs)} seasons')
    o = sorted(wr, key=lambda r: r['dgoal'])
    ax[1].barh([r['k'] for r in o], [100 * r['dgoal'] for r in o], color=[GREEN if r['dgoal'] > 0 else CLAY for r in o])
    ax[1].axvline(0, color=INK, lw=1)
    ax[1].set_title('Goal score when it happens vs when it does not')
    ax[1].set_xlabel('goal score points')
    save(fig, 'weird_outcomes.png')

    # ------------------------------------------------------------------ scenarios: size and the 150
    sc = d['scenarios']
    by_n = {}
    for s in sc:
        b = (s['cfg']['n'] - 6) // 6
        by_n.setdefault(b, []).extend(s['runs'])
    rows = []
    for b in sorted(by_n):
        rs = by_n[b]
        rows.append([f'{6 + 6 * b}-{11 + 6 * b}', len(rs), f"{mean(r['retention'] for r in rs):.3f}", pct(mean(r['bottom_quit'] for r in rs)),
                     f"{mean(r['growth'] for r in rs) * 100:.1f}", f"{mean(r['drama'] for r in rs):.2f}", f"{100 * mean(r['goal'] for r in rs):.1f}"])
    T['size'] = table(['group size', 'seasons', 'logging retention', 'bottom third quit', 'new people kept per 100', 'drama', 'goal'], rows)
    allr = [r for s in sc for r in s['runs']]
    nm = [sum(s['cfg']['mech'][m] for m in s['cfg']['mech'] if m != 'belt_last_winner') for s in sc]
    by_m = {}
    for s, k in zip(sc, nm):
        by_m.setdefault(min(k // 3, 5), []).extend(s['runs'])
    rows = []
    for b in sorted(by_m):
        rs = by_m[b]
        rows.append([f'{3 * b}-{3 * b + 2}', len(rs), f"{mean(r['retention'] for r in rs):.3f}", pct(mean(r['bottom_quit'] for r in rs)), f"{100 * mean(r['goal'] for r in rs):.1f}"])
    T['mech_count'] = table(['mechanics switched on', 'seasons', 'logging retention', 'bottom third quit', 'goal'], rows)
    fig, ax = plt.subplots(figsize=(8, 4.5))
    xs = [s['cfg']['n'] for s in sc]
    ysr = [mean(r['goal'] for r in s['runs']) * 100 for s in sc]
    ax.scatter(nm, ysr, c=xs, cmap='viridis', s=26)
    ax.set_xlabel('mechanics switched on')
    ax.set_ylabel('goal score')
    ax.set_title('150 scenarios: more rules, lower goal (color = group size)')
    save(fig, 'scenarios_mechanic_count.png')
    best = sorted(sc, key=lambda s: -mean(r['goal'] for r in s['runs']))
    def desc(s):
        c = s['cfg']
        on = [m for m, v in c['mech'].items() if v]
        return f"n={c['n']}, {c['weeks']} wk, crown={c['crown']}, ranking={c['ranking']}, on: {', '.join(on) if on else 'none'}"
    T['best_worst'] = table(['', 'goal', 'retention', 'bottom quit', 'scenario'],
                            [['best', f"{100 * mean(r['goal'] for r in s['runs']):.1f}", f"{mean(r['retention'] for r in s['runs']):.3f}", pct(mean(r['bottom_quit'] for r in s['runs'])), desc(s)] for s in best[:5]]
                            + [['worst', f"{100 * mean(r['goal'] for r in s['runs']):.1f}", f"{mean(r['retention'] for r in s['runs']):.3f}", pct(mean(r['bottom_quit'] for r in s['runs'])), desc(s)] for s in best[-5:]])
    D['overall'] = {k: mean(r[k] for r in allr) for k in ('retention', 'bottom_quit', 'growth', 'drama', 'goal', 'quit_all', 'log_first', 'log_last')}
    D['n_seasons'] = {'scenarios': len(allr), 'rankings': sum(len(v) for v in d['ranking_runs'].values()), 'crowns': sum(len(v) for v in d['crowns'].values()),
                      'ablation_pairs': sum(len(v) for v in d['ablation'].values()), 'duel': len(next(iter(duel.values())))}
    with open('tables.md', 'w') as f:
        for k, v in T.items():
            f.write(f'<!-- {k} -->\n{v}\n\n')
    with open('digest.json', 'w') as f:
        json.dump(D, f, indent=1, default=float)
    print('ok')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'results.json')
