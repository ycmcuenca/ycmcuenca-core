#!/usr/bin/env bash
#
# Checks that the five living documents exist and that each one holds at least
# one Mermaid diagram block (design D4 in
# openspec/changes/living-docs/design.md).
#
# Usage:
#   scripts/docs/check-living-docs.sh
#
# Every failing document is reported before the script exits non-zero:
#   missing: <path>               the file does not exist
#   no mermaid diagram: <path>    no line starts with ```mermaid
# On success it prints `living documents: ok`.
#
# It checks that a diagram block exists, not that the diagram renders. Rendering
# is checked by eye in the pull request's rendered view.

set -euo pipefail

# The five living documents. Keep this list in step with the archive guidance
# in openspec/config.yaml (operations.archive.guidance).
LIVING_DOCUMENTS=(
  docs/ARCHITECTURE.md
  docs/DESIGN.md
  docs/PRODUCT.md
  docs/ROADMAP.md
  docs/USER_JOURNEY.md
)

# Paths are relative to the repository root, so the script works from any
# working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

failed=0

for document in "${LIVING_DOCUMENTS[@]}"; do
  if [[ ! -f "$REPO_ROOT/$document" ]]; then
    printf 'missing: %s\n' "$document"
    failed=1
  elif ! grep -q '^```mermaid' "$REPO_ROOT/$document"; then
    printf 'no mermaid diagram: %s\n' "$document"
    failed=1
  fi
done

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

printf 'living documents: ok\n'
