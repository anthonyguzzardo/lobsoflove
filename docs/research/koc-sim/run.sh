#!/usr/bin/env bash
# One command: sets up Python with numpy and matplotlib (first time only), runs the simulation, rebuilds charts and tables.
set -euo pipefail
cd "$(dirname "$0")"
[ -d .venv ] || { python3 -m venv .venv && .venv/bin/pip install -q numpy matplotlib; }
.venv/bin/python sim.py --out results.json
.venv/bin/python report.py results.json
.venv/bin/python confirm_test.py
echo "Done. Charts, tables.md, digest.json and confirm_test.json are rebuilt. report.md is written by hand: check its numbers against tables.md."
