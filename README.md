# ycmcuenca-core

[![CI](https://github.com/ycmcuenca/ycmcuenca-core/actions/workflows/ci.yml/badge.svg)](https://github.com/ycmcuenca/ycmcuenca-core/actions/workflows/ci.yml)

The core monorepo for Yosef Christian Mercene Cuenca's personal platform: a
portfolio site (`apps/welcome`), its CMS admin (`apps/admin`) and the base for
future satellite projects. Both are SvelteKit applications built for Cloudflare
Workers. `welcome` renders the content `admin` publishes.

## Documentation

- [Architecture](docs/ARCHITECTURE.md): how the parts connect, and what exists
  versus what is planned.
- [Product](docs/PRODUCT.md): who the platform is for, and what it leaves out.
- [User journeys](docs/USER_JOURNEY.md): what each kind of person does, step by
  step.
- [Design](docs/DESIGN.md): how the apps should look, and which choices are
  open.
- [System design](docs/SYSTEM_DESIGN.md): a study notebook of the system design
  concepts each sprint applies.
- [Roadmap](docs/ROADMAP.md): the sprint plan and the status of every change.
- [Decisions](docs/DECISIONS.md): the platform-wide decisions and the parking
  lot of deferred work.
- [AGENTS.md](AGENTS.md): the entry point for coding agents.

## Tools you need

| Tool                  | Version    | Why                                                                                                                                                                                               |
| --------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Bun](https://bun.sh) | 1.4.2      | Installs dependencies and runs every script. The exact version is pinned in `packageManager`.                                                                                                     |
| Node.js               | 24 LTS     | Vite, Wrangler and svelte-check run on Node. `.node-version` pins 24 (read by CI and version managers); `engines.node` is `>=24`, so a newer local Node works, but CI's Node 24 is authoritative. |
| Git                   | any recent | Hook activation happens on install.                                                                                                                                                               |

No Cloudflare account is needed for development or tests: `wrangler` runs
locally. Wrangler is a dev dependency of each app, like everything else.

## Install

```sh
bun install
```

This also runs the root `prepare` script (`lefthook install`), which activates
the git hooks. If you installed with `--ignore-scripts`, activate them
manually:

```sh
bunx lefthook install
```

## Everyday commands

| Command                    | What it does                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `bun run dev`              | Starts both apps: welcome on <http://localhost:5173>, admin on <http://localhost:5174>.                                         |
| `bun run build`            | Builds every app for Workers; output lands in `apps/*/.svelte-kit/cloudflare`.                                                  |
| `bun run check`            | Type-checks every app (svelte-check in strict mode; warnings fail the task).                                                    |
| `bun run lint`             | Lints the whole repository (JavaScript, TypeScript, Svelte, JSON, YAML, Markdown) with the shared ESLint config.                |
| `bun run format`           | Checks formatting with Prettier. `bun run format:write` fixes it.                                                               |
| `bun run test`             | Runs unit tests (Vitest).                                                                                                       |
| `bun run test:e2e`         | Builds, then runs each app's Playwright smoke test in Chromium against `wrangler dev` — the same workerd runtime as production. |
| `bun run test:integration` | Runs the database integration tests against the local Postgres container (see [Database](#database)).                           |
| `bun run db:up`            | Starts the local Postgres 18 container.                                                                                         |
| `bun run db:prepare`       | Creates the test database, the runtime role and the schema, and checks the runtime's privileges.                                |

Member tasks (`build`, `check`, `test`, `test:e2e`, `dev`) run through
Turborepo, so unchanged inputs are not rebuilt; the repository-wide tools
(`lint`, `format`) run directly from the root scripts. If a cached result
looks wrong, bypass the cache with `bunx turbo run <task> --force`.

The first `bun run test:e2e` on a machine needs Chromium once. Run it inside
an app, so the Playwright version pinned there downloads its matching browser:

```sh
cd apps/welcome
bunx playwright install chromium
```

After changing an app's `wrangler.jsonc`, refresh its generated types with
`bun run gen` inside that app and commit the changed
`worker-configuration.d.ts`.

## Database

`admin` stores the owner's content in Postgres: `entries`, each with
append-only `revisions`. Locally that is a container defined by `compose.yaml`,
and the tests use the same container. No command in this section reaches a
hosted database.

Docker is a prerequisite: Docker Desktop, OrbStack or Podman. With Podman, use
`podman compose` wherever the commands below say `docker compose`. The image is
Postgres 18, the major version the Neon projects run in production, and
Renovate keeps it current. If Neon moves to a new major, move the image with
it.

### Set up the local database

1. Copy the example environment file and replace every placeholder with a
   local value:

   ```sh
   cp .env.example .env
   ```

   `.env` is git-ignored, and this repository is public, so never commit it.

2. Start the container. It listens on `127.0.0.1:54329`, so a Postgres already
   using 5432 is left alone:

   ```sh
   bun run db:up
   ```

3. Create the integration-test database, the `cms_runtime` role and the
   schema:

   ```sh
   bun run db:prepare
   ```

   It applies only the migrations that are still pending, so run it again
   after a schema change.

4. Load `.env` into your shell before a Turborepo task that needs the database.
   Turborepo does not read `.env`, and `admin`'s dev server stops with "no
   local hyperdrive connection string" without the Hyperdrive variable:

   ```sh
   set -a; . ./.env; set +a
   ```

5. Start the apps and open <http://localhost:5174>. The page shows how many
   entries are stored, read through the local Hyperdrive binding as
   `cms_runtime`:

   ```sh
   bun run dev
   ```

6. Run the integration tests against the container:

   ```sh
   bun run test:integration
   ```

`docker compose down` stops the container and keeps its data.
`docker compose down -v` also drops the volume, which is the way back to an
empty database.

### Migration rules

The schema, the migrations and the repository functions live in
[`packages/db`](packages/db/README.md), whose README explains the grant model
and the steps for adding a migration. Three rules apply to every migration:

- **Forward-only.** Never edit or delete a migration that has been merged.
  Correct a mistake with a new migration.
- **Expand, then contract.** Add columns as nullable or with a default. Remove
  a column or a table only in a later release, after no released `admin` reads
  it, so a rollback deploy stays safe.
- **One concern per migration.**

`bun run db:prepare` applies migrations through
`packages/db/scripts/migrate.ts`, the one entry point used locally, in CI and
by the deploy. It ends by checking `cms_runtime`'s privileges, so a missing or
an extra right fails the command.

### Publishing

Publishing moves an entry's published pointer in Postgres, then writes the
entry's snapshot into the `snapshots` KV namespace. `admin` binds that
namespace as `SNAPSHOTS`, and `welcome` reads only it, never the database
([C4, C5](docs/DECISIONS.md#cms-architecture)). One namespace serves both
workers. Its id is committed in `apps/admin/wrangler.jsonc`, because an id is
not a secret.

The projection uses two key formats, built by
[`packages/cms-core/src/snapshot-keys.ts`](packages/cms-core/src/snapshot-keys.ts):

| Key                     | Value                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| `entry:<type>:<slug>`   | One entry: title, summary, rendered blocks, publish times          |
| `index:<type>:<locale>` | Every published entry with its publish times, newest publish first |

Each value is JSON with `snapshot_v: 1`. An index item's `updatedAt` is its
entry's last-update date. The field is optional, so an index written before it
existed still reads; the sitemap then shows that item's `publishedAt`. The index
is rebuilt from Postgres on every publish, never patched in place, so the next
publish repairs a missing or stale key.

Moving the pointer and marking the entry as not yet projected are one database
write. The entry stays marked until both the entry snapshot and the index are
written. If the KV write fails, `admin` shows the entry as **published, not
live** and offers a retry. A retry reads the published state from Postgres
again, so running it twice leaves the same result. Until the reconciler of
[W1](docs/DECISIONS.md#publishing-workflow) arrives, the owner presses retry.

An entry's slug can change only until its first publish. A published URL
outlives the entry's title, and changing it needs redirects. The publishing use
case refuses the change, and so does the database.

### Production (owner)

Production and CI each use their own Neon project, both on Postgres 18. CI
creates a throwaway branch per pull request, runs the migrations and the
integration tests on it, and deletes it afterwards. A pull request from a fork
cannot reach that project's key, so the `database` job refuses it instead of
skipping it. CI deletes each branch when its job ends. If one is left behind,
`neon branches list` shows it: delete any branch named `ci-*`, or wait for its
expiry.

The credentials are not in the repository. Set them once:

| Name                   | Kind     | Where                    |
| ---------------------- | -------- | ------------------------ |
| `NEON_MIGRATOR_URL`    | secret   | `production` environment |
| `NEON_CI_API_KEY`      | secret   | repository               |
| `NEON_CI_PROJECT_ID`   | variable | repository               |
| `CLOUDFLARE_API_TOKEN` | secret   | `production` environment |

`scripts/github/apply-settings.sh --check` reports a missing one as drift.

The first production run, in order:

1. Run the migrations with the owner role's unpooled connection string:
   `DATABASE_URL=<owner unpooled URL> bun --no-env-file packages/db/scripts/migrate.ts`.
   `--no-env-file` stops Bun from loading a developer's `.env`, so the run
   cannot seed `cms_runtime` with a local password. Then set `cms_runtime`'s
   login password once, in the Neon SQL editor.
2. Create the Hyperdrive configuration with the `cms_runtime` unpooled
   connection string and `--caching-disabled`, so a save is visible to the next
   read. The id is not a secret; commit it in `apps/admin/wrangler.jsonc` and
   run `bun run gen` in `apps/admin`.
3. Set `NEON_MIGRATOR_URL` with
   `gh secret set NEON_MIGRATOR_URL --env production`.

From then on the deploy applies the migrations and checks the privileges before
it uploads `admin`.

## Editing content

Open `admin` at <http://localhost:5174> to write and publish. Its home page lists
every entry with the title of its latest revision, its slug, its status and the
time of its latest save. **New article** opens the editor.

The editor shows the fields the article type describes, in that type's order, so
a new field appears with no page change. The body is one Markdown block in a
plain text area, posted as one `body` field; a body stored as several blocks is
joined back into that one field. **Preview** renders the current, unsaved text
with the same rendering a publish uses, so the preview and the public page share
their markup. A preview writes nothing and adds no revision.

**Save** appends a revision and leaves every earlier revision unchanged. Saving
without a change adds nothing and says "No changes to save.". A slug can change
until the entry's first publish. After that the form shows it read-only with the
note "Published slugs cannot change." and ignores a posted value. A save that
changes only the slug updates the slug and adds no revision.

The components live in [`packages/ui`](packages/ui/README.md), whose README
states the security policy every component must keep.

## Public site

`welcome` serves the public site from the snapshots `admin` publishes. It reads
only KV, never the database ([C4, C5](docs/DECISIONS.md#cms-architecture)), so
a database outage cannot take the site down.

| Route                 | What it serves                                                            |
| --------------------- | ------------------------------------------------------------------------- |
| `/`                   | `Welcome`, the site introduction and the published articles, newest first |
| `/en/articles/[slug]` | One published article; an unknown slug answers 404                        |
| `/sitemap.xml`        | The home page and every published article, each with its last-update date |
| `/en/feed.xml`        | An Atom feed of the published articles                                    |

`apps/welcome/wrangler.jsonc` sets `SITE_ORIGIN`, the one origin behind every
absolute URL: canonical links, the sitemap, the feed and the `Sitemap:` line in
`static/robots.txt`. It names production under `bun run dev` too, so a local
page or a preview URL never claims to be canonical. Changing the origin means
changing both that variable and `static/robots.txt`; a unit test keeps them
equal.

To see an article under `bun run dev`, seed the local KV the dev server reads.
Run these from `apps/welcome`, with values that match the snapshot shape
described in [Publishing](#publishing):

```sh
cd apps/welcome
bunx wrangler kv key put "entry:article:hello-world" \
  '{"snapshot_v":1,"type":"article","slug":"hello-world","title":"Hello, world","summary":"The first article.","blocks":[{"type":"markdown","html":"<p>First paragraph.</p>"}],"publishedAt":"2026-11-01T09:00:00.000Z","updatedAt":"2026-11-01T09:00:00.000Z"}' \
  --local --binding SNAPSHOTS
bunx wrangler kv key put "index:article:en" \
  '{"snapshot_v":1,"type":"article","locale":"en","items":[{"slug":"hello-world","title":"Hello, world","summary":"The first article.","publishedAt":"2026-11-01T09:00:00.000Z","updatedAt":"2026-11-01T09:00:00.000Z"}]}' \
  --local --binding SNAPSHOTS
```

Then open <http://localhost:5173/en/articles/hello-world>. These commands write
to `apps/welcome/.wrangler/state`, the directory `vite dev` reads. The e2e
suite seeds its own state in `.wrangler/e2e-state`, so the two never mix.

## Commits

- Pre-commit formats and lints only the staged files with Lefthook and
  re-stages the fixes; files that still fail linting abort the commit.
- Commit-msg enforces Conventional Commits (`type(scope): subject`) via
  commitlint, because release automation derives versions and changelogs
  from them.
- `LEFTHOOK=0 git commit ...` bypasses the hooks once, and CI re-checks every
  commit message (and the rest) anyway, so hooks are a convenience, not the
  gate.

## How changes land

`main` only changes through pull requests that pass CI:

1. Open a pull request against `main`. CI (`.github/workflows/ci.yml`) runs
   on it: format, lint, type check, build, unit tests, the Playwright smoke
   tests, a Conventional Commits check of every commit it adds,
   `openspec validate --strict`, the living-documents check, and a lint/audit
   of the workflow files themselves.
2. Fix anything red and push again; a newer push cancels the older run.
3. When the run is green, its `ci-ok` aggregate check passes. The `main`
   ruleset requires exactly that check, so it fails whenever anything real
   fails.
4. If the branch is behind `main`, update it from `main` and wait for `ci-ok`
   again (the ruleset requires an up-to-date branch), then merge with
   **Rebase and merge** — the only method the repository offers. The head
   branch is deleted automatically.

## Releases

Each app (`welcome`, `admin`) has its own version, changelog, git tag and
GitHub Release, all derived from the Conventional Commits that touch its
directory. No version is ever edited by hand.

- Every push to `main` runs `.github/workflows/release-please.yml`, which
  keeps one open release pull request that bumps each app with releasable
  changes since its last release (a `feat` below 1.0 bumps the minor version)
  and updates its changelog. Commits before the `bootstrap-sha` recorded in
  `release-please-config.json` are excluded, so each app's first feature
  release is `0.1.0`.
- The release pull request is opened with the workflow's own short-lived
  token, which GitHub starts in an approval-required state: open the run and
  click **Approve workflows to run** (again after every push to that pull
  request). Its changelog is the review; merging it is what publishes.
- Merging the release pull request creates the tags and GitHub Releases
  (for example `welcome-v0.1.0`) with the changelog notes. Internal packages
  (`packages/*`) are not versioned.

## Deploying

A release deploys itself; nobody runs `wrangler deploy` by hand.

- Merging a release pull request tags each released app (see Releases).
  `.github/workflows/deploy.yml` then deploys that app from its tag, inside
  the `production` environment. The environment is the only place that holds
  `CLOUDFLARE_API_TOKEN` (secret) and `CLOUDFLARE_ACCOUNT_ID` (variable), and
  its branch policy lets only `main` use them.
- The job checks out the tag, runs the app's checks, tests and build, deploys
  with `bunx wrangler deploy`, and then runs
  `scripts/deploy/smoke-check.sh <app>`. A failed smoke check leaves the run
  red; the version that was serving keeps serving.
- To deploy by hand — a rollback, for example — start the workflow yourself:
  **Actions** → **Deploy** → **Run workflow**, then give the app and the
  version to deploy, such as `0.1.0`. It builds the matching tag and runs the
  same checks and smoke test. Name an older version to roll back.
- Both smoke checks also run standalone against the production URLs:

  ```sh
  scripts/deploy/smoke-check.sh welcome
  scripts/deploy/smoke-check.sh admin
  ```

  `welcome` must answer 200 with the security headers; `admin` must refuse an
  anonymous request (302, 401 or 403) and never serve the app. Pass a second
  argument to point a check at another URL, for example a local
  `wrangler dev`.

- **Token rotation:** roll the deploy token in the Cloudflare dashboard
  (**My Profile** → **API Tokens** → **Roll**), then update the secret:

  ```sh
  gh secret set CLOUDFLARE_API_TOKEN --env production
  ```

  The next deploy authenticates with the new token. No code or workflow
  change is needed.

- **Deploy token:** an account-owned token with **Workers Scripts: Edit** on
  the one account, the only permission its deploys have needed. If a deploy
  is ever refused, the API names the missing permission.

## Cloudflare Access

`admin` is closed twice over. Cloudflare Access sits in front of every route,
and the worker itself verifies the `Cf-Access-Jwt-Assertion` header against
the team's key set (`accessGuard` in `apps/admin/src/hooks.server.ts`). A
request without a valid token is answered with 403, so a misconfiguration
fails closed.

The Zero Trust setup is committed as code under
`scripts/cloudflare/access/`, applied by a compare-then-apply script: one
One-time PIN identity provider, one `owner-only` policy for the owner's
email, and two Worker-level applications (`admin` for all traffic, `welcome`
for preview URLs only). The script reads `CLOUDFLARE_API_TOKEN` (a personal
Access-admin token, never stored in GitHub), `CLOUDFLARE_ACCOUNT_ID` and
`OWNER_EMAIL`:

```sh
OWNER_EMAIL=... CLOUDFLARE_API_TOKEN=... scripts/cloudflare/apply-access.sh --check
OWNER_EMAIL=... CLOUDFLARE_API_TOKEN=... scripts/cloudflare/apply-access.sh
```

`--check` reports drift and changes nothing; the plain run applies it and
never deletes an application, so each keeps its AUD. The script prints
`admin`'s AUD, which is committed as `ACCESS_AUD` in
`apps/admin/wrangler.jsonc`; the deployed worker trusts exactly that
application. The owner signs in with a one-time PIN sent to the owner's
email — the policy includes that one address, so codes go nowhere else.

If an application is deleted by hand, the next run recreates it with a new
AUD. The committed AUD no longer matches, `admin` stays closed, and
`--check` reports the mismatch until the new AUD is committed and `admin`
redeployed.

**Access-admin token:** Access: Apps and Policies Edit, Access:
Organizations, Identity Providers, and Groups Edit, and Workers Scripts
Read.

## Shipping shared-package changes

`packages/edge` and `packages/db` are internal and are never versioned on
their own. A change there reaches production only through an app release.
Every change that must ship therefore comes with a `fix(<app>)` (or
`feat(<app>)`) commit that touches each affected app — a line in that app's
`hooks.server.ts`, or a dependency in its `package.json`, for example. That
commit is what release-please proposes as the app's patch release, and the
deploy carries the package change along. A package change without such a
commit waits for the next app release.

## Repository settings

The settings this repository depends on are defined in committed files and
applied by one idempotent script: rebase-only merging with merged branches
deleted, Actions restricted to SHA-pinned references with a read-only default
workflow token that may create pull requests (release-please's release PR),
Dependabot vulnerability alerts, secret scanning and push protection, CodeQL
default setup, the `main` ruleset, and the `production` environment the deploy
uses (`.github/rulesets/main.json`, `scripts/github/apply-settings.sh`).

```sh
scripts/github/apply-settings.sh --check   # report drift, change nothing
scripts/github/apply-settings.sh           # apply drift
```

Both need `gh` authenticated as a repository admin. Once the repository
matches, the script only reports `unchanged`. It also reports the
`production` environment's credentials by name; it cannot set them, and a
missing one counts as drift.

**Break-glass:** if the ruleset ever blocks an emergency fix, an admin can
disable it in the repository's ruleset settings (or through the API), land the
fix, and then re-run the script to restore the committed rules.

## Specs (OpenSpec)

The specs under `openspec/` are this repository's source of truth. The
OpenSpec CLI is a pinned dev dependency here, so use it through `bunx` (the
same version CI validates with):

```sh
bunx openspec validate --all --strict --no-interactive
```

## Dependencies (Renovate)

The Mend Renovate app keeps dependencies current, with no automerge: every
update is proposed as a pull request that passes `ci-ok` and waits for the
owner.

- Updates are grouped (SvelteKit runtime, Cloudflare tooling, lint/format,
  tests, build, commit tooling, the OpenSpec CLI, GitHub Actions, toolchain
  pins) and proposed inside one weekly window: Mondays 00:00–05:59
  `Asia/Manila`. Security fixes ignore the window.
- npm updates wait for a minimum release age of **3 days**
  (`security:minimumReleaseAgeNpm`); vulnerability fixes skip the age too and
  are committed as `fix(deps)`.
- Major updates wait on Renovate's Dependency Dashboard issue for approval.
  Vitest stays below 5 and TypeScript below 7 until their blockers lift (see
  Maintenance notes).
- Libraries bundled into the deployed apps (`svelte`, `@sveltejs/*`) are
  committed as `fix(deps)`, so each app they touch is proposed for a patch
  release; everything else is `chore(deps)`.
- The configuration lives in `renovate.json5`; the dashboard issue is where
  config errors and pending majors appear.

## Maintenance notes

- **Bun version mismatches are silent.** Bun 1.4.2 neither warns nor fails when
  the running Bun differs from the `packageManager` version (verified
  2026-10-17 by running 1.4.2 against declared `bun@1.0.0` and `bun@99.0.0`,
  with and without dependencies). CI added in `ci-release-pipeline` is what
  actually guarantees the version: `setup-bun` reads `packageManager` (no
  version input), and every job installs with
  `bun install --frozen-lockfile`.
- **Deliberately one major behind:** Vitest 4 (5.x exists, but
  `@cloudflare/vitest-pool-workers` requires Vitest ^4.1), TypeScript 6 (7.x
  exists, but svelte-check supports up to 6) and Node 24 LTS (26 is not LTS
  yet). Revisit when the Workers Vitest pool supports Vitest 5, when
  svelte-check supports TypeScript 7, and when Node 26 becomes LTS. Renovate's
  configuration holds each of these inside its current major
  (`allowedVersions` in `renovate.json5`); other majors wait on the
  Dependency Dashboard for approval.
