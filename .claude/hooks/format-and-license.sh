#!/usr/bin/env bash
# PostToolUse hook: after Edit/Write/MultiEdit, run prettier on the touched file
# and re-apply license headers across the project. CI rejects PRs on either
# check failing, so fixing locally avoids a round-trip.
set -euo pipefail

payload=$(cat)

file_path=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)

cd "${CLAUDE_PROJECT_DIR:-.}"

if [[ -n "$file_path" && -f "$file_path" ]]; then
  case "$file_path" in
    *.ts|*.tsx|*.js|*.mjs|*.cjs|*.json|*.md|*.css|*.html|*.yml|*.yaml)
      bunx prettier --write --log-level warn "$file_path" >/dev/null 2>&1 || true
      ;;
  esac
fi

bun scripts/add-license-headers.ts >/dev/null 2>&1 || true

exit 0
