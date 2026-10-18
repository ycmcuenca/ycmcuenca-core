# Tasks

## 1. Repository prerequisites

- [x] 1.1 Add `.codegraph/` to `.gitignore` under a "Local tooling state" comment, and verify `git status --short` no longer lists `.codegraph/` and `git check-ignore -v .codegraph/codegraph.db` names the new rule
- [x] 1.2 Add `@fission-ai/openspec@1.14.3` as an exact root dev dependency, and verify `bun install` updates `bun.lock` and `bunx openspec --version` prints `1.14.3`
- [x] 1.3 Verify `bunx openspec validate --all --strict --no-interactive` passes on the current tree (main specs, plus this change once its artifacts are complete), and that it exits non-zero on a scratch spec delta with a requirement that has no scenario; delete the scratch delta afterwards

## 2. Pull-request CI workflow (`.github/workflows/ci.yml`)

- [x] 2.1 Resolve the full commit SHA for each action at its verified tag (checkout v7.0.1, setup-node v7.1.0, setup-bun v2.2.0, cache v6.1.0, zizmor-action v0.7.1) with `gh api repos/<owner>/<repo>/git/ref/tags/<tag>` (dereferencing annotated tags), and record the SHA plus version-comment pairs used in the workflows
- [x] 2.2 Write `ci.yml` with the triggers, concurrency, top-level `permissions: {}`, `LEFTHOOK=0` and runner `ubuntu-24.04` (design D2, A8), plus the `verify` job with named steps `format`, `lint`, `check`, `build`, `test` after `setup-bun` (no version input), `setup-node` (`node-version-file: .node-version`) and `bun install --frozen-lockfile`; every checkout uses `persist-credentials: false`. Each design decision gets a short comment. Verify with `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:1.7.12` locally that the file lints clean
- [x] 2.3 Add the Turborepo cache (`.turbo/cache`, key and restore-key per D4) to `verify`, and verify on the PR that the second run's logs show `Cache hit` / restored and that Turborepo reports cached tasks (`FULL TURBO` or per-task `cache hit`)
- [x] 2.4 Add the `e2e` job (Playwright browser cache per D4, `install --with-deps chromium` on miss, `install-deps chromium` on hit, `bun run test:e2e`), and verify on the PR that it passes and that a rerun restores the browser cache
- [x] 2.5 Verify that Playwright inside `turbo run test:e2e` sees `CI=true` in GitHub Actions (log `process.env.CI` once from the config, or confirm `retries: 2` in the reporter output); if it does not, add `CI` to `passThroughEnv` for `test:e2e` in `turbo.jsonc` and re-verify; remove any temporary logging
- [x] 2.6 Add the `commits` job (PR only, `fetch-depth: 0`, `bunx commitlint --from "$BASE_SHA" --to "$HEAD_SHA" --verbose` with SHAs passed via `env`), and verify on a throwaway PR branch that a commit made with `LEFTHOOK=0 git commit -m "updated stuff"` fails the job and names that commit; then drop the commit from the branch
- [x] 2.7 Add the `specs` job (`bunx openspec validate --all --strict --no-interactive`), and verify it passes on the PR
- [x] 2.8 Read `zizmorcore/zizmor-action`'s `action.yml` at the pinned SHA to identify the input that disables SARIF upload so findings fail the job, add the `workflows` job (actionlint from the `rhysd/actionlint` image pinned by digest, then zizmor with SARIF disabled), and verify locally with `uvx zizmor@1.31.1 .github/workflows` that there are no findings
- [x] 2.9 Verify the audit catches problems: on a throwaway branch, change one `uses:` to a tag reference (`@v7`) and add a step that interpolates `${{ github.event.pull_request.title }}` into `run:`; confirm the `workflows` job fails with `unpinned-uses` and `template-injection` findings; then revert
- [x] 2.10 Verify whether zizmor flags the digest-pinned `docker://rhysd/actionlint@sha256:…` reference, and whether GitHub's SHA-pinning enforcement accepts it once enabled (checked again in 5.4); if either rejects it, stop and ask the owner before choosing another way to run actionlint
- [x] 2.11 Add the `ci-ok` aggregate job (`needs` all jobs, `if: always()`, fails on any `failure`, `cancelled` or unexpected `skipped`, with results passed via `env`), and verify on the throwaway branch that a failing `lint` step makes `ci-ok` fail, and that `ci-ok` passes when everything is green; confirm in the PR's checks list that the check-run name is exactly `ci-ok`
- [x] 2.12 Verify the fork and token posture: confirm the workflow has no `pull_request_target` trigger, and that each job's "Set up job" log lists only the `Contents: read` (and `Metadata: read`) token permissions

## 3. Release automation

- [x] 3.1 Write `release-please-config.json` per design D8 (two `node` packages with components `welcome` and `admin`, `include-component-in-tag`, `bump-minor-pre-major`, no plugins, `bootstrap-sha` = `2f69ec2810dced8df7068a62c0d2b5e2030a50d5`) and `.release-please-manifest.json` (`0.0.1` for both apps), and verify both parse with `jq . <file>` and match the schema keys documented for release-please 17.11
- [x] 3.2 Write `.github/workflows/release-please.yml` (push to `main`, `permissions: {}` at the top, one job with `contents`/`pull-requests`/`issues: write`, SHA-pinned `googleapis/release-please-action` v5.0.0, no checkout and no cache, job outputs `releases_created` and `paths_released`), and verify actionlint and zizmor report no findings for it
- [x] 3.3 Dry-run the configuration against the repository with the matching CLI, `bunx release-please@17.11.2 release-pr --repo-url=ycmcuenca/ycmcuenca-core --token="$(gh auth token)" --dry-run` (confirm the flags with `--help` first), and verify it reports no release candidates for the current history (bootstrap-sha honored, nothing under `apps/` since)
- [x] 3.4 Verify the version rules with the dry run on a local throwaway branch containing one `feat(welcome): …` commit touching `apps/welcome` and one `feat(eslint-config): …` commit touching only `packages/`: welcome is proposed at `0.1.0`, admin is not proposed, and the package commit appears in no changelog; then delete the branch (no push)

## 4. Renovate configuration

- [x] 4.1 Write `renovate.json5` per design D11 (`config:best-practices` + `:semanticCommits`, schedule Mondays 00:00–05:59 `Asia/Manila`, dashboard, `rangeStrategy: pin`, the listed groups, `fix` commit type for the `svelte-runtime` group and `vulnerabilityAlerts`, dashboard approval for majors, `allowedVersions` `<5` for vitest/`@vitest/**` and `<7` for typescript, no automerge), each rule commented, and verify `bunx --package renovate@44.166.0 renovate-config-validator renovate.json5` reports it valid
- [x] 4.2 Verify Renovate's resolved behavior locally with `bunx --package renovate@44.166.0 renovate --platform=local --dry-run=lookup` (or the documented local-platform equivalent), and confirm from its output that (a) the `packageManager` Bun pin and `.node-version` are detected, (b) the `svelte-runtime` group would use `fix(deps)` and other groups `chore(deps)`, and (c) the effective `minimumReleaseAge` value; record (c) for the README; if (a) is not detected, stop and ask the owner how Bun and Node updates should be handled

## 5. Repository settings as code

- [x] 5.1 Write `.github/rulesets/main.json` per design D9 (default branch, active, no bypass actors, deletion, non-fast-forward, linear history, PR with 0 approvals and `allowed_merge_methods: ["rebase"]`, strict required check `ci-ok` with `integration_id: 15368`), and verify it parses with `jq`
- [x] 5.2 Write `scripts/github/apply-settings.sh` (commented, `set -euo pipefail`, admin `gh` auth check, per-setting compare-then-apply with `unchanged` / `updated` output, `--check` mode that exits non-zero on drift without writing), and verify `shellcheck scripts/github/apply-settings.sh` passes and `--check` against the current repository reports every setting as drifted while changing nothing (re-read the settings via `gh api` to confirm)
- [x] 5.3 **Owner task:** after the PR's `ci-ok` is green and named exactly `ci-ok` (2.11), run `scripts/github/apply-settings.sh`. Verify that a second run prints only `unchanged`, and that `--check` exits 0
- [x] 5.4 Verify the applied settings through the API: rebase-only merge with branch deletion on; `actions/permissions` shows `sha_pinning_required: true`; `vulnerability-alerts` returns 204; `security_and_analysis` and `code-scanning/default-setup` show alerts enabled and CodeQL `configured` (record the languages it chose); `rulesets` shows the `main` ruleset active with no bypass actors. Also confirm the PR's own workflow runs still start with SHA pinning enforced (including the digest-pinned actionlint image)
- [x] 5.5 Verify enforcement: a direct `git push origin HEAD:main` of a throwaway commit is rejected by the ruleset (then delete the local throwaway commit); the PR's merge menu offers only "Rebase and merge"; and `gh api repos/ycmcuenca/ycmcuenca-core/rulesets/<id>` shows `strict_required_status_checks_policy: true` (the stale-branch behavior is observed the first time two PRs are open at once, and recorded in the README if it differs)
- [x] 5.6 Verify drift correction: change `delete_branch_on_merge` to false in the GitHub UI, confirm `--check` exits non-zero naming that setting, re-run the script, and confirm it reports `updated` and the setting is restored
- [x] 5.7 **Owner task:** install the Mend Renovate app on `ycmcuenca/ycmcuenca-core` only, confirm the app's permissions include "Dependabot alerts: read", and verify that within one hour Renovate creates the Dependency Dashboard issue without config errors

## 6. Documentation

- [x] 6.1 Update `README.md` per design D13: CI badge, how changes land, how releases work (including the "Approve workflows to run" step on release PRs), repository settings and the break-glass procedure, `bunx openspec`, the Renovate schedule and the `minimumReleaseAge` value recorded in 4.2. Replace the "CI (in the next change)" wording, and verify every command in the new sections runs as written (the settings script in `--check` mode)

## 7. Integration verification

- [x] 7.1 Run the full local equivalent of CI (`bun install --frozen-lockfile`, `bun run format`, `bun run lint`, `bun run check`, `bun run build`, `bun run test`, `bun run test:e2e`, `bunx openspec validate --all --strict --no-interactive`, actionlint, zizmor) and verify all pass
- [x] 7.2 Verify on the PR that every job is green and `ci-ok` succeeds, then rebase-merge the PR under the active ruleset and verify the `push` run on `main` is green
- [x] 7.3 Verify release-please's first run on `main` succeeds and opens no release PR (this change touches no files under `apps/`), and that the Actions secrets list is still empty (`gh secret list`)
- [x] 7.4 Run `openspec validate ci-release-pipeline --strict` and verify it passes

## Workflow follow-up

- Scenarios that need real history; record the outcome when each happens:
  - release-management "Tag naming", "Both apps changed", "Release pull request kept current", "Release pull request passes the same gate" and "Release published": the first release PR (approve its workflow run, rebase-merge it, verify the `welcome-v…`/`admin-v…` tags and GitHub Releases with matching changelog notes).
  - repository-governance "Stale branch blocks merge": the first time two pull requests are open at once.
- The first Renovate PRs follow the Monday schedule.
- Commit through `/git` and ship through `/ship`. Archiving syncs the specs, and the archive guidance reports there are no living docs yet.
- Next change: `edge-infrastructure`, which adds the deploy workflow that consumes `paths_released`.

## Verification follow-up (2026-10-18)

The `/opsx-verify` findings addressed on PR #5, each in its own commit:

- W1 (`18e8749`): engine and peer ranges stay unpinned (`rangeStrategy: "auto"`, Renovate's `:pinAllExceptPeerDependencies` recipe), and Node is capped below 25 until 26 is LTS. The dashboard evidence (a `>=24 -> v26.12.0` node upgrade under "Awaiting Schedule", outside A3's approval) is what this fixes; the lookup dry run's resolved config shows both rules.
- W2 (`296f1c7`): each tooling group sets `semanticCommitType: "chore"` explicitly, so packages sitting in `dependencies` (the shared ESLint config's) stop proposing app patch releases; `svelte-runtime` keeps `fix(deps)`. Renovate merges package rules in order (later wins; user rules come after presets), so these override `:semanticPrefixFixDepsChoreOthers`; the resolved config in the dry run shows the group types. `vulnerabilityAlerts` still wins over the groups through Renovate's appended forced rule (`init/vulnerability.ts`, 44.166.0), so a tooling security fix stays `fix(deps)`.
- W3 (`38b1255`): the actionlint container keeps its digest and gains the `1.7.12` tag the dry run reads back as `currentValue` with the same digest; actionlint and zizmor pass on the new reference locally.
- W4 (`d2b849b`): the settings script compares and applies secret scanning and push protection; the extra scanning modes stay off (A9). README updated. `--check` reports it `unchanged` and exits 0, and the PATCH body was exercised against the live repository.
- W5 (`5c57025`): ruleset drift now includes rule types added outside the committed file. Verified end to end on the live ruleset: an extra `creation` rule made `--check` exit 1 naming the ruleset, the script's re-run restored the committed rules, and `--check` exits 0 again. (GitHub rejects `commit_message_pattern`, `max_file_path_length` and `branch_name_pattern` with "Invalid rule" for this repository ruleset; the test used `creation`, which is inert on `main`. Done through the API - no signed-in GitHub session for the browser panels, same as 5.6.)
- S1 (`4156d02`): the runner-image comment now says Renovate proposes it with majors behind dashboard approval; the dry run confirms the `ubuntu 24.04 -> 26.04` proposal.
- S2 (`b256588`): ci-checks "Pinned references" allows `docker://` images pinned by `sha256` digest with the version in the tag.
- S3 (`7a22f8a`): the vulnerability-alerts probe treats only a 404 as "off" and aborts on anything else (204, simulated 404 and a simulated network failure all exercised).

Local checks before the push: `bun run format`, `bun run lint`, `bunx openspec validate --all --strict --no-interactive`, actionlint through the new reference, zizmor, shellcheck, the Renovate config validator, and `scripts/github/apply-settings.sh --check` (exit 0).

After merge, record when Renovate next runs: the dashboard shows no `engines`/peer pins, `rhysd/actionlint` with a version, and no Node major outside Pending Approval (there should be none at all). Then re-run `/opsx-verify ci-release-pipeline`.
