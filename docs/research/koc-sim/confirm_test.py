"""How much does making the confirm step easier matter, next to any mechanic? Same 60 groups, lean rules, renown_doc ranking."""
import json
import random
import sim

rng = random.Random(77)
bases = [sim.random_scenario(rng, 5000 + i) for i in range(60)]
out = {}
for label, cb, lb in (('as today', 0.0, 0.0), ('confirm +0.10', 0.10, 0.0), ('confirm +0.20', 0.20, 0.0), ('log and confirm +0.15', 0.15, 0.15)):
    rs = []
    for b in bases:
        cfg = dict(b, mech={m: False for m in sim.MECHS}, crown='none', ranking='renown_doc', confirm_boost=cb, log_boost=lb)
        rs += sim.run_cfg(cfg, range(800 + b['id'], 804 + b['id']))
    out[label] = {k: sim.mean(r[k] for r in rs) for k in ('retention', 'bottom_quit', 'bottom_inactive', 'growth', 'goal', 'log_last')}
    out[label]['unlogged_share'] = sim.mean(r['unlogged'] / max(1, r['unlogged'] + r['confirmed']) for r in rs)
json.dump(out, open('confirm_test.json', 'w'), indent=1)
for k, v in out.items():
    print(k, {a: round(b, 3) for a, b in v.items()})
