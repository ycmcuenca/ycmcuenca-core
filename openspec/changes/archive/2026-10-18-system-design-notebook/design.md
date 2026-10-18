# Design

## Context

See proposal.md for the motivation. The required behavior is in the specs: `system-design-notebook` (new), and the deltas to `project-documentation`, `ci-checks` and `planning-workflow`.

Current state, observed on 2026-10-18:

- `docs/` holds five living documents and `DECISIONS.md` (259 lines). Decision P8 fixes the number at five.
- Four places enforce that number:
  - the `project-documentation` and `ci-checks` specs
  - the list in `scripts/docs/check-living-docs.sh`
  - the archive guidance in `openspec/config.yaml`
  - the documentation lists in `AGENTS.md` and `README.md`
- `scripts/docs/check-living-docs.sh` checks only that each document exists and has a Mermaid block. It runs as the "Check living documents" step of the `specs` CI job, which already runs `bun install --frozen-lockfile`.
- ROADMAP.md lists "Learning concepts" for each sprint: 6 for S1 and 24 for S2 to S6.
- The four archived `design.md` files name 14 patterns on `**Pattern:**` lines. `bootstrap-monorepo` names none.
- Links between documents were checked once, by hand, in living-docs task 5.1. Nothing checks them since.
- The developer-peer journey in USER_JOURNEY.md and the peer row in PRODUCT.md point peers at "the decisions and the documents". Neither names a place to learn the concepts.

### Versions and facts verified (2026-10-18)

| Item                              | Fact                                                                                                                                                                                                                                                                            | Source                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `remark-cli`                      | 12.0.1 is the latest version. Flags: `--use`, `--frail` (exit 1 on warnings), `--quiet`, `--[no-]stdout`, `--[no-]config`, `--[no-]ignore`, `--[no-]color`. Without `--output` it writes no files                                                                               | npm registry; Context7 `/remarkjs/remark` (remark-cli readme)                           |
| `remark-validate-links`           | 13.1.0 is the latest version. It checks that local links point to existing files and headings in a Git repository, works offline, does not check external URLs, and uses `github-slugger` 2 for heading anchors. Through the CLI, it checks headings in other files             | npm registry; readme on GitHub `remarkjs/remark-validate-links` (main)                  |
| Spike: remark on this repository  | Both pinned versions, run over `docs`, `AGENTS.md` and `README.md` today, exit 0                                                                                                                                                                                                | Local run, versions above                                                               |
| Spike: what remark catches        | In a scratch repository, it reported a wrong anchor in another file, a missing file, a wrong local anchor, a broken link inside a table without `remark-gfm`, a broken link inside `<details>`, and a wrong anchor and a missing code file outside the checked file set         | Local run, versions above                                                               |
| Spike: Git remote needed          | With no `origin` remote, the plugin stops with "Cannot find remote `origin`". `actions/checkout` keeps the `origin` remote even with `persist-credentials: false`                                                                                                               | Local run; the checkout behavior is an assumption (A4)                                  |
| Install warning                   | Installing `remark-cli` 12.0.1 prints a deprecation warning for its transitive dependency `glob@10.5.0`                                                                                                                                                                         | Local `npm install` output                                                              |
| `@eslint/markdown` (already used) | 8.0.3, run by `bun run lint` on every `.md` file. Its recommended rules include `no-missing-link-fragments` (anchors within the same file), `heading-increment`, `fenced-code-language` and `table-column-count`. It does not check other files or whether a linked file exists | `packages/eslint-config/package.json`; the plugin's `configs.recommended`, read locally |
| GitHub heading anchors            | Lower case. Spaces become hyphens. Other punctuation is removed. Formatting is removed. A duplicate heading gets `-1`, `-2` and so on                                                                                                                                           | Context7 `/github/docs` ("Section links")                                               |
| GitHub collapsed sections         | `<details>` with a `<summary>` renders closed until the reader clicks it, and Markdown inside it renders when blank lines surround it                                                                                                                                           | Context7 `/github/docs` ("Organizing information with collapsed sections")              |
| Mermaid diagram types             | `sequenceDiagram` and `stateDiagram-v2` are documented Mermaid syntax. GitHub lists one known issue: sequence diagrams render with extra padding below them                                                                                                                     | Context7 `/mermaid-js/mermaid` (v11 docs); Context7 `/github/docs` (Mermaid)            |
| GitHub's Mermaid version          | Not stated by GitHub                                                                                                                                                                                                                                                            | Context7 `/github/docs`                                                                 |
| `lychee` (alternative)            | v0.24.2 (2026-05-01). Has `--offline` and `--include-fragments`. Installed through Homebrew, Cargo, Docker or release binaries, not npm                                                                                                                                         | Context7 `/websites/lychee_cli_rs`; GitHub releases API                                 |
| ISO 24495-1                       | ISO 24495-1:2023, "Plain language — Part 1: Governing principles and guidelines", edition 1, published 2023-06                                                                                                                                                                  | iso.org standard 78907 (found through web search; iso.org rejects `curl`)               |
| Candidate S1 references           | Every web address behind the D3 references returned HTTP 200 after redirects                                                                                                                                                                                                    | `curl -L` on 2026-10-18                                                                 |

## Goals / Non-Goals

**Goals:**

- A reader can study one concept in one sitting, from definition to self-check, without leaving the entry. Links lead deeper only when the reader chooses.
- Each fact keeps one home. The notebook explains the general idea. DECISIONS.md, the archived designs and the code stay the record of what this repository does and why.
- Keeping the notebook current costs each archive a known, small edit: one entry turns from planned to built.
- Every promise in the specs is enforced by CI or by a named review step, never by memory.

**Non-Goals:**

- A complete system design textbook. The notebook covers only concepts this platform applies or plans to apply.
- Checking the quality of the plain language automatically.
- Mermaid syntax validation in CI. The living-docs design D4 chose to check presence only. Diagrams are still checked by eye in the PR.

## Decisions

### D1. One fixed entry format, with bold labels instead of sub-headings

An entry is a `###` heading inside a `## Sprint <n>: <name>` section, followed by these lines in this order:

| Part                                 | Exact line or form                                                      | Built    | Planned  |
| ------------------------------------ | ----------------------------------------------------------------------- | -------- | -------- |
| Status                               | `**Status:** built (S1)` or `**Status:** planned (S2)`                  | required | required |
| What it is and the problem it solves | `**What it is**`, then one or more paragraphs                           | required | required |
| Diagram                              | a ` ```mermaid ` block                                                  | required | optional |
| General trade-offs                   | `**Trade-offs**`, then a list                                           | required | absent   |
| How this repository applies it       | `**How this repository applies it**`, then a list of linked citations   | required | absent   |
| What we learned here                 | `**What we learned here**`, then a list                                 | required | absent   |
| Self-check questions                 | `**Check yourself**`, then 2 to 4 numbered questions                    | required | required |
| Answers                              | `<details><summary>Answer</summary>` … `</details>` after each question | required | optional |
| Further reading                      | `**Further reading**`, then 2 to 5 reference lines                      | required | required |

- **Code blocks:** every fenced block names its language (`mermaid`, `sh`, `text`), because `markdown/fenced-code-language` requires it.
- **Reference line:** `- [Title](https://…), author or publisher. Read on YYYY-MM-DD.` The check counts lines that end with `Read on YYYY-MM-DD.`
- **Draft marker:** an agent-drafted "What we learned here" starts with the line `> Draft: awaiting the owner's rewrite.` The owner deletes the line when they rewrite the part.
- **Pattern:** a fixed "card" template ([documentation as a bounded context](../../../../docs/SYSTEM_DESIGN.md#documentation-as-a-bounded-context)), so a reader builds a habit of where to look, and so a script can check completeness.
- **Why bold labels:** GitHub's outline then lists only sprints and concepts. Seven `####` sub-headings in each of 37 entries would add more than 200 outline items. Most would get suffixed anchors such as `#trade-offs-12`, which nobody can cite.
- **Alternatives:**
  - `####` sub-headings. Each part can be linked, but the outline gets noisy and the anchors are unstable.
  - YAML front matter per entry. Easy for machines, but GitHub renders it badly inside a document.
  - One file per concept. Clean files, but this contradicts the owner's single-file choice and multiplies the links to maintain.
- **Failure modes:**
  - A label is mistyped, for example `**Tradeoffs**`. The check reports the part as missing (D7).
  - Answers that are not wrapped in `<details>` are shown openly. This is caught in review on the rendered page.

### D2. Document outline

1. **Opening:** what the notebook covers, who it is for, and that DESIGN.md covers visual design. The neighboring documents and how to cite them, as in the other living documents.
2. **Contents:** a nested list linking every sprint section and every entry. The link check (D8) keeps it honest.
3. **How to read an entry:** the parts from D1, what built and planned mean, and how citations work (decision IDs, `design.md` `Dn`, code paths).
4. **Overview diagram:** a Mermaid `flowchart` from each sprint to its concepts. Built concepts are drawn solid and planned ones dashed, reusing ROADMAP's `classDef built` and `classDef planned` styles.
5. **`## Sprint 1: Foundation` … `## Sprint 6: Content and 3D`:** the same names as ROADMAP. Each opens with a `**Study path:**` paragraph, then its entries.
6. **Keeping this document current:** the archive rule (D9), the references policy (D10) and the size rule (split at about 3,000 lines into `docs/system-design/`).

- **Pattern:** the same "one owner per topic, fixed outline" approach as living-docs design D1 ([documentation as a bounded context](../../../../docs/SYSTEM_DESIGN.md#documentation-as-a-bounded-context)).
- **Alternative:** a glossary section for terms. It was rejected because the spec asks that each term be defined where it first appears. A glossary would be a second home for the same definitions.

### D3. The Sprint 1 inventory: 13 full entries

Every `Pattern:` line maps to exactly one entry. The "applied here" column lists the sources the entry cites. The "References" column lists candidate sources, all checked on 2026-10-18 (see Context).

| Entry heading (anchor follows GitHub's rules)      | Folds in                                                                                                    | Applied here: decisions, designs, code                                                                                | Candidate references                                                                                                                                           |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo task graphs and caching                   | Content-addressed cache with a nearest-ancestor restore (ci D4)                                             | bootstrap D1, D7; ci D4; `turbo.jsonc`, `.github/workflows/ci.yml`                                                    | turborepo.com "Caching" and "Configuring tasks"; GitHub Docs "Dependency caching"                                                                              |
| Trunk-based development with a required-check gate | Required-check aggregator (ci D1)                                                                           | ci D1; `.github/rulesets/main.json`, the `ci-ok` job in `ci.yml`                                                      | trunkbaseddevelopment.com; Fowler, "Patterns for Managing Source Code Branches"; GitHub Docs "Available rules for rulesets"                                    |
| Release trains from Conventional Commits           | Release PR (ci D8); single deploy definition (edge D1)                                                      | P6, P9, P14; ci D5, D8; edge D1; `release-please-config.json`, `commitlint.config.js`, `.github/workflows/deploy.yml` | Conventional Commits 1.0.0; Semantic Versioning 2.0.0; `googleapis/release-please` readme                                                                      |
| Settings as code                                   | Desired state plus an idempotent reconciler (ci D9, edge D5)                                                | A4; ci D9; edge D5; `scripts/github/apply-settings.sh`, `scripts/cloudflare/apply-access.sh`                          | Kubernetes "Controllers"; Fowler, "InfrastructureAsCode"                                                                                                       |
| Supply-chain hardening                             | SHA pinning (ci D10); batched dependency flow with a security fast lane (ci D11); workflow auditing (ci D7) | ci D7, D10, D11, D12; `renovate.json5`, `.github/workflows/`                                                          | GitHub Docs "Security hardening for GitHub Actions"; SLSA (slsa.dev); zizmor docs; Renovate docs                                                               |
| Reproducible toolchains                            | Exact pins, frozen lockfile, pinned runtimes                                                                | bootstrap D2; ci D3; `package.json` `packageManager`, `.node-version`, `bun.lock`                                     | reproducible-builds.org; Bun docs "Lockfile"                                                                                                                   |
| Least privilege                                    | One credential, one environment, one branch (edge D3)                                                       | edge D3; ci D2; the `permissions:` blocks in `.github/workflows/`                                                     | Saltzer and Schroeder, "The Protection of Information in Computer Systems" (1975); GitHub Docs "Automatic token authentication"; Cloudflare "Create API token" |
| Zero trust and defense in depth                    | The edge decides and the app re-verifies (edge D6)                                                          | A1, A2, A4, A5; edge D5, D6; `packages/edge/src/access.ts`                                                            | NIST SP 800-207 "Zero Trust Architecture"; RFC 7519 (JWT); Cloudflare "Validate JWTs"                                                                          |
| Browser security headers and CSP                   | HSTS, CSP, `frame-ancestors`, `Referrer-Policy`                                                             | I10; edge D8; `packages/edge/src/headers.ts`, the apps' `_headers`                                                    | MDN "Content Security Policy"; W3C CSP Level 3; RFC 6797 (HSTS); OWASP Secure Headers Project; SvelteKit "Configuration" (`csp`)                               |
| Testing the production artifact                    | A test trust anchor injected through configuration (edge D7); post-deploy smoke check (edge D11)            | edge D7, D11; bootstrap D6; `scripts/deploy/smoke-check.sh`, the apps' `e2e/`                                         | Fowler, "ContinuousDelivery"; The Twelve-Factor App, "Config"                                                                                                  |
| Structured logs with a correlation id              | Cloudflare Ray ID as the request id (edge D9)                                                               | I9; edge D9; `packages/edge/src/logging.ts`                                                                           | Cloudflare "Workers Logs"; Cloudflare "Ray ID"; The Twelve-Factor App, "Logs"; W3C Trace Context                                                               |
| Fitness functions                                  | A structural fitness function (living-docs D4); this change's checks (D7, D8)                               | living-docs D4; this change's D7, D8; `scripts/docs/check-living-docs.sh`                                             | Thoughtworks Technology Radar, "Architectural fitness function"; Ford, Parsons and Kua, _Building Evolutionary Architectures_ (book)                           |
| Documentation as a bounded context                 | Single source of truth; visual encoding of lifecycle state (living-docs D1, D2)                             | P8 and its successor; living-docs D1 to D3; this change's D6                                                          | Fowler, "BoundedContext"; Diátaxis (diataxis.fr); C4 model (c4model.com); ISO 24495-1:2023                                                                     |

- **Pattern:** "one concept, one home" ([documentation as a bounded context](../../../../docs/SYSTEM_DESIGN.md#documentation-as-a-bounded-context)). Each `Pattern:` maps to exactly one entry, so the design rule (D9) has one link target.
- **Alternatives:** one entry per `Pattern:` line, which gives 14 or more thin entries that repeat each other (settings as code appears twice). Or ROADMAP's 6 only, which leaves 8 named patterns unexplained.
- **Failure mode:** a reference turns out to be weak once read in full, for example a page that only promotes a product. Mitigation: the writer replaces it with another source of the D10 kinds and records it in the PR.

### D4. Planned stubs for Sprints 2 to 6: 24 entries, taken from ROADMAP

- **S2:** hexagonal architecture (ports and adapters); CQRS-lite read projections; event-sourcing-lite append-only revisions; schema versioning with upcasters; versioned contracts and tolerant readers; cache invalidation by tag; branch-per-PR database testing.
- **S3:** content-addressed storage; upload protocols and integrity checks; abuse prevention; backup and restore as a tested process (RPO and RTO).
- **S4:** reconciliation loops and at-most-once claims (links back to settings as code); eventual consistency and its SLOs; time handling in UTC; internationalization versus localization; read-your-writes for previews.
- **S5:** design tokens and theming; accessibility as a requirement; font subsetting and loading; performance budgets; privacy-preserving analytics.
- **S6:** content modelling against real content; progressive enhancement; performance budgets for 3D on the web (links back to S5's performance budgets).

The writer may shorten a heading so its anchor stays readable, for example "Backup and restore as a tested process". The ROADMAP wording and link change in the same commit.

Stub references come from the same sources as D10, chosen when the stub is written. None are listed here, because none have been read yet.

### D5. Diagram types: three in the notebook, two elsewhere

- The notebook may use `flowchart`, `sequenceDiagram` and `stateDiagram-v2`. The other living documents keep living-docs D2's `flowchart` and `journey`.
- **Why:** many concepts are about order over time (the Access JWT check, a release train) or about states (a revision, a claim). A flowchart draws these poorly.
- **Alternatives:**
  - Keep D2's two types. Consistent, but some concepts would be drawn badly.
  - ASCII sketches. Easy to write, but they don't count as diagrams for the check, and they read worse.
- **Failure modes:**
  - GitHub runs an unstated Mermaid version, and a newer feature fails to render. Mitigation: use only the basic syntax shown in the Mermaid docs, and check each diagram on the PR's rendered view.
  - Sequence diagrams get extra padding (a known GitHub issue). This is cosmetic and accepted.

### D6. Links between the notebook and the other documents

| From → to                        | Form                                                                                                                                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Notebook → DECISIONS             | `([C5](DECISIONS.md#cms-architecture))`, the same form as the other documents (living-docs D3)                                                                                                 |
| Notebook → archived design       | `[ci D9](../openspec/changes/archive/2026-10-18-ci-release-pipeline/design.md#d9-repository-settings-as-code)`                                                                                 |
| Notebook → code                  | `[apply-settings.sh](../scripts/github/apply-settings.sh)`. This links to the file only, never to line numbers, which go stale                                                                 |
| ROADMAP → notebook               | Each item in a "Learning concepts" sentence becomes a link: `[settings as code](SYSTEM_DESIGN.md#settings-as-code)`. S1's sentence lists all 13 entries                                        |
| DECISIONS → notebook             | A short final sentence on the decisions that apply a concept: `Concept: [CQRS-lite read projections](SYSTEM_DESIGN.md#cqrs-lite-read-projections).` About 25 decisions qualify                 |
| ARCHITECTURE → notebook          | "What exists today" bullets and the pipeline steps link to their concepts inline. The planned-components table gains a "Concepts" column. The read and write path steps link to their concepts |
| USER_JOURNEY, PRODUCT → notebook | A new "Study the concepts (today)" task in the peer journey's "Follow the thinking" section, plus its step-table row. The peer row in PRODUCT.md and its diagram node name the notebook        |
| DESIGN → notebook                | One sentence in the opening paragraphs                                                                                                                                                         |
| AGENTS, README → notebook        | One row in AGENTS.md's table and one line in README's documentation list                                                                                                                       |

**The new decision in DECISIONS.md** goes under "Platform and scope", as the next free number (P15):

> **P15 Six living documents.** Supersedes P8 for the number of documents. `docs/SYSTEM_DESIGN.md` joins the five as a study notebook of the system design concepts each sprint applies. P8's diagram conventions and sync rule still apply. Why: the learning goal (P1) needs a place that explains concepts, and DECISIONS records only outcomes.

P8 gains "**Superseded by P15** for the number of documents", following the log's rule. Its text is not otherwise edited.

- **Pattern:** bidirectional links, with each fact kept in one home ([documentation as a bounded context](../../../../docs/SYSTEM_DESIGN.md#documentation-as-a-bounded-context)). A link replaces a copy.
- **Failure modes:**
  - A renamed notebook heading breaks every link into it. Mitigation: the link check (D8) fails and names each broken line.
  - DECISIONS.md grows from 259 lines to about 290, close to its own 300-line split trigger. This is accepted, and listed under Risks.

### D7. Entry-structure check: `awk` inside the existing script

- `check-living-docs.sh` keeps its current presence and Mermaid loop over six paths. It gains one function that runs an `awk` program over `docs/SYSTEM_DESIGN.md`.
- The program tracks the current `## Sprint` section and the current `###` entry inside it. At the end of each entry it checks:
  - the status line exists
  - each label that status requires exists
  - a built entry has at least one ` ```mermaid ` block and one `<details>`
  - the dated reference lines number 2 to 5
  - a built entry has a "What we learned here" part. Whether it still carries the draft marker is not checked (D11)
- **Failure output:** one line per missing part, in the script's existing style: `incomplete entry: <heading>: <part>`. For example, `incomplete entry: Settings as code: further reading`. All failures are reported before the script exits non-zero, as today.
- **Pattern:** a structural fitness function ([fitness functions](../../../../docs/SYSTEM_DESIGN.md#fitness-functions)), the same as living-docs D4. The notebook's own "Fitness functions" entry cites it.
- **Alternatives:**
  - A TypeScript script run by Bun, with unit tests. Better tested, but it would be the first TypeScript under `scripts/`. All four existing scripts are bash.
  - A remark lint plugin. Would reuse the Markdown parser, but adds a custom plugin to maintain.
- **Failure modes:**
  - The `awk` program treats a `###` line inside a code block as an entry. Mitigation: the program skips fenced blocks.
  - shellcheck does not cover `awk`. Mitigation: the program is short, and its failure modes are proven on a throwaway commit (tasks).

### D8. Relative-link check: `remark-cli` and `remark-validate-links`, pinned as root dev dependencies

- `package.json` gains `remark-cli` `12.0.1` and `remark-validate-links` `13.1.0`, both pinned exactly.
- The script runs `bunx remark --use remark-validate-links --no-config --no-ignore --no-stdout --frail --quiet --no-color docs AGENTS.md README.md`. Any warning fails the run, and each warning names the file, line and link.
- **Pattern:** a fitness function for documentation integrity ([fitness functions](../../../../docs/SYSTEM_DESIGN.md#fitness-functions)), run offline, so it gives no false alarms from the network.
- **Why this tool:**
  - `bun install` installs it, so the local CI command needs nothing extra. This keeps the developer-workspace promise that every tool is a dev dependency.
  - It uses GitHub's own anchor rules (`github-slugger`).
  - It reads headings in files outside the checked set, such as the archived designs.
  - The spikes in Context proved each of these.
  - It adds what `@eslint/markdown` lacks: anchors in other files, and whether linked files exist. The overlap on same-file anchors is harmless: both tools agree, and each names the line.
- **Alternatives:**
  - `lychee --offline --include-fragments`. Fast, but a Rust binary: CI would need a digest-pinned Docker image, and contributors would install it by hand. Its handling of GitHub's anchor rules is untested here.
  - A hand-written bash parser. No dependency, but it would re-implement GitHub's anchor rules.
  - `markdown-link-check`. Its anchor checks across files were not verified, so it was not chosen.
- **Failure modes:**
  - No `origin` remote, for example in a fresh local clone of a fork without one. The tool stops with a clear message. Mitigation: the script checks for the remote first, and if it is missing, explains how to add one.
  - A dependency update changes behavior. Renovate proposes it as a PR, so the same check runs on it.
  - The transitive `glob@10.5.0` deprecation warning. It prints at install time only, and Renovate tracks updates.

### D9. Planning rules in `openspec/config.yaml`

- **Archive guidance:**
  - The living-documents bullet lists six documents.
  - A new bullet says: complete the notebook entries for the concepts the change applies (planned → built, or a new entry); draft "What we learned here" from the change's design risks, open questions and follow-ups, marked with the draft line from D1; and leave the rewrite to the owner.
- **Design rules:** a new bullet says: link each `**Pattern:**` to its notebook entry, and add a planned entry in the same change when none exists.
- The script's comment that ties its list to the archive guidance stays as it is, and both now list six documents.
- **Why:** the rules travel with every OpenSpec instruction, so no agent has to remember them. This is the same reason given in bootstrap D10.
- **Failure mode:** an archive forgets to complete an entry. Partial mitigation: the archive review reads the guidance. A planned status on an archived concept is not detected automatically, and this is accepted (see Risks).

### D10. References: kinds, verification and dates

- **Kinds allowed:** official documentation, specifications and RFCs, original papers or the originator's own writing (for example martinfowler.com for patterns Fowler named), and widely recognized books. A book is cited by title, authors and edition, with the publisher's page as its link.
- **Verification before a reference is added:**
  - Library and platform documentation is read through Context7 where Context7 has it.
  - Every web address is opened, and the final address after redirects is recorded.
  - The reference line gets the date it was read.
- **Re-checking:** each quarter, beside the restore drill in ROADMAP's "Recurring checks", every external link in the notebook is opened by hand. Dead links are replaced, and the dates of re-read sources are updated.
- **Why:** external links fail at random, so checking them in CI would make CI flaky (owner decision). Dates show a reader how fresh a source is.

### D11. Who writes what in this change

- The agent writes every entry. The S1 lessons are drafted from:
  - the archived designs' Risks, Open Questions and Assumptions
  - the follow-up PRs: #5 after `ci-release-pipeline`, #11 after `edge-infrastructure`
  - the commit history
- Each S1 lesson carries the draft marker. CI does not check the marker (owner decision, 2026-10-18): the owner's rewrite is confirmed by an approval comment on the PR (task 6.4), not by a failing check. The marker stays as a convention, so a reader can tell a draft from a rewritten lesson.
- **Alternative:** leave the S1 lessons empty for the owner. Rejected because the owner chose "agent drafts, owner edits".

## Risks / Trade-offs

- **The notebook is the largest document, about 1,500 lines, and review is heavy.** → The tasks write it sprint by sprint and entry by entry. Each S1 entry is reviewed on GitHub's rendered view.
- **"Applied here" drifts into restating the decisions.** → The spec's "Applied, not restated" requirement is checked in review. Each citation is a link plus at most one sentence of context.
- **DECISIONS.md reaches about 290 lines, near its split trigger.** → Accepted. S2's `content-store` will likely cross 300 and do the `docs/adr/` split, as the parking-lot rule already says.
- **A planned entry stays planned after its change is archived.** → The archive guidance (D9) asks for it. The check does not compare the notebook with ROADMAP. Accepted for now, and listed as an open question.
- **An agent-written explanation is wrong in a subtle way.** → Each entry cites sources the reader can verify. The owner's study of each entry is itself a review. Corrections are ordinary PRs.
- **The link check fails on work that is legitimately in progress, for example a link to a heading planned in the same PR.** → This cannot happen within one PR, because the check runs on the PR's final state.
- **The `awk` structure check has no unit tests.** → Its failure modes are proven on a throwaway commit before merge, as living-docs task 5.2 did.

## Migration Plan

1. On the change branch: add the dependencies, extend the script, then write the notebook, then add the links in the other documents, the config rules and P15.
2. CI runs on the PR. The extended step must pass, draft markers included. Its failure modes are proven on throwaway commits (tasks).
3. The owner rewrites the 13 S1 lessons, which removes the draft markers, reviews the rendered notebook and approves the PR.
4. Rebase-merge. No release follows, because nothing under `apps/` changes.

**Rollback:** revert the PR. The check script, dependencies and documents return to their previous state together. Nothing outside the repository changes.

## Open Questions

Deferrable: none of these changes the specs or the task breakdown.

- Should the check also compare the notebook's statuses with ROADMAP, for example by failing when a concept of an archived change is still planned? This waits until a real drift happens.
- Whether GitHub's outline view lists headings that sit inside `<details>`. None are planned there, so this does not matter now.
- Whether `bunx remark` runs the CLI under Node or under Bun. The spike ran it under Node. Task 1.2 confirms that it gives the same results under `bunx`.

## Assumptions for owner review

- **A1** Entry parts use bold labels, not `####` sub-headings (D1).
- **A2** Planned stubs may include answers in `<details>`, but only built entries must have them (D1, spec "Self-check answers hidden until asked").
- **A3** The 13 S1 headings and the folding in D3 are final. Renaming a heading later is allowed, together with every link to it.
- **A4** `actions/checkout` keeps the `origin` remote with `persist-credentials: false`, so the link check runs in CI without extra steps. Task 6.2 verifies it in the PR's CI run.
- **A5** Each quarter's manual external-link check goes in ROADMAP's "Recurring checks", beside the restore drill.
- **A6** About 25 decisions in DECISIONS.md get a concept link. A decision gets one only when its notebook entry exists in this change, as a full entry or a stub.
- **A7** CI does not enforce the draft marker. The owner's rewrite of the S1 lessons is confirmed by an approval comment on the PR (D11).
- **A8** Code is cited by file path only, never by line number (D6).
- **A9** S1's exit criteria in ROADMAP become "all six living documents exist".
