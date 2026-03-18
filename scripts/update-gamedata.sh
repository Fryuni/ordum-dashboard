#!/usr/bin/env bash

# Copyright (C) 2026 Luiz Ferraz
#
# This file is part of Ordum Dashboard.
#
# Ordum Dashboard is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# Ordum Dashboard is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with Ordum Dashboard. If not, see <https://www.gnu.org/licenses/>.

# ═══════════════════════════════════════════════════════════════════════════════
# Update BitCraft Game Data
# ═══════════════════════════════════════════════════════════════════════════════
#
# Downloads the latest game data files from:
#   https://github.com/BitCraftToolBox/BitCraft_GameData/tree/cereal/cs/static
#
# Usage:
#   ./scripts/update-gamedata.sh
#
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

REPO="BitCraftToolBox/BitCraft_GameData"
BRANCH="cereal/cs"
DIR="static"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/gamedata"
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"

# Files needed for the dashboard
FILES=(
  item_desc.json
  cargo_desc.json
  crafting_recipe_desc.json
  building_desc.json
  claim_tech_desc.json
  construction_recipe_desc.json
  extraction_recipe_desc.json
  skill_desc.json
  tool_desc.json
  tool_type_desc.json
  building_claim_desc.json
  item_list_desc.json
  building_type_desc.json
  resource_desc.json
)

mkdir -p "$OUT_DIR"

echo "📦 Updating BitCraft game data..."
echo "   Source: github.com/$REPO (branch: $BRANCH)"
echo "   Target: $OUT_DIR"
echo ""

FAILED=0
for file in "${FILES[@]}"; do
  printf "  %-45s" "$file"
  URL="https://raw.githubusercontent.com/$REPO/$BRANCH/$DIR/$file"
  if curl -sfL "$URL" -o "$OUT_DIR/$file.tmp"; then
    mv "$OUT_DIR/$file.tmp" "$OUT_DIR/$file"
    SIZE=$(wc -c <"$OUT_DIR/$file" | tr -d ' ')
    printf "✅ %s bytes\n" "$SIZE"
  else
    rm -f "$OUT_DIR/$file.tmp"
    printf "❌ failed\n"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
if [ $FAILED -eq 0 ]; then
  echo "✅ All ${#FILES[@]} files updated successfully!"
else
  echo "⚠️  $FAILED file(s) failed to download."
  exit 1
fi

# Write a timestamp
echo "{\"updated_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"source\": \"$REPO\", \"branch\": \"$BRANCH\"}" >"$OUT_DIR/_meta.json"
echo "   Metadata written to $OUT_DIR/_meta.json"

bun run "$SCRIPTS_DIR/preprocess-gamedata.ts" \
  "$OUT_DIR" \
  "$ROOT_DIR/src/common/gamedata/codex.ts"
