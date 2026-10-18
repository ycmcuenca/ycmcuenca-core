# Proposal

## Why

`bootstrap-monorepo` gave the repository its local quality gates, but each one can be bypassed (`--no-verify`, `--ignore-scripts`), and `main` is unprotected: anything can be pushed or force-pushed to it. Nothing checks a pull request on a clean machine, nothing turns the Conventional Commits into versions and changelogs, and the exactly pinned dependencies have no update path. The repository is public, so its GitHub Actions setup is also an attack surface before any deploy secret exists. Closing these gaps now means `edge-infrastructure` adds its Cloudflare secrets and deploy workflow to an already gated, hardened pipeline.

## What Changes

- **Pull-request CI** (GitHub Actions, on every PR to `main` and every push to `main`): one clean-machine run of format, lint, type check, build, unit tests, the Chromium e2e smoke tests, Conventional Commit validation of every commit in the PR, `openspec validate --strict`, and workflow linting (actionlint plus zizmor, which fails on findings). One aggregate check is what branch protection requires.
- **Turborepo results cached** between CI runs with the GitHub Actions cache. Toolchain versions come from the existing pins (`packageManager`, `.node-version`).
- **Release automation with release-please**: one version, changelog and tag per app (`welcome`, `admin`). Internal packages are not versioned. Releases start fresh from this change (history before it is excluded), so the first feature release of each app is `0.1.0`, and breaking changes bump the minor version while below 1.0. One combined release PR, opened with the default `GITHUB_TOKEN`, whose CI waits for a one-click approval.
- **Repository governance as code**: a committed, idempotent settings script plus a committed ruleset definition. It allows rebase merging only, deletes merged branches, and protects `main` with a ruleset that has no bypass: PR required (0 approvals), the aggregate check required from GitHub Actions only, branch up to date before merge, linear history, no force-push or deletion. It also requires SHA-pinned actions, turns on Dependabot vulnerability alerts (Dependabot security-update PRs stay off; Renovate opens those), and turns on CodeQL default setup. The owner runs the script.
- **Supply-chain hardening**: every action pinned to a full commit SHA with its version as a comment, least-privilege `permissions` per workflow and job, and `persist-credentials: false` on checkouts.
- **Dependency updates with Renovate** (the hosted Mend app, which the owner installs). Based on `config:best-practices` (action digest pinning, release-age delay, weekly lockfile maintenance), with grouped updates on a weekly schedule, a dependency dashboard and no automerge.
- **The OpenSpec CLI becomes a pinned root dev dependency** so CI can validate specs.
- **`.codegraph/` (local code-index database) added to `.gitignore`.**
- **README updated** with the CI badge, the PR and release flow and the governance script.

Out of scope:

- The deploy workflow, Cloudflare API tokens and any Wrangler deploy step (`edge-infrastructure`).
- Drizzle migrations in CI (they arrive with `@ycmcuenca/db` in Sprint 2).
- Versioning internal packages (revisit in Sprint 2 when `cms-core` changes app behavior).
- Turborepo `--affected` filtering, a merge queue, required reviews and Renovate automerge.
- `AGENTS.md` and the living docs (`living-docs`).

## Capabilities

### New Capabilities

- `ci-checks`: What every proposed change to `main` must pass on a clean machine, how those results gate merging, and the security posture of the CI workflows themselves.
- `release-management`: How app versions, changelogs, tags and GitHub Releases are derived from Conventional Commits.
- `repository-governance`: The GitHub repository's enforced rules and settings (merge methods, `main` protection, Actions policy, security features), how they are defined as code, and how dependencies are kept current.

### Modified Capabilities

- `developer-workspace`: the public-repository hygiene requirement now also covers local tooling state (such as code-index databases), which must stay out of git.

## Impact

- **New files**: `.github/workflows/ci.yml`, `.github/workflows/release-please.yml`, `release-please-config.json`, `.release-please-manifest.json`, `renovate.json5`, `.github/rulesets/main.json`, `scripts/github/apply-settings.sh`.
- **Changed files**: `package.json` and `bun.lock` (OpenSpec CLI dev dependency), `.gitignore`, `README.md`. The `version` fields of `apps/*/package.json` are bumped by release PRs from now on.
- **External systems**: GitHub repository settings, a ruleset on `main`, Actions policy, Dependabot alerts and CodeQL (applied by the owner via the script), plus the Mend Renovate app installed on this one repository (owner task). No Cloudflare resources are touched and no secrets are added.
- **Workflow change for contributors**: after this change, `main` only changes through PRs that pass CI, and branches must be rebased onto the latest `main` before merging.
