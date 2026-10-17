# ycmcuenca-core

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
| `bun run lint`     | Lints every app with the shared ESLint config.                                                                                  |
| `bun run format`   | Checks formatting with Prettier. `bun run format:write` fixes it.                                                               |
| `bun run test`     | Runs unit tests (Vitest).                                                                                                       |
| `bun run test:e2e` | Builds, then runs each app's Playwright smoke test in Chromium against `wrangler dev` — the same workerd runtime as production. |

All tasks run through Turborepo, so unchanged inputs are not rebuilt. If a
cached result looks wrong, bypass the cache with
`bunx turbo run <task> --force`.

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
  commitlint, because release automation later derives versions and changelogs
  from them.
- `LEFTHOOK=0 git commit ...` bypasses the hooks once, and CI (in the next
  change) re-checks everything, so hooks are a convenience, not the gate.

## Maintenance notes

- **Bun version mismatches are silent.** Bun 1.4.2 neither warns nor fails when
  the running Bun differs from the `packageManager` version (verified
  2026-10-17 by running 1.4.2 against declared `bun@1.0.0` and `bun@99.0.0`,
  with and without dependencies). The CI pin added in `ci-release-pipeline` is
  what actually guarantees the version.
- **Deliberately one major behind:** Vitest 4 (5.x exists, but
  `@cloudflare/vitest-pool-workers` requires Vitest ^4.1), TypeScript 6 (7.x
  exists, but svelte-check supports up to 6) and Node 24 LTS (26 is not LTS
  yet). Revisit when the Workers Vitest pool supports Vitest 5, when
  svelte-check supports TypeScript 7, and when Node 26 becomes LTS.
- Full documentation (architecture, product, roadmap) arrives with the
  `living-docs` change; this README stays minimal on purpose.
