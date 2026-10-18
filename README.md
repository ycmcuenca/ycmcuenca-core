# ycmcuenca-core

[![CI](https://github.com/ycmcuenca/ycmcuenca-core/actions/workflows/ci.yml/badge.svg)](https://github.com/ycmcuenca/ycmcuenca-core/actions/workflows/ci.yml)

The core monorepo for Yosef Christian Mercene Cuenca's personal platform: a
portfolio site (`apps/welcome`), its CMS admin (`apps/admin`) and the base for
future satellite projects. Both are SvelteKit applications built for Cloudflare
Workers and currently serve placeholder pages.

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
   `openspec validate --strict`, and a lint/audit of the workflow files
   themselves.
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

## Repository settings

The settings this repository depends on are defined in committed files and
applied by one idempotent script: rebase-only merging with merged branches
deleted, Actions restricted to SHA-pinned references, Dependabot
vulnerability alerts, secret scanning and push protection, CodeQL default
setup, and the `main` ruleset
(`.github/rulesets/main.json`, `scripts/github/apply-settings.sh`).

```sh
scripts/github/apply-settings.sh --check   # report drift, change nothing
scripts/github/apply-settings.sh           # apply drift
```

Both need `gh` authenticated as a repository admin. Once the repository
matches, the script only reports `unchanged`.

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
- Full documentation (architecture, product, roadmap) arrives with the
  `living-docs` change; this README stays minimal on purpose.
