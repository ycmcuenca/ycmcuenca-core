# Design

## Context

See proposal.md for the motivation, `specs/public-site/spec.md` for the behavior and the `developer-workspace` delta for the cross-app test.

Current state, expected after `revisions-publishing`:

- `admin` writes `entry:article:<slug>` and `index:article:en` to the `SNAPSHOTS` KV namespace. `@ycmcuenca/cms-core` exports `entryKey`/`indexKey`, `readEntrySnapshot`/`readIndexSnapshot` (`snapshot_v: 1`; they throw `UnsupportedSnapshotVersionError` or a Zod error), and `renderMarkdown`.
- `apps/welcome` (observed 2026-10-19):
  - `src/routes/+page.svelte` renders `<h1>{appName}</h1>` (`Welcome`); `+layout.svelte` sets the favicon; `+error.svelte` shows the status and request id.
  - `src/hooks.server.ts` applies `securityHeaders()` and `handleErrorFor("welcome")`.
  - `app.html` has `<html lang="en">`; `static/robots.txt` allows everything.
  - `wrangler.jsonc` has no bindings and only `nodejs_als`.
  - `playwright.config.ts` runs `wrangler dev --port 8787 --inspector-port 9229`.
- `apps/admin/playwright.config.ts` runs the Access fixture (8799) and `wrangler dev` on 8788/9230 with `--var` overrides.
- The CSP (`packages/edge/src/headers.ts`) is hash-based with `script-src 'self'`, `style-src 'self'` and `img-src 'self' data:`.

### Versions and facts verified (2026-10-19)

| Item                      | Fact                                                                                                                                                              | Source                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Svelte packages           | a package exposes components through `exports` with the `svelte` condition (and `types`); Svelte-aware tooling then compiles them                                 | Context7 `/sveltejs/kit` (packaging)                                            |
| SvelteKit 3 platform      | `env` comes from `cloudflare:workers`, not `platform`                                                                                                             | Context7 `/sveltejs/kit` (migrating to SvelteKit 3)                             |
| Multi-worker local dev    | `wrangler dev -c a -c b` runs several workers in one session, but only the first gets a port; separate `wrangler dev` processes are needed for two browsable apps | Context7 `/llmstxt/developers_cloudflare_workers_llms-full_txt` (multi-workers) |
| Local KV state            | local KV persists to a directory, and `--persist-to` chooses it; `wrangler kv key put --local --persist-to <dir>` writes to the same state                        | same source (local data)                                                        |
| Turborepo package configs | `apps/<app>/turbo.json` with `"extends": ["//"]` can make a task depend on another package's task (`"dependsOn": ["welcome#build"]`)                              | Context7 `/vercel/turborepo` (package configurations)                           |

## Goals / Non-Goals

**Goals:**

- `welcome` turns a snapshot into HTML with templates only. No Markdown parsing or database access happens on the read path (C5, C9).
- The block registry is the single place that maps a block type to a component, shared with `admin`'s preview.
- Every page is valid under the existing strict CSP, with no new directive.

**Non-Goals:**

- Response caching (`edge-cache`).
- Pagination of the home list. S2 has a handful of articles, and the index snapshot holds them all.

## Decisions

### D1. `@ycmcuenca/cms-render`: a source-only Svelte package

- `packages/cms-render/package.json`: private, ESM, `"exports": { ".": { "types": "./src/index.ts", "svelte": "./src/index.ts" } }`, `peerDependencies: { "svelte": "5.57.2" }`, `dependencies: { "@ycmcuenca/cms-core": "workspace:*" }`. Scripts: `check` (`svelte-check`), `test` (Vitest with `@testing-library/svelte` if task 1.1 finds it needed, otherwise Svelte's `render` from `svelte/server`) and `lint`.
- Contents:
  - `src/MarkdownBlock.svelte` renders `{@html block.html}` inside a `<div class="block block-markdown">`.
  - `src/BlockList.svelte` iterates `blocks` and picks the component from `blockComponents`, a `Record<BlockType, Component>` in `src/registry.ts`. The `Record` type makes a new block type a compile error until it has a component.
  - `src/snapshot-reader.ts` (D2) holds the reader.
- **Why `{@html}` is safe here:** the HTML was produced by cms-core's renderer with raw HTML disabled (content-model D5), and only `admin` writes KV. A compromised KV namespace would be a compromise of the account, not of this code.
- **Pattern:** [hexagonal architecture](../../../docs/SYSTEM_DESIGN.md#hexagonal-architecture-ports-and-adapters). The reader is the KV adapter on the read side, and the components depend only on cms-core's snapshot types.
- **Alternatives:** _components inside `apps/welcome`_ (`admin-editor`'s preview could not reuse them, and C1 names `cms-render`); _a built package with `svelte-package`_ (a build step for a package with no outside consumer).
- **Failure modes:** _Vite does not compile `.svelte` files from a symlinked workspace package:_ task 1.1 checks it first, and the fallback is `svelte-package` with `dist/`, which the SvelteKit docs describe.

### D2. Reading snapshots tolerantly (C8)

- `readArticle(kv, slug, log)` and `readArticleIndex(kv, log)` in `src/snapshot-reader.ts`:
  1. `kv.get(key, "json")`. A missing key returns `undefined`.
  2. Parse with `readEntrySnapshot`/`readIndexSnapshot`.
  3. On `UnsupportedSnapshotVersionError` or a validation error, log `error("unreadable snapshot", { key, problem })` and return `undefined`.
- The caller treats `undefined` as "not published": a 404 for an article, and an empty list for the index (spec, "Unreadable snapshots are not shown").
- The reader takes a minimal `{ get(key, type: "json") }` interface rather than the full `KVNamespace`, so tests use a plain object.
- **Pattern:** [versioned contracts and tolerant readers](../../../docs/SYSTEM_DESIGN.md#versioned-contracts-and-tolerant-readers).
- **Failure modes:** _KV is unavailable (a thrown error, not a missing key):_ it is not caught here, so SvelteKit's `handleError` logs it with the request id and the visitor gets a 500. That is the honest answer to an outage.

### D3. Routes on `welcome`

| Route                 | File                                                            | Reads                  | Output                                                         |
| --------------------- | --------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------- |
| `/`                   | `src/routes/+page.server.ts`, `+page.svelte`                    | `index:article:en`     | `Welcome` heading, intro paragraph, list or "No articles yet." |
| `/en/articles/[slug]` | `src/routes/en/articles/[slug]/+page.server.ts`, `+page.svelte` | `entry:article:<slug>` | the article, or `error(404)`                                   |
| `/sitemap.xml`        | `src/routes/sitemap.xml/+server.ts`                             | `index:article:en`     | `application/xml` sitemap (sitemaps.org 0.9)                   |
| `/en/feed.xml`        | `src/routes/en/feed.xml/+server.ts`                             | `index:article:en`     | `application/atom+xml` feed                                    |

- `[slug]` is checked against cms-core's slug rule before KV is read, so a malformed slug is a 404 without a KV read.
- Dates are rendered with `<time datetime="…">` in `YYYY-MM-DD` form from the UTC timestamp, with no locale formatting until S4.
- Sitemap and feed XML are built by small string functions in `src/lib/server/xml.ts` that escape `& < > " '`, with no XML library (two fixed shapes). The feed's top-level `updated` is the newest entry's first-publish time, or the Unix epoch when the feed is empty.
- `welcome` reads `env.SNAPSHOTS` through `import { env } from "cloudflare:workers"`, as `admin` reads its variables.
- **Alternatives:** _an `/en/` home with `/` redirecting_ (the deploy smoke check `scripts/deploy/smoke-check.sh` and the existing smoke test expect `/` to answer 200 with `Welcome`; S4 decides locale negotiation for `/`); _RSS 2.0_ (Q4 allows either; Atom has mandatory ids and timestamps, which suit snapshots).

### D4. SEO metadata from one origin

- `apps/welcome/wrangler.jsonc` gains `"vars": { "SITE_ORIGIN": "https://welcome.ycmcuenca.workers.dev" }`. `src/lib/server/seo.ts` exports `absoluteUrl(path)`. Each page's `load` returns `{ seo: { canonical, description } }`, and `+layout.svelte` renders the canonical link, the `hreflang="en"` and `x-default` alternates, the meta description and the feed autodiscovery link in `<svelte:head>`.
- `static/robots.txt` gains `Sitemap: https://welcome.ycmcuenca.workers.dev/sitemap.xml`. A unit test asserts it equals `SITE_ORIGIN` + `/sitemap.xml`, read from `wrangler.jsonc` with Wrangler's `unstable_readConfig`, as `apps/admin/src/lib/trust-config.test.ts` does, so the two cannot drift.
- Canonical URLs always use the committed origin, also on preview URLs and under `wrangler dev`, so a preview never claims to be canonical.
- **Failure modes:** _the custom-domain cutover (parking lot):_ `SITE_ORIGIN` and `robots.txt` change together, and the test enforces it.

### D5. Tests

- **Unit:**
  - `packages/cms-render`: the registry renders a `markdown` block's HTML; the reader returns `undefined` and logs for a version 2 snapshot and for a snapshot without a title, and returns `undefined` silently for a missing key.
  - `apps/welcome`: the XML escaping, and the sitemap and feed for zero and two items.
- **`welcome`'s own e2e** (`apps/welcome/e2e/articles.spec.ts`): a Playwright `globalSetup` runs `bunx wrangler kv key put --local --persist-to .wrangler/e2e-state` for two fixture snapshots and the index, and `playwright.config.ts` starts `wrangler dev` with the same `--persist-to`. The tests check:
  - the home list order;
  - an article page with both dates;
  - a 404 for an unknown slug;
  - a 404 plus no partial content for a version 2 snapshot under another key;
  - the canonical and alternate links;
  - that the sitemap and feed contain both URLs;
  - no CSP violation on the article page.
- **The publish-path e2e** (`apps/admin/e2e/publish-path.spec.ts`): `apps/admin/playwright.config.ts` adds a third `webServer`, which runs `welcome`'s built worker with `wrangler dev --port 8791 --inspector-port 9231 --persist-to ../admin/.wrangler/e2e-state` from `apps/welcome`, and `admin`'s own server gains the same `--persist-to`. `apps/admin/turbo.json` (`"extends": ["//"]`) makes `test:e2e` depend on `build` and `welcome#build`. The test seeds an entry, publishes it in `admin`, opens `http://127.0.0.1:8791/en/articles/<slug>`, checks the home list, unpublishes and expects 404.
- **Pattern:** [testing the production artifact](../../../docs/SYSTEM_DESIGN.md#testing-the-production-artifact).
- **Failure modes:** _two `wrangler dev` processes do not see each other's writes in one persistence directory_ (for example, because of a per-process cache or locking): task 4.1 spikes it first, and **stops for the owner** if it fails (options: a test-only KV write endpoint in `welcome` behind `dev`, or a single `wrangler dev -c` session driving `admin` through a service binding).

## Risks / Trade-offs

- **Two worker processes sharing local state is unverified** → spiked first (D5).
- **`{@html}` trusts KV content** → only `admin` writes it, after sanitized rendering (D1).
- **Every page view is a KV read until `edge-cache`** → within 100,000 reads a day on the Free plan; `edge-cache` follows in the same sprint.

## Migration Plan

1. Merge. The `welcome` release deploys with the `SNAPSHOTS` binding (the same id as `admin`'s, committed by `revisions-publishing`) and `SITE_ORIGIN`.
2. The owner checks production (task 5.2).
3. Rollback: redeploy the previous `welcome` tag, which serves the placeholder again. KV is untouched.

## Assumptions

- **A1.** The deploy token can deploy a worker with a KV binding using Workers Scripts: Edit alone, as `admin` already did in `revisions-publishing` (its task 5.2).
