# Design

## Context

See proposal.md for the motivation, `specs/edge-caching/spec.md` for the behavior and the `observability` delta for logging.

Current state, observed on 2026-11-07 after `admin-editor` was archived:

- `apps/welcome/wrangler.jsonc` has `main: ".svelte-kit/cloudflare/_worker.js"`, the `ASSETS` binding, `nodejs_als`, the `SNAPSHOTS` KV binding and `SITE_ORIGIN`.
- The installed adapter (`@sveltejs/adapter-cloudflare` 8.0.1):
  - writes its worker to the `main` of the Wrangler config it reads (`index.js:64`), and its `config` option names that file;
  - generates `export default { async fetch(req, env) { … } }` (`files/worker.js`), which passes no `ctx` to SvelteKit.
- The generated `worker-configuration.d.ts` types `ExecutionContext` with `readonly exports: Cloudflare.Exports` and `cache?: CacheContext`, the latter optional (`apps/welcome/worker-configuration.d.ts:470`), and `CacheContext.purge(options): Promise<CachePurgeResult>` (`:527`).
- Wrangler 4.151.1's `config-schema.json` accepts the `cache` and `exports` keys.
- `welcome`'s routes (`/`, `/en/articles/[slug]`, `/sitemap.xml`, `/en/feed.xml`) read KV through `@ycmcuenca/cms-render`. `src/hooks.server.ts` is `sequence(securityHeaders())`.
- In `admin`, cms-core's `publishing.ts` projects and then `markProjected`s (`project`, `packages/cms-core/src/publishing.ts:138`). It has no purge step. Its `ProjectionLogger` offers only `error` (`:10`), and `PublishingDependencies` (`:15`) is built in one place, `dependenciesFor` in `apps/admin/src/routes/entries/[id]/+page.server.ts:237`, which all six entry actions share.

### Versions and facts verified (2026-10-19)

| Item                        | Fact                                                                                                                                                                                                                                                               | Source                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Purge scope                 | `ctx.cache.purge({ tags })` purges only the cache of the entrypoint that calls it; a tag in two entrypoints needs a purge from each                                                                                                                                | Context7 `/llmstxt/developers_cloudflare_workers_llms-full_txt` (purge by tag, tag scope) |
| Per-entrypoint cache config | `"cache": { "enabled": true }` plus `"exports": { "default": { "type": "worker", "cache": { "enabled": false } }, "<Name>": { "type": "worker", "cache": { "enabled": true } } }`; the documented pattern routes reads through `ctx.exports.<Name>.fetch(request)` | same source (per-entrypoint caching, the leaderboard example)                             |
| `ctx.exports`               | needs the `enable_ctx_exports` compatibility flag                                                                                                                                                                                                                  | same source (Context API)                                                                 |
| Cache key                   | the target entrypoint plus the request's path and query string; **not** the host, the method (`GET`/`HEAD` share) or the body                                                                                                                                      | same source (what goes into the cache key)                                                |
| Default caching             | a response with no `Cache-Control` and no `Expires` is still cached by heuristic: 200 for 7,200 s, 404 for 180 s; `no-store` or `private` opts out                                                                                                                 | same source (Cache-Control semantics)                                                     |
| Header precedence           | `cloudflare-cdn-cache-control` (stripped before the client) beats `cdn-cache-control`, which beats `Cache-Control`                                                                                                                                                 | same source (header precedence)                                                           |
| `s-maxage` and SWR          | `s-maxage`, `must-revalidate` and `proxy-revalidate` disable `stale-while-revalidate`                                                                                                                                                                              | same source (stale-while-revalidate)                                                      |
| Bypass rules                | `Set-Cookie` in the response, `private`/`no-store`, or an `Authorization` request header (unless `public`/`s-maxage`) bypass the cache                                                                                                                             | same source (automatic bypass conditions)                                                 |
| `Cache-Tag`                 | comma-separated; printable ASCII only; at most 1,024 characters per tag and 1,000 tags per response; matched case-insensitively; stripped before the client; invalid tags are dropped silently                                                                     | same source (Cache-Tag response header)                                                   |
| Billing                     | with caching on, every request to the Worker counts at the request rate, including cache hits, static-asset requests and worker-to-worker calls; CPU is billed only when the Worker runs                                                                           | same source (Workers Cache pricing)                                                       |
| workers.dev                 | Workers Cache works on `*.workers.dev` (the docs' HIT/MISS example uses a `workers.dev` URL)                                                                                                                                                                       | same source (inspect a cache HIT)                                                         |
| Named entrypoint binding    | `"services": [{ "binding": "…", "service": "<worker>", "entrypoint": "<Name>" }]`                                                                                                                                                                                  | Context7 (service bindings, RPC)                                                          |
| SvelteKit custom classes    | the adapter does not support exporting custom classes (its note on Durable Objects and Workflows); its `config` option names the Wrangler file to read                                                                                                             | Context7 `/sveltejs/kit` (adapter-cloudflare)                                             |

## Goals / Non-Goals

**Goals:**

- A cache hit runs no SvelteKit code and reads no KV. Only the small `default` wrapper runs, to decide whether the request is cacheable (D1, D2).
- A publish affects only the pages that show the published entry.
- Nothing about caching can leak an unreleased version or let a visitor purge.

**Non-Goals:**

- Precise freshness guarantees beyond "about a minute" while KV propagates (C4's eventual consistency, owner decision).
- Caching `admin`.

## Decisions

### D1. A hand-written entry around SvelteKit, with two Wrangler files

- `apps/welcome/wrangler.sveltekit.jsonc` holds only what the adapter reads: `name`, `main: ".svelte-kit/cloudflare/_worker.js"`, `assets` and `compatibility_date`. `apps/welcome/vite.config.ts` passes `adapter({ config: "wrangler.sveltekit.jsonc", platformProxy: { configPath: "wrangler.jsonc" } })`. The adapter spreads `options.platformProxy` after `configPath`, so the build reads the adapter file while the dev platform proxy reads `wrangler.jsonc` with its `vars` and KV bindings.
- `apps/welcome/wrangler.jsonc`, the deploy file, changes:
  - `main` becomes `"src/worker.ts"`;
  - `enable_ctx_exports` joins `compatibility_flags`;
  - it gains `"cache": { "enabled": true }` and `"exports": { "default": { "type": "worker", "cache": { "enabled": false } }, "Site": { "type": "worker", "cache": { "enabled": true } } }`.
- `apps/welcome/src/worker.ts`:

  ```ts
  import { WorkerEntrypoint } from "cloudflare:workers";
  import sveltekit from "../.svelte-kit/cloudflare/_worker.js";

  export class Site extends WorkerEntrypoint<Env> {
    fetch(request: Request) { return sveltekit.fetch(request, this.env, this.ctx); }
    async purge(tags: string[]): Promise<PurgeOutcome> { … }   // D4
  }

  export default {
    fetch(request, env, ctx) {
      return isCacheable(request, env)                           // D2
        ? ctx.exports.Site.fetch(request)
        : sveltekit.fetch(request, env, ctx);
    },
  } satisfies ExportedHandler<Env>;
  ```

  `src/sveltekit-worker.d.ts` declares the module `../.svelte-kit/cloudflare/_worker.js` as an `ExportedHandler<Env>`, so `svelte-check` passes before a build exists.

- A unit test (`src/lib/worker-config.test.ts`, using Wrangler's `unstable_readConfig`) asserts that both Wrangler files agree on `name`, `assets` and `compatibility_date`, that the deploy file's `main` is `src/worker.ts`, and that `Site` is the only entrypoint with caching on.
- **Pattern:** [cache invalidation by tag](../../../docs/SYSTEM_DESIGN.md#cache-invalidation-by-tag). The purging code must live in the entrypoint that owns the cache, so the entrypoint is shaped around it.
- **Alternatives:**
  - _Caching on the default entrypoint_: SvelteKit's default handler has no `ctx`, so nothing could purge it.
  - _The Cache API (`caches.default`) inside a hook_: no tag purge, and Cloudflare's docs describe its operations as working on custom domains.
  - _Patching the adapter's output after the build_: fragile against adapter upgrades.
  - _Dropping C10 from S2_: the owner chose to keep it as its own change.
- **Failure modes:** _Wrangler cannot bundle an import of the adapter's built `_worker.js`, or `vite dev` breaks because the adapter's platform proxy now reads the other file:_ task 1.1 spikes both first and **stops for the owner** if either fails. _Observed 2026-11-07:_ the dev break happened (`bun run dev` returned 500 because `SITE_ORIGIN` and `SNAPSHOTS` were undefined); the `platformProxy` option above resolved it, and `build`, `wrangler deploy --dry-run`, `wrangler dev` and `check` pass.

### D2. Only production `GET`/`HEAD` requests go through the cache

`isCacheable(request, env)` is true when:

- the method is `GET` or `HEAD`, and
- `new URL(request.url).host` equals `new URL(env.SITE_ORIGIN).host`.

Everything else, including Access-protected preview and version URLs, calls SvelteKit directly, so no unreleased HTML can enter the cache, whose key ignores the host (verified). Requests carrying `Authorization` bypass Cloudflare's cache by its own rules anyway.

- **Failure modes:** _the custom-domain cutover:_ `SITE_ORIGIN` changes, and caching follows the new host. _A visitor adds random query strings:_ each one is a miss that runs the worker, which is no worse than having no cache.

### D3. Cache headers and tags from one hook

- `apps/welcome/src/lib/server/cache.ts` exports `cachePolicy()`, a SvelteKit `Handle` placed in `hooks.server.ts` after `securityHeaders()`:
  - When the route set `event.locals.cacheTags` and the response status is 200, it sets:
    - `Cloudflare-CDN-Cache-Control: max-age=60, stale-while-revalidate=300`;
    - `Cache-Control: public, max-age=0`;
    - `Cache-Tag: <tags joined by ",">`.
  - Otherwise it sets `Cache-Control: no-store`, which covers every 404, error and untagged route (spec, "Other responses are never cached").
- Each cacheable route sets `locals.cacheTags` in its `load` or `GET`, using cms-core's builders (D4): `entryTag(type, slug)`, `indexTag(type, locale)`, `typeTag(type)`, `localeTag(locale)`.
- Tags reuse the KV key format (`entry:article:<slug>`, `index:article:en`), plus `type:article` and `locale:en`. Slugs are lowercase ASCII (content-model), so every tag is printable ASCII, as `Cache-Tag` requires.
- `App.Locals` gains `cacheTags?: string[]` in `apps/welcome/src/app.d.ts`.
- **Why the edge-only header:** `s-maxage` would turn off `stale-while-revalidate` (verified), and the `Cloudflare-CDN-` header keeps the edge lifetime out of what browsers see.
- **Alternatives:** _headers in each route_ (four places to keep in step); _caching 404s briefly_ (an unpublished page would stay hidden after a publish until the 404 expired, unless every 404 also carried tags).

### D4. Tags and the purge port in cms-core; the purge in `Site`

- `packages/cms-core/src/cache-tags.ts` exports the four builders. `entryTag(type, slug)` returns the same string as `entryKey`, so a tag names exactly one KV entry.
- `packages/cms-core/src/ports.ts` gains `interface CachePurger { purge(tags: string[]): Promise<PurgeOutcome> }`, with `PurgeOutcome = { purged: true } | { purged: false; reason: string }`.
- `publishing.ts` widens `ProjectionLogger` with `warn` (the `Logger` from `@ycmcuenca/edge` already has it, `packages/edge/src/logging.ts:14`) and adds `purger: CachePurger` to `PublishingDependencies`. After `markProjected`, `project` calls `purger.purge([entryTag(type, slug), indexTag(type, "en")])`. A `{ purged: false }` result or a thrown error logs `warn("cache purge failed", { tags, reason })`, and the use case still returns `{ ok: true, live: true }` (spec, "A failed purge does not fail the publish").
- `Site.purge(tags)`:
  1. Reject any tag that is not 1 to 1,024 printable ASCII characters, returning `{ purged: false, reason: "invalid tag" }`.
  2. If `this.ctx.cache` is undefined (the type marks it optional; for example under local `wrangler dev`), return `{ purged: false, reason: "cache unavailable" }`.
  3. Otherwise `await this.ctx.cache.purge({ tags })`, and map `result.success` and `result.errors` to the outcome.
- **Why purge after `markProjected`:** a purge before KV is written would let a request refill the cache with the old snapshot.

### D5. `admin` calls `Site` through a service binding

- `apps/admin/wrangler.jsonc` gains `"services": [{ "binding": "WELCOME", "service": "welcome", "entrypoint": "Site" }]`.
- `apps/admin/src/lib/server/cache-purger.ts`: `cachePurgerFor(env.WELCOME)` calls `binding.purge(tags)` and converts a thrown error into `{ purged: false, reason }`. It describes the binding with a minimal local interface (`{ purge(tags: string[]): Promise<PurgeOutcome> }`) rather than importing `welcome`'s code, so neither app depends on the other's sources.
- `dependenciesFor` in the entry page adds the purger, so publish, roll back, unpublish and retry share it. `changeSlug` never projects (it only runs before the first publish), so it never purges.
- **Who can purge:** `purge` is an RPC method, and RPC is reachable only through a binding. `welcome` has no route that purges, so no HTTP request from a visitor can reach it (spec, "Only admin can purge").
- **Failure modes:** _`admin` is deployed before `welcome` has `Site`:_ the call throws, the purger turns it into a warning, and pages refresh within 60 seconds, or up to 360 when served stale (D6).

### D6. Release order

The pull request carries `feat(welcome)` and `feat(admin)` commits, so one release PR releases both, and the two deploy jobs run in parallel (deployment spec). Until `welcome`'s deploy finishes, an `admin` purge fails with a logged warning and staleness is bounded by the 60-second lifetime, plus up to 300 seconds served stale. Nothing breaks, so no forced order is needed. The owner's production check (task 5.2) runs after both deploys.

### D7. Tests

- **Unit (`welcome`):**
  - `isCacheable` for the production host, a preview host, `POST` and `HEAD`;
  - `cachePolicy` for a tagged 200, an untagged 200 and a 404;
  - `Site.purge` with an invalid tag, without `ctx.cache`, and with a fake `ctx.cache` that succeeds or fails.
- **Unit (cms-core):** the tag builders, and `publishing.ts` calling the purger with exactly the two tags, logging and still succeeding when it fails.
- **e2e:**
  - `apps/welcome/e2e/articles.spec.ts` asserts the cache headers on an article, the home page, the sitemap and the feed, and `no-store` on a 404. Locally nothing strips the headers, so their values are checked directly.
  - `apps/admin/e2e/cache-purge.spec.ts`, running in the two-worker setup from `public-rendering`, publishes and asserts the entry is live. `admin`'s output then has one `cache purge failed` warning that names both tags (`entry:article:<slug>` and `index:article:en`) and carries a non-empty reason. Locally the reason is one of two, depending on whether the binding resolves: `cache unavailable`, when `Site.purge` runs and finds `ctx.cache` undefined (task 1.2's first finding, seen again in task 4.2), or Wrangler's message when the local binding cannot reach a named entrypoint (`Worker does not export an entrypoint named "Site"`, task 1.2's second finding), which the purger turns into `{ purged: false, reason }` (D5). The test does not pin the reason text, which belongs to Wrangler. `Site.purge` and its `cache unavailable` reason are covered by the `welcome` unit tests, and the real purge by the production check. Task 1.2 also recorded that local `ctx.cache` exists as a key but is `undefined`.
- **Production (owner, task 5.2):** `Cf-Cache-Status` `MISS` then `HIT` on an article; publish an edit; the next request is `MISS` with the new title; another article stays `HIT`; no `Cache-Tag` or `Cloudflare-CDN-Cache-Control` header reaches the browser; a 404 is never `HIT`; a preview URL shows its own version while production still serves the cached page.
- **Pattern:** [testing the production artifact](../../../docs/SYSTEM_DESIGN.md#testing-the-production-artifact). Only production has a real edge cache, so the decisive check is the owner's.

## Risks / Trade-offs

- **The wrapper entry and the two Wrangler files are unproven here** → spiked first, with a stop (D1).
- **Cache hits and static assets now count toward 100,000 requests a day** → the monthly usage check; the Workers Paid trigger in the parking lot.
- **KV propagation can refill a purged page with old content** → the 60-second lifetime, plus up to 300 seconds served stale, bounds it (owner decision).
- [`ctx.cache` is `undefined` locally, and a local service binding cannot reach `Site`] → `Site.purge` handles the first, the purger turns the second into a logged warning, and the production check covers the real purge.

## Migration Plan

1. Merge. One release PR releases both apps, and both deploy jobs run.
2. The owner runs the production check (task 5.2).
3. Rollback: redeploy the previous `welcome` tag. Its `main` is SvelteKit's worker with no cache configuration, so caching stops at once. Redeploy the previous `admin` tag to stop purge calls (they are harmless either way).

## Assumptions

- **A1.** Workers Cache and `ctx.cache.purge` are available to Workers on the Free plan. The docs' pricing section describes billing for both plans, and the audit recorded the feature for `workers.dev`; the production check confirms it.
- **A2.** Requests reaching the `default` entrypoint through `ctx.exports.Site.fetch` count once more toward the request total ("worker-to-worker invocations", verified). At the site's traffic this stays far below 100,000 a day.
