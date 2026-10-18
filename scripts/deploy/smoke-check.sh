#!/usr/bin/env bash
#
# Verifies a deploy in production (design D11 in
# openspec/changes/edge-infrastructure/design.md). The deploy workflow runs
# it after `wrangler deploy`; the owner also runs it by hand after the
# bootstrap deploy.
#
# Usage:
#   scripts/deploy/smoke-check.sh <welcome|admin> [url]
#
# `url` overrides the production URL, so the check also runs against a local
# server. A fresh deploy takes a few seconds to reach every edge, so the
# check retries for up to 60 seconds and exits non-zero when it still fails.
#
#   welcome: the home page must return 200 and carry the security headers.
#   admin: an anonymous home-page request must be refused or sent to the
#          Access sign-in (302, 401 or 403) and must never serve the app.

set -euo pipefail

README_USAGE="usage: $0 <welcome|admin> [url]"

app="${1:-}"
url="${2:-}"

case "$app" in
  welcome | admin) ;;
  *)
    printf '%s\n' "$README_USAGE" >&2
    exit 2
    ;;
esac

if [ -z "$url" ]; then
  url="https://${app}.ycmcuenca.workers.dev"
fi

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

# Prints one line per problem with the last response; prints nothing when the
# response is healthy.
problems() {
  local status
  status="$(curl -sS -o "$work_dir/body" -D "$work_dir/headers" -w '%{http_code}' "$url/" 2>/dev/null || printf '000')"
  case "$app" in
    welcome) welcome_problems "$status" ;;
    admin) admin_problems "$status" ;;
  esac
}

welcome_problems() {
  local header
  if [ "$1" != "200" ]; then
    printf 'the home page returned %s, want 200\n' "$1"
  fi
  for header in Content-Security-Policy Strict-Transport-Security X-Content-Type-Options; do
    if ! grep -qi "^${header}:" "$work_dir/headers"; then
      printf 'the home page is missing %s\n' "$header"
    fi
  done
}

admin_problems() {
  case "$1" in
    302 | 401 | 403) ;;
    *)
      printf 'the home page returned %s, want 302, 401 or 403\n' "$1"
      ;;
  esac
  if grep -q '<h1>Admin' "$work_dir/body"; then
    printf 'the home page served the admin app to an anonymous request\n'
  fi
}

deadline=$((SECONDS + 60))
while :; do
  found_problems="$(problems)"
  if [ -z "$found_problems" ]; then
    printf '%s ok: %s\n' "$app" "$url"
    exit 0
  fi
  if [ "$SECONDS" -ge "$deadline" ]; then
    printf '%s failed: %s\n' "$app" "$url" >&2
    printf '%s\n' "$found_problems" >&2
    exit 1
  fi
  sleep 5
done
