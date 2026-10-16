#!/usr/bin/env bash
# Regenerates database.types.ts from the linked Supabase project and copies it
# into the app. Run after any schema change.
#
#   ./sync-types.sh            # regenerate + copy
#   ./sync-types.sh --no-gen   # copy the existing types file without regenerating
set -euo pipefail
cd "$(dirname "$0")"

TYPES_FILE="types/database.types.ts"
TARGETS=(
  "../src/types"
)

if [[ "${1:-}" != "--no-gen" ]]; then
  echo "Generating types from linked project (schemas: public, lol)..."
  supabase gen types typescript --linked --schema public --schema lol > "$TYPES_FILE"
fi

for dir in "${TARGETS[@]}"; do
  mkdir -p "$dir"
  cp "$TYPES_FILE" "$dir/database.types.ts"
  echo "  synced -> $dir/database.types.ts"
done

echo "Done. $(grep -c 'Row: {' "$TYPES_FILE") row types synced."
