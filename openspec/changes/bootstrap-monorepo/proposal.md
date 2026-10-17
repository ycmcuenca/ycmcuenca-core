# Proposal

## Why

`ycmcuenca-core` is an empty folder: no git history, no workspace, no tooling. Every later Sprint 1 change (CI/release pipeline, edge infrastructure, living docs) and every CMS change after that needs one repeatable base: one way to install, build, check, lint, test and commit. That base has to be safe to develop in public from the first commit. The project also has an explicit learning goal, so the OpenSpec workflow rules that make every later design explain its reasoning need to be in place before those designs are written.

## What Changes

- Initialize the repository: git with `main` as the default branch, a public GitHub repository `ycmcuenca/ycmcuenca-core` (created via `gh` during apply, after confirmation), an MIT `LICENSE` that explicitly excludes personal brand assets and content, a `.gitignore` that keeps secrets (`.dev.vars`, `.env*`) and build output out of git, and a minimal `README.md`.
- Create a Bun-workspaces + Turborepo monorepo (`apps/*`, `packages/*`), with Bun 1.4.2 and Node 24 LTS pinned for every contributor and CI.
- Add shared configuration packages `@ycmcuenca/tsconfig` and `@ycmcuenca/eslint-config`, consumed via `workspace:*`.
- Scaffold two SvelteKit 3 apps, `apps/welcome` and `apps/admin`, as unstyled hello-world pages using `@sveltejs/adapter-cloudflare`. Each has a minimal `wrangler.jsonc` with no bindings. Nothing is deployed in this change.
- Set up workspace-wide tooling: TypeScript 6, ESLint + Prettier (Svelte plugins), Vitest 4.1 unit tests, and one Playwright smoke test per app.
- Add Turborepo tasks (`build`, `check`, `lint`, `format`, `test`, `test:e2e`, `dev`) runnable from the root.
- Add local git hooks via Lefthook: format and lint staged files on pre-commit, and Conventional Commit validation on commit-msg.
- Populate `openspec/config.yaml` with project context and rules. Every `design.md` must explain the architectural "why", trade-offs and failure modes, and archiving a change must sync the living docs in `docs/`.
- Manual cleanup task for the owner: delete the stray, unused `~/openspec/` in the home directory (outside this repo, never removed automatically).

Out of scope (later changes): CI workflows, release-please, and deploy (`ci-release-pipeline`); Cloudflare resources, bindings, Access and deployment (`edge-infrastructure`); `AGENTS.md`, the 5 living docs and the revised architecture diagram (`living-docs`); Tailwind and shadcn-svelte (the first UI change in Sprint 2); and the `@ycmcuenca/cms-*`, `db` and `ui` packages (each is created by the change that first needs it).

## Capabilities

### New Capabilities
- `developer-workspace`: How the monorepo is structured and operated. This covers workspace layout and naming, pinned toolchain versions, the root task interface (build, check, lint, format, test, e2e), the shared config packages, the hello-world app baseline on the Workers adapter, local commit checks, and repository hygiene for a public repo (license, ignored secrets).
- `planning-workflow`: The rules that govern OpenSpec artifacts in this repo. Designs must explain reasoning, trade-offs and failure modes; archiving a change requires syncing the living docs.

### Modified Capabilities
<!-- None: no specs exist yet. -->

## Impact

- **New files**: root `package.json`, `bun.lock`, `turbo.json`, `lefthook.yml`, commitlint config, Prettier config, `.gitignore`, `.node-version`, `LICENSE`, `README.md`, `packages/tsconfig/*`, `packages/eslint-config/*`, `apps/welcome/*`, `apps/admin/*`, and an updated `openspec/config.yaml`.
- **Dependencies**: SvelteKit 3.1, Svelte 5.57, Vite 8, `@sveltejs/adapter-cloudflare` 8, TypeScript 6, Turborepo 2.11, ESLint + `eslint-plugin-svelte` + `typescript-eslint`, Prettier + `prettier-plugin-svelte`, Vitest 4.1, Playwright 1.64, Lefthook 2, commitlint, and Wrangler 4 (dev dependency, used by the adapter's local platform proxy).
- **External systems**: one public GitHub repository is created. No Cloudflare, Neon or other cloud resources are touched.
- **Existing OpenSpec setup**: the `.claude/` and `.opencode/` OpenSpec skill and command files already in the repo are kept and committed.
