#!/usr/bin/env bash
# Add, commit, and push everything to main in one go.
# Usage: ./l <commit message>
set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: ./l <commit message>"
  exit 1
fi

cd "$(dirname "$0")"

git add -A
if git diff --cached --quiet; then
  echo "Nothing to commit."
  exit 0
fi

git commit -m "$*"
git push origin main
