# Design

## Context

See proposal.md for the motivation, `specs/content-store/spec.md` for the store's behavior, and the `developer-workspace`, `ci-checks` and `deployment` deltas for the workspace, CI and deploy rules.

Current state, observed on 2026-10-19:

- `@ycmcuenca/cms-core` exists (from `content-model`): `validateArticle`, `storedContent`/`readStoredContent` (`schema_v: 1`, content without the slug).
- `apps/admin/wrangler.jsonc` declares `compatibility_flags: ["nodejs_als"]` with the comment "`nodejs_compat` waits until a library actually needs it", plus `vars` for Access and no bindings. `apps/admin/src/lib/trust-config.test.ts` reads it with Wrangler's `unstable_readConfig`.
- `apps/admin/playwright.config.ts` starts the Access key-set fixture (port 8799) and `wrangler dev --port 8788` with `--var` overrides. `apps/admin/e2e/smoke.spec.ts` signs a token and asserts the `Admin` heading. `apps/admin/src/routes/+page.svelte` renders only `<h1>{appName}</h1>`.
- `.github/workflows/ci.yml` has jobs `verify`, `e2e`, `commits`, `specs` and `workflows`, plus `ci-ok`, whose `check_result` fails on any skip except `commits` on push. `deploy.yml` runs `check test build`, then `wrangler deploy`, then the smoke check, in the `production` environment; `release-please.yml` passes `CLOUDFLARE_API_TOKEN` to it through `secrets:`.
- `scripts/github/apply-settings.sh` step 7 manages the `production` environment and reports the Cloudflare secret and variable by name.
- `turbo.jsonc` has no `env` or `passThroughEnv` keys, so Turborepo's default strict mode hides every unlisted environment variable from tasks.
- `.gitignore` ignores `.env` and `.env.*` but not `.env.example`.

### Versions and facts verified (2026-10-19)

| Item                         | Version or fact                                                                                                                                                                                                                            | Source                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Drizzle                      | `drizzle-orm` latest 0.45.4 (2026-10-08); newest real release candidate `1.0.0-rc.4` (2026-06-27); "rc.5" exists only as a snapshot build (`1.0.0-rc.5-5935859`). `drizzle-kit` latest 0.31.11 (2026-09-21)                                | npm registry (`dist-tags`, `time`)                                                       |
| Drizzle 0.x to 1.0           | breaking changes: Relational Queries v1 removed (replaced by `defineRelations`), new migration folder layout converted by `drizzle-kit up`. The core query builder is not listed                                                           | Context7 `/websites/orm_drizzle_team` (upgrade-v1, v0-v1-changes)                        |
| Drizzle migrations           | `migrate(db, { migrationsFolder })` from `drizzle-orm/node-postgres/migrator` applies pending migrations and skips applied ones; the log table is `__drizzle_migrations` in schema `drizzle` by default                                    | Context7 `/websites/orm_drizzle_team` (migrations, drizzle-config-file)                  |
| Drizzle and pg               | `drizzle-orm@0.45.4` peer-depends on `pg >=8` and `@types/pg`                                                                                                                                                                              | npm registry                                                                             |
| pg                           | 8.23.1; `@types/pg` 8.23.1                                                                                                                                                                                                                 | npm registry                                                                             |
| Hyperdrive drivers           | node-postgres is the recommended driver (minimum `pg@8.13.0`) and needs `nodejs_compat`; create a new client per request, Hyperdrive pools                                                                                                 | Context7 `/websites/developers_cloudflare_hyperdrive` (supported drivers, node-postgres) |
| Hyperdrive and Neon          | connect with pg or Postgres.js, not the Neon serverless driver; use the connection string **without** connection pooling                                                                                                                   | Context7 `/websites/developers_cloudflare_hyperdrive` (Neon)                             |
| Hyperdrive caching           | read caching is on by default (`max_age` 60 s, `stale_while_revalidate` 15 s); a write does not invalidate cached reads; `--caching-disabled` turns it off per configuration                                                               | Context7 `/websites/developers_cloudflare_hyperdrive` (query caching, read-after-write)  |
| Hyperdrive local development | `wrangler dev` connects directly (no pooling or caching) to `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_<BINDING>` or `localConnectionString`; the environment variable keeps credentials out of the repository                         | Context7 `/websites/developers_cloudflare_hyperdrive` (local development)                |
| Hyperdrive Free              | 100,000 queries a day                                                                                                                                                                                                                      | DECISIONS.md facts table (2026-10-18)                                                    |
| Neon projects                | the CLI creates projects on Postgres 18 by default; region `aws-ap-southeast-1` exists                                                                                                                                                     | Context7 `/websites/neon` (CLI projects create)                                          |
| Neon roles                   | roles created with SQL (`CREATE ROLE … LOGIN PASSWORD`) do not get `neon_superuser` and have only default `public` schema rights; passwords need 60 bits of entropy. Branches copy their parent's roles and passwords (unprotected parent) | Context7 `/websites/neon` (manage roles, protected branches)                             |
| Neon API keys                | a project-scoped key "cannot create projects, mint API keys, or read any other project. It can still change and delete everything inside that project"                                                                                     | Context7 `/websites/neon` (CLI api-keys)                                                 |
| Neon branch actions          | `neondatabase/create-branch-action@v6` (inputs `project_id`, `branch_name`, `api_key`, `role`; outputs `db_url`, `branch_id`) and `neondatabase/delete-branch-action@v3` (`project_id`, `branch`, `api_key`). Do not log `db_url`          | Context7 `/websites/neon` (GitHub integration, branching with GitHub Actions)            |
| Turborepo environment        | `envMode` defaults to `strict`: a task sees only variables listed in `env`/`globalEnv` or `passThroughEnv`/`globalPassThroughEnv`                                                                                                          | Context7 `/vercel/turborepo` (configuration reference)                                   |

## Goals / Non-Goals

**Goals:**

- The running app physically cannot rewrite history: append-only is a database privilege, not a coding convention.
- A schema change is proven three times before production: locally, on a CI branch and by the deploy's privilege check.
- No database credential can reach a pull-request job that could touch production.

**Non-Goals:**

- Connection pooling inside the worker (Hyperdrive pools).
- Zero-downtime schema changes beyond expand-then-contract. One owner and one `admin` version at a time do not need more.

## Decisions

### D1. Drizzle 0.45.4 with the core query builder only (Q5)

- `@ycmcuenca/db` depends on `drizzle-orm` 0.45.4 and `pg` 8.23.1, with dev dependencies `drizzle-kit` 0.31.11 and `@types/pg` 8.23.1.
- Code uses `pgTable`, `db.select()`, `db.insert()`, `db.update()` and `db.transaction()`. It never calls `db.query.*` or defines `relations()`, the Relational Queries v1 API that Drizzle 1.0 removes. A `no-restricted-syntax` ESLint rule in `packages/db/eslint.config.js` flags member access `.query.` on the database object, and `no-restricted-imports` blocks `drizzle-orm/relations`.
- **Pattern:** [hexagonal architecture (ports and adapters)](../../../docs/SYSTEM_DESIGN.md#hexagonal-architecture-ports-and-adapters). Drizzle lives only in this adapter package, so the upgrade's reach is one package.
- **Why not the RC (Q5's original lean):** the RC line has been quiet for four months while 0.x ships fixes, and the repository pins every version exactly, so an RC pin would freeze a pre-release. The owner chose 0.45.4.
- **Alternatives:** _`1.0.0-rc.4`_ (see above); _Kysely_ (a good query builder, but DECISIONS and the roadmap name Drizzle, and its migrations tooling is thinner); _raw SQL with `pg`_ (the most transparent, but typed results and migration generation would be hand-written).
- **Failure modes:** _Drizzle 1.0 ships and Renovate proposes it:_ the upgrade is `drizzle-kit up` plus the version bump inside this package, and CI's `database` job proves the migrations still apply.

### D2. Schema

```text
entries   id uuid pk default gen_random_uuid()
          type text not null            -- 'article'
          slug text not null
          created_at timestamptz not null default now()
          unique (type, slug)

revisions id uuid pk default gen_random_uuid()
          entry_id uuid not null references entries(id)
          number integer not null       -- 1, 2, 3 ... per entry
          schema_v integer not null
          content jsonb not null        -- cms-core stored content, without schema_v
          created_at timestamptz not null default now()
          unique (entry_id, number)
```

- `src/schema.ts` declares both tables. `gen_random_uuid()` is built into Postgres 13 and later, so no extension is needed.
- The slug is on the entry because it must be unique per type. A revision stores what the owner wrote (`content-model` D4).
- `appendRevision` computes `number` as `coalesce(max(number), 0) + 1` for the entry inside a transaction. The unique constraint turns a concurrent duplicate into an error instead of a silent overwrite; with one owner this should never happen, and the error message says so.
- **Pattern:** [event-sourcing-lite append-only revisions](../../../docs/SYSTEM_DESIGN.md#event-sourcing-lite-append-only-revisions).
- **Alternatives:** _a sequence or identity column for `number`_ (global, not per entry); _a `current_content` column on `entries`_ (a second copy of the latest revision that can drift; the latest revision is one indexed query away).
- **Failure modes:** _an entry with no revision:_ `createEntry` inserts the entry and revision 1 in one transaction, so both exist or neither does.

### D3. Roles and privileges (I6)

- **Migrator:** the Neon project's owner role (`neondb_owner`, created with the project), and the `postgres` superuser locally. It owns the schema and runs migrations. Its connection string exists only in the GitHub `production` environment (`NEON_MIGRATOR_URL`), in the owner's shell and in the local `.env`.
- **Runtime:** `cms_runtime`, created with SQL so it does not inherit `neon_superuser`. Its rights are granted in a migration:
  - `USAGE` on schema `public`;
  - `SELECT, INSERT, UPDATE` on `entries`;
  - `SELECT, INSERT` on `revisions`.

  Postgres 15 and later no longer give `PUBLIC` the right to create objects in `public`, so `cms_runtime` cannot run DDL.

- `packages/db/scripts/ensure-runtime-role.ts` (Bun, `pg`) runs as the migrator before migrations:
  1. Create `cms_runtime NOLOGIN` if it is absent.
  2. `GRANT cms_runtime TO CURRENT_USER`, so tests and the privilege check can `SET ROLE cms_runtime`.
  3. If `RUNTIME_ROLE_PASSWORD` is set (locally and in CI's `e2e` job only), `ALTER ROLE cms_runtime LOGIN PASSWORD …`.

  In production the owner sets the login password once, by hand (owner task), and the password goes only into the Hyperdrive configuration.

- `packages/db/scripts/check-privileges.ts` uses only read-only `has_table_privilege` and `has_schema_privilege` calls for `cms_runtime`. It compares them with the expected set (above, plus "no `CREATE` on `public`", "no `UPDATE`/`DELETE`/`TRUNCATE` on `revisions`" and "no `DELETE`/`TRUNCATE` on `entries`"), prints one line per right, and exits non-zero on any difference.
- **Pattern:** [least privilege](../../../docs/SYSTEM_DESIGN.md#least-privilege). Append-only is enforced where it cannot be bypassed by app code.
- **Alternatives:** _a Console-created runtime role_ (Neon gives it `neon_superuser`, far too much); _a trigger that rejects updates_ (the table owner could still disable it, and privileges are simpler and reported by the check).
- **Failure modes:** _someone grants `cms_runtime` extra rights by hand:_ the deploy's privilege check fails before the upload (deployment spec). _The runtime password leaks:_ the role can only read and append content, and the owner rotates it with `ALTER ROLE` plus `wrangler hyperdrive update`.

### D4. Migrations: generated, forward-only, expand then contract

- Authoring: `packages/db/drizzle.config.ts` (`dialect: "postgresql"`, `schema: "./src/schema.ts"`, `out: "./migrations"`), with `bun run --filter @ycmcuenca/db db:generate` running `drizzle-kit generate`. Grants live in a custom migration (`drizzle-kit generate --custom --name runtime-grants`), because Drizzle's schema does not model privileges.
- Applying: `packages/db/scripts/migrate.ts` runs `ensure-runtime-role`, then `migrate(db, { migrationsFolder })` from `drizzle-orm/node-postgres/migrator`, then the privilege check. It reads `DATABASE_URL` (a migrator connection) and is the only migration entry point, used locally, in CI and in the deploy.
- **Rules,** written in `packages/db/README.md`:
  - **Forward-only:** never edit or delete a merged migration.
  - **Expand, then contract:** add columns as nullable or with a default; remove a column or table only in a later release, after no released `admin` reads it.
  - **One concern per migration.**
- **Pattern:** [expand and contract migrations](../../../docs/SYSTEM_DESIGN.md#expand-and-contract-migrations). The notebook has no entry yet, so this change adds a planned one to `docs/SYSTEM_DESIGN.md` (config rule).
- **Alternatives:** _`drizzle-kit push`_ (no migration history, unsafe for production); _down migrations_ (Drizzle has none, and a rollback that drops data is worse than a backward-compatible schema).
- **Failure modes:** _a migration that only works for the new code:_ the rule review in the PR, plus the Rollback deploy scenario that `revisions-publishing`'s first expand migration exercises (task in that change). _Two branches add migrations in parallel:_ rebase-merging serializes them, and the `database` CI job applies them in order on a fresh branch.

### D5. `admin` connects through Hyperdrive with caching disabled

- `apps/admin/wrangler.jsonc` gains `"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<id>" }]` and `nodejs_compat` in `compatibility_flags` (keeping `nodejs_als`). The id is not a secret: it is useless without the account's credentials. The connection string lives in the Hyperdrive configuration, never in the repository.
- The owner creates the configuration with `wrangler hyperdrive create admin-cms --connection-string="<cms_runtime unpooled URL>" --caching-disabled` (owner task).
- `apps/admin/src/lib/server/database.ts` exports `withDatabase(work)`. It reads `env.HYPERDRIVE.connectionString` through `import { env } from "cloudflare:workers"` and calls `connectDatabase` from `@ycmcuenca/db`, which creates a new `pg.Client`, connects, wraps it with `drizzle({ client })`, runs `work`, and always `end()`s the client. That is one client per request, as Hyperdrive recommends.
- **Why caching is off:** Hyperdrive's default caches identical reads for 60 s and does not invalidate them on write (verified). The owner would save and then see the old revision list, which breaks the spec's "A save is visible to the next read". `admin`'s reads are few, so the cache would save almost nothing.
- **Alternatives:** _two configurations, cached and uncached_ (Cloudflare's documented pattern, but `admin` has no read that benefits from caching); _the Neon serverless driver over HTTP_ (Cloudflare's Neon guide says to use pg through Hyperdrive instead).
- **Failure modes:**
  - _`pg` does not bundle for workerd through SvelteKit's Vite build:_ task 2.1 spikes this first. If it fails, stop and ask the owner (fallback: Postgres.js, which Hyperdrive also supports).
  - _A Neon cold start (scale to zero after 5 minutes) adds latency:_ that is wall time, not CPU time, so it does not count against the 10 ms CPU limit.
  - _Hyperdrive's 100,000 queries a day:_ one owner uses `admin`, far below the limit.

### D6. Local database

- `compose.yaml` at the repository root defines one service, `postgres`: image `postgres:18` pinned by digest (task 1.3 resolves it), port `127.0.0.1:54329:5432` (so it doesn't clash with a Postgres already on 5432), `POSTGRES_PASSWORD` read from `.env`, and a named volume.
- `.env.example` (committed, placeholders only) lists `POSTGRES_PASSWORD`, `DATABASE_URL` (migrator, database `cms`), `DATABASE_URL_TEST` (database `cms_test` for integration tests), `RUNTIME_ROLE_PASSWORD` and `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` (the runtime role on `cms`). `.gitignore` already ignores `.env`; it keeps `.env.example`.
- Root scripts: `db:up` (`docker compose up -d --wait postgres`) and `db:prepare` (create the `cms_test` database if absent, then `migrate.ts` against both databases).
- `turbo.jsonc`: `dev` and `test:e2e` get `passThroughEnv: ["CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE"]`; a new `test:integration` task (`cache: false`) gets `passThroughEnv: ["DATABASE_URL_TEST"]`. Pass-through variables don't change cache keys, which is right for credentials.
- **Alternatives:** _a Neon dev branch_ (the owner chose the container: offline, free, fast to reset); _PGlite in-process_ (not the same server, so it can't test privileges).
- **Failure modes:** _Docker is not installed:_ `db:up` fails with Docker's own error, and the README names Docker Desktop, OrbStack or Podman (with `podman compose`) as prerequisites. _The image's major version drifts from Neon's:_ the image is pinned to 18, Renovate proposes updates, and the README says to match Neon's major version.

### D7. CI: a throwaway branch in a separate Neon CI project (Q1, amended)

New job `database` in `.github/workflows/ci.yml`, with `permissions: { contents: read }`:

1. **Require the credential.** If `NEON_CI_API_KEY` is empty, which is always the case for fork pull requests, print "Pull requests from forks are not accepted; see README" and exit 1. The secret reaches the step through `env`, never through a `${{ }}` in `run:`.
2. **Create the branch** with `neondatabase/create-branch-action` v6 (pinned by SHA in task 4.1). Inputs: `project_id: ${{ vars.NEON_CI_PROJECT_ID }}`, `api_key`, `branch_name: ci-${{ github.run_id }}-${{ github.run_attempt }}`. If the action has an expiry input, it is set to one hour as a safety net (task 4.1 checks).
3. Checkout, toolchain and install, as in `verify`.
4. `bun packages/db/scripts/migrate.ts` with `DATABASE_URL` set to the action's `db_url` output (the project owner role on the branch). This also runs the privilege check.
5. `bun run test:integration` with `DATABASE_URL_TEST` set to the same URL.
6. **Delete the branch** (`if: always()`) with `neondatabase/delete-branch-action` v3.

The CI project's default branch holds only the schema history of earlier runs, no content. `ci-ok` adds `database` to `needs`, with no new expected skip.

- **Pattern:** [branch-per-PR database testing](../../../docs/SYSTEM_DESIGN.md#branch-per-pr-database-testing), with [least privilege](../../../docs/SYSTEM_DESIGN.md#least-privilege): a project-scoped key "can still change and delete everything inside that project" (verified), so the project it can reach holds nothing of value.
- **Secrets:** `NEON_CI_API_KEY` is a repository secret and `NEON_CI_PROJECT_ID` a repository variable. Pull-request jobs from this repository's branches receive them; fork runs don't (GitHub's rule, and the existing ci-checks requirement "Untrusted code never receives secrets"). Renovate's branches live in this repository, so its pull requests run the job.
- **Why fork PRs fail rather than skip (owner decision):** the owner doesn't accept outside contributions, and a skipped database check could merge an untested migration.
- **Alternatives:** _branches of the production project_ (the original Q1: the CI key could delete production, and branches copy production data); _a Postgres service container only_ (no secret and works for forks, but the owner wants branch-per-PR testing as practice); _container tests plus a Neon migration check_ (the most coverage, with two database jobs to maintain).
- **Failure modes:** _the delete step fails:_ the branch stays until the expiry (if supported) or until the owner deletes it; Neon's Free plan archives idle branches, and the README documents `neon branches list` for cleanup. _The Free plan's branch or compute limits:_ each run uses one short-lived branch for about two minutes.

### D8. The `e2e` job gets a Postgres service container

- The `e2e` job adds `services.postgres` (the same pinned `postgres:18` digest as `compose.yaml`, port 5432, `POSTGRES_PASSWORD: e2e-only`). The value is not a secret: the container lives only for the job and is reachable only from the runner.
- A step after install runs `bun run db:prepare` with `DATABASE_URL`, `RUNTIME_ROLE_PASSWORD` and the Hyperdrive local variable set through job `env`, so `wrangler dev` connects `admin` to it.
- **Failure modes:** _zizmor flags the literal password:_ if it does, the task records the finding's name and adds a scoped `# zizmor: ignore[...]` with the reason, as `release-please.yml` already does for `self-repository`.

### D9. The deploy applies migrations before uploading `admin`

- `deploy.yml` gains a step after "Check, test and build the app" and before "Deploy with Wrangler": `if: inputs.app == 'admin'`, `env: DATABASE_URL: ${{ secrets.NEON_MIGRATOR_URL }}`, `run: bun packages/db/scripts/migrate.ts`. Because `migrate.ts` ends with the privilege check, drift stops the deploy.
- `workflow_call.secrets` gains `NEON_MIGRATOR_URL` (`required: false`, because `welcome` deploys don't need it), and `release-please.yml`'s `deploy-admin` job passes it. A `workflow_dispatch` run reads it from the `production` environment directly.
- The step runs from the release tag's checkout, so a rollback deploy applies that tag's migrations, which are already applied: the migrator skips them (spec, "Rollback deploy").
- **Pattern:** [release trains from Conventional Commits](../../../docs/SYSTEM_DESIGN.md#release-trains-from-conventional-commits): a schema change ships with the app release that needs it.
- **Alternatives:** _a manual migration workflow_ (the owner rejected it: easy to forget); _migrating at runtime_ (violates I6 and the 10 ms CPU limit).
- **Failure modes:** _the migration succeeds but `wrangler deploy` fails:_ the old worker runs against the new schema, which expand-then-contract makes safe. _The secret is missing:_ `migrate.ts` exits with "DATABASE_URL is not set", before anything is uploaded.

### D10. Settings checks and owner documentation

- `scripts/github/apply-settings.sh`: step 7 also reports `NEON_MIGRATOR_URL` by name in the `production` environment. A new step 8 reports the repository secret `NEON_CI_API_KEY` and the variable `NEON_CI_PROJECT_ID` by name. As with the Cloudflare credentials, it cannot set them, so a missing one is drift under `--check`.
- `README.md` gains a "Database" section: prerequisites (Docker or Podman), `cp .env.example .env`, `bun run db:up`, `bun run db:prepare`, `bun run test:integration`, the migration rules (D4), and the owner's production setup (D11, Migration Plan).

### D11. `admin`'s home page shows the entry count

- `apps/admin/src/routes/+page.server.ts` loads `countEntries()` through `withDatabase`. `+page.svelte` keeps `<h1>{appName}</h1>` and adds `<p>{count} entries</p>` (with "1 entry" for one).
- It is the smallest real use of the binding: the e2e test proves Hyperdrive's local connection, the runtime role and the schema together, and `admin-editor` later replaces it with the entry list.

## Risks / Trade-offs

- [`pg` may not bundle for workerd through SvelteKit] → task 2.1 spikes it first, with a stop for the owner.
- \[The Neon Free plan may not allow a second project] → owner task 1.1 checks it first. If it doesn't, stop and ask the owner (options: a second Neon account, or the container-only CI the owner turned down).
- \[A pull request's database job uses a secret] → the secret reaches only the CI project, which holds no content.
- \[Migrations before upload could leave a new schema with an old worker] → expand-then-contract; the deployment spec's "Rollback deploy" scenario.
- [A cold Neon compute makes the first `admin` request slow] → wall time only, inside Access-protected owner use; acceptable.

## Migration Plan

1. Owner: create the Neon production project (Singapore, Postgres 18) and the Neon CI project, and confirm the Free plan allows both (task 1.1).
2. Merge-time order, all in this change's branch before merge: local verification, then the owner creates `cms_runtime`'s password and the Hyperdrive configuration, commits the Hyperdrive id, and sets the GitHub secrets (tasks 6.x).
3. The release PR for `admin` deploys: the deploy runs migration 0000 and the grants, checks privileges, then uploads the worker.
4. Rollback: redeploy the previous `admin` tag. It has no database code and ignores the tables, which stay.

## Assumptions

- **A1.** The ubuntu-24.04 runner can pull `postgres:18` as a service container, which is standard GitHub Actions behavior.
- **A2.** `neondatabase/create-branch-action` v6's `db_url` output uses the project's default owner role when `role` is not given. Task 4.1 confirms this from the action's `action.yml` at the pinned SHA.
- **A3.** Deploying a worker with a Hyperdrive binding needs no Cloudflare permission beyond the deploy token's Workers Scripts: Edit. Task 6.4 confirms it on the first deploy and adds only the permission named if it is refused.
