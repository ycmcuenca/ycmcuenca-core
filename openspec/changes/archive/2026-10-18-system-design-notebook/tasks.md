# Tasks

## 1. Checks and tooling

- [x] 1.1 Add `remark-cli` `12.0.1` and `remark-validate-links` `13.1.0` as exact-pinned root dev dependencies (design D8). Verify that `package.json` shows both without a range prefix, that `bun install --frozen-lockfile` passes with the updated `bun.lock`, and that no other dependency changed (`git diff package.json`)
- [x] 1.2 Verify the link checker under `bunx`, since the spike ran it only under Node: run `bunx remark --use remark-validate-links --no-config --no-ignore --no-stdout --frail --quiet --no-color docs AGENTS.md README.md` on the current tree and verify it exits 0. Then, on a local throwaway branch, break one cross-file anchor in `docs/ARCHITECTURE.md` (for example `DECISIONS.md#cms-architecturex`) and one file link in `README.md`. Verify the command exits non-zero and names both files and lines. Delete the branch
- [x] 1.3 Extend `scripts/docs/check-living-docs.sh` per design D7 and D8:
  - the six paths, listed once
  - a check for the `origin` remote, which explains how to add one when it is missing
  - the link-check command from 1.2
  - one function that runs the entry-structure `awk` program and skips fenced code blocks
  - every failure reported before the non-zero exit
  - the header comment and the `ci.yml` step comment citing this change's design D7 and D8 as well as living-docs D4

  Verify that `shellcheck scripts/docs/check-living-docs.sh` passes, that the CI step's name and position in the `specs` job are unchanged (`git diff .github/workflows/ci.yml` shows comment lines only), and that on the current tree the script fails and names only `missing: docs/SYSTEM_DESIGN.md`

- [x] 1.4 Prove the structure check's failure modes. On a local throwaway branch, write a minimal `docs/SYSTEM_DESIGN.md` holding:
  - a complete built entry
  - a built entry without "Further reading"
  - a built entry without a Mermaid block
  - a built entry with only one dated reference
  - a built entry that keeps the draft marker (the check must stay silent)
  - an entry with no status line
  - a complete planned entry
  - a `### Heading` inside a fenced code block

  Verify that the script prints exactly one `incomplete entry: <heading>: <part>` line for each faulty entry other than the draft-marker one, and nothing for the complete entries or the fenced heading. Delete the branch

## 2. Notebook skeleton

- [x] 2.1 Create `docs/SYSTEM_DESIGN.md` per design D2:
  - the opening, which names DESIGN.md as the visual-design document
  - the contents list
  - "How to read an entry", following D1
  - the overview `flowchart`, using ROADMAP's `built` and `planned` `classDef`s
  - the six `## Sprint <n>: <name>` sections, each with its `**Study path:**` paragraph
  - "Keeping this document current", with the archive rule, the references policy (D10) and the 3,000-line split rule

  Verify that the sprint names match ROADMAP.md exactly, that `scripts/docs/check-living-docs.sh` passes, and that `bun run lint` reports nothing for the file

## 3. Sprint 1 entries (13, per design D3)

For every entry in this group: follow D1's format. Define each system design term where it first appears in the notebook. Cite decisions, archived designs (`Dn` with its anchor) and code paths as links, without restating their reasoning. Read each reference and record the final address after redirects, with `Read on <date>`. Take library and platform facts from Context7 where it has them. Draft "What we learned here" from that change's design Risks, Open Questions and Assumptions, its follow-up PRs and the commit history, under the draft marker.

- [x] 3.1 Write the delivery entries: monorepo task graphs and caching, trunk-based development with a required-check gate, and release trains from Conventional Commits. Verify that the check passes for these three, and that each `Pattern:` D3 assigns them (ci D1, D4, D8; edge D1) is named in its entry
- [x] 3.2 Write the governance entries: settings as code, supply-chain hardening, reproducible toolchains and least privilege. Verify that the check passes for these four, and that each `Pattern:` D3 assigns them (ci D9, D11; edge D3, D5) is named in its entry
- [x] 3.3 Write the edge entries: zero trust and defense in depth (with a `sequenceDiagram` of the Access JWT check), browser security headers and CSP, testing the production artifact, and structured logs with a correlation id. Verify that the check's only findings for these four are the draft markers, that each `Pattern:` D3 assigns them (edge D6, D7, D9) is named in its entry, and that the Access entry's lessons include the missing `ctx.access` on Workers with static assets (A5)
- [x] 3.4 Write the documentation entries: fitness functions, and documentation as a bounded context. Verify that the check passes for these two, and that living-docs D1, D2 and D4 and this change's D7 and D8 are cited
- [x] 3.5 Self-review S1 against the `system-design-notebook` spec. Verify that every built-entry part appears in D1's order in all 13 entries, and that no sentence of DECISIONS.md appears in the notebook: `grep -F` for each decision bullet's first sentence returns nothing. Verify that every `**Pattern:**` line in the four archived designs maps to exactly one entry, as the D3 table shows

## 4. Planned stubs (24, per design D4)

For every stub: a status line, a one-paragraph definition, 2 to 4 self-check questions and 2 to 5 dated references, read and verified as in group 3. Stubs describe no implementation.

- [x] 4.1 Write the seven S2 stubs. Verify that the check passes for them, and that each heading matches its ROADMAP S2 learning concept
- [x] 4.2 Write the four S3 stubs and the five S4 stubs. "Reconciliation loops and at-most-once claims" links to the S1 "Settings as code" entry. Verify that the check passes for them, and that the back-link resolves
- [x] 4.3 Write the five S5 stubs and the three S6 stubs. "Performance budgets for 3D on the web" links to the S5 "Performance budgets" entry. Verify that the check passes for them, that the contents list and the overview diagram list all 37 entries, and that the notebook is under 3,000 lines (`wc -l`)

## 5. Links from the other documents, and planning rules

- [x] 5.1 Update `docs/ROADMAP.md` per design D6:
  - link every learning concept to its entry
  - extend S1's list to the 13 entries
  - add the quarterly external-link re-check to "Recurring checks" (A5)
  - change S1's exit criteria to six living documents (A9)

  Verify that every ROADMAP learning concept has exactly one notebook entry, comparing the two lists by hand, and that the link check passes

- [x] 5.2 Update `docs/DECISIONS.md`: add P15 with the text in design D6, mark P8 "**Superseded by P15** for the number of documents", and add a `Concept:` link to each decision whose concept has an entry (A6). Verify that `git diff docs/DECISIONS.md` shows only additions plus P8's marker, that the file has at most 300 lines (`wc -l`), and that the link check passes
- [x] 5.3 Update `docs/ARCHITECTURE.md` per design D6: inline concept links in "What exists today", the pipeline steps, and the read and write paths, and a "Concepts" column in the planned-components table. Verify that both Mermaid diagrams are unchanged (`git diff` shows no line inside a ` ```mermaid ` block) and that the link check passes
- [x] 5.4 Update `docs/DESIGN.md`, `docs/USER_JOURNEY.md` and `docs/PRODUCT.md` per design D6:
  - DESIGN.md's opening sentence
  - a new "Study the concepts (today)" journey task and step-table row
  - the notebook in PRODUCT.md's peer row and diagram node

  Verify the spec scenario "Two design documents told apart" against both openings, and that the journey's task and table row agree

- [x] 5.5 Add the notebook to the table in `AGENTS.md` and to the documentation list in `README.md`. Verify that README's section links all six living documents, DECISIONS.md and AGENTS.md (the "Reader finds the documents" scenario), and that the link check passes
- [x] 5.6 Update `openspec/config.yaml` per design D9: the archive guidance lists six documents and gains the concept-entry bullet, and `rules.design` gains the pattern-link bullet. Verify that `bunx openspec instructions design --change system-design-notebook --json` returns the new design rule, that `bunx openspec context --json` still resolves the root, and that `bunx openspec validate --all --strict --no-interactive` passes
- [x] 5.7 Apply the new design rule to this change: link the `**Pattern:**` lines in this change's `design.md` (D1, D2, D3, D6, D7, D8) to their notebook entries. Verify that `bunx openspec validate system-design-notebook --strict` passes, and that each link resolves (`bunx remark --use remark-validate-links --no-config --no-stdout --frail --quiet openspec/changes/system-design-notebook/design.md`)

## 6. Integration verification

- [x] 6.1 Run `scripts/docs/check-living-docs.sh` on the finished tree. Verify that it prints `living documents: ok`, reporting no missing document, no broken link and no missing part
- [x] 6.2 Open the pull request, then verify A4 in the `specs` job log: the link check ran with the `origin` remote, and the step passes
- [x] 6.3 In GitHub's rendered view of `docs/SYSTEM_DESIGN.md`, verify in both light and dark themes that every Mermaid diagram renders without an error, that planned concepts are dashed in the overview, that every `<details>` answer is collapsed until clicked, and that the contents links jump to their headings. Record any diagram that needed a fix
- [ ] 6.4 **Owner task:** rewrite the 13 S1 "What we learned here" parts in your own words, deleting each draft marker, and review the rendered notebook for plain language (ISO 24495-1) and accuracy. Verify that you post an approval comment on the pull request. CI does not check the rewrite **Deferred by the owner on 2026-10-18; not done at archive.**
- [x] 6.5 Run the local CI equivalent from AGENTS.md (`bun install --frozen-lockfile`, format, lint, check, build, test, test:e2e, `bunx openspec validate --all --strict --no-interactive`, `scripts/docs/check-living-docs.sh`), plus actionlint and zizmor on the workflows. Verify that all pass and that `ci-ok` is green on the pull request

## Workflow follow-up

- Set this change's row in `docs/ROADMAP.md` to `in progress` when implementation starts, and to `merged` once the PR lands.
- Commit through `/git` and ship through `/ship`. No release PR follows, because nothing under `apps/` changes.
- Archive:
  - Set the row to `archived`.
  - This is the first archive under the six-document guidance. Review all six documents, and confirm that the "Fitness functions" and "Documentation as a bounded context" entries reflect this change's final state.
  - Point the design citations in `scripts/docs/check-living-docs.sh`, `.github/workflows/ci.yml` and the notebook to `openspec/changes/archive/<date>-system-design-notebook/design.md`.
- Next: the S2 `content-store` proposal follows the new design rule, and probably triggers the DECISIONS.md split into `docs/adr/`.
