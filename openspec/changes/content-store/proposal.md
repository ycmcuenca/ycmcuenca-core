# Proposal

## Why

Neon is the CMS's source of truth (C4), and every publish starts from a stored revision (C3). Nothing in the repository stores data yet: neither app has a database binding, and there is no database package, migration path or database test. This change adds the store, which the rest of Sprint 2 builds on. It also settles the Drizzle version (Q5), the two database roles (I6) and the database tests in CI (Q1), which DECISIONS left for this change.

## What Changes

- **New package `@ycmcuenca/db`** (C1 adapter): the schema, migrations and repository functions for `entries` and `revisions`, on Drizzle ORM 0.45.4 with node-postgres. Only Drizzle's core SQL-like query builder is used, never its Relational Queries v1 API, so moving to Drizzle 1.0 later stays inside this package (owner decision, Q5).
- **Two tables.** `entries` has an id, a type and a slug that is unique per type. `revisions` is append-only and numbered per entry, and each revision stores versioned content (`content-model`). Append-only is enforced by database privileges: the runtime role can insert and read revisions, but never update or delete them.
- **Two roles (I6).** Migrations run as the project's owner role. `admin` connects as `cms_runtime`, which has no DDL rights and only the table privileges listed above. A committed check script verifies those privileges.
- **Migrations in the deploy (owner decision).** The `admin` deploy job applies pending migrations with the migrator credential, checks the runtime privileges, and only then runs `wrangler deploy`. Migrations are forward-only and follow expand-then-contract, so a rollback deploy of an older `admin` keeps working against the newer schema.
- **`admin` connects through Hyperdrive.** `admin` gains a `HYPERDRIVE` binding and the `nodejs_compat` flag that node-postgres needs. The Hyperdrive configuration is created with query caching **disabled**, because Hyperdrive's default 60-second cache would show the owner stale data right after a save. `welcome` gets no database binding (C5).
- **`admin`'s home page shows the number of entries.** This is a small, visible proof that the binding, the role and the schema work end to end, and the smoke test asserts it.
- **Local Postgres 18 in a container** (owner decision): a `compose.yaml` service matching Neon's default major version, with connection strings in a git-ignored `.env` and placeholders in a committed `.env.example`.
- **Database tests in CI on a throwaway Neon branch (Q1, amended).** A new `database` CI job creates a branch in a **separate Neon CI project**, migrates it, checks the privileges, runs the integration tests and deletes the branch. Its API key is scoped to the CI project, so CI can never reach or copy production data. The `e2e` job gets a Postgres service container so `admin` can start under `wrangler dev`.
- **Fork pull requests fail CI (owner decision).** The `database` job needs a secret that fork runs never receive, and it fails with a message saying fork pull requests are not accepted. `ci-ok` treats this as a failure.
- **Owner tasks and check scripts** (owner decision): the owner creates the Neon projects, the runtime role's password, the Hyperdrive configuration and the GitHub secrets by hand. `scripts/github/apply-settings.sh` reports whether the new secrets are present, and the privilege check script verifies the roles.

Out of scope:

- Publishing columns, KV and the projector (`revisions-publishing`).
- The `media`, `inbox` and `redirects` tables (S3, S5 and later).
- Deleting entries.
- Backups (`data-backups`, S3) and the restore drill (I8).
- Drizzle 1.0, Relational Queries and Drizzle Studio.
- Terraform or reconciler scripts for Neon and Hyperdrive (owner decision: owner tasks plus checks).

## Capabilities

### New Capabilities

- `content-store`: how entries and their append-only revisions are stored, which database rights the running app has, how the schema changes over time, and that a save is visible to the next read.

### Modified Capabilities

- `developer-workspace`: "Hello-world applications on the Workers runtime" now allows the bindings an app needs and forbids a database binding on `welcome`, and each home page only has to name its app. New requirements cover the local database and the integration test task.
- `ci-checks`: new requirements for database tests on a throwaway branch of a CI-only database, and for failing fork pull requests.
- `deployment`: new requirements for applying migrations and checking runtime privileges before `admin` is deployed.

## Impact

- **New files**: `packages/db/` (manifest, configs, schema, migrations, repository, scripts, tests), `compose.yaml`, `.env.example`, `apps/admin/src/lib/server/database.ts`, `apps/admin/src/routes/+page.server.ts`.
- **Changed files**: `apps/admin/wrangler.jsonc` and the regenerated `worker-configuration.d.ts`, `apps/admin/src/routes/+page.svelte`, `apps/admin/package.json`, `apps/admin/e2e/smoke.spec.ts`, `apps/admin/playwright.config.ts`, `apps/admin/src/lib/trust-config.test.ts`, `.github/workflows/ci.yml` (`database` job, Postgres service in `e2e`, `ci-ok`), `.github/workflows/deploy.yml` and `release-please.yml` (migration step and secret), `scripts/github/apply-settings.sh`, `turbo.jsonc` (`test:integration`, pass-through variables), root `package.json`, `renovate.json5`, `README.md`, `docs/SYSTEM_DESIGN.md` (a planned entry for expand-and-contract migrations), `bun.lock`.
- **Dependencies**: `drizzle-orm` 0.45.4, `pg` 8.23.1, `drizzle-kit` 0.31.11 and `@types/pg` 8.23.1, pinned exactly. Container image `postgres:18`, pinned by digest.
- **External systems (owner tasks)**: a Neon production project in `aws-ap-southeast-1` (Singapore) and a separate Neon CI project, both on Postgres 18 and the Free plan; a project-scoped API key for the CI project; a Hyperdrive configuration with caching disabled; GitHub secrets `NEON_MIGRATOR_URL` (in the `production` environment) and `NEON_CI_API_KEY`, plus the variable `NEON_CI_PROJECT_ID`.
- **Releases**: `feat(admin)` commits release `admin`. Its deploy runs the first migration against production.
- **Decisions**: settles Q5 (Drizzle 0.45.4, core builder only) and builds on C3, C4, C5 and I6. **It amends Q1**, which the owner approved during exploration: database tests use a separate Neon CI project rather than branches of production, and fork pull requests fail CI instead of skipping the tests. At archive, DECISIONS.md records Q5 as Decided, a new entry superseding Q1, the 60-second Hyperdrive cache fact, and the correction that Drizzle's latest real release candidate is `1.0.0-rc.4` (2026-06-27), not rc.5.
