# Proposal

## Why

The platform is built partly to learn system design (P1), and ROADMAP.md lists the "learning concepts" each sprint teaches. Nothing in the repository explains those concepts. DECISIONS.md records what was decided, the archived `design.md` files record why, and ARCHITECTURE.md shows what exists. No document says what a concept such as CQRS or a release train _is_, what problem it solves, where this repository applies it, or what to read to learn it. The owner wants to study each sprint's concepts before and after building them, and wants others to be able to learn how the system was built. Sprint 1 is complete and Sprint 2 is next, so this is the moment to capture S1's concepts while their changes are fresh, and to prepare the S2 reading before S2 starts.

## What Changes

- **`docs/SYSTEM_DESIGN.md`** (new): a study notebook of the system design concepts the platform uses, written in plain language (ISO 24495-1) for a web developer who is new to system design.
  - It opens with a contents list, a Mermaid overview of sprints and their concepts (built solid, planned dashed), and how to read the entries.
  - There is one section per sprint, matching ROADMAP.md. Each section opens with a short study path: the reading order, and what to study before the sprint and after it.
  - Each concept is a heading under the sprint that first applies it. A later sprint that revisits a concept links back to it instead of repeating it.
  - A **built** entry has: what it is and the problem it solves, a diagram, general trade-offs, how this repository applies it (citing decision IDs, `design.md` decisions and code paths, never restating their reasoning), what we learned here, self-check questions with answers in collapsed sections, and 2 to 5 dated external references.
  - A **planned** entry (a stub) has a one-paragraph definition, self-check questions and dated references to study ahead.
  - The first version has 13 full S1 entries and stubs for every concept ROADMAP lists for S2 to S6. The S1 entries cover the 6 ROADMAP concepts, the 14 `Pattern:` lines in the archived designs (related patterns are folded into one entry), the browser security headers and CSP, and reproducible toolchains.
- **`docs/DECISIONS.md`**: a new entry, **"Six living documents"**, supersedes P8 for the number of documents. Decisions that apply a concept gain a short link to its notebook entry.
- **`docs/ROADMAP.md`**: each sprint's learning-concepts list keeps its role as the plan and links each item to its notebook entry. S1's list grows to match the 13 entries. A recurring check is added: re-check the notebook's external links by hand. This change's row is added to Sprint 1.
- **`docs/ARCHITECTURE.md`**: components and paths link to the concepts behind them.
- **`docs/DESIGN.md`**: its opening states that it covers visual design, and that SYSTEM_DESIGN.md covers system design concepts.
- **`docs/USER_JOURNEY.md`** and **`docs/PRODUCT.md`**: the developer peer's journey gains a "study the concepts" step, and PRODUCT.md names the notebook as one of the things that serve developer peers.
- **`openspec/config.yaml`**:
  - The archive guidance adds the notebook to the documents to review, and asks for the change's concept entries to be written or completed. The agent drafts "What we learned here" and the owner rewrites it.
  - The design rule asks each `Pattern:` in a `design.md` to link to its notebook entry, adding a stub when the concept is new.
- **CI** (`scripts/docs/check-living-docs.sh`, same `specs` job step):
  - It checks six documents instead of five.
  - It checks that every notebook entry has the parts its status requires.
  - It checks that every relative link and heading anchor in `docs/`, `AGENTS.md` and `README.md` resolves. This uses `remark-cli` and `remark-validate-links`, pinned as root dev dependencies.
- **`AGENTS.md`** and **`README.md`**: list the new document.

Out of scope:

- Automated checks of external links. External links break at random and would make CI flaky, so they are re-checked by hand on a schedule.
- Full entries for the S2 to S6 concepts. Their stubs are completed by the change that builds each concept, at its archive.
- Spec-driven development (OpenSpec) as a concept entry. The owner left it out of the S1 list.
- Splitting the notebook into `docs/system-design/`. The notebook carries its own rule: split at about 3,000 lines.
- Splitting DECISIONS.md into `docs/adr/`, which keeps its own 300-line trigger even though the concept links bring it closer.
- Plain-language linting (for example Vale). ISO 24495-1 is checked in review, as it is for every other document.
- Translating the notebook. It is English only, like the other documents.
- Changing any app, package or deployed system.

## Capabilities

### New Capabilities

- `system-design-notebook`: the study notebook in `docs/SYSTEM_DESIGN.md`. It covers the notebook's outline, its built and planned entries and the parts each requires, its references policy, and the links between the notebook and the other documents.

### Modified Capabilities

- `project-documentation`: the set of living documents grows from five to six, and the README's documentation index lists six.
- `ci-checks`: the living-documents check covers six documents, checks the notebook's entry structure, and checks every relative link and heading anchor in the documentation.
- `planning-workflow`: archiving a change reviews six living documents and fills in the change's concept entries, and each design's patterns link to the notebook.

## Impact

- **New files**: `docs/SYSTEM_DESIGN.md`.
- **Changed files**:
  - Documents: `docs/DECISIONS.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN.md`, `docs/PRODUCT.md`, `docs/USER_JOURNEY.md`, `AGENTS.md`, `README.md`.
  - Configuration: `openspec/config.yaml`.
  - Checks and tooling: `scripts/docs/check-living-docs.sh`, the root `package.json` (two exact-pinned dev dependencies) and `bun.lock`.
- **CI**: no new job and no new step. The existing "Check living documents" step in `specs` does more. `ci-ok` and the `main` ruleset are unchanged.
- **Releases**: none. No file under `apps/` changes, so release-please proposes no app release.
- **External systems**: none. No secrets, settings or Cloudflare resources are touched.
- **Decisions**: contradicts **P8** ("Five living documents"). The owner approved superseding it during exploration on 2026-10-18. The new entry supersedes P8 for the number of documents only. P8's diagram conventions and sync rule still apply.
