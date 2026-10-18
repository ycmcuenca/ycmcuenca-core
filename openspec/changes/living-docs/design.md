# Design

## Context

See proposal.md for the motivation, and the specs `project-documentation` and the `ci-checks` delta for the required behavior.

Current state, observed on 2026-10-18:

- `docs/` holds `ROADMAP.md` (sprint plan, status vocabulary, one Mermaid `flowchart` whose `classDef`s cover only `archived`, `merged` and `planned`) and `DECISIONS.md` (decision log by section: Platform and scope, Identity and access, CMS architecture, Publishing workflow, Localization, Media, Integrations and longevity, Quality, Parking lot). Its entries are bullets with bold identifiers such as **C5**, so the stable link targets are the section headings.
- No `ARCHITECTURE.md`, `DESIGN.md`, `PRODUCT.md`, `USER_JOURNEY.md` or `AGENTS.md` exists. The bootstrap design (D-section on project context, A8) promised `AGENTS.md` and the full docs for this change. The README says "Full documentation (architecture, product, roadmap) arrives with the `living-docs` change".
- What is built: the Bun + Turborepo workspace, two hello-world SvelteKit 3 apps on the Cloudflare adapter (unstyled placeholder pages, no bindings, not deployed), shared `@ycmcuenca/tsconfig` and `@ycmcuenca/eslint-config`, the CI workflow with the `ci-ok` gate, release-please, the settings script and ruleset, Renovate and CodeQL. Agent command files exist for both Claude Code (`.claude/`) and OpenCode (`.opencode/`).
- `openspec/config.yaml` archive guidance already names the five living documents. The `planning-workflow` spec requires syncing them on archive, and covers the case where they do not exist yet.
- `edge-infrastructure` is proposed alongside this change and is implemented **after** it (owner decision, 2026-10-18).

### Versions and facts verified (2026-10-18)

| Item                       | Fact                                                                                                                                                                                         | Source                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| GitHub Mermaid rendering   | GitHub renders fenced ` ```mermaid ` blocks in Markdown files. The Mermaid version GitHub runs is not stated                                                                                 | Context7 `/github/docs` ("Creating diagrams")            |
| Mermaid flowchart          | dotted links `-.->`; `classDef` with `stroke-dasharray` (commas escaped as `\,`); `class` applied to nodes                                                                                   | Context7 `/mermaid-js/mermaid` (flowchart syntax)        |
| Mermaid user journey       | `journey` with `title`, `section`s and tasks `Task: <score 1-5>: <actors>`                                                                                                                   | Context7 `/mermaid-js/mermaid` (examples)                |
| OpenCode instruction files | V2 discovers only `AGENTS.md` (global, then from the working directory up to the project root) and does not fall back to `CLAUDE.md`                                                         | Context7 `/anomalyco/opencode` (instructions, migration) |
| Claude Code and AGENTS.md  | reads `AGENTS.md` as project instructions when no `CLAUDE.md` exists, from v2.1.277; "in some sessions Claude can't read `AGENTS.md`", where a `CLAUDE.md` that imports it is the workaround | Context7 `/websites/code_claude` (glossary)              |

## Goals / Non-Goals

**Goals:**

- Each fact has one home. The living documents describe and diagram; DECISIONS.md decides; ROADMAP.md schedules. The living documents cite the other two and never compete with them.
- The documents are cheap to keep current. Every later archive touches only the diagrams and sections it affects.
- An agent with no prior context reaches the right sources from `AGENTS.md` in one hop.

**Non-Goals:**

- Exhaustive documentation. Each living document stays short (roughly one to three screens) and links out for detail: to specs, archived designs and DECISIONS.md.
- Documenting tooling that belongs to the owner's machine rather than the repository, such as local code-index or MCP configuration.

## Decisions

### D1. One owner per topic, a fixed outline per document

| Document        | Owns                                                                                                                                                                                                                                                                                                                             | Does not own                                         | Diagram                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| ARCHITECTURE.md | System context; containers (both workers; planned Neon, KV, R2, Hyperdrive, Images, Access); workspace layout (`apps/`, `packages/`, planned `cms-core`, `cms-render`, `db`, `ui`); the delivery pipeline (PR → `ci-ok` → rebase merge → release PR → release, and later deploy); planned read path (C5) and write path (C3, C4) | Why each choice was made (DECISIONS), when (ROADMAP) | Master `flowchart` (built solid, planned dashed), plus a small pipeline `flowchart`                   |
| PRODUCT.md      | Purpose; audiences (recruiters and hiring managers, prospective clients, developer peers); the owner as sole editor; goals, non-goals (multi-user editing, public sign-ups: A1, A3), locales (L1, L3); success as the roadmap's exit criteria                                                                                    | Journeys, UI                                         | `flowchart` from audiences to what they come for, to the site areas that serve them                   |
| USER_JOURNEY.md | One journey per audience and the owner's write → preview → publish → live journey; each step marked `today` or `planned (S<n>)`                                                                                                                                                                                                  | Feature specs                                        | One Mermaid `journey` per journey, plus a step table carrying the today/planned marks                 |
| DESIGN.md       | Visual and UX principles; accessibility target WCAG 2.2 AA (Q3); Latin Extended-A glyph coverage (L6); UI layering: `@ycmcuenca/ui` with Tailwind and shadcn-svelte in S2 (Q2), brand tokens in S5; current state (unstyled placeholders); open choices with their deciding sprint                                               | Brand decisions not yet made                         | `flowchart` of token layers (brand tokens → semantic tokens → `@ycmcuenca/ui` → apps), planned dashed |
| ROADMAP.md      | Unchanged ownership (plan and status). Gains `classDef`s for `proposed` and `in progress`, and links to the other living documents                                                                                                                                                                                               | —                                                    | Existing overview                                                                                     |

- **Pattern:** "documentation as a bounded context". Each document owns a topic, and the others reference it rather than copy it. This is the same single-source-of-truth rule the repository applies to config, such as `.node-version`.
- **Why:** the archive rule makes every change pay a sync cost. Fixed outlines and clear ownership keep that cost to editing one known section.
- **Alternatives:** _one large `docs/README.md`_ (easier to write; every archive edits the same file, and diagrams compete for space); _arc42 or C4 templates in full_ (thorough but heavy for one owner at 8–12 h/week; the master diagram borrows C4's context and container levels without the template).
- **Failure modes:** _Drift between documents_, for example PRODUCT naming an audience that USER_JOURNEY lacks. Mitigation: the spec makes cross-document coverage testable, and the archive review in each later change re-reads all five. _Documents restating decisions_: caught in review against the "cite, don't restate" requirement.

### D2. Diagram conventions

- **Built versus planned** (P8): built nodes use `classDef built` (solid stroke); planned nodes use `classDef planned` (dashed, matching ROADMAP's existing `stroke-dasharray:5 5`); planned connections use dotted links `-.->`. Each planned node's label ends with its source, such as `KV snapshot<br/>(S2 revisions-publishing)`. A small legend subgraph shows one built and one planned example.
- **Diagram types:** only `flowchart` and `journey`. Both are long-standing Mermaid types; newer types such as `mindmap` or `architecture-beta` are avoided because GitHub does not document the Mermaid version it runs.
- **Journeys:** Mermaid `journey` tasks need a 1–5 score. Here the score means the experience the step is meant to give (5 = effortless). Today/planned is carried by a `(planned S<n>)` suffix on the task name and by the step table, not by the score.
- **Pattern:** visual encoding of lifecycle state, so a reader sees at a glance how far the system has come.
- **Alternatives:** _separate "current" and "target" diagrams_ (no styling tricks needed; two diagrams to keep in sync on every archive); _colour only_ (fails for colour-blind readers and in GitHub's dark theme, where the dashed stroke still reads).
- **Failure modes:** _A diagram fails to render on GitHub_ (syntax error or unsupported feature). Mitigation: each diagram is checked in the PR's rendered view (task 5.2). The CI check only proves a block exists (see D4).

### D3. Citing decisions and roadmap state

- Decisions are cited inline by identifier and linked to their DECISIONS.md section, for example `([C5](DECISIONS.md#cms-architecture))`. Section anchors are stable; entry-level anchors do not exist because entries are bullets.
- Sprint and status come from ROADMAP.md only. The living documents say "planned (S2)", never a status such as `proposed`, so they do not need editing when a change's status moves.
- **Why:** a superseded decision is then fixed in one place, and a status change never touches the living documents.
- **Failure modes:** a renamed DECISIONS section breaks links. Mitigation: the section names are part of the log's structure and rarely change. Task 5.1 checks every relative link.

### D4. CI check: presence plus a diagram block, in the `specs` job

- `scripts/docs/check-living-docs.sh` (bash, `set -euo pipefail`): for each of the five paths, it fails with `missing: <path>` when the file does not exist, or with `no mermaid diagram: <path>` when no line starts with ` ```mermaid `. It reports every failing document before exiting non-zero, then prints `living documents: ok`.
- It runs as a new step `Check living documents` in the existing `specs` job, after `Validate specs`. No new job, so `ci-ok`'s `needs` list and the ruleset stay unchanged.
- **Pattern:** a structural fitness function. It cheaply checks a property that must always hold.
- **Why in `specs`:** both checks guard planning artifacts, and this one needs no install or build.
- **Alternatives:** _a new `docs` job_ (cleaner naming; needs a `ci-ok` edit, more for no gain); _a Lefthook hook_ (bypassable, and CI must re-check anyway); _Mermaid syntax validation_ (owner chose presence only; a headless parser is a large dependency whose feasibility is unverified).
- **Failure modes:** _A broken but present diagram passes._ Accepted, and covered by the PR review in D2. _Script drift from the list in `openspec/config.yaml`._ The five paths are listed once in the script with a comment pointing at the config's archive guidance. shellcheck runs on the script in task 1.1.

### D5. `AGENTS.md` as a pointer file

Contents, kept to roughly 60–100 lines:

1. What the repository is (two sentences) and that it is public: no secrets ever (P2).
2. **Read first:** `docs/ROADMAP.md`, `docs/DECISIONS.md`, `openspec/config.yaml` (context and per-artifact rules), and the living documents, each with one line on when it matters.
3. **Workflow:** OpenSpec changes (`/opsx-propose`, `/opsx-apply`, `/opsx-archive`; the command files live in `.claude/` and `.opencode/`), one change per capability and per PR (P7), and use `bunx openspec` (the pinned CLI).
4. **Commands:** links to the README's command table, plus the full local CI equivalent in one line.
5. **Conventions:** Conventional Commits (versions derive from them), rebase-only merging, exact dependency pins, comments that cite design decisions (`design D4`), and committing regenerated `worker-configuration.d.ts` after `wrangler.jsonc` changes.

- **Why one file:** OpenCode V2 reads only `AGENTS.md`, and Claude Code reads it when no `CLAUDE.md` exists (verified above). A pointer file never goes stale when a rule changes, because the rule lives in `config.yaml`.
- **Alternatives:** _`AGENTS.md` plus a `CLAUDE.md` that imports it_ (covers the sessions where Claude cannot read `AGENTS.md`; the owner chose not to add it); _copying the rules into `AGENTS.md`_ (two sources of truth).
- **Failure modes:** _a Claude Code session that cannot read `AGENTS.md`._ Mitigation: listed as an open question; the fallback is a one-line `CLAUDE.md` containing `@AGENTS.md`, added only if it actually happens.

### D6. README documentation index

The README gains a `## Documentation` section after the opening paragraph: one line per living document, DECISIONS.md and AGENTS.md. The "Full documentation … arrives with the `living-docs` change" maintenance note is removed. Nothing else in the README moves (owner decision: keep the README as the onboarding entry point).

## Risks / Trade-offs

- **Documents describe a system that is mostly planned, and could read as promises** → every planned element names its sprint, and PRODUCT.md states that the roadmap, not the documents, is the plan of record.
- **The archive sync becomes a chore and gets skipped** → fixed outlines (D1) keep each sync to known sections, and the CI check stops a document from silently disappearing.
- **The owner's product intent is drafted by an agent** → PRODUCT.md and USER_JOURNEY.md wording is an explicit owner-review task (5.3) before merge.
- **Mermaid features render differently on GitHub than in other viewers** → only `flowchart` and `journey`, checked on the PR's rendered view.

## Migration Plan

1. Land the documents, `AGENTS.md`, the README section, the ROADMAP styles and the CI step on the change branch.
2. CI runs on the PR. The new step passes, and its failure mode is checked on a throwaway commit (task 4.2).
3. The owner reviews the rendered documents on the PR and approves the product wording.
4. Rebase-merge. No release follows, because nothing under `apps/` changed.

**Rollback:** revert the PR. Nothing outside the repository changes.

## Open Questions

Deferrable: neither changes the specs or the task breakdown.

- Which Mermaid version GitHub renders with. It doesn't matter as long as D2's diagram types render, which task 5.2 checks.
- Which Claude Code sessions "can't read `AGENTS.md`". If the owner hits one, add a `CLAUDE.md` containing only `@AGENTS.md`.

## Assumptions for owner review

- **A1** The documents are in English only, like the admin UI (L1).
- **A2** Decisions are cited by identifier and linked to their DECISIONS.md section (D3).
- **A3** Only Mermaid `flowchart` and `journey` diagrams are used (D2).
- **A4** Journey scores express the intended experience of a step, and the today/planned status sits in the task name and the step table (D2).
- **A5** Because this change lands before `edge-infrastructure`, ARCHITECTURE.md draws deployment, Access, observability and the security headers dashed, labelled `edge-infrastructure`. That change's archive turns them solid.
- **A6** PRODUCT.md measures success by the roadmap's exit criteria, with no traffic or conversion targets, until Web Analytics arrives (I3, S5).
- **A7** `AGENTS.md` does not mention tooling that lives on the owner's machine, such as the code index or MCP servers.
- **A8** The living-documents check runs in the existing `specs` CI job (D4).
