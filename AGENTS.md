# Agent guide

`ycmcuenca-core` is a Bun and Turborepo monorepo. It holds the owner's portfolio
site (`apps/welcome`), its CMS admin (`apps/admin`) and the base for future
satellite projects. Both apps are SvelteKit apps for Cloudflare Workers.

This file points to the sources of truth. It does not copy them, so when a rule
changes, this file needs no edit.

The repository is public. Never commit a secret
([P2](docs/DECISIONS.md#platform-and-scope)).

## Read first

Read these before you propose or change anything:

1. [docs/ROADMAP.md](docs/ROADMAP.md): the sprint plan and the status of every
   change.
2. [docs/DECISIONS.md](docs/DECISIONS.md): the platform-wide decisions, such as
   `C5` or `L3`. A change that contradicts a decided entry needs the owner's
   approval first.
3. [openspec/config.yaml](openspec/config.yaml): the project context and the
   rules for each OpenSpec artifact.

## The living documents

Read the one that matches your task.

| Document                                | Read it when you need to know                                  |
| --------------------------------------- | -------------------------------------------------------------- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the parts connect, and what exists versus what is planned. |
| [PRODUCT.md](docs/PRODUCT.md)           | Who the platform is for, and what it leaves out.               |
| [USER_JOURNEY.md](docs/USER_JOURNEY.md) | What each kind of person does, step by step.                   |
| [DESIGN.md](docs/DESIGN.md)             | How the apps should look, and which choices are open.          |
| [ROADMAP.md](docs/ROADMAP.md)           | When each part arrives.                                        |

The archive guidance in `openspec/config.yaml` says when to update them.

## Workflow

- Work happens as OpenSpec changes: one change is one capability and one pull
  request ([P7](docs/DECISIONS.md#platform-and-scope)).
- The commands are `/opsx-propose`, `/opsx-apply` and `/opsx-archive`. Their
  files live in `.claude/commands/opsx/` and `.opencode/commands/`.
- Run the OpenSpec CLI through `bunx openspec`. The repository pins its version.
- The [README](README.md) explains how changes land, how releases work and how
  repository settings are applied.

## Commands

The [README](README.md#everyday-commands) lists the everyday commands. The local
equivalent of CI is:

```sh
bun install --frozen-lockfile && bun run format && bun run lint && bun run check \
  && bun run build && bun run test && bun run test:e2e \
  && bunx openspec validate --all --strict --no-interactive \
  && scripts/docs/check-living-docs.sh
```

## Conventions

- Write commit messages as Conventional Commits. Release versions come from
  them.
- Merge only by rebase. The `main` ruleset allows nothing else.
- Pin every dependency to an exact version.
- In code comments, cite the design decision that explains the choice, for
  example `design D4`.
- After you change an app's `wrangler.jsonc`, run `bun run gen` in that app and
  commit the changed `worker-configuration.d.ts`.
- Write documents in plain language, following ISO 24495-1: short sentences,
  common words, one idea per paragraph, and each term defined where it first
  appears.
