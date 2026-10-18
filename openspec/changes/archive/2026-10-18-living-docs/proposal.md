# Proposal

## Why

The plan (`docs/ROADMAP.md`) and the decisions (`docs/DECISIONS.md`) exist, but nothing describes the system itself: how its parts fit together, who the product is for, what a visitor or the owner actually does with it, or how its visual design is meant to evolve. Decision P8 requires five living documents with Mermaid diagrams, and the archive guidance in `openspec/config.yaml` already expects to sync them. Until they exist, every archive reports "no living documents to sync", and every agent session has to rediscover the system from code and archived designs. Writing them now, before `edge-infrastructure` is built, means that change's archive is the first to exercise the sync rule for real: deployment and Access move from dashed to solid in the architecture diagram.

## What Changes

- **`docs/ARCHITECTURE.md`**: the system as built today and as planned through S6: context (owner, visitors, GitHub, Cloudflare, later Neon), the workspace layout, the two workers, the CI, release and settings-as-code pipeline, and the planned CMS read and write paths. Its master diagram draws what exists with solid lines and what is planned with dashed lines, and labels each planned element with the change or sprint that brings it. Rationale is cited by decision ID (for example C5) instead of restated.
- **`docs/PRODUCT.md`**: what the platform is for: the public portfolio's audiences (recruiters and hiring managers, prospective clients, developer peers), the owner as the only editor, goals and non-goals, the three locales, and success measured against the roadmap's exit criteria.
- **`docs/USER_JOURNEY.md`**: one journey for each audience plus the owner's write-and-publish journey, each step marked as available today or planned (with its sprint). Drawn as Mermaid `journey` diagrams.
- **`docs/DESIGN.md`**: the visual and UX design stance: principles, the accessibility target (Q3), glyph coverage for Esperanto (L6), the two-step UI plan (Q2: shared UI in S2, brand tokens in S5), and an honest statement of today's state (unstyled placeholders). Most of its decisions are explicitly deferred to the brand sprint.
- **`docs/ROADMAP.md`** (adopted): its overview diagram gains styles for every status in its vocabulary (`proposed` and `in progress` are missing today), and it links to the other living documents. Its plan content is unchanged apart from this change's own status row.
- **`docs/DECISIONS.md`** (adopted): unchanged. It stays the decision log that the living documents cite.
- **`AGENTS.md`** at the repository root: the entry point for coding agents. It says what to read first (ROADMAP, DECISIONS, the OpenSpec rules), where the living documents are, the everyday commands and the repository's conventions, all by linking rather than copying. Both agents the owner uses read it without a second file: OpenCode V2 reads only `AGENTS.md`, and Claude Code reads it when no `CLAUDE.md` exists.
- **`README.md`**: gains a short "Documentation" section linking every living document, DECISIONS and `AGENTS.md`, and drops the note that full documentation arrives with this change.
- **CI**: the existing `specs` job gains a step that fails when any of the five living documents is missing or contains no Mermaid diagram.

Out of scope:

- Mermaid syntax validation in CI. The CI step only checks that a diagram block exists; rendering is checked by eye on the pull request.
- A `CLAUDE.md`, a documentation website, and per-package READMEs.
- Splitting DECISIONS into `docs/adr/` (its own trigger: about 300 lines).
- Translating the documents. They are English only, like the admin UI (L1).
- Making the brand and visual design decisions themselves (S5 `brand-identity`, `welcome-design`). DESIGN.md records principles and open choices only.
- Changing the archive rules in `openspec/config.yaml` or the `planning-workflow` spec. They already describe the sync, and both keep working once the documents exist.

## Capabilities

### New Capabilities

- `project-documentation`: the living documents in `docs/`, what each one owns, their diagram conventions (built versus planned), the agent entry point and the README's documentation index.

### Modified Capabilities

- `ci-checks`: a new requirement that every CI run checks the living documents are present and each carries a Mermaid diagram.

## Impact

- **New files**: `docs/ARCHITECTURE.md`, `docs/DESIGN.md`, `docs/PRODUCT.md`, `docs/USER_JOURNEY.md`, `AGENTS.md`, `scripts/docs/check-living-docs.sh`.
- **Changed files**: `docs/ROADMAP.md` (status styles, links, this change's row), `README.md`, `.github/workflows/ci.yml` (one step in `specs`).
- **Releases**: none. No file under `apps/` changes, so release-please proposes no app release.
- **External systems**: none. No secrets, settings or Cloudflare resources are touched.
- **Decisions**: builds on P8 and contradicts no decided entry.
