# Tasks

## 1. Living-documents check in CI

- [x] 1.1 Write `scripts/docs/check-living-docs.sh` per design D4: bash, `set -euo pipefail`, the five paths listed once with a comment pointing at the archive guidance in `openspec/config.yaml`, every failure reported before a non-zero exit, `living documents: ok` on success. Verify `shellcheck scripts/docs/check-living-docs.sh` passes, and that running it on the current tree exits non-zero and names exactly `docs/ARCHITECTURE.md`, `docs/DESIGN.md`, `docs/PRODUCT.md` and `docs/USER_JOURNEY.md` as missing
- [x] 1.2 Add the step `Check living documents` (`scripts/docs/check-living-docs.sh`) to the `specs` job in `.github/workflows/ci.yml` after `Validate specs`, with a comment citing design D4. Verify locally that actionlint 1.7.12 (`docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:1.7.12`) and `uvx zizmor@1.31.1 .github/workflows` report no findings, and that `ci-ok`'s `needs` list is unchanged

## 2. Architecture and roadmap

- [x] 2.1 Write `docs/ARCHITECTURE.md` per design D1–D3: an opening paragraph naming what it covers and which documents cover neighboring topics, the master `flowchart` (built `classDef` solid, planned dashed with `-.->` links, a legend, each planned node labelled with its sprint or change), the delivery-pipeline `flowchart`, the workspace layout, and the planned read path (C5, C8, C10) and write path (C3, C4), with decisions cited as `([ID](DECISIONS.md#section))`. Verify every element drawn solid exists in the repository (paths checked with `ls`, workflows with `ls .github/workflows`). Verify every planned element names a change or sprint that appears in `docs/ROADMAP.md`, and that deployment, Access, observability and security headers are drawn planned with the label `edge-infrastructure` (assumption A5)
- [x] 2.2 Update `docs/ROADMAP.md`: add `classDef proposed` and `classDef inProgress` styles so every status in the vocabulary has a style (planned keeps the dashed stroke), style the `edge-infrastructure` and `living-docs` nodes with the status their table rows show at that moment, and add a one-line pointer to the other living documents under the intro. Verify each status in the "Status vocabulary" table has exactly one `classDef`, and that the plan content is otherwise unchanged (`git diff docs/ROADMAP.md` shows only those edits and this change's status row)

## 3. Product, journeys and design

- [x] 3.1 Write `docs/PRODUCT.md` per design D1: purpose, the three audiences (recruiters and hiring managers, prospective clients, developer peers) and what each comes for, the owner as the only editor, goals, non-goals citing A1 and A3, locales citing L1 and L3, and success measured by the roadmap's exit criteria (A6). Include an audience-to-site-area `flowchart`. Verify every requirement scenario of "Product document" in `specs/project-documentation/spec.md` is answered by a section of the document
- [x] 3.2 Write `docs/USER_JOURNEY.md` per design D1–D2: one Mermaid `journey` and one step table for each audience in PRODUCT.md, plus the owner's write → preview → publish → live journey. Each step is marked `today` or `planned (S<n>)`, and scores follow assumption A4. Verify every audience named in PRODUCT.md has a journey, and that every `planned (S<n>)` step matches the sprint ROADMAP.md gives that capability
- [x] 3.3 Write `docs/DESIGN.md` per design D1: principles, the WCAG 2.2 AA target (Q3), Latin Extended-A glyph coverage (L6), the token-layer `flowchart` (planned layers dashed, labelled S2 and S5 per Q2), the current visual state, and a table of open design choices with the sprint that decides each. Verify the current-state section matches what `bun run dev` shows on <http://localhost:5173> and <http://localhost:5174>

## 4. Agent entry point and README

- [x] 4.1 Write `AGENTS.md` at the repository root per design D5 (roughly 60–100 lines, links rather than copies). Verify every relative link resolves, and that no sentence from the `rules` or `context` blocks of `openspec/config.yaml` appears verbatim in it (`grep -F` over each rule line returns nothing)
- [x] 4.2 Verify that both agents load `AGENTS.md` in this repository: start an OpenCode session and a Claude Code session (v2.1.277 or later) at the root, and confirm in each that the project instructions list `AGENTS.md` (OpenCode's loaded instructions; Claude Code's `/context` or "Project instructions" setting). If Claude Code does not load it, stop and ask the owner whether to add a `CLAUDE.md` containing only `@AGENTS.md` (design D5 open question)
- [x] 4.3 Add the `## Documentation` section to `README.md` per design D6 and remove the "Full documentation … arrives with the `living-docs` change" maintenance note. Verify the section links all five living documents, `docs/DECISIONS.md` and `AGENTS.md`, and that each link resolves

## 5. Integration verification

- [x] 5.1 Check every relative link and anchor in `docs/*.md`, `AGENTS.md` and `README.md` (a small loop over the Markdown link targets, with each anchor compared against the target file's headings in GitHub's slug form). Verify there are no broken targets
- [x] 5.2 Run `scripts/docs/check-living-docs.sh` and verify it prints `living documents: ok`. On a local throwaway branch, delete `docs/PRODUCT.md` and remove the Mermaid block from `docs/DESIGN.md`, then verify the script exits non-zero and names both files. Delete the branch
- [ ] 5.3 Open the pull request, then verify in GitHub's rendered view that every Mermaid diagram in the five living documents renders without an error, in both light and dark themes, and that planned elements are visibly dashed. Record any diagram that needed changes
- [ ] 5.4 **Owner task:** review the wording of `docs/PRODUCT.md` and `docs/USER_JOURNEY.md` on the pull request (audiences, goals, non-goals, journeys). Verify by an explicit approval comment from the owner on the pull request before merging
- [ ] 5.5 Run the local CI equivalent (`bun install --frozen-lockfile`, `bun run format`, `bun run lint`, `bun run check`, `bun run build`, `bun run test`, `bun run test:e2e`, `bunx openspec validate --all --strict --no-interactive`, `scripts/docs/check-living-docs.sh`, actionlint and zizmor), then verify all pass, `openspec validate living-docs --strict` passes, and `ci-ok` is green on the pull request

## Workflow follow-up

- Set this change's row in `docs/ROADMAP.md` to `in progress` when implementation starts, and to `merged` once the PR lands.
- Commit through `/git` and ship through `/ship`. No release PR follows, because nothing under `apps/` changes.
- Archive: set the row to `archived`. This is the first archive with living documents to sync. Review all five, and update any that this change's final state affects.
- On archive, change the design citations in `.github/workflows/ci.yml` (the `Check living documents` step) and `scripts/docs/check-living-docs.sh` to `openspec/changes/archive/<date>-living-docs/design.md`.
- Next change: `edge-infrastructure`. Its archive turns deployment, Access, observability and security headers solid in ARCHITECTURE.md.
