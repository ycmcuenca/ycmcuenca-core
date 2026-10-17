# Tasks

## 1. Repository initialization (git, ignore rules, license, GitHub)

- [x] 1.1 Run `git init -b main` and verify `git branch --show-current` prints `main`
- [x] 1.2 Create `.gitignore` per design D9 (with a short comment per section) and verify that a scratch `apps/x/.dev.vars`, `.env`, `.env.local` and `node_modules/` are each reported ignored by `git check-ignore -v`, while `.env.example` is not; then delete the scratch files
- [ ] 1.3 Create `LICENSE` (MIT, holder per A7) with the brand/content exclusion clause, and verify it contains both the MIT text and the exclusion paragraph
- [ ] 1.4 Make the initial commit on `main` with only `openspec/`, `.claude/`, `.opencode/`, `.gitignore` and `LICENSE` (message `chore: initialize repository`), and verify `git show --stat HEAD` lists only those paths
- [ ] 1.5 **Owner confirmation required:** show the exact `gh repo create ycmcuenca/ycmcuenca-core --public --source . --push` command and wait for a yes; then run it and verify `gh repo view ycmcuenca/ycmcuenca-core --json visibility,defaultBranchRef` reports `PUBLIC` and `main`
- [ ] 1.6 Check that secret scanning and push protection are on for the repository (`gh api repos/ycmcuenca/ycmcuenca-core --jq .security_and_analysis`), turn on whichever is off, and verify both report `enabled`

## 2. Workspace root and pinned toolchain

- [ ] 2.1 Create root `package.json` (private, `workspaces: ["apps/*", "packages/*"]`, `packageManager: "bun@1.4.2"`, `engines.node: ">=24"` per A1, `prepare: "lefthook install"`, and root scripts delegating to `turbo run` for build/check/lint/test/test:e2e/dev plus `format`/`format:write`) and `.node-version` containing `24`; verify `bun install` completes and creates `bun.lock`
- [ ] 2.2 Add `turbo@2.11.9` and create `turbo.json` with the task graph from design D7 (commented), and verify `bunx turbo run build --dry=json` parses the config without errors
- [ ] 2.3 Record whether Bun 1.4.2 warns or fails when its version differs from `packageManager` (design Open Question) by checking the docs or running a mismatched version, and note the result for the README in group 7

## 3. Shared configuration packages

- [ ] 3.1 Create `packages/tsconfig` (`@ycmcuenca/tsconfig`, private, exports `base.json` with `strict` + `noUncheckedIndexedAccess` per A2, and `svelte-app.json`), with a comment-bearing README section on why each option is set, and verify `bun pm ls` shows it as a workspace member
- [ ] 3.2 Create `packages/eslint-config` (`@ycmcuenca/eslint-config`, private, ESLint 10.13 flat configs `base` and `svelte` with typescript-eslint 8.71, eslint-plugin-svelte 3.23 and eslint-config-prettier last), and verify a scratch `.ts` file with an unused variable produces an error when linted with the `base` config; then delete the scratch file
- [ ] 3.3 Add root Prettier 3.9 config (`.prettierrc` with `prettier-plugin-svelte`, `.prettierignore` covering build output, lockfile and `openspec/changes/archive/`), and verify `bun run format` passes on the current tree and fails on a deliberately misformatted scratch file; then delete the scratch file

## 4. Applications (`welcome`, `admin`) on the Workers adapter

- [ ] 4.1 Scaffold `apps/welcome` with `bunx sv@1.1.1 create apps/welcome --template minimal --types ts --no-add-ons --install bun`, then add `@sveltejs/adapter-cloudflare@8` (Workers target; confirm the option syntax with `sv add --help`), and verify `vite.config.ts` uses `sveltekit({ adapter })` with the Cloudflare adapter
- [ ] 4.2 Repeat 4.1 for `apps/admin`, and verify both apps' `package.json` names are `welcome` and `admin` and both are private
- [ ] 4.3 Point each app's `tsconfig.json` at `@ycmcuenca/tsconfig/svelte-app.json` and each app's `eslint.config.js` at `@ycmcuenca/eslint-config/svelte`, removing scaffolded duplicates, and verify `bun run check` and `bun run lint` pass for both apps
- [ ] 4.4 Add a commented `wrangler.jsonc` per app per design D4 (`name`, `main`, `assets`, `compatibility_date` = apply date, `compatibility_flags: ["nodejs_als"]`, no bindings), add `wrangler@4` as a dev dependency, and verify `bun run build` produces `.svelte-kit/cloudflare/_worker.js` in each app
- [ ] 4.5 Add `src/lib/app-meta.ts` (exports the app's display name) and a placeholder `+page.svelte` whose `<h1>` renders it, set fixed dev ports per A4 with `strictPort`, and verify `bun run dev` serves HTTP 200 with the correct heading at `localhost:5173` (welcome) and `localhost:5174` (admin)

## 5. Tests

- [ ] 5.1 Add Vitest 4.1.12 to both apps with a unit test for `app-meta.ts` (asserts the display name), and verify `bun run test` passes and then fails when the expected name in the test is changed (revert afterwards)
- [ ] 5.2 Verify `wrangler dev` serves an app's built `.svelte-kit/cloudflare` output locally without Cloudflare login (with `WRANGLER_SEND_METRICS=false`); if it requires login or does not serve, stop and ask the owner before changing the e2e approach
- [ ] 5.3 Add Playwright 1.64 (Chromium only) per app with `webServer` running `wrangler dev` on ports 8787/8788 against the build, plus one smoke test asserting the heading, and verify `bun run test:e2e` passes for both apps
- [ ] 5.4 Break the welcome page temporarily (throw in its load or remove the heading), verify `bun run test:e2e` exits non-zero, then revert and verify it passes again

## 6. Local commit checks

- [ ] 6.1 Add Lefthook 2.2.2 and `lefthook.yml` (commented) with the `pre-commit` prettier and eslint jobs on `{staged_files}` with `stage_fixed: true`, and verify `.git/hooks/pre-commit` exists after `bun install`
- [ ] 6.2 Add commitlint 21.2.3 with `@commitlint/config-conventional` (`commitlint.config.js`, per A3) and a `commit-msg` hook running `commitlint --edit {1}`; on a throwaway branch verify `git commit -m "updated stuff"` is rejected and `git commit -m "feat(welcome): add placeholder page"` passes; then delete the throwaway branch
- [ ] 6.3 Verify the partial-staging behavior: stage one file that has an additional unstaged edit, commit on a throwaway branch, and confirm the unstaged edit survives untouched; if it does not, stop and ask the owner before choosing an alternative; then delete the throwaway branch

## 7. OpenSpec configuration and README

- [ ] 7.1 Write `openspec/config.yaml` per design D10 (`context`, `rules.proposal/specs/design/tasks`, `operations.archive.guidance`), and verify `openspec instructions design --change bootstrap-monorepo --json` returns the new context and design rules, and `openspec context --json` still resolves this repo as root
- [ ] 7.2 Write `README.md` (purpose, required toolchain, install/dev/check/lint/format/test/e2e commands, `bunx lefthook install` fallback, the Bun version-mismatch finding from 2.3, and maintenance notes about Vitest 5, TS 7 and Node 26 LTS), and verify every command in it runs successfully as written on the current tree

## 8. Integration verification

- [ ] 8.1 From a fresh clone of the local repo plus the working tree (or after `git clean -xdf` on ignored files only), run `bun install`, `bun run check`, `bun run lint`, `bun run format`, `bun run build`, `bun run test` and `bun run test:e2e`, and verify all pass
- [ ] 8.2 Run `bun run build` twice and verify the second run reports full Turborepo cache hits
- [ ] 8.3 Verify `git status` after 8.1 lists no build output, caches, test reports or secret files (only intended source changes)
- [ ] 8.4 Run `openspec validate bootstrap-monorepo --strict` and verify it passes
- [ ] 8.5 **Owner task (manual):** delete the stray `~/openspec/` directory in your home folder (it is outside this repo and is never removed automatically); verify by running `openspec context --json` from this repo and confirming the root is still this repo

## Workflow follow-up

- Commit the bootstrap work on its own branch and open the PR through `/git` and `/ship` (CI does not exist yet, so the PR is reviewed manually).
- Archive the change after merge; the archive guidance from 7.1 will report that no living docs exist yet.
- Next change: `ci-release-pipeline`.
