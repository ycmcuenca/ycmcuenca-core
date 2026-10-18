#!/usr/bin/env bash
#
# Applies the GitHub repository settings this project relies on, from the
# committed sources of truth (design D9 in
# openspec/changes/archive/2026-10-18-ci-release-pipeline/design.md):
#
#   1. repository merge settings: rebase merging only, merged branches deleted
#   2. Actions permissions: enabled, all actions allowed, SHA pinning required;
#      the default workflow token is read-only and may create pull requests
#      (release-please needs that for its release pull request)
#   3. vulnerability alerts: on (Renovate turns them into fix(deps) PRs)
#   4. secret scanning and push protection: on (the extra modes stay off, A9)
#   5. CodeQL default setup: code scanning on, GitHub's default query suite
#   6. the `main` ruleset, from .github/rulesets/main.json
#   7. the `production` environment: custom branch policy limited to `main`,
#      and the deploy credential names reported as set or missing
#
# Usage:
#   scripts/github/apply-settings.sh           apply drift (idempotent)
#   scripts/github/apply-settings.sh --check   report drift, change nothing,
#                                              exit non-zero when any exists
#
# Every step compares the current value with the desired one: a step that
# already matches prints `unchanged`, and the others print `updated` (or
# `drifted`, under --check). `gh` must be authenticated as a repository
# admin; these are admin-only settings.

set -euo pipefail

REPO="ycmcuenca/ycmcuenca-core"
RULESET_NAME="main"

README_USAGE="usage: $0 [--check]"

mode="apply"
case "${1:-}" in
  --check) mode="check" ;;
  "") ;;
  *)
    printf '%s\n' "$README_USAGE" >&2
    exit 2
    ;;
esac

# The committed ruleset body, resolved relative to this script so the script
# works from any working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RULESET_FILE="$REPO_ROOT/.github/rulesets/$RULESET_NAME.json"

# Set when any step differs; only --check turns it into a non-zero exit.
drift_found=0

die() {
  printf '%s\n' "$*" >&2
  exit 1
}

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

# --- Admin check ------------------------------------------------------------
# Most of these settings are admin-only, so fail before touching anything.

command -v gh >/dev/null 2>&1 || die "gh (the GitHub CLI) is required"
gh auth status >/dev/null 2>&1 || die "gh is not authenticated; run 'gh auth login' first"
if [ "$(gh api "repos/$REPO" --jq '.permissions.admin')" != "true" ]; then
  die "the authenticated gh user is not an admin of $REPO; these settings are admin-only"
fi

# --- 1. Merge settings ------------------------------------------------------
# Rebase merging only and delete merged head branches (D9). `-F` sends real
# booleans.

apply_merge_settings() {
  gh api --method PATCH "repos/$REPO" \
    -F allow_rebase_merge=true \
    -F allow_squash_merge=false \
    -F allow_merge_commit=false \
    -F delete_branch_on_merge=true >/dev/null
}

merge_detail=""
repo_json="$(gh api "repos/$REPO")"
for field in allow_rebase_merge allow_squash_merge allow_merge_commit delete_branch_on_merge; do
  case "$field" in
    allow_rebase_merge | delete_branch_on_merge) desired="true" ;;
    *) desired="false" ;;
  esac
  current="$(printf '%s' "$repo_json" | jq -r ".$field")"
  if [ "$current" != "$desired" ]; then
    merge_detail="${merge_detail}${merge_detail:+; }$field: $current -> $desired"
  fi
done
handle_step "merge settings" "$merge_detail" apply_merge_settings

# --- 2. Actions permissions -------------------------------------------------
# Actions enabled, all actions allowed, but every `uses:` reference must be a
# full commit SHA, enforced by the platform as well as by CI (D9, D10).

apply_actions_permissions() {
  gh api --method PUT "repos/$REPO/actions/permissions" \
    -F enabled=true \
    -f allowed_actions=all \
    -F sha_pinning_required=true >/dev/null
}

actions_detail=""
actions_json="$(gh api "repos/$REPO/actions/permissions")"
for field in enabled allowed_actions sha_pinning_required; do
  case "$field" in
    allowed_actions) desired="all" ;;
    *) desired="true" ;;
  esac
  current="$(printf '%s' "$actions_json" | jq -r ".$field")"
  if [ "$current" != "$desired" ]; then
    actions_detail="${actions_detail}${actions_detail:+; }$field: $current -> $desired"
  fi
done
handle_step "actions permissions" "$actions_detail" apply_actions_permissions

# The token every workflow starts from: read-only, and allowed to create pull
# requests, which release-please needs for its release pull request. The first
# release needed the gate enabled by hand before that request could open; the
# script now manages it.

apply_workflow_permissions() {
  gh api --method PUT "repos/$REPO/actions/permissions/workflow" \
    -f default_workflow_permissions=read \
    -F can_approve_pull_request_reviews=true >/dev/null
}

workflow_detail=""
workflow_json="$(gh api "repos/$REPO/actions/permissions/workflow")"
for field in default_workflow_permissions can_approve_pull_request_reviews; do
  case "$field" in
    default_workflow_permissions) desired="read" ;;
    *) desired="true" ;;
  esac
  current="$(printf '%s' "$workflow_json" | jq -r ".$field")"
  if [ "$current" != "$desired" ]; then
    workflow_detail="${workflow_detail}${workflow_detail:+; }$field: $current -> $desired"
  fi
done
handle_step "workflow permissions" "$workflow_detail" apply_workflow_permissions

# --- 3. Vulnerability alerts ------------------------------------------------
# Dependabot vulnerability alerts feed Renovate's `vulnerabilityAlerts` (D11);
# Dependabot's own security updates stay off. The endpoint answers 204 when
# the alerts are on and 404 when they are off. gh prints the response status
# line even for the 404; anything that is neither 204 nor 404 - a network or
# auth failure - is an error, never "off".

apply_vulnerability_alerts() {
  gh api --method PUT "repos/$REPO/vulnerability-alerts" >/dev/null
}

vulnerability_detail=""
vuln_probe="$(gh api -i "repos/$REPO/vulnerability-alerts" 2>&1 || true)"
vuln_status="$(printf '%s\n' "$vuln_probe" | awk '/^HTTP\// { print $2; exit }')"
case "$vuln_status" in
  204) ;;
  404) vulnerability_detail="disabled" ;;
  *)
    die "vulnerability alerts check failed (HTTP '${vuln_status:-no response}')" \
      "only a 404 means the alerts are off, so this is an error"
    ;;
esac
handle_step "vulnerability alerts" "$vulnerability_detail" apply_vulnerability_alerts

# --- 4. Secret scanning and push protection --------------------------------
# The repository is public, so credentials must never reach its history:
# secret scanning finds them, push protection blocks them before they are
# pushed. Only these two are managed (A9 keeps the non-provider patterns
# and the validity checks off).

apply_secret_scanning() {
  gh api --method PATCH "repos/$REPO" --input - >/dev/null <<'JSON'
{
  "security_and_analysis": {
    "secret_scanning": { "status": "enabled" },
    "secret_scanning_push_protection": { "status": "enabled" }
  }
}
JSON
}

secret_scanning_detail=""
security_and_analysis_json="$(gh api "repos/$REPO" --jq '.security_and_analysis')"
for feature in secret_scanning secret_scanning_push_protection; do
  current="$(printf '%s' "$security_and_analysis_json" | jq -r ".${feature}.status // \"unknown\"")"
  if [ "$current" != "enabled" ]; then
    secret_scanning_detail="${secret_scanning_detail}${secret_scanning_detail:+; }$feature: $current -> enabled"
  fi
done
handle_step "secret scanning and push protection" "$secret_scanning_detail" apply_secret_scanning

# --- 5. CodeQL default setup ------------------------------------------------
# Code scanning on, with GitHub's default query suite and its choice of
# languages (D12). Not a required check: findings are triaged, not
# merge-blocking.

apply_code_scanning() {
  gh api --method PATCH "repos/$REPO/code-scanning/default-setup" \
    -f state=configured \
    -f query_suite=default >/dev/null
}

code_scanning_detail=""
code_scanning_json="$(gh api "repos/$REPO/code-scanning/default-setup" 2>/dev/null || printf '{}')"
current_state="$(printf '%s' "$code_scanning_json" | jq -r '.state // "unknown"')"
if [ "$current_state" != "configured" ]; then
  code_scanning_detail="state: $current_state -> configured"
else
  current_suite="$(printf '%s' "$code_scanning_json" | jq -r '.query_suite // "unknown"')"
  if [ "$current_suite" != "default" ]; then
    code_scanning_detail="query_suite: $current_suite -> default"
  fi
fi
handle_step "code scanning default setup" "$code_scanning_detail" apply_code_scanning

# --- 6. The `main` ruleset --------------------------------------------------
# Upsert by name: PUT when it exists, POST when it does not (D9). The
# comparison keeps only the fields the committed file defines - and, per
# rule, only the parameters the file sets - dropping everything the API adds
# (ids, URLs, timestamps, defaulted parameters) - but it compares the sorted
# list of rule types in full, so a rule added outside the committed file is
# drift. An applied ruleset therefore compares equal and a re-run changes
# nothing.

canonical_ruleset() { # canonical_ruleset <json> <desired-json>
  jq -S --argjson desired "$2" '
    {
      name: .name,
      target: .target,
      enforcement: .enforcement,
      bypass_actors: .bypass_actors,
      conditions: (.conditions | .ref_name.exclude = (.ref_name.exclude // [])),
      rules: (
        [
          $desired.rules[] as $desired_rule |
          (.rules[] | select(.type == $desired_rule.type)) as $current_rule |
          {
            type: $current_rule.type,
            parameters: (
              ($current_rule.parameters // {}) as $current_parameters |
              ($desired_rule.parameters // {}) as $desired_parameters |
              $current_parameters |
              with_entries(select(.key as $key | $desired_parameters | has($key)))
            )
          }
        ] | sort_by(.type)
      ),
      rule_types: ([.rules[].type] | sort)
    }
  ' <<< "$1"
}

apply_ruleset() {
  if [ -n "$ruleset_id" ]; then
    gh api --method PUT "repos/$REPO/rulesets/$ruleset_id" --input "$RULESET_FILE" >/dev/null
  else
    gh api --method POST "repos/$REPO/rulesets" --input "$RULESET_FILE" >/dev/null
  fi
}

ruleset_id="$(gh api --paginate "repos/$REPO/rulesets" \
  --jq ".[] | select(.name == \"$RULESET_NAME\") | .id" | sed -n '1p')"
ruleset_detail=""
if [ -z "$ruleset_id" ]; then
  ruleset_detail="not present"
else
  current_ruleset="$(gh api "repos/$REPO/rulesets/$ruleset_id")"
  if [ "$(canonical_ruleset "$current_ruleset" "$(cat "$RULESET_FILE")")" != \
    "$(canonical_ruleset "$(cat "$RULESET_FILE")" "$(cat "$RULESET_FILE")")" ]; then
    ruleset_detail="differs from .github/rulesets/$RULESET_NAME.json"
  fi
fi
handle_step "$RULESET_NAME ruleset" "$ruleset_detail" apply_ruleset

# --- 7. The `production` environment ----------------------------------------
# The deploy job runs in this environment, so the Cloudflare credentials are
# scoped to it and only `main` may use them (design D3 in
# openspec/changes/archive/2026-10-18-edge-infrastructure/design.md). The environment is
# upserted, never recreated, and its branch policies converge to exactly
# `main`. A missing credential can only be reported by name - the script
# cannot set the secret's value - so it counts as drift under --check and
# stays a note otherwise (the owner sets it once).

ENVIRONMENT_NAME="production"

apply_environment() {
  gh api --method PUT "repos/$REPO/environments/$ENVIRONMENT_NAME" --input - >/dev/null <<'JSON'
{
  "deployment_branch_policy": {
    "protected_branches": false,
    "custom_branch_policies": true
  }
}
JSON
  if [ -z "$main_policy_id" ]; then
    gh api --method POST "repos/$REPO/environments/$ENVIRONMENT_NAME/deployment-branch-policies" \
      -f name=main -f type=branch >/dev/null
  fi
  while IFS=$'\t' read -r policy_id policy_name; do
    if [ -n "$policy_id" ] && [ "$policy_name" != "main" ]; then
      gh api --method DELETE "repos/$REPO/environments/$ENVIRONMENT_NAME/deployment-branch-policies/$policy_id" >/dev/null
    fi
  done <<< "$branch_policies_tsv"
}

environment_detail=""
main_policy_id=""
branch_policies_tsv=""
# gh prints the 404's JSON body even though the call failed, so the absence
# of the environment is a status check, never an empty response (step 3 uses
# the same probe).
environment_probe="$(gh api -i "repos/$REPO/environments/$ENVIRONMENT_NAME" 2>&1 || true)"
environment_status="$(printf '%s\n' "$environment_probe" | awk '/^HTTP\// { print $2; exit }')"
case "$environment_status" in
  200)
    environment_json="$(gh api "repos/$REPO/environments/$ENVIRONMENT_NAME")"
    branch_policies_json="$(gh api "repos/$REPO/environments/$ENVIRONMENT_NAME/deployment-branch-policies")"
    branch_policies_tsv="$(printf '%s' "$branch_policies_json" | jq -r '.branch_policies[]? | "\(.id)\t\(.name)"')"
    main_policy_id="$(printf '%s' "$branch_policies_tsv" | awk -F'\t' '$2 == "main" { print $1; exit }')"
    policy_names="$(printf '%s' "$branch_policies_tsv" | cut -f2 | paste -sd, -)"
    if [ "$policy_names" != "main" ]; then
      environment_detail="branch policies: ${policy_names:-none} -> main"
    fi
    policy_mode="$(printf '%s' "$environment_json" | jq -r '
      .deployment_branch_policy as $policy |
      if $policy == null then "all branches"
      elif $policy.protected_branches == true then "protected branches"
      elif $policy.custom_branch_policies == true then "custom"
      else "none" end')"
    if [ "$policy_mode" != "custom" ]; then
      environment_detail="${environment_detail}${environment_detail:+; }branch policy mode: $policy_mode -> custom"
    fi
    ;;
  404)
    environment_detail="not present"
    ;;
  *)
    die "environment check failed (HTTP '${environment_status:-no response}')" \
      "only a 404 means the environment does not exist, so this is an error"
    ;;
esac
handle_step "$ENVIRONMENT_NAME environment" "$environment_detail" apply_environment

# Names only, never values: the API returns secret names and variable names
# (with values), so naming a missing one cannot leak anything. Without the
# environment, neither can exist.
if [ "$environment_detail" = "not present" ]; then
  environment_secret_names=""
  environment_variable_names=""
else
  environment_secret_names="$(gh api "repos/$REPO/environments/$ENVIRONMENT_NAME/secrets" --jq '.secrets[].name')"
  environment_variable_names="$(gh api "repos/$REPO/environments/$ENVIRONMENT_NAME/variables" --jq '.variables[].name')"
fi
credentials_detail=""
if ! grep -qx 'CLOUDFLARE_API_TOKEN' <<< "$environment_secret_names"; then
  credentials_detail="CLOUDFLARE_API_TOKEN (secret) not set"
fi
if ! grep -qx 'CLOUDFLARE_ACCOUNT_ID' <<< "$environment_variable_names"; then
  credentials_detail="${credentials_detail}${credentials_detail:+; }CLOUDFLARE_ACCOUNT_ID (variable) not set"
fi
if [ -z "$credentials_detail" ]; then
  printf '%s: unchanged\n' "$ENVIRONMENT_NAME credentials"
elif [ "$mode" = "check" ]; then
  printf '%s: drifted (%s)\n' "$ENVIRONMENT_NAME credentials" "$credentials_detail"
  drift_found=1
else
  printf '%s: missing (%s); set them by hand (see README, "Deploying")\n' \
    "$ENVIRONMENT_NAME credentials" "$credentials_detail"
fi

# --- Result -----------------------------------------------------------------

if [ "$mode" = "check" ]; then
  if [ "$drift_found" -ne 0 ]; then
    printf '\n%s\n' "Drift found: re-run without --check to update." >&2
    exit 1
  fi
  printf '\n%s\n' "Everything matches the committed settings."
fi
