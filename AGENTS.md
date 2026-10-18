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
- In OpenCode the commands are `/opsx-propose`, `/opsx-apply` and
  `/opsx-archive`. In Claude Code they are `/opsx:propose`, `/opsx:apply` and
  `/opsx:archive`. Their files live in `.opencode/commands/` and
  `.claude/commands/opsx/`.
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

CI also runs the `workflows` job (actionlint and zizmor) and the `commits` job
(commitlint over the pull request's commits). See `.github/workflows/ci.yml`.

## Conventions

- Write commit messages as Conventional Commits. Release versions come from
  them.
- Merge only by rebase. The `main` ruleset allows nothing else.
- Pin every dependency to an exact version.
- After you change an app's `wrangler.jsonc`, run `bun run gen` in that app and
  commit the changed `worker-configuration.d.ts`.
- Write documents in plain language, following ISO 24495-1: short sentences,
  common words, one idea per paragraph, and each term defined where it first
  appears.

## Clean Code

Apply the rules of Robert C. Martin's _Clean Code_ to all code in the
repository: TypeScript, Svelte and shell scripts.

- **Names:** use names that reveal intent and are easy to say. Avoid
  abbreviations and encodings.
- **Functions:** keep them small. Each does one thing, at one level of
  abstraction, with as few arguments as possible.
- **Comments:** explain why, never what. Cite the design decision that explains
  a choice, for example `design D4`. Delete a comment that restates the code.
- **No duplication, no dead code:** express each idea once. Delete unused and
  commented-out code. Version control keeps it.
- **Errors:** fail with a clear error. Do not return or pass `null` to signal a
  problem. Wrap third-party APIs at the boundary.
- **Design:** give each module one reason to change. Depend on abstractions,
  and prefer composition to inheritance (SOLID).
- **Tests:** keep them fast, independent, repeatable, self-validating and
  written with the code. Test one concept at a time.
- **Boy Scout rule:** leave code cleaner than you found it, but only within the
  scope of the change. Keep formatting consistent; Prettier decides.
