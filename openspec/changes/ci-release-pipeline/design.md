# Design

## Context

See proposal.md for the motivation, and the specs `ci-checks`, `release-management`, `repository-governance` and the `developer-workspace` delta for the required behavior.

Current state, observed on 2026-10-18:

- `main` (at `2f69ec2`) has a linear history. PR #1 was **rebase-merged**: its merge SHA is its last commit. There is no branch protection and no ruleset.
- Repository settings: all three merge methods allowed, `delete_branch_on_merge: false`, Actions `allowed_actions: all` with `sha_pinning_required: false`, secret scanning and push protection **on**, Dependabot vulnerability alerts **off** (API 404), Dependabot security updates **off**, CodeQL default setup `not-configured` (detected languages `javascript-typescript`). No Actions secrets or variables.
- Root scripts already exist: `format` (`prettier --check .`), `lint` (`eslint .`), and `check` / `build` / `test` / `test:e2e` via `turbo run`. The Turborepo tasks are defined in `turbo.jsonc`. The apps run e2e through Playwright, whose `webServer` is `wrangler dev`. The Playwright configs read `process.env.CI` (retries, `reuseExistingServer`).
- Apps are versioned `0.0.1`. `bun.lock` records each workspace's `version`.
- The OpenSpec CLI is not a repository dependency (owner has Homebrew 1.14.1).
- `.codegraph/` (local CodeGraph index) is untracked and not ignored.

### Versions and facts verified (2026-10-18)

| Item                                   | Version or fact                                                                                                                                                                                                                                                                                                                                                                                                                                | Source                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| actions/checkout                       | v7.0.1                                                                                                                                                                                                                                                                                                                                                                                                                                         | GitHub releases API                                           |
| actions/setup-node                     | v7.1.0                                                                                                                                                                                                                                                                                                                                                                                                                                         | GitHub releases API                                           |
| actions/cache                          | v6.1.0                                                                                                                                                                                                                                                                                                                                                                                                                                         | GitHub releases API                                           |
| oven-sh/setup-bun                      | v2.2.0. With no version input it reads `packageManager` (`bun@<v>`) from `package.json`                                                                                                                                                                                                                                                                                                                                                        | releases API; Context7 `/oven-sh/setup-bun`                   |
| googleapis/release-please-action       | v5.0.0 (release-please 17.11.2). Outputs `releases_created` and `paths_released` are always set; per-release outputs only when releases exist                                                                                                                                                                                                                                                                                                  | releases API; Context7                                        |
| release-please merged-PR detection     | finds merged release PRs by **labels**, independent of merge method. `BEGIN_COMMIT_OVERRIDE` only works with squash merges (not used here)                                                                                                                                                                                                                                                                                                     | Context7 `/googleapis/release-please` (`manifest.ts`, README) |
| release-please `node-workspace` plugin | only updates `package-lock.json`, never `bun.lock`                                                                                                                                                                                                                                                                                                                                                                                             | Context7 (`node-workspace.ts`)                                |
| Bun 1.4.2 `--frozen-lockfile`          | **passes** after a workspace's own `version` is bumped, without the lockfile being changed                                                                                                                                                                                                                                                                                                                                                     | verified locally in a throwaway copy, 2026-10-18              |
| `GITHUB_TOKEN`-created PRs             | `pull_request` `opened`/`synchronize`/`reopened` events create workflow runs in an **approval-required** state                                                                                                                                                                                                                                                                                                                                 | docs.github.com, "GITHUB_TOKEN" (fetched 2026-10-18)          |
| Ruleset API                            | `pull_request.parameters.allowed_merge_methods` (`merge`/`squash`/`rebase`); `required_status_checks[].integration_id`; `strict_required_status_checks_policy`                                                                                                                                                                                                                                                                                 | docs.github.com REST "Rules"                                  |
| Actions permissions API                | `sha_pinning_required: boolean`                                                                                                                                                                                                                                                                                                                                                                                                                | docs.github.com REST "Actions permissions"                    |
| GitHub Actions app id                  | 15368                                                                                                                                                                                                                                                                                                                                                                                                                                          | `gh api /apps/github-actions`                                 |
| zizmor / zizmor-action                 | 1.31.1 / v0.7.1. Since 1.20 the `unpinned-uses` default is hash-pin for **all** actions. In SARIF mode zizmor always exits 0                                                                                                                                                                                                                                                                                                                   | releases API; Context7 `/zizmorcore/zizmor`                   |
| actionlint                             | 1.7.12                                                                                                                                                                                                                                                                                                                                                                                                                                         | releases API                                                  |
| Renovate                               | 44.166.0. `config:best-practices` = `config:recommended` + `helpers:pinGitHubActionDigests` + `:pinDevDependencies` + `security:minimumReleaseAgeNpm` + `:maintainLockFilesWeekly` + … The `bun` manager regenerates `bun.lock` by running `bun install`. `vulnerabilityAlerts` defaults to `schedule: []` and `minimumReleaseAge: null`, and needs the dependency graph, Dependabot alerts and the app's "Dependabot alerts: read" permission | Context7 `/renovatebot/renovate`                              |
| OpenSpec CLI                           | `@fission-ai/openspec` 1.14.3 on npm (Node ≥20.19)                                                                                                                                                                                                                                                                                                                                                                                             | npm registry                                                  |

## Goals / Non-Goals

**Goals:**

- One required, spoof-proof status (`ci-ok`) gates `main`. Individual checks can be added or renamed without touching protection.
- CI and release workflows that pass zizmor's default audits, and stay that way, because CI audits itself.
- Releases need no human version editing and no stored secret.
- Every GitHub setting this change relies on is reproducible from committed files.

**Non-Goals:**

- Deploying (the `edge-infrastructure` change consumes `paths_released` later).
- Detecting settings drift on a schedule (would need an admin token in Actions, which is deliberately not done).
- Validating the Renovate config in CI (see D11).

## Decisions

### D1. One CI workflow with a few coarse jobs and an aggregate gate

`.github/workflows/ci.yml` with jobs:

| Job                 | Runs                                                                                                                                                     | Why separate                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `verify`            | `bun install --frozen-lockfile`, then named steps `format`, `lint`, `check`, `build`, `test`                                                             | One install, with Turborepo running members in parallel. Each step has a clear name, so a failure names the check. |
| `e2e`               | install, Playwright Chromium (cached), `test:e2e`                                                                                                        | Needs browsers and ports; it's the slowest job, so it runs in parallel with `verify`.                              |
| `commits` (PR only) | commitlint over the PR's commit range                                                                                                                    | Needs full history (`fetch-depth: 0`).                                                                             |
| `specs`             | `bunx openspec validate --all --strict` (exact flags confirmed in tasks)                                                                                 | Independent of the build.                                                                                          |
| `workflows`         | actionlint, then zizmor                                                                                                                                  | Audits the workflows themselves.                                                                                   |
| `ci-ok`             | `needs:` all of the above, `if: always()`, fails unless every needed job's result is `success` (a skipped `commits` on push to `main` counts as allowed) | The single required check.                                                                                         |

- **Pattern:** the "required-check aggregator". Branch protection pins one stable context name instead of five or six that change over time.
- **Alternatives:** _Require every job in the ruleset._ Any rename or new job then needs a ruleset change, and a job that silently doesn't run (path filters, `if:`) can block or, worse, never be required. _One giant job:_ no parallelism, and slower feedback.
- **Failure modes:** with `if: always()`, a naive aggregator can pass when a dependency was _cancelled_ or _skipped_. Mitigation: the aggregator explicitly fails on `failure`, `cancelled` and unexpected `skipped`. The needed job results are passed through `env` rather than interpolated into the script.

### D2. Triggers, concurrency and token scope

- `on: pull_request` (branches `[main]`) and `push` (branches `[main]`). **Never `pull_request_target`.** Fork PRs therefore get a read-only token and no secrets.
- `concurrency: { group: ci-${{ github.event.pull_request.number || github.sha }}, cancel-in-progress: ${{ github.event_name == 'pull_request' }} }`. Superseded PR runs are cancelled; runs on `main` never cancel each other.
- Top-level `permissions: {}`. Each job grants only `contents: read`. Every `actions/checkout` uses `persist-credentials: false`, so later steps can't reuse the token to push.
- **Why:** zizmor's `dangerous-triggers`, `excessive-permissions` and `artipacked` audits cover exactly these issues. Following them by construction keeps the audit green.

### D3. Toolchain from the existing pins; frozen install

- `oven-sh/setup-bun` with no version input, so it reads `packageManager: bun@1.4.2`. `actions/setup-node` with `node-version-file: .node-version`. This gives one source of truth per tool.
- `bun install --frozen-lockfile` in every job that needs dependencies.
- The root `prepare` script (`lefthook install`) runs during install in CI. It only writes `.git/hooks` in the runner's checkout, which is harmless, and `LEFTHOOK=0` is set at workflow level so no hook ever executes.
- **Failure modes:** release-please bumps app versions but not `bun.lock`. Verified: a frozen install still passes, so the only effect is a stale `version` inside `bun.lock`, which Renovate's weekly lockfile maintenance refreshes.

### D4. Caching: Turborepo outputs and Playwright browsers

- `actions/cache` on the root `.turbo/cache` with key `turbo-${{ runner.os }}-${{ github.sha }}` and restore-key `turbo-${{ runner.os }}-`, so each run restores the newest previous entry and saves its own.
- Playwright browsers cached at `~/.cache/ms-playwright` with key `playwright-${{ runner.os }}-${{ hashFiles('bun.lock') }}`. On a miss: `bunx playwright install --with-deps chromium`. On a hit: `bunx playwright install-deps chromium`, because system packages aren't cached.
- **Pattern:** content-addressed cache with a "nearest ancestor" restore. Turborepo's own task hashes decide whether a restored entry is valid, so a stale entry costs nothing.
- **Alternatives:** Vercel Remote Cache (needs an account and token, rejected); no cache (simpler, slower).
- **Failure modes:** _Cache poisoning._ GitHub scopes caches written by PR runs to that PR's ref, and `main`'s caches are readable by PRs but writable only by `main` runs, so a malicious PR can't poison `main`. The release workflow uses **no** cache at all, so zizmor's `cache-poisoning` audit stays clean. _Turborepo strict env mode hiding `CI` from Playwright:_ the configs need `CI=true` for retries and a fresh server. A task verifies this. If `CI` isn't passed through, `turbo.jsonc` declares it in `passThroughEnv` for `test:e2e`.

### D5. Commit messages checked per commit

- PRs only: `bunx commitlint --from "$BASE_SHA" --to "$HEAD_SHA" --verbose`, with the SHAs from `github.event.pull_request.base.sha` and `head.sha` passed via `env:` (template-injection-safe) and `fetch-depth: 0`.
- **Why:** with rebase-only merging, every PR commit becomes a `main` commit and a changelog line, so every commit (not the PR title) is what has to conform. It's the same `commitlint.config.js` as the local hook.
- **Failure modes:** a force-pushed PR whose base moved. Using the event's `base.sha` and `head.sha` (not `HEAD~n`) handles that.

### D6. OpenSpec validation with a pinned CLI

- Add `@fission-ai/openspec@1.14.3` as an exact root dev dependency. CI runs `bunx openspec validate --all --strict --no-interactive` (flag names verified against `openspec validate --help` during apply).
- **Why:** specs are this repo's source of truth. An invalid delta should block a merge just like a type error.
- **Failure modes:** owner's Homebrew CLI (1.14.1) and CI's (1.14.3) disagree. Mitigation: the README tells contributors to use `bunx openspec`, and Renovate keeps the pin current (Assumption A6).

### D7. Workflow linting and auditing

- **actionlint 1.7.12** runs from the official `rhysd/actionlint` container image, **pinned by digest** (`docker://rhysd/actionlint@sha256:…`). The documented download script pipes `curl` from the project's `main` branch into `bash`, an unpinned supply-chain hop this change is trying to remove.
- **zizmor** runs through `zizmorcore/zizmor-action@<sha> # v0.7.1` with SARIF upload **disabled** (in SARIF mode zizmor always exits 0), so findings fail the job. The default persona applies, with the default `unpinned-uses` policy (hash-pin everything). No `zizmor.yml` is needed unless a finding has to be deliberately accepted, in which case it is accepted with an inline, justified ignore.
- **Failure modes:** it's unverified whether GitHub's `sha_pinning_required` setting also governs `docker://` image references, and whether zizmor flags a digest-pinned image. Both are verification tasks; if either behaves unexpectedly, stop and ask the owner. The exact zizmor-action input that disables SARIF is also confirmed against its `action.yml` during apply.

### D8. release-please: manifest mode, apps only, one combined PR

- `release-please-config.json`:
  - `packages`: `apps/welcome` (`component: welcome`) and `apps/admin` (`component: admin`), both `release-type: node`.
  - `include-component-in-tag: true`, giving tags like `welcome-v0.1.0`.
  - `bump-minor-pre-major: true`, so a breaking change before 1.0 bumps the minor version.
  - `separate-pull-requests: false`, and **no** `node-workspace` plugin (it would try to update a non-existent `package-lock.json` and rewrite dependency ranges).
  - `bootstrap-sha: 2f69ec2810dced8df7068a62c0d2b5e2030a50d5`, so history before this change is excluded (A5).
- `.release-please-manifest.json`: `{ "apps/welcome": "0.0.1", "apps/admin": "0.0.1" }`.
- `.github/workflows/release-please.yml`: on `push` to `main`, `permissions: {}` at the top. One job with `contents: write`, `pull-requests: write` and `issues: write` (release-please creates its labels), using the default `GITHUB_TOKEN`. It exposes `releases_created` and `paths_released` as job outputs for the future deploy workflow. No checkout, no cache.
- **Pattern:** "release PR" (release train). Versions are proposed continuously and published only on an explicit, reviewed merge.
- **Alternatives:** _changesets_ (manual intent files per change; more ceremony, though better for npm publishing). _semantic-release_ (publishes on every merge with no review step, and is weak at per-path monorepos). _A PAT or GitHub App token_ (CI would run without approval, but needs a long-lived secret; rejected by the owner).
- **Failure modes:**
  - _Approval forgotten:_ release PR CI waits for "Approve workflows to run", and the PR can't merge until `ci-ok` passes (intended).
  - _Release PR goes stale:_ the ruleset's strict up-to-date policy requires it to match `main`. release-please rebuilds its branch on every push to `main`, which keeps it current but creates new approval-required runs each time.
  - _Rebase merge of the release PR:_ detection is label-based, so it should work. The first real release is a verification task.
  - _Package-only `feat` commits release nothing:_ intended for now, and revisited in Sprint 2.

### D9. Repository settings as code

- `.github/rulesets/main.json`: target `branch`, `conditions.ref_name.include: ["~DEFAULT_BRANCH"]`, `enforcement: active`, **`bypass_actors: []`**. Rules:
  - `deletion`, `non_fast_forward` and `required_linear_history`.
  - `pull_request` with `required_approving_review_count: 0`, every review requirement off, and `allowed_merge_methods: ["rebase"]`.
  - `required_status_checks` with `strict_required_status_checks_policy: true` and `[{ context: "ci-ok", integration_id: 15368 }]`. Requiring the GitHub Actions app id means a commit status posted by anything else can't satisfy the check.
- `scripts/github/apply-settings.sh` (bash, `set -euo pipefail`, requires `gh` authenticated as a repo admin; `--check` mode exits non-zero on drift without changing anything):
  1. `PATCH /repos/{repo}`: `allow_rebase_merge: true`, `allow_squash_merge: false`, `allow_merge_commit: false`, `delete_branch_on_merge: true`.
  2. `PUT /repos/{repo}/actions/permissions`: `enabled: true`, `allowed_actions: all`, `sha_pinning_required: true`.
  3. `PUT /repos/{repo}/vulnerability-alerts`. The dependency graph is always on for public repos (verified by reading `security_and_analysis` afterwards).
  4. `PATCH /repos/{repo}/code-scanning/default-setup`: `state: configured`, `query_suite: default`.
  5. Ruleset upsert by name (`main`): `PUT` if it exists, otherwise `POST`.

  Each step compares the current value with the desired value and prints `unchanged` or `updated`. That's what makes a re-run report no changes.

- **Pattern:** settings as code (declarative desired state plus an idempotent reconciler). A small version of what Terraform or Probot Settings do, with no extra service.
- **Alternatives:** _Terraform GitHub provider_ (state file and provider to maintain; heavy for one repo). _Probot Settings app_ (another third-party app with admin rights). _One-off commands_ (rejected by the owner).
- **Failure modes:**
  - _Lockout:_ no bypass means a broken CI or a GitHub outage blocks every merge. Break-glass: the owner, as admin, can disable the ruleset in the UI or with the script's ruleset file. That is documented in the README and must be followed by re-running the script.
  - _Ordering:_ applying the ruleset before `ci-ok` has ever reported would block this change's own PR. The tasks apply the settings only after this PR's first green run.
  - _Check-name mismatch:_ the check-run name must equal the job's `name` (`ci-ok`). This is verified against the PR's actual check runs before the ruleset is applied.

### D10. Supply-chain hardening conventions

- Every `uses:` is a 40-character SHA followed by `# vX.Y.Z`. Renovate's `helpers:pinGitHubActionDigests` (in `config:best-practices`) keeps SHA and comment in sync. Combined with `sha_pinning_required` in settings (D9) and zizmor's `unpinned-uses` (D7), that's three layers: authoring convention, CI audit, and platform enforcement.
- No `${{ … }}` expressions inside `run:` scripts for any event-derived value. They go through `env:` (zizmor `template-injection`).

### D11. Renovate (Mend hosted app)

`renovate.json5` at the root (JSON5, so every rule carries a comment):

- `extends: ["config:best-practices", ":semanticCommits"]`. `semanticCommits` is forced on because the repo requires Conventional Commits, rather than relying on auto-detection.
- `schedule: ["* 0-5 * * 1"]` with `timezone` (A2). `dependencyDashboard: true`. `rangeStrategy: "pin"`. No `automerge` anywhere.
- **Groups:**
  - `svelte-runtime`: `svelte`, `@sveltejs/**`
  - `cloudflare`: `wrangler`, `@cloudflare/**`
  - `lint-format`: `eslint`, `@eslint/**`, `typescript-eslint`, `eslint-plugin-*`, `eslint-config-*`, `prettier`, `prettier-plugin-*`
  - `test`: `vitest`, `@vitest/**`, `@playwright/test`
  - `build`: `turbo`, `vite`, `typescript`, `@types/**`
  - `commit-tooling`: `@commitlint/**`, `lefthook`
  - `openspec`: `@fission-ai/openspec`
  - `github-actions` (manager)
  - toolchain: Bun's `packageManager`, `.node-version`
- **Commit types** (per the owner's decision): the `svelte-runtime` group gets `semanticCommitType: "fix"` (it's bundled into deployed output, so changed apps get a patch release). `vulnerabilityAlerts` also gets `semanticCommitType: "fix"`. Everything else defaults to `chore(deps)`.
- **Major updates** need approval on Renovate's dependency dashboard (`dependencyDashboardApproval: true` for `matchUpdateTypes: ["major"]`). The known incompatibilities are disabled until their blockers lift (A3): `vitest`/`@vitest/**` `allowedVersions: "<5"`, `typescript` `"<7"`. Node majors go through the dashboard approval.
- **Pattern:** batched, scheduled, human-approved dependency flow, with security fixes taking a fast lane.
- **Alternatives:** Dependabot (weaker grouping and Bun support; rejected). Self-hosted Renovate (secrets and upkeep; rejected).
- **Failure modes:** _Config typo silently ignored:_ the Mend app reports config errors on its dependency dashboard and in PRs; the tasks also validate once locally with `renovate-config-validator` at the pinned version. _Updates the `packageManager` field can't handle:_ unverified for Bun, so it's a verification task. _Mend app missing "Dependabot alerts: read":_ security PRs never appear (owner task with explicit verification).

### D12. CodeQL default setup

Enabled by the settings script (D9). GitHub chooses the languages (`javascript-typescript`, and `actions` if offered) and maintains the queries. CodeQL is **not** a required check: its results can arrive after `ci-ok`, and alerts are triaged in the Security tab.

- **Alternative:** an advanced `codeql.yml` (rejected by the owner: one more pinned workflow to maintain).

### D13. Small repository changes

- `.gitignore`: add `.codegraph/` under a "Local tooling state" comment (developer-workspace delta).
- `README.md`: CI badge, "How changes land" (PR → `ci-ok` → rebase merge), "How releases work" (release PR approval, tags), "Repository settings" (run `scripts/github/apply-settings.sh`, plus the break-glass note), and "Use `bunx openspec`".

## Risks / Trade-offs

- **No-bypass ruleset can block emergency fixes** → break-glass procedure documented (D9). The ruleset itself is code, so restoring it is one script run.
- **Every release PR update needs a manual "Approve workflows to run"** → accepted cost of not storing a token; revisit with a GitHub App if it becomes tedious.
- **Strict up-to-date policy plus a frequently rebuilt release PR means extra CI runs** → small repo, cheap runs, and public repos get free GitHub-hosted minutes.
- **Renovate is a third party with write access** → installed on this repository only, no automerge, and every PR passes `ci-ok`.
- **Stale workspace `version` in `bun.lock` after releases** → cosmetic (verified), refreshed by weekly lockfile maintenance.
- **CodeQL and zizmor false positives** → zizmor findings can be accepted only with an inline, justified ignore; CodeQL alerts are triaged, not merge-blocking.
- **Hosted runner image changes (ubuntu-latest)** → use `ubuntu-24.04` explicitly, and update it deliberately.

## Migration Plan

1. Land the workflows, configs and script on the change branch. Open the PR and let CI run (the ruleset isn't active yet).
2. Once `ci-ok` is green on the PR and its check-run name is confirmed, the owner runs `scripts/github/apply-settings.sh`, then installs the Mend Renovate app.
3. Rebase-merge the PR under the new rules (this exercises the ruleset).
4. Watch release-please's first run on `main`. It should open no release PR, because this change's commits don't touch `apps/`.

**Rollback:** revert the PR and delete the ruleset (UI or API). The settings script can be re-run with an edited JSON to restore earlier values. No data is at risk.

## Open Questions

Deferrable: none of these change the specs or the task breakdown.

- The exact `minimumReleaseAge` value applied by `security:minimumReleaseAgeNpm` in Renovate 44.166 (recorded in the README once read from the resolved config).
- Whether CodeQL default setup offers the `actions` language for this repository (it's recorded by reading the setup back).

## Assumptions for owner review

- **A1** The aggregate check is named `ci-ok`.
- **A2** (confirmed by the owner) Renovate runs Mondays 00:00–05:59 `Asia/Manila`.
- **A3** Major updates require dashboard approval. Vitest stays below 5 and TypeScript below 7 until the blockers in the README lift. Node majors also go through the dashboard.
- **A4** release-please's default changelog sections (Features, Bug Fixes, Performance Improvements, Reverts). Dependency fixes show under Bug Fixes.
- **A5** `bootstrap-sha` is current `main` (`2f69ec2`). The first release PR includes only commits after it.
- **A6** The OpenSpec CLI is pinned at 1.14.3 in the repo, and contributors use `bunx openspec`. Your Homebrew 1.14.1 may differ until you upgrade it.
- **A7** The Renovate config is validated locally once, not in CI. The validator is a large install, and the Mend app reports config errors itself.
- **A8** Runners are pinned to `ubuntu-24.04` rather than `ubuntu-latest`.
- **A9** Secret-scanning extras (non-provider patterns, validity checks) stay off.
