# Design

## Context

See proposal.md for the motivation and `specs/content-model/spec.md` for the required behavior.

Current state, observed on 2026-10-19:

- `packages/` holds `tsconfig`, `eslint-config` and `edge`. `@ycmcuenca/edge` is the only TypeScript library package and the model for a new one. It is source-only: `exports` points at `.ts` files, relative imports carry their `.ts` extension, and `tsconfig.json` extends `@ycmcuenca/tsconfig/base.json` with `moduleResolution: bundler`, `allowImportingTsExtensions`, `verbatimModuleSyntax` and `noEmit` (`packages/edge/package.json`, `packages/edge/tsconfig.json`). Its scripts are `check` (`tsc --noEmit`), `test` (`vitest run`) and `lint` (`eslint .`).
- `turbo.jsonc` runs `check`, `lint` and `test` in every member that defines them, so a new package joins the root tasks without editing it.
- `renovate.json5` groups runtime dependencies that change app behavior with `semanticCommitType: "fix"` (`svelte-runtime`, `edge-runtime`), and tooling with `chore`.
- No content code exists anywhere in the repository.

### Versions and facts verified (2026-10-19)

| Item                    | Version or fact                                                                                                                                                                                                                                            | Source                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Zod                     | 4.6.7 (`latest`). `z.object` strips unknown keys by default (the `$strip` config); `z.strictObject` rejects them; `z.looseObject` keeps them                                                                                                               | npm registry; Context7 `/colinhacks/zod` (API, `schemas.ts`) |
| markdown-it             | 15.0.3. The default preset has `html: false`, so raw HTML is escaped. The built-in `validateLink` refuses `javascript:`, `vbscript:`, `file:` and `data:` except `data:image/(gif\|png\|jpeg\|webp)`                                                       | npm registry; Context7 `/markdown-it/markdown-it` (safety)   |
| markdown-it package     | ships its own types (`dist/markdown-it.d.mts`); ESM build imports no `node:` module (its dependencies include `punycode.js`, the userland package); the default preset sets `maxNesting: 100`                                                              | the 15.0.3 tarball from npm, 2026-10-19                      |
| markdown-it output      | scratch test: `<script>alert(1)</script>`, `[x](javascript:alert(1))` and `<img src=x onerror=alert(1)>` render as escaped text inside `<p>`, with no element or link created                                                                              | scratch test, Bun 1.4.2, 2026-10-19                          |
| markdown-it render cost | warm render of mixed Markdown (headings, paragraphs, lists, code): 10 KB 0.97 ms, 30 KB 2.55 ms, 100 KB 8.87 ms; a first render on a new instance of 100 KB 9.46 ms. Measured on the owner's machine, which is faster than an edge CPU is guaranteed to be | scratch test, Bun 1.4.2, 2026-10-19                          |
| Workers CPU             | Free plan: 10 ms CPU per request, with occasional overage tolerated (edge-infrastructure design facts)                                                                                                                                                     | developers.cloudflare.com/workers/platform/limits            |

## Goals / Non-Goals

**Goals:**

- One definition of the article that the database adapter, the projector, `welcome` and `admin` all import, so no layer re-describes it.
- Everything in the package runs unchanged in workerd, Bun and Node, because it uses only standard JavaScript.
- Safety and size limits are enforced in one place, so a later caller cannot forget them.

**Non-Goals:**

- A plugin system for types or blocks. A new type or block is a code change in this package, which is what C2 ("code-first") asks for.
- Rich-text features in Markdown (tables, footnotes, typographic quotes). They can be enabled later without a schema change, because the source is stored and the HTML is re-rendered at the next publish.

## Decisions

### D1. Package shape: a source-only TypeScript package like `@ycmcuenca/edge`

- `packages/cms-core/package.json`: `"name": "@ycmcuenca/cms-core"`, `"private": true`, `"type": "module"`, one export `".": "./src/index.ts"`, scripts `check`, `test` and `lint` copied from `packages/edge/package.json`.
- Runtime `dependencies`: `zod` 4.6.7 and `markdown-it` 15.0.3, pinned exactly. Unlike `jose` in `@ycmcuenca/edge` (a peer dependency the app also imports), nothing outside this package imports them, so they are ordinary dependencies.
- `devDependencies`: `@ycmcuenca/eslint-config`, `@ycmcuenca/tsconfig`, `typescript` 6.0.3 and `vitest` 4.1.12, matching the versions `packages/edge` uses.
- `tsconfig.json` copies `packages/edge/tsconfig.json` except `lib`: `["esnext"]` only, because this package needs no DOM types. `TextEncoder` is the one host global it uses, and it is typed by adding `"types": []` with an `ambient.d.ts` declaring `TextEncoder` if `tsc` reports it missing (task 1.1 decides).
- **Pattern:** [hexagonal architecture (ports and adapters)](../../../docs/SYSTEM_DESIGN.md#hexagonal-architecture-ports-and-adapters). This package is the core: it imports nothing from Cloudflare, Postgres or Svelte, and adapters will depend on it, never the other way round.
- **Alternatives:** _types inside `apps/admin`_ (then `welcome` would import from an app, and C1 forbids that); _a built package with `dist/`_ (it adds a build step and a `^build` dependency for no consumer outside this repository; `@ycmcuenca/edge` already proves source-only works).
- **Failure modes:** _a contributor imports a Cloudflare or database module into `cms-core`:_ task 1.2 adds an ESLint `no-restricted-imports` rule for `cloudflare:*`, `pg`, `drizzle-orm`, `svelte` and `@sveltejs/*` in `packages/cms-core/eslint.config.js`, so `bun run lint` fails.

### D2. Field, block and type layers (C2)

```text
field  = { name, label, help?, editor: "text" | "textarea" | "markdown", required, limit, schema }
block  = { type: "markdown", source: string }            -- the only block in S2
type   = { name: "article", fields: [title, slug, summary], body: { blocks: ["markdown"] } }
```

- `src/fields.ts` exports factory functions, `textField`, `slugField` and `multilineField`. Each returns a field definition whose Zod schema carries the limits stated in the spec. Lengths are counted in UTF-16 code units, as `String.prototype.length` does, which matches what an HTML `maxlength` attribute counts.
- `src/blocks.ts` defines `markdownBlock` as `z.object({ type: z.literal("markdown"), source: z.string() })`, and `bodySchema` as a non-empty array of blocks, discriminated on `type` with `z.discriminatedUnion` so that a future `image` block is one more member.
- `src/types/article.ts` defines `article` from those parts, plus a `superRefine` on the body for the 32,768-byte limit (D5).
- `src/index.ts` re-exports the public API: `article`, the `ArticleContent` type, `validateArticle`, `renderMarkdown`, `readStoredContent`, `storedContent`, the snapshot schemas and readers, and `formDescription`.
- **Why the slug is a field here:** the owner edits it in the same form. Where it is stored (on the entry row, so that it can be unique) is `content-store`'s concern.
- **Alternatives:** _a JSON-Schema-driven definition_ (more generic, but loses Zod's types for the code that uses the content); _one flat Zod object per type_ (simpler today, but each later type would repeat the field rules, and the form description could drift from validation).
- **Failure modes:** _the form and the validation disagree on a limit:_ the form description is derived from the same field objects (D6), and a unit test checks each stated limit against validation (spec, "Form and validation agree").

### D3. Validation returns errors per field

- `validateArticle(input: unknown)` returns either `{ ok: true, content }` or `{ ok: false, errors }`, where `errors` maps a field path (`title`, `slug`, `summary`, `body`, `body.0.source`) to one message. It uses `safeParse` and maps Zod 4's issues by their `path`, keeping the first message per path.
- Messages are written in this package in plain English (for example "Use at most 120 characters."), not Zod's defaults, so `admin` shows them as they are.
- Title and summary are trimmed by the schema (`z.string().trim()`) before the length checks. The title also refuses `\n` and `\r` (spec: one line).
- **Why a result, not an exception:** invalid input is an expected outcome of a form, and the Clean Code rule in AGENTS.md says not to signal a problem with `null`. A discriminated result is explicit and typed.
- **Failure modes:** _Zod changes its issue shape in a minor release:_ the unit tests assert the mapped messages, so a Renovate update that breaks them fails CI.

### D4. Stored content versioning

- `storedContent` is `z.object({ schema_v: z.literal(1), content: articleSchema.omit({ slug: true }) })`. The slug is left out because `content-store` keeps it on the entry row, where it can be unique per type; a revision records what the owner wrote, and the slug is the entry's address. `readStoredContent(value: unknown)` checks `schema_v` first. If it is not 1, it throws `UnsupportedSchemaVersionError` naming the version found (or "missing"). Otherwise it parses the content.
- There is no upcaster chain yet. S4 adds the first upcaster (version 1 to 2, per-locale fields), and with it the chain that `readStoredContent` runs before parsing. This is the owner's decision from explore: English-only now, a real upcaster in S4.
- **Pattern:** [schema versioning with upcasters](../../../docs/SYSTEM_DESIGN.md#schema-versioning-with-upcasters). The version field is the part every upcaster needs; the chain arrives with the first real change of shape.
- **Alternatives:** _a localized shape from day one_ (rejected by the owner: it carries unused structure and leaves the upcaster untested); _a synthetic v0-to-v1 upcaster now_ (rejected: an artificial test case).
- **Failure modes:** _a revision written by a newer version of the code is read by an older one,_ for example after a rollback deploy: the read fails loudly with the version named, and nothing renders half-understood content.

### D5. Markdown rendering and the 32 KB limit (C9)

- `renderMarkdown(source: string): string` uses one module-level `new MarkdownIt({ html: false, linkify: false, typographer: false })`, created once per isolate, and returns `md.render(source)`.
- `html: false` escapes raw HTML, and the built-in `validateLink` refuses the dangerous schemes the spec lists (verified in the facts table). No separate sanitizer runs: the parser never emits an element the Markdown grammar did not produce, so the output is safe by construction. This is why the owner chose "no raw HTML".
- **The limit:** the article schema rejects a body whose blocks hold more than 32,768 bytes of Markdown together, counted with `new TextEncoder().encode(source).length`. Measured, 30 KB renders in 2.55 ms warm on the owner's machine, so a full-size article leaves most of the 10 ms budget for Access verification, Neon and KV. The owner chose 32 KB after seeing the measurement (100 KB took 8.87 ms). A body of more than 200 blocks is rejected as well: the byte count alone would allow any number of empty blocks, and the block list is what a revision row and a snapshot store.
- **Pattern:** rendering at write time, part of [CQRS-lite read projections](../../../docs/SYSTEM_DESIGN.md#cqrs-lite-read-projections): the expensive work happens once at publish, and every read gets finished HTML.
- **Alternatives:** _`marked` with a sanitizer_ (marked does not sanitize, and DOMPurify needs a DOM, which workerd lacks); _a unified/rehype pipeline with `rehype-sanitize`_ (more flexible, with an allow-list for raw HTML, but more CPU per render and more dependencies, for a feature the owner turned down); _rendering in the browser_ (C9 renders at publish, so `welcome` only serves HTML).
- **Failure modes:**
  - _An edge CPU is slower than the measurement:_ `revisions-publishing` measures `cpuTimeMs` of a real publish of a 32 KB article in Workers Logs (its verification task). If it is consistently over 10 ms, the limit is lowered in a follow-up.
  - _A markdown-it update changes the output:_ the snapshot stores HTML, so already published pages do not change; the next publish re-renders. A golden-output unit test makes any change visible in the Renovate PR.
  - _Deeply nested input:_ markdown-it's default preset limits nesting with `maxNesting: 100` (verified in the tarball), the 32 KB limit bounds the input, and the only author is the owner behind Access.

### D6. Form descriptions from the same field objects

- `formDescription(type)` returns `type.fields` mapped to `{ name, label, help, editor, required, limit }`, plus one entry for the body (`name: "body"`, `editor: "markdown"`, `limit: 32768`, with the limit in bytes). The order is the order of `type.fields`, followed by the body.
- The description is plain data, with no Svelte or HTML, so `cms-core` stays free of UI code (owner decision: definitions drive forms, `cms-core` stays UI-free).
- **Pattern:** a single source of truth for the schema and the form, so they cannot drift (the spec's "Form and validation agree" scenario is its test).
- **Alternatives:** _a hand-built form per type in `admin`_ (the owner rejected it: every new type would need new form code).

### D7. The snapshot contract (C8)

- `src/snapshot.ts` defines two schemas, both plain `z.object` (which strips unknown keys, so readers are tolerant, as verified for Zod 4):
  - `entrySnapshot`: `snapshot_v: 1`, `type`, `slug`, `title`, `summary`, `blocks: [{ type: "markdown", html }]`, `publishedAt`, `updatedAt` (ISO 8601 UTC strings).
  - `indexSnapshot`: `snapshot_v: 1`, `type`, `locale: "en"`, `items: [{ slug, title, summary, publishedAt }]`.
- `readEntrySnapshot(value)` and `readIndexSnapshot(value)` check `snapshot_v` against the supported set (`[1]`) first, throwing `UnsupportedSnapshotVersionError` for anything else, and then parse. When a later change adds version 2, the supported set becomes `[1, 2]` and the reader maps 1 to 2, so the two workers can deploy in either order (C8).
- The functions that _build_ snapshots from content belong to the projector in `revisions-publishing`. This change defines only the shape and the readers.
- **Pattern:** [versioned contracts and tolerant readers](../../../docs/SYSTEM_DESIGN.md#versioned-contracts-and-tolerant-readers).
- **Alternatives:** _`z.looseObject`_ (keeps unknown fields in the parsed value; stripping them is safer, because the renderer then never sees fields it was not written for); _no version field until it is needed_ (C8 requires it from the first snapshot).
- **Failure modes:** _a snapshot written by a newer `admin` reaches an older `welcome`:_ the reader rejects it with the version named. `public-rendering` decides how a page responds then (it logs an error and answers 404 rather than half-rendering).

## Risks / Trade-offs

- **The article type is shaped by one imagined use, not real content** → S6 (`portfolio-projects`) revisits the model against real content, and the block list leaves room to grow without a schema break.
- **Defining the snapshot here, before its producer and consumer exist, could guess wrong** → Its two users arrive in the next three changes, and any field they need is added to version 1 before anything is published, since nothing is stored in KV until `revisions-publishing` merges.
- **Measured on a laptop, not on the edge** → `revisions-publishing` measures a real publish (D5).

## Migration Plan

Nothing to migrate: the package is new and unused until `revisions-publishing`. Rollback is reverting the commits.

## Assumptions

- **A1.** `zod` 4.6.7 and `markdown-it` 15.0.3 load in workerd without `nodejs_compat`. Both are pure JavaScript with no Node.js built-ins at runtime; this is confirmed when `admin` first bundles them in `revisions-publishing` (its build runs in CI with only `nodejs_als` and `nodejs_compat`).
- **A2.** Counting title and summary limits in UTF-16 code units (JavaScript `length`) is acceptable for English text. Localization in S4 may revisit this for other scripts.
