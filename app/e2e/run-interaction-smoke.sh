#!/bin/sh
set -eu

preview_url="${POLIMATCH_E2E_URL:-http://127.0.0.1:4177/}"
preview_log="${TMPDIR:-/tmp}/polimatch-sound-preview.log"

npm run preview --prefix app -- --host 127.0.0.1 --port 4177 --strictPort >"$preview_log" 2>&1 &
preview_pid=$!
trap 'kill "$preview_pid" 2>/dev/null || true' EXIT INT TERM

attempt=0
until curl -fs "$preview_url" >/dev/null; do
  attempt=$((attempt + 1))
  if ! kill -0 "$preview_pid" 2>/dev/null || [ "$attempt" -ge 100 ]; then
    printf '%s\n' "A prévia não ficou disponível em $preview_url" >&2
    sed -n '1,120p' "$preview_log" >&2
    exit 1
  fi
  sleep .1
done

for browser in chromium webkit; do
  POLIMATCH_E2E_URL="$preview_url" POLIMATCH_E2E_BROWSER="$browser" node app/e2e/interaction-smoke.mjs
done
