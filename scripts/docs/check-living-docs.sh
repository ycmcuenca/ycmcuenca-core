#!/usr/bin/env bash
#
# Checks the living documents:
#   - each of the six exists and holds at least one Mermaid diagram block
#     (design D4 in openspec/changes/archive/2026-10-18-living-docs/design.md)
#   - each concept entry in docs/SYSTEM_DESIGN.md has the parts its status
#     requires (design D7 in openspec/changes/archive/2026-10-18-system-design-notebook/design.md)
#   - each relative link and heading anchor in docs/, AGENTS.md and README.md
#     resolves (design D8 in the same file)
#
# Usage:
#   scripts/docs/check-living-docs.sh
#
# Every failure is reported before the script exits non-zero:
#   missing: <path>                          the file does not exist
#   no mermaid diagram: <path>               no line starts with ```mermaid
#   incomplete entry: <heading>: <part>      a notebook entry lacks a part
#   remark-validate-links warnings           a relative link does not resolve
# On success it prints `living documents: ok`.
#
# It checks that a diagram block exists, not that the diagram renders. Rendering
# is checked by eye in the pull request's rendered view. External links are not
# checked, because the network would make the run flaky (design D10).

set -euo pipefail

# The six living documents. Keep this list in step with the archive guidance
# in openspec/config.yaml (operations.archive.guidance).
LIVING_DOCUMENTS=(
  docs/ARCHITECTURE.md
  docs/DESIGN.md
  docs/PRODUCT.md
  docs/ROADMAP.md
  docs/SYSTEM_DESIGN.md
  docs/USER_JOURNEY.md
)
NOTEBOOK=docs/SYSTEM_DESIGN.md
LINKED_DOCUMENTS=(docs AGENTS.md README.md)

# Paths are relative to the repository root, so the script works from any
# working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

failed=0

check_documents_present() {
  local document
  for document in "${LIVING_DOCUMENTS[@]}"; do
    if [[ ! -f "$REPO_ROOT/$document" ]]; then
      printf 'missing: %s\n' "$document"
      failed=1
    elif ! grep -q '^```mermaid' "$REPO_ROOT/$document"; then
      printf 'no mermaid diagram: %s\n' "$document"
      failed=1
    fi
  done
}

# Each `###` heading inside a `## Sprint` section is one entry. Lines inside
# fenced code blocks are skipped, so a heading in an example is not an entry.
# The parts and their labels follow design D1.
check_notebook_entries() {
  [[ -f "$REPO_ROOT/$NOTEBOOK" ]] || return 0
  awk '
    function report(part) {
      printf "incomplete entry: %s: %s\n", heading, part
      incomplete = 1
    }
    function finish_entry() {
      if (heading == "") return
      if (status == "") {
        report("status")
      } else {
        if (!has["what it is"]) report("what it is")
        if (status == "built") {
          if (!has_diagram) report("diagram")
          if (!has["trade-offs"]) report("trade-offs")
          if (!has["how this repository applies it"]) report("how this repository applies it")
          if (!has["what we learned here"]) report("what we learned here")
        }
        if (!has["check yourself"]) report("check yourself")
        if (status == "built" && !has_answer) report("answers")
        if (!has["further reading"] || references < 2 || references > 5) report("further reading")
      }
      heading = ""
    }
    function start_entry(title) {
      heading = title
      status = ""
      split("", has)
      has_diagram = has_answer = references = 0
    }

    /^```/ {
      if (!in_fence && heading != "" && $0 ~ /^```mermaid/) has_diagram = 1
      in_fence = !in_fence
      next
    }
    in_fence { next }

    /^## / { finish_entry(); in_sprint = ($0 ~ /^## Sprint /); next }
    /^### / && in_sprint { finish_entry(); start_entry(substr($0, 5)); next }
    heading == "" { next }

    /^\*\*Status:\*\* built \(S[1-6]\)$/ { status = "built" }
    /^\*\*Status:\*\* planned \(S[1-6]\)$/ { status = "planned" }
    /^\*\*What it is\*\*$/ { has["what it is"] = 1 }
    /^\*\*Trade-offs\*\*$/ { has["trade-offs"] = 1 }
    /^\*\*How this repository applies it\*\*$/ { has["how this repository applies it"] = 1 }
    /^\*\*What we learned here\*\*$/ { has["what we learned here"] = 1 }
    /^\*\*Check yourself\*\*$/ { has["check yourself"] = 1 }
    /^\*\*Further reading\*\*$/ { has["further reading"] = 1 }
    /<details><summary>Answer<\/summary>/ { has_answer = 1 }
    /Read on [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]\.$/ { references++ }

    END { finish_entry(); exit incomplete }
  ' "$REPO_ROOT/$NOTEBOOK" || failed=1
}

# remark-validate-links reads the `origin` remote to know the repository, and
# stops with a terse message without it (design D8).
check_links_resolve() {
  if ! git -C "$REPO_ROOT" remote get-url origin >/dev/null 2>&1; then
    printf 'links not checked: no git remote named origin. Add one with\n'
    printf '  git remote add origin https://github.com/ycmcuenca/ycmcuenca-core.git\n'
    failed=1
    return
  fi
  (
    cd "$REPO_ROOT"
    bunx remark --use remark-validate-links --no-config --no-ignore \
      --no-stdout --frail --quiet --no-color "${LINKED_DOCUMENTS[@]}"
  ) || failed=1
}

check_documents_present
check_notebook_entries
check_links_resolve

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

printf 'living documents: ok\n'
