# Design

## Context

The repository currently contains only `openspec/` (with an empty `config.yaml` template) and the OpenSpec agent files in `.claude/` and `.opencode/`. It is not a git repository yet. See proposal.md for the motivation and scope, and `specs/developer-workspace` and `specs/planning-workflow` for the required behavior.

Constraints that shape this design:

- **Public repository from the first push.** Nothing secret may ever be committed, and the history itself is part of the portfolio.
- **Target runtime is Cloudflare Workers (Free plan).** Code has to build for, and be tested against, the Workers runtime from day one, even though nothing deploys in this change.
- **Long-lived.** The owner intends to maintain this for a career. Pick boring, widely adopted tools, pin them, and leave clear upgrade seams.
- **Learning goal.** Every config file carries a short comment explaining _why_ it exists.

### Versions verified (npm registry and docs, 2026-10-17)

| Tool                                     | Version                                 | Constraint that matters                                                                                                        |
| ---------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Bun                                      | 1.4.2 (installed)                       | package manager and script runner                                                                                              |
| Node.js                                  | 24 LTS pinned (owner has 26.10 locally) | SvelteKit 3.1 needs `>=22.17`, Wrangler `>=22`, ESLint 10 `>=24` OK                                                            |
| Turborepo                                | 2.11.9                                  | `devEngines.packageManager` or legacy `packageManager` field                                                                   |
| SvelteKit                                | 3.1.0 (released 2026-10-14)             | peers: `typescript ^6`, `vite ^8.0.12`, `svelte ^5.57.1`, `@sveltejs/vite-plugin-svelte ^7`                                    |
| Svelte                                   | 5.57.2                                  |                                                                                                                                |
| `@sveltejs/adapter-cloudflare`           | 8.0.1                                   | peer `wrangler ^4.118.0`                                                                                                       |
| Wrangler                                 | 4.151.1                                 | dev dependency only                                                                                                            |
| TypeScript                               | 6.0.3                                   | TS 7.0.2 exists but svelte-check 4.7.7 supports `^5 \|\| ^6` and typescript-eslint 8.71 supports `<6.1`                        |
| ESLint                                   | 10.13.0                                 | config lookup starts from each linted file's directory (v10 default)                                                           |
| typescript-eslint / eslint-plugin-svelte | 8.71.2 / 3.23.1                         | both accept ESLint ^10                                                                                                         |
| Prettier / prettier-plugin-svelte        | 3.9.10 / 4.1.1                          |                                                                                                                                |
| Vitest                                   | 4.1.12                                  | `@cloudflare/vitest-pool-workers` 0.23 requires `vitest ^4.1` (Vitest 5.0.5 is out but unsupported there). 4.1 accepts Vite ^8 |
| Playwright                               | 1.64.1                                  | Chromium only                                                                                                                  |
| Lefthook                                 | 2.2.2                                   |                                                                                                                                |
| commitlint (cli + config-conventional)   | 21.2.3                                  | needs Node `>=22.12`                                                                                                           |
| `sv` CLI                                 | 1.1.1                                   | `create --template minimal --types ts --no-add-ons --install bun`                                                              |

## Goals / Non-Goals

**Goals:**

- One command each to install, develop, check, lint, format, test and smoke-test the whole repo.
- The Workers build target and the workerd runtime are exercised locally, so incompatibilities surface now rather than at the first deploy.
- Shared config is defined once, in packages a future satellite repo could also consume.
- Every later change can rely on `openspec/config.yaml` to enforce the learning and documentation rules.

**Non-Goals:**

- CI, branch protection, release automation, deploys (`ci-release-pipeline`).
- Any Cloudflare account resource, binding or `workers.dev` route (`edge-infrastructure`).
- Styling, Tailwind, shadcn-svelte, or any real page content.
- Domain packages (`@ycmcuenca/cms-core`, `cms-render`, `db`, `ui`).

## Decisions

### D1. Monorepo with Bun workspaces for linking and Turborepo for the task graph

- **Why:** The core apps share contracts that will change together, for example a block schema that `admin` edits and `welcome` renders. A monorepo makes such a change one atomic commit and one PR, with one lockfile. Bun workspaces handle linking (`workspace:*`). Turborepo adds what Bun's `--filter` lacks: a dependency-aware task graph, content-hashed caching, and (in `ci-release-pipeline`) "only what changed" filtering for selective deploys.
- **Alternatives:** _Bun workspaces only_: no caching or task graph, so CI re-runs everything. _Nx_: more powerful, but brings far more concepts and config than three apps need. _Polyrepo for core_: shared contracts would have to be published and versioned, and every schema change becomes a multi-repo dance.
- **Failure modes:** Misdeclared `outputs` or `inputs` in `turbo.json` can serve a stale cached build ("cache poisoning"). Mitigation: declare outputs explicitly per task, keep env-var-dependent tasks declared under `env`, and document `turbo run <task> --force` as the escape hatch.

### D2. Toolchain pinning: exact Bun, Node 24 LTS for CI, Node 24+ allowed locally

- **Why:** Bun installs dependencies and runs scripts. But the `vite`, `wrangler` and `svelte-check` binaries have `#!/usr/bin/env node` shebangs, so they run on Node unless forced with `bun --bun`. Running them on Node keeps us on the path their maintainers test. Pins: `"packageManager": "bun@1.4.2"` (read by Turborepo, and by `oven-sh/setup-bun` in CI later), `.node-version` = `24` (read by CI and version managers), `engines.node` = `">=24"`.
- **Alternatives:** _Node 26_: not yet an LTS line. _`engines.node` ">=24 <25"_: would block the owner's local Node 26.10 (see Assumptions A1). _Run everything with `bun --bun`_: faster, but off the tested path for Vite and Wrangler.
- **Failure modes:** Local Node 26 and CI Node 24 drift apart, so something works locally and fails in CI. Mitigation: CI (next change) is authoritative; the README recommends Node 24 via a version manager.

### D3. Shared config as "just-in-time" internal packages

- `packages/tsconfig` (`@ycmcuenca/tsconfig`) exports JSON bases: `base.json` (strict) and `svelte-app.json`, which extends the SvelteKit-generated `./.svelte-kit/tsconfig.json`.
- `packages/eslint-config` (`@ycmcuenca/eslint-config`) exports flat-config arrays: `base` (JS + typescript-eslint) and `svelte` (adds eslint-plugin-svelte, Svelte-aware TS parsing, `eslint-config-prettier` last).
- **Why:** Packages, unlike root-relative files, are resolved by name. A future satellite repo could depend on the same rules via a git or npm dependency, and the dependency graph shows which members consume which config. "Just-in-time" means they export source or JSON directly with no build step. Turborepo recommends this for private packages that consumers' bundlers can read.
- **Alternatives:** _Root `tsconfig.base.json` + relative `extends`_: simpler, but not reusable outside the repo and invisible to the task graph. _Compiled packages_: needed only for publishing, which these never are.
- **Failure modes:** Prettier is configured once at the root (Prettier resolves its config by walking up the directory tree, so it doesn't need a package). If an app adds its own `.prettierrc`, it silently forks the formatting. Mitigation: a short note in the README and the shared ESLint config comments.

### D4. SvelteKit 3 apps scaffolded with `sv`, using adapter-cloudflare from day one

- Scaffold with `sv create apps/<name> --template minimal --types ts --no-add-ons --install bun`. Then add the adapter with `sv add sveltekit-adapter` (adapter `cloudflare`, target `workers`; confirm the exact option syntax with `sv add --help` during apply). Tooling (ESLint, Prettier, Vitest, Playwright) is wired by hand to the shared packages rather than through `sv` add-ons, because the add-ons generate per-app configs that would duplicate the shared ones.
- SvelteKit 3 keeps its config in `vite.config.ts` through `sveltekit({ adapter })`. There is no `svelte.config.js`, which differs from the owner's LOOM project on Kit 2.9.
- `wrangler.jsonc` per app: `name` = `welcome` / `admin`, `main` = `.svelte-kit/cloudflare/_worker.js`, `assets` = `{ binding: "ASSETS", directory: ".svelte-kit/cloudflare" }`, `compatibility_date` = the date of apply, `compatibility_flags` = `["nodejs_als"]`. No bindings, routes or `workers_dev` settings yet.
- Fixed dev ports with `strictPort`: welcome 5173, admin 5174.
- **Why:** Building with the real adapter now surfaces Workers-incompatible code (Node-only APIs, oversized bundles) at the cheapest moment. The worker `name` values are chosen now because they become `welcome.ycmcuenca.workers.dev` and `admin.ycmcuenca.workers.dev` later.
- **Alternatives:** _adapter-auto now, swap later_: hides runtime issues until deploy. _`nodejs_compat` now_: broader Node API surface than anything needs today. It gets added when the first library needs it (database drivers in Sprint 2).
- **Failure modes:** SvelteKit 3 is about two weeks old, so `sv` or plugin versions may lag. Mitigation: exact versions in the lockfile, and the apply step verifies `check`, `build` and the smoke tests pass before anything is committed.

### D5. Type checking, linting and formatting

- TypeScript 6.0.3 with `strict: true` and `noUncheckedIndexedAccess: true` (Assumption A2). `check` per app = `svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings`.
- ESLint 10 runs per member through Turborepo (`lint`). Because ESLint 10 resolves config from each file's directory, the pre-commit hook can run one root `eslint` over staged files from mixed members and each file still gets its own member's config.
- Prettier 3.9 with `prettier-plugin-svelte`, root `.prettierrc` and `.prettierignore`. The root-only Turborepo task `//#format` runs `prettier --check .`, and `format:write` fixes.
- **Why:** ESLint finds bugs and Prettier formats; `eslint-config-prettier` stops them from fighting. Keeping them separate avoids slow, noisy lint-as-format rules.
- **Alternatives:** Biome (experimental full Svelte support, rejected by the owner), or a hybrid of two toolchains.
- **Failure modes:** `svelte-check` results depend on `svelte-kit sync` having generated `.svelte-kit/` types. Running `check` before sync causes confusing errors. Mitigation: `sync` is always part of the `check` script.

### D6. Tests: Vitest 4.1 for units, Playwright against the real Workers runtime for smoke tests

- Vitest 4.1.12 pinned across all members. Each app ships one unit test against a small pure module (e.g. `src/lib/app-meta.ts` exporting the app's display name, which the page also renders), so the test is meaningful rather than `expect(1).toBe(1)`.
- Turborepo `test` per member, not one root `vitest` projects config. This gives per-package caching and lets each member pick its pool later (Node for pure packages, `@cloudflare/vitest-pool-workers` for Worker code).
- Playwright 1.64 (Chromium), with a config per app. `webServer` runs **`wrangler dev`** against the built `.svelte-kit/cloudflare` output (welcome on 8787, admin on 8788), so the smoke test runs in **workerd, the same runtime as production**, not Node. `test:e2e` depends on `build`.
- **Why:** Unit tests guard logic; the smoke test guards "it actually boots on Workers". `vite preview` would run the Node server, which is precisely the environment we don't ship to.
- **Alternatives:** Vitest 5 (blocked by the Workers pool peer range); `vite preview` for e2e (less faithful); WebKit/mobile projects (owner chose Chromium only for now).
- **Failure modes:** `wrangler dev` may prompt (telemetry, login) or need a free port. Mitigation: `WRANGLER_SEND_METRICS=false` in the Playwright `webServer` env, explicit `--port`, and `reuseExistingServer: !process.env.CI`. Verify during apply that `wrangler dev` serves the build locally without Cloudflare login. If it doesn't, stop and ask the owner before falling back.

### D7. Turborepo task graph

| Task        | Depends on | Cached                  | Outputs                                                    |
| ----------- | ---------- | ----------------------- | ---------------------------------------------------------- |
| `build`     | `^build`   | yes                     | `.svelte-kit/cloudflare/**`, `.svelte-kit/output/**`       |
| `check`     | `^check`   | yes                     | none                                                       |
| `lint`      | `^lint`    | yes                     | none                                                       |
| `test`      | `^build`   | yes                     | `coverage/**`                                              |
| `test:e2e`  | `build`    | no                      | `playwright-report/**`, `test-results/**` (ignored by git) |
| `dev`       | none       | no (`persistent: true`) | none                                                       |
| `//#format` | none       | yes                     | none (root task)                                           |

`globalDependencies` include the root Prettier config, `tsconfig` changes reach consumers through the package graph, and Turborepo strict env mode stays on with no env vars declared yet.

### D8. Local commit checks: Lefthook + commitlint

- Root `package.json` `"prepare": "lefthook install"`. Bun runs the root package's own lifecycle scripts, but blocks dependencies' `postinstall` scripts unless they are trusted. The Lefthook binary arrives through its platform-specific optional dependency, so no trust entry is needed. Verify during apply.
- `pre-commit` (parallel): `prettier --write {staged_files}` and `eslint --fix {staged_files}`, each with a glob and `stage_fixed: true`. The spec requires that partially staged files keep their unstaged changes. Verify Lefthook's behavior during apply with a real partially staged file. If it modifies unstaged changes, stop and ask the owner before choosing an alternative.
- `commit-msg`: `commitlint --edit {1}` with `@commitlint/config-conventional` (no enforced scope list, Assumption A3). The same config is reused for PR-title linting in `ci-release-pipeline`.
- Hooks are skipped in CI with `LEFTHOOK=0` (next change).
- **Why:** Fast local feedback on formatting and commit messages, which release-please later depends on to compute versions and changelogs. CI enforces the same rules again, because local hooks can be bypassed with `--no-verify` or `--ignore-scripts`.
- **Failure modes:** A contributor installs with `--ignore-scripts`, so no hooks get installed. Mitigation: CI is the real gate; the README documents `bunx lefthook install`.

### D9. Repository creation and public-repo hygiene

- `git init -b main`. The apply step makes **one initial commit on `main`** containing only the files that already exist: `openspec/`, `.claude/`, `.opencode/`, plus the new `.gitignore` and `LICENSE`. It then creates the public GitHub repository with `gh repo create ycmcuenca/ycmcuenca-core --public --source . --push`, **after explicit owner confirmation** (Assumption A6). All bootstrap work stays uncommitted, for the `/git` workflow to commit on its own branch and open as a PR.
- After creation, check that GitHub secret scanning and push protection are on for the repository, and turn them on if not. Branch protection is left to `ci-release-pipeline`, once there are status checks to require.
- `.gitignore`: `node_modules/`, `.svelte-kit/`, `.wrangler/`, `.turbo/`, `build/`, `dist/`, `coverage/`, `playwright-report/`, `test-results/`, `.dev.vars*`, `.env`, `.env.*` (with `!.env.example`), `.DS_Store`, `*.log`.
- `LICENSE`: standard MIT text, copyright "Yosef Christian Mercene Cuenca", plus a separate clause stating that personal brand assets (name, logo, likeness) and published content (writing, artwork, images, 3D models) are not licensed under MIT.
- **Why:** The initial commit gives `main` a base for the first PR, and keeps the bootstrap work reviewable as a normal PR, which itself shows the workflow.
- **Failure modes:** A secret committed before scanning is on. Mitigation: no secret exists in this change; `.dev.vars*` and `.env*` are ignored before the first commit; push protection is checked immediately after repo creation.

### D10. `openspec/config.yaml` content

- `context`: only facts not inferable from code. That covers platform purpose (personal portfolio + hand-built CMS + base for future satellite projects); deployment (`*.ycmcuenca.workers.dev` now, custom domain later, Workers Free plan limits); single admin user behind Cloudflare Access; public repo; locales `en`, `fil`, `eo` with English required to publish; sprint plan (S1 foundation through S5 content + 3D); and the learning goal (the CMS is hand-built, everything else is managed services).
- `rules.proposal`: one capability-scoped change per PR; explicit out-of-scope list; ask the owner about any material ambiguity.
- `rules.specs`: behavior only, no library names unless they are external constraints.
- `rules.design`: for each significant decision, the pattern and why it fits, the alternatives with trade-offs, and the failure modes with mitigation; record verified versions and dates; list unconfirmed assumptions for owner review; take external facts from current docs (Context7).
- `rules.tasks`: include verification tasks for any unverified external behavior; manual owner tasks are marked as such.
- `operations.archive.guidance`: review all 5 living docs in `docs/` (when they exist) and update those affected, including their Mermaid diagrams; report "no living docs yet" otherwise.
- **Why:** OpenSpec passes `context` and `rules` into every artifact instruction, so the rules are enforced by the workflow itself rather than relying on memory or on AGENTS.md alone. `AGENTS.md` (in `living-docs`) will point to them, not duplicate them.
- **Failure modes:** Context bloat (OpenSpec caps it at 51,200 bytes) and stale facts. Mitigation: keep it to constraints, and update it in the change that alters a fact.

## Risks / Trade-offs

- [SvelteKit 3.x and adapter-cloudflare 8 are brand new, and tooling may have rough edges] → exact pins, lockfile committed, and apply verifies `check`, `build`, `test` and `test:e2e` before handing off.
- [Pinned behind latest: Vitest 4 vs 5, TypeScript 6 vs 7] → deliberate, for compatibility. Record "revisit when `@cloudflare/vitest-pool-workers` supports Vitest 5 and svelte-check supports TS 7" in the README's maintenance notes.
- [Turborepo cache serving stale results] → explicit outputs and inputs; `--force` documented.
- [Hooks bypassed] → CI re-enforces (next change).
- [Local Node 26 vs CI Node 24] → CI authoritative; README recommends 24.
- [Two-step repo creation publishes the OpenSpec/agent files before the bootstrap PR] → intentional; they contain no secrets, and the owner confirms before the push.

## Migration Plan

Greenfield, so nothing to migrate. Rollback: before the push, delete `.git/` and the generated files. After the push, the GitHub repository can be deleted or reset by the owner. No cloud resources are created.

## Open Questions

These are deferrable and don't change the specs or tasks:

- Does Bun 1.4.2 warn or fail when the running Bun version differs from `packageManager`? If not, the CI pin (next change) is the guarantee. Record the observed behavior in the README.

## Assumptions for owner review

These were not explicitly confirmed. Each is easy to change before apply:

- **A1** `engines.node` is `">=24"` (so local Node 26.10 works), while `.node-version` pins CI to 24.
- **A2** TypeScript `strict` plus `noUncheckedIndexedAccess`.
- **A3** commitlint uses `config-conventional` with no fixed scope list.
- **A4** Dev ports 5173/5174 and e2e ports 8787/8788.
- **A5** The only compatibility flag is `nodejs_als`, with `compatibility_date` set to the apply date.
- **A6** The initial commit on `main` holds only `openspec/`, `.claude/`, `.opencode/`, `.gitignore` and `LICENSE`, and is pushed when the repo is created (after your confirmation). Bootstrap work then goes through `/git` and `/ship` as a PR.
- **A7** LICENSE copyright holder is "Yosef Christian Mercene Cuenca".
- **A8** The README stays minimal (purpose, toolchain, commands, maintenance notes). Full docs come in `living-docs`.
