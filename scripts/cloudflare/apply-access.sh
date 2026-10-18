#!/usr/bin/env bash
#
# Applies the Cloudflare Access configuration this project relies on, from the
# committed desired state in scripts/cloudflare/access/ (design D5 in
# openspec/changes/archive/2026-10-18-edge-infrastructure/design.md):
#
#   1. the One-time PIN identity provider exists
#   2. the reusable `owner-only` policy matches, with the owner's address
#      filled in from OWNER_EMAIL at run time
#   3. both Access applications exist and match: `admin` protects every URL of
#      the `admin` Worker; `welcome` protects only its preview and version
#      URLs, so production stays public
#   4. `admin`'s AUD is printed and compared with the `ACCESS_AUD` committed
#      in apps/admin/wrangler.jsonc
#
# Usage:
#   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... OWNER_EMAIL=... \
#     scripts/cloudflare/apply-access.sh
#   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... OWNER_EMAIL=... \
#     scripts/cloudflare/apply-access.sh --check
#
# CLOUDFLARE_API_TOKEN is the owner's own Access-admin token, never the deploy
# token and never stored in GitHub (assumption A7). The README, "Cloudflare
# Access", lists its permission groups and the sign-in flow.
#
# Every step compares the current value with the desired one: a step that
# already matches prints `unchanged`, and the others print `updated` (or
# `drifted`, under --check). Applications are upserted by name - `PUT` when
# present, `POST` when absent, never deleted and recreated - so an
# application's AUD stays stable across runs. The owner's address never
# reaches the repository; the AUD is committed by hand (task 5.3).

set -euo pipefail

API_BASE="https://api.cloudflare.com/client/v4"
README_USAGE="usage: CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... OWNER_EMAIL=... $0 [--check]"

mode="apply"
case "${1:-}" in
  --check) mode="check" ;;
  "") ;;
  *)
    printf '%s\n' "$README_USAGE" >&2
    exit 2
    ;;
esac

die() {
  printf '%s\n' "$*" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || die "curl is required"
command -v jq >/dev/null 2>&1 || die "jq is required"
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] || die "the CLOUDFLARE_API_TOKEN variable is required"
[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ] || die "the CLOUDFLARE_ACCOUNT_ID variable is required"
[ -n "${OWNER_EMAIL:-}" ] || die "the OWNER_EMAIL variable is required"

# The address check assembles the at sign from an octal escape on purpose:
# this directory stays free of email-shaped text, so the repository-wide
# address scan stays empty (access-control spec, "Email kept out of the
# repository").
at="$(printf '\100')"
case "$OWNER_EMAIL" in
  ?*"$at"?*.*) ;;
  *) die "OWNER_EMAIL is not an email address" ;;
esac

# Resolved relative to this script, so it works from any working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ACCESS_DIR="$SCRIPT_DIR/access"
ADMIN_CONFIG="$REPO_ROOT/apps/admin/wrangler.jsonc"

# Set when any step differs; only --check turns it into a non-zero exit.
drift_found=0

# handle_step <name> <drift-detail> <apply-function>
# An empty detail means the step already matches. Otherwise the detail names
# exactly what differs: shown (and counted as drift) under --check, applied
# and reported as `updated` otherwise.
handle_step() {
  local name="$1" detail="$2" apply_fn="$3"
  if [ -z "$detail" ]; then
    printf '%s: unchanged\n' "$name"
  elif [ "$mode" = "check" ]; then
    printf '%s: drifted (%s)\n' "$name" "$detail"
    drift_found=1
  else
    "$apply_fn"
    printf '%s: updated (%s)\n' "$name" "$detail"
  fi
}

# api <method> <endpoint> [body]
# Sends one API call and prints the response body. A non-2xx answer - a token
# missing a permission included - stops the script, naming both the endpoint
# and Cloudflare's error text (design D5, "Owner token missing a permission").
# The body travels as an argument (empty for GETs), never through curl's file
# syntax, which keeps the address scan over this directory free of false
# positives.
api() {
  local method="$1" endpoint="$2" body="${3:-}"
  local response status response_body
  response="$(curl -sS --request "$method" \
    --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    --header 'Content-Type: application/json' \
    --data-binary "$body" \
    "$API_BASE$endpoint" --write-out $'\n%{http_code}')" \
    || die "$method $endpoint: no response from Cloudflare (network or DNS)"
  status="${response##*$'\n'}"
  response_body="${response%$'\n'*}"
  case "$status" in
    2??) ;;
    *)
      die "$method $endpoint failed (HTTP $status): $(printf '%s' "$response_body" | jq -c '.errors // .' 2>/dev/null || printf '%s' "$response_body")"
      ;;
  esac
  printf '%s' "$response_body"
}

# canonical_policy <json> / canonical_app <json>
# Keep only the fields this project manages, sorted, so a comparison cannot
# trip over ids, timestamps or API defaults.
canonical_policy() {
  jq -S '{ name, decision, include, session_duration }' <<< "$1"
}

canonical_app() {
  jq -S '{
    type,
    destinations: [.destinations[]? | { type, worker_id }],
    allowed_idps: ([.allowed_idps[]?] | sort),
    policies: ([.policies[]? | { id, precedence }] | sort_by(.precedence))
  }' <<< "$1"
}

# --- 1. One-time PIN identity provider --------------------------------------
# Zero Trust organizations no longer add OTP automatically, so it is created
# here when missing; it is the only sign-in method both applications allow
# (design D5).

desired_identity_provider="$(cat "$ACCESS_DIR/identity-provider.json")"

apply_identity_provider() {
  if [ -z "$idp_id" ]; then
    idp_id="$(api POST "/accounts/$CLOUDFLARE_ACCOUNT_ID/access/identity_providers" "$desired_identity_provider" |
      jq -r '.result.id')"
  else
    api PUT "/accounts/$CLOUDFLARE_ACCOUNT_ID/access/identity_providers/$idp_id" \
      "$desired_identity_provider" >/dev/null
  fi
}

idp_json="$(api GET "/accounts/$CLOUDFLARE_ACCOUNT_ID/access/identity_providers?per_page=100")"
idp_id="$(printf '%s' "$idp_json" | jq -r 'first(.result[]? | select(.type == "onetimepin") | .id) // empty')"
idp_detail=""
if [ -z "$idp_id" ]; then
  idp_detail="not present"
else
  current_idp_name="$(printf '%s' "$idp_json" | jq -r --arg id "$idp_id" 'first(.result[] | select(.id == $id) | .name) // empty')"
  desired_idp_name="$(jq -r '.name' "$ACCESS_DIR/identity-provider.json")"
  if [ "$current_idp_name" != "$desired_idp_name" ]; then
    idp_detail="name: $current_idp_name -> $desired_idp_name"
  fi
fi
handle_step "One-time PIN identity provider" "$idp_detail" apply_identity_provider

# --- 2. The `owner-only` policy ---------------------------------------------
# One reusable policy allows exactly the owner's address, which only exists at
# run time, and sets the 24-hour session duration (assumption A4). Both
# applications link it, so a change reaches both at once.

apply_policy() {
  if [ -z "$policy_id" ]; then
    policy_id="$(api POST "/accounts/$CLOUDFLARE_ACCOUNT_ID/access/policies" "$desired_policy" |
      jq -r '.result.id')"
  else
    api PUT "/accounts/$CLOUDFLARE_ACCOUNT_ID/access/policies/$policy_id" \
      "$desired_policy" >/dev/null
  fi
}

policy_name="owner-only"
desired_policy="$(jq -c --arg owner "$OWNER_EMAIL" '
  walk(if . == "<OWNER_EMAIL>" then $owner else . end)
' "$ACCESS_DIR/policy.json")"
case "$desired_policy" in
  *"$OWNER_EMAIL"*) ;;
  *) die "the resolved $policy_name policy does not contain OWNER_EMAIL; check scripts/cloudflare/access/policy.json" ;;
esac

policies_json="$(api GET "/accounts/$CLOUDFLARE_ACCOUNT_ID/access/policies?per_page=100")"
policy_id="$(printf '%s' "$policies_json" | jq -r --arg name "$policy_name" 'first(.result[]? | select(.name == $name) | .id) // empty')"
policy_detail=""
if [ -z "$policy_id" ]; then
  policy_detail="not present"
else
  current_policy="$(printf '%s' "$policies_json" | jq -c --arg id "$policy_id" '.result[] | select(.id == $id)')"
  if [ "$(canonical_policy "$current_policy")" != "$(canonical_policy "$desired_policy")" ]; then
    policy_detail="differs from scripts/cloudflare/access/policy.json"
  fi
fi
handle_step "$policy_name policy" "$policy_detail" apply_policy

# --- 3. The two Access applications -----------------------------------------
# A `worker` destination follows the `admin` Worker across its production,
# preview and version URLs; `preview_worker` covers only `welcome`'s previews,
# which keeps production public (design D5). Worker tags are looked up by
# name, and every run-time value of the committed template is filled in.

apply_application() {
  if [ -z "$app_id" ]; then
    api POST "/accounts/$CLOUDFLARE_ACCOUNT_ID/access/apps" "$app_body" >/dev/null
  else
    api PUT "/accounts/$CLOUDFLARE_ACCOUNT_ID/access/apps/$app_id" "$app_body" >/dev/null
  fi
}

workers_json="$(api GET "/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts")"
worker_tags="{}"
while IFS= read -r worker_name; do
  worker_tag="$(printf '%s' "$workers_json" | jq -r --arg name "$worker_name" 'first(.result[]? | select(.id == $name) | .tag) // empty')"
  [ -n "$worker_tag" ] ||
    die "the Worker '$worker_name' is not deployed in account $CLOUDFLARE_ACCOUNT_ID; deploy it first (design D5, 'Worker not deployed yet')"
  worker_tags="$(printf '%s' "$worker_tags" | jq -c --arg name "$worker_name" --arg tag "$worker_tag" '. + { ($name): $tag }')"
done <<< "$(jq -r '.[].name' "$ACCESS_DIR/applications.json")"

desired_apps_json="$(jq -c --argjson tags "$worker_tags" --arg idp_id "$idp_id" --arg policy_id "$policy_id" '
  map(
    walk(if . == "<ONETIMEPIN_IDP_ID>" then $idp_id
         elif . == "<OWNER_ONLY_POLICY_ID>" then $policy_id
         else . end)
    | .destinations[0].worker_id = $tags[.name]
  )
' "$ACCESS_DIR/applications.json")"
if printf '%s' "$desired_apps_json" | grep -q '<[A-Z_]*>'; then
  die "scripts/cloudflare/access/applications.json still has an unfilled placeholder"
fi

apps_json="$(api GET "/accounts/$CLOUDFLARE_ACCOUNT_ID/access/apps?per_page=100")"
while IFS= read -r app_name; do
  app_body="$(jq -c --arg name "$app_name" '.[] | select(.name == $name)' <<< "$desired_apps_json")"
  app_id="$(printf '%s' "$apps_json" | jq -r --arg name "$app_name" 'first(.result[]? | select(.name == $name) | .id) // empty')"
  app_detail=""
  if [ -z "$app_id" ]; then
    app_detail="not present"
  else
    current_app="$(printf '%s' "$apps_json" | jq -c --arg id "$app_id" '.result[] | select(.id == $id)')"
    if [ "$(canonical_app "$current_app")" != "$(canonical_app "$app_body")" ]; then
      app_detail="differs from scripts/cloudflare/access/applications.json"
    fi
  fi
  handle_step "Access application '$app_name'" "$app_detail" apply_application
done <<< "$(jq -r '.[].name' <<< "$desired_apps_json")"

# --- 4. The admin audience (AUD) --------------------------------------------
# `admin` re-verifies every request against this AUD (design D6). The script
# cannot change a committed file, so a mismatch is reported here and committed
# by hand (task 5.3); the next run then reports it unchanged.

apps_json="$(api GET "/accounts/$CLOUDFLARE_ACCOUNT_ID/access/apps?per_page=100")"
admin_aud="$(printf '%s' "$apps_json" | jq -r 'first(.result[]? | select(.name == "admin") | .aud) // empty')"
printf 'admin application AUD: %s\n' "${admin_aud:-none}"
committed_aud="$(
  grep -o '"ACCESS_AUD"[[:space:]]*:[[:space:]]*"[^"]*"' "$ADMIN_CONFIG" |
    cut -d'"' -f4 |
    sed -n '1p' || true
)"
if [ -z "$admin_aud" ]; then
  printf '%s\n' 'ACCESS_AUD: cannot compare yet (no Access application named "admin")'
  drift_found=1
elif [ "$committed_aud" = "$admin_aud" ]; then
  printf '%s\n' 'ACCESS_AUD: unchanged'
elif [ "$mode" = "check" ]; then
  printf 'ACCESS_AUD: drifted (committed %s, the application has %s)\n' "${committed_aud:-empty}" "$admin_aud"
  drift_found=1
else
  printf 'ACCESS_AUD: the application has %s; commit it as ACCESS_AUD in apps/admin/wrangler.jsonc, then redeploy admin\n' "$admin_aud"
fi

# --- Result -----------------------------------------------------------------

if [ "$mode" = "check" ]; then
  if [ "$drift_found" -ne 0 ]; then
    printf '\n%s\n' "Drift found: re-run without --check to update (the AUD line is committed by hand)." >&2
    exit 1
  fi
  printf '\n%s\n' "Everything matches the committed settings."
fi
