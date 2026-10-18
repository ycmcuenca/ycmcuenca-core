# Decisions

The platform-wide decisions made while planning `ycmcuenca-core`, so that
future sessions and OpenSpec changes start from them instead of rediscovering
them. The sprint plan is in [ROADMAP.md](ROADMAP.md).

How to use this log:

- **Decided** entries are settled. A change that contradicts one must say so
  in its proposal and get the owner's approval, then this log is updated.
- **Proposed** entries are leanings to decide in the change that needs them.
- A change's own `design.md` holds the detailed reasoning, versions and
  alternatives. This log records only the outcome and a short why.
- Decisions made inside a change are not repeated here. See
  `openspec/changes/archive/2026-10-17-bootstrap-monorepo/design.md` for the
  workspace tooling and `openspec/changes/ci-release-pipeline/design.md` (moves
  to the archive when it is archived) for CI, releases, repository governance
  and Renovate.

All entries below are **Decided** and were recorded on 2026-10-18 from the
planning discussions before and during Sprint 1.

## Platform and scope

- **P1 Hand-built CMS, managed everything else.** Only the CMS is built by
  hand, as the learning vehicle; hosting, database, storage, auth and analytics
  are managed services. Why: learning depth where it matters, low upkeep
  elsewhere.
- **P2 Public repository.** The repo shows how the platform was built, so no
  secret is ever committed and security is part of every change.
- **P3 Cloudflare Workers on the Free plan.** Its limits (10 ms CPU per
  request, 1,000 KV writes a day, subrequest and size limits) are hard design
  constraints.
- **P4 `*.ycmcuenca.workers.dev` only, for now.** The custom domain
  `ycmcuenca.dev` comes later (parking lot). The Public Suffix List lists
  `workers.dev`, not `*.workers.dev`, so a cookie scoped to
  `ycmcuenca.workers.dev` is shared by its subdomains and no token-handoff flow
  is needed.
- **P5 Two core workers.** `welcome` (public portfolio) and `admin` (CMS).
- **P6 Deploy with GitHub Actions and Wrangler**, driven by release-please's
  released paths (`edge-infrastructure`).
- **P7 Spec-driven development with OpenSpec**, rooted at `openspec/` in the
  repository root. One change is one capability and one PR.
- **P8 Five living documents** in `docs/` (ARCHITECTURE, DESIGN, PRODUCT,
  ROADMAP, USER_JOURNEY), each with a Mermaid diagram, synced when a change is
  archived. The master architecture diagram uses solid lines for what exists
  and dashed lines for what is planned.
- **P9 Sprints are the plan; versions follow.** Five sprints (see ROADMAP.md),
  one semantic version per app, Conventional Commits and release-please.
- **P10 Long-lived and flexible.** The system must stay maintainable over a
  career; prefer boring tools with clear upgrade seams and avoid
  over-engineering.

## Identity and access

- **A1 Cloudflare Access first.** The owner is the only core user; `admin` sits
  behind Access.
- **A2 Access on every admin URL.** Both production and preview URLs of
  `admin` are behind Access, and the worker also verifies the Access JWT's
  `aud` itself. Any local dev bypass must be impossible to enable in
  production.
- **A3 `apps/auth` only when needed.** A Better Auth-based `apps/auth` (not
  OpenAuth) is built only when the first satellite needs public sign-ups.

## CMS architecture

- **C1 Ports and adapters.** `@ycmcuenca/cms-core` is pure TypeScript: content
  schemas, upcasters, publish rules, the projector and the ports. Adapters are
  `@ycmcuenca/db` (Neon), KV, R2 and Access. `@ycmcuenca/cms-render` is a
  shared Svelte block registry used by `welcome` and the admin preview;
  `@ycmcuenca/ui` holds shared UI.
- **C2 Code-first content types** in `cms-core`, built from field, block and
  type layers. The admin edits them with forms and a Markdown editor.
- **C3 Append-only revisions.** `entries` plus append-only `revisions`, each
  with a `schema_v`; old revisions are read through upcasters covered by
  fixture tests. Further tables: `media`, `inbox`, `redirects`. Publishing
  moves a pointer to a revision.
- **C4 Neon is the source of truth; KV and R2 are projections.** Anything in KV
  or R2 can be rebuilt from Neon. A failed projection leaves a dirty flag that
  the cron reconciler retries.
- **C5 Publish-snapshot read path (CQRS-lite).** Publishing writes a snapshot
  to KV; `welcome` reads only KV and has no database binding. This is a
  projection written at publish time, not cache-aside.
- **C6 One KV key per entry**, holding all locales, plus per-type index keys,
  which keeps writes under the free 1,000 per day.
- **C7 Every service owns its own database.** Portfolio projects are a CMS
  content type, not a separate service.

## Publishing workflow

- **W1 One cron reconciler.** One cron tick publishes due entries, claiming
  each with an atomic conditional `UPDATE`, and re-projects dirty snapshots.
  Target: about two minutes from due time to live. Times are stored in UTC.
- **W2 Draft previews are owner-only**, inside `admin` behind Access, reading
  Neon directly.

## Localization

- **L1 Locales `en`, `fil`, `eo`.** The admin UI is English only.
- **L2 Per-field localization.** Each field is shared or localized; each locale
  has a `ready` flag; one revision chain holds all locales.
- **L3 One publish covers all locales**, and English must be ready before
  anything publishes. An entry not ready in a locale is hidden in that locale.
- **L4 Shared slugs and locale-prefixed URLs:** `/{locale}/{type}/{slug}`.
- **L5 Paraglide JS for UI strings only**; content localization lives in the
  CMS.
- **L6 Fonts must cover Latin Extended-A** for Esperanto.

## Media

- **M1 R2 layout.** `public/<sha256>-<width>.webp` for served derivatives and
  `originals/<sha256>.<ext>` for originals, which are private, kept and never
  routed.
- **M2 Processing pipeline.** The browser computes the SHA-256 and R2 checks
  it; derivatives are EXIF-free WebP at 640, 1280 and 2048 px plus a BlurHash,
  served through a `welcome` route.
- **M3 Three-step upload protocol:** create, then parts, then complete.
  Single-part first; large files move to R2 multipart through the binding later
  with no client change.

## Integrations and longevity

- **I1 Contact form into the CMS inbox** until email exists, protected by
  Turnstile and rate limiting.
- **I2 OpenAPI and Orval only when something outside this repo consumes the
  admin API.** Until then, SvelteKit form actions with Zod.
- **I3 Analytics: Cloudflare Web Analytics beacon first**; a custom metrics
  dashboard later.
- **I4 Email arrives with the custom domain:** Email Routing, Resend with Gmail
  send-as, and contact-form email notifications.
- **I5 Longevity guards.** A `cms export` command (NDJSON) as an exit path, a
  `redirects` table, and 301s from `workers.dev` at the domain cutover.
- **I6 Two Neon roles:** one for migrations, one with runtime privileges only.
- **I7 Satellite boundary.** Satellites own their own database, integrate only
  through published contracts and never reach into core's Neon.

## Parking lot

Deferred work and the trigger that brings each one in.

| Item                                                        | Trigger                                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| Custom domain `ycmcuenca.dev`, workers.dev 301s, email (I4) | The owner decides to cut over; after Sprint 5 unless brought forward.  |
| R2 multipart uploads (M3)                                   | The first upload too large for a single part.                          |
| `apps/auth` with Better Auth (A3)                           | The first satellite that needs public sign-ups.                        |
| OpenAPI + Orval (I2)                                        | The first consumer of the admin API outside this repository.           |
| Custom metrics dashboard (I3)                               | The Web Analytics beacon no longer answers the owner's questions.      |
| Versioning internal packages                                | Sprint 2, when `cms-core` changes start changing app behavior.         |
| Vitest 5 and TypeScript 7                                   | `vitest-pool-workers` supports Vitest 5; `svelte-check` supports TS 7. |
| GitHub Milestones per sprint                                | The owner wants PRs grouped by sprint on GitHub.                       |
