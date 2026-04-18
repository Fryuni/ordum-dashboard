#!/usr/bin/env bash
# PreToolUse hook: block edits to secret/env files and foreign lockfiles.
# CI already rejects foreign lockfiles; env files contain deploy keys.
set -euo pipefail

payload=$(cat)

file_path=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)

if [[ -z "$file_path" ]]; then
  exit 0
fi

name=$(basename "$file_path")

case "$name" in
  .env|.env.*|bun.lock|package-lock.json|yarn.lock|pnpm-lock.yaml)
    echo "Refusing to edit $name via automation. If this change is intentional, ask the user to modify it directly — deploy keys and lockfiles should not be touched by Claude." >&2
    exit 2
    ;;
esac

exit 0
