# Roadmap

The plan for `ycmcuenca-core`, sprint by sprint. Sprints are the plan; each
app's version follows from what ships in them (see
[How versions relate to sprints](#how-versions-relate-to-sprints)).

This file and [DECISIONS.md](DECISIONS.md) carry the planning context between
sessions. Read both before proposing an OpenSpec change, and update the
change's row here when it moves to a new status.

The other living documents are [ARCHITECTURE.md](ARCHITECTURE.md),
[DESIGN.md](DESIGN.md), [PRODUCT.md](PRODUCT.md) and
[USER_JOURNEY.md](USER_JOURNEY.md).

- **Pace:** 8–12 hours a week, mostly agent-driven work with human review. A
  sprint takes one to two weeks, so this roadmap has no dates.
- **Unit of work:** one OpenSpec change is one capability, one pull request.
- **Change names** describe the capability (`ci-release-pipeline`), never the
  sprint. Names for future sprints are candidates and are fixed only when the
  change is proposed.

## Status vocabulary

| Status        | Meaning                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| `planned`     | Listed here, no OpenSpec change yet.                                    |
| `proposed`    | Change exists in `openspec/changes/` with its artifacts, not yet built. |
| `in progress` | Being implemented, or its PR is open.                                   |
| `merged`      | The implementation PR is on `main`; follow-ups or the archive pending.  |
| `archived`    | Archived in `openspec/changes/archive/`, specs synced.                  |

## Overview

Solid boxes have an OpenSpec change; dashed boxes are planned. Arrows point from
a change to the changes that build on it.

```mermaid
flowchart LR
    subgraph S1["S1 Foundation"]
        bootstrap["bootstrap-monorepo"]:::archived
        ci["ci-release-pipeline"]:::archived
        edge["edge-infrastructure"]:::planned
        docs["living-docs"]:::archived
    end
    subgraph S2["S2 Publish path"]
        s2["content store, content model,<br/>revisions + projector,<br/>public rendering, admin editor"]:::planned
    end
    subgraph S3["S3 Media, inbox, backups"]
        s3["media uploads, contact inbox,<br/>data backups"]:::planned
    end
    subgraph S4["S4 Workflow"]
        s4["scheduled publishing,<br/>draft preview, localization"]:::planned
    end
    subgraph S5["S5 Brand"]
        s5["brand identity, welcome design,<br/>analytics, a11y + perf budgets"]:::planned
    end
    subgraph S6["S6 Content + 3D"]
        s6["projects content,<br/>Threlte 3D"]:::planned
    end

    bootstrap --> ci --> edge
    bootstrap --> docs
    edge --> s2 --> s3 --> s4 --> s5 --> s6

    classDef archived fill:#d1fae5,stroke:#047857,color:#111827
    classDef merged fill:#dbeafe,stroke:#1d4ed8,color:#111827
    classDef inProgress fill:#fef3c7,stroke:#b45309,color:#111827
    classDef proposed fill:#ede9fe,stroke:#6d28d9,color:#111827
    classDef planned fill:#f3f4f6,stroke:#6b7280,color:#111827,stroke-dasharray:5 5
```

## Sprint 1: Foundation

**Goal:** a gated, hardened repository whose two workers are live on
`*.ycmcuenca.workers.dev`, with the living documents in place.

| Change                | Status   | What it delivers                                                                                                                                                                                                                                                                                                                             |
| --------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bootstrap-monorepo`  | archived | Bun + Turborepo workspace, `welcome` and `admin` as hello-world SvelteKit apps on the Workers adapter (local only), ESLint, Prettier, Lefthook + commitlint, Vitest, Chromium smoke tests on `wrangler dev`. PR #1, archived 2026-10-17.                                                                                                     |
| `ci-release-pipeline` | archived | PR CI with one `ci-ok` gate, release-please (one version per app), repository settings as code, SHA-pinned actions, Renovate, CodeQL. PR #2 merged, follow-up PR #5 merged, archived 2026-10-18.                                                                                                                                             |
| `edge-infrastructure` | planned  | Cloudflare API token, a deploy workflow that consumes release-please's `paths_released`, both workers live on `workers.dev`, Cloudflare Access in front of `admin` (production and preview URLs), Workers Logs and traces (I9), security headers and CSP (I10). KV, R2 and Neon are created in S2 and S3 by the change that first uses them. |
| `living-docs`         | archived | Adopts this file and DECISIONS.md and adds ARCHITECTURE, DESIGN, PRODUCT and USER_JOURNEY, each with a Mermaid diagram, plus AGENTS.md, a README documentation index and a CI check that the documents exist. Revises the master architecture diagram: solid lines for what exists, dashed for what is planned. PR #8, archived 2026-10-18.  |

**Exit criteria:** `main` changes only through checked PRs; a merged release
PR deploys the released app; `admin` is reachable only through Access; all five
living documents exist.

**Learning concepts:** monorepo task graphs and caching, trunk-based
development with a required-check gate, release trains from Conventional
Commits, settings as code (desired state plus an idempotent reconciler),
supply-chain hardening (SHA pinning, least privilege, workflow auditing),
zero-trust access at the edge.

## Sprint 2: Publish path

**Goal:** a walking skeleton. The owner writes and publishes an English entry in
`admin`, and `welcome` serves it from a published snapshot.

Candidate changes (tentative names):

- `content-store`: Neon, Hyperdrive and Drizzle in `@ycmcuenca/db`, two Neon
  roles (I6), integration tests on a Neon branch per PR (Q1). Settles the
  Drizzle version (Q5).
- `content-model`: code-first field, block and type layers in
  `@ycmcuenca/cms-core` (C2).
- `revisions-publishing`: append-only revisions, pointer moves, the KV publish
  projector with a versioned snapshot (C8) and Markdown rendered at publish
  (C9).
- `public-rendering`: `welcome` reads KV through `@ycmcuenca/cms-render`,
  behind Workers Cache with tag purges over a service binding (C10), plus SEO
  basics (Q4).
- `admin-editor`: forms and the Markdown editor, with Tailwind and
  shadcn-svelte arriving in `@ycmcuenca/ui` (Q2).

**Exit criteria:** publishing an English entry makes it visible on `welcome`
with no database binding on `welcome`; editing creates a new revision and never
overwrites one; a publish purges exactly the affected cached pages.

**Learning concepts:** hexagonal architecture (ports and adapters), CQRS-lite
read projections, event-sourcing-lite append-only revisions, schema versioning
with upcasters, versioned contracts and tolerant readers, cache invalidation
by tag, branch-per-PR database testing.

## Sprint 3: Media, inbox and backups

**Goal:** entries can carry images, visitors can send a message, and the data
survives a mistake.

Candidate changes (tentative names):

- `media-uploads`: single-part uploads to R2 through the three-step protocol
  (M3), derivatives from the Images binding (M4), BlurHash in the browser.
- `contact-inbox`: the contact form into the CMS inbox, with Turnstile and rate
  limiting (I1).
- `data-backups`: `cms export` (I5) and the nightly backup job to private R2
  with a restore drill (I8).

**Exit criteria:** an uploaded image is served at its three widths; a contact
message appears in the inbox and spam is rejected; a backup restores into a
Neon branch with matching row counts.

**Learning concepts:** content-addressed storage, upload protocols and
integrity checks, abuse prevention, backup and restore as a tested process
(RPO and RTO).

## Sprint 4: Scheduling, preview and localization

**Goal:** the owner can schedule a publish, preview a draft, and publish in
English, Filipino and Esperanto.

Candidate changes (tentative names): `scheduled-publishing` (cron reconciler
with an atomic claim, W1), `draft-preview` (owner-only preview in `admin`,
reading Neon, W2), `content-localization` (per-field localization, per-locale
`ready` flags, Paraglide for UI strings, `/{locale}/{type}/{slug}` URLs).

**Exit criteria:** a scheduled entry publishes within the reconciler's window;
a draft is visible only through `admin`; an untranslated entry is hidden in
that locale and English must be ready before any publish.

**Learning concepts:** reconciliation loops and at-most-once claims,
eventual consistency and its SLOs, time handling in UTC, internationalization
versus localization, read-your-writes for previews.

## Sprint 5: Brand

**Goal:** both apps carry the owner's brand, and quality is measured.

Candidate changes (tentative names): `brand-identity` (tokens, type and colour
on top of `@ycmcuenca/ui`, fonts covering Latin Extended-A), `welcome-design`
(the public site's visual design), `web-analytics` (Cloudflare Web Analytics
beacon), `quality-budgets` (axe accessibility checks and Lighthouse budgets in
CI, Q3).

**Exit criteria:** every page uses the shared design tokens; all three locales
render with correct glyphs; accessibility and performance budgets pass in CI;
page views are visible in Web Analytics.

**Learning concepts:** design tokens and theming, accessibility as a
requirement, font subsetting and loading, performance budgets,
privacy-preserving analytics.

## Sprint 6: Content and 3D

**Goal:** the portfolio is filled with real content and has its 3D layer.

Candidate changes (tentative names): `portfolio-projects` (projects as a CMS
content type and the pages that list them), `threlte-scenes` (Threlte 3D on
`welcome`).

**Exit criteria:** the portfolio's projects are authored in the CMS and
published in English at least; the 3D scenes stay within the Workers Free
limits and degrade gracefully.

**Learning concepts:** content modelling against real content, progressive
enhancement, performance budgets for 3D on the web.

## After Sprint 6

Deferred work, each with the trigger that brings it in, is listed in the
parking lot of [DECISIONS.md](DECISIONS.md#parking-lot): the Workers Paid
plan, the custom domain and email, multipart uploads, `apps/auth`, OpenAPI,
the metrics dashboard and versioned internal packages.

## Recurring checks

- **Monthly:** compare usage in the Cloudflare dashboard with the Free limits
  (P3). Any limit at 70% or more for 3 days triggers the Workers Paid review.
- **Quarterly:** run the backup restore drill (I8).

## How versions relate to sprints

Each deployable app (`welcome`, `admin`) has its own semantic version, derived
by release-please from the Conventional Commits that touch it. A sprint does
not produce a version number; it produces the commits that the next release PR
turns into one. Apps stay below 1.0.0 until the owner declares the platform
stable.
