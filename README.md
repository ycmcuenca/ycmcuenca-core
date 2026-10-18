# ycmcuenca-core

[![CI](https://github.com/ycmcuenca/ycmcuenca-core/actions/workflows/ci.yml/badge.svg)](https://github.com/ycmcuenca/ycmcuenca-core/actions/workflows/ci.yml)

The core monorepo for Yosef Christian Mercene Cuenca's personal platform: a
portfolio site (`apps/welcome`), its CMS admin (`apps/admin`) and the base for
future satellite projects. Both are SvelteKit applications built for Cloudflare
Workers and currently serve placeholder pages.

## Documentation

- [Architecture](docs/ARCHITECTURE.md): how the parts connect, and what exists
  versus what is planned.
- [Product](docs/PRODUCT.md): who the platform is for, and what it leaves out.
- [User journeys](docs/USER_JOURNEY.md): what each kind of person does, step by
  step.
- [Design](docs/DESIGN.md): how the apps should look, and which choices are
  open.
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

| Command            | What it does                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `bun run dev`      | Starts both apps: welcome on <http://localhost:5173>, admin on <http://localhost:5174>.                                         |
| `bun run build`    | Builds every app for Workers; output lands in `apps/*/.svelte-kit/cloudflare`.                                                  |
| `bun run check`    | Type-checks every app (svelte-check in strict mode; warnings fail the task).                                                    |
| `bun run lint`     | Lints the whole repository (JavaScript, TypeScript, Svelte, JSON, YAML, Markdown) with the shared ESLint config.                |
| `bun run format`   | Checks formatting with Prettier. `bun run format:write` fixes it.                                                               |
| `bun run test`     | Runs unit tests (Vitest).                                                                                                       |
| `bun run test:e2e` | Builds, then runs each app's Playwright smoke test in Chromium against `wrangler dev` — the same workerd runtime as production. |

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

`packages/edge` is internal and is never versioned on its own. A change
there reaches production only through an app release. Every change that must
ship therefore comes with a `fix(<app>)` (or `feat(<app>)`) commit that
touches each affected app — a line in that app's `hooks.server.ts`, for
example. That commit is what release-please proposes as the app's patch
release, and the deploy carries the package change along. A package change
without such a commit waits for the next app release.

## Repository settings

The settings this repository depends on are defined in committed files and
applied by one idempotent script: rebase-only merging with merged branches
deleted, Actions restricted to SHA-pinned references, Dependabot
vulnerability alerts, secret scanning and push protection, CodeQL default
setup, the `main` ruleset, and the `production` environment the deploy uses
(`.github/rulesets/main.json`, `scripts/github/apply-settings.sh`).

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
