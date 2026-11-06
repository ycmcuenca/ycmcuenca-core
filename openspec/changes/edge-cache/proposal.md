# Proposal

## Why

After `admin-editor`, the publish path works end to end, but every `welcome` page view runs the worker and reads KV. C10 puts Workers Cache in front of `welcome`, with tag purges from `admin`, and Sprint 2's last exit criterion is "a publish purges exactly the affected cached pages". Exploration found that this needs more than headers:

- `ctx.cache.purge()` affects only the entrypoint that calls it.
- SvelteKit's generated worker passes no `ctx` to the app and exports only `default`.
- The adapter writes its output to whatever `main` names.

So caching needs a hand-written entry around SvelteKit, which the owner chose to isolate in its own change, last in the sprint.

## What Changes

- **A wrapper entry for `welcome`.** `welcome`'s Workers config points `main` at a small hand-written `src/worker.ts`. It exports:
  - a named entrypoint `Site` that serves SvelteKit's worker and owns the cache, with a `purge(tags)` RPC method;
  - a `default` handler with caching off, which sends `GET` and `HEAD` requests for the production host through `Site`, and everything else straight to SvelteKit. The Workers cache key is the entrypoint, path and query, not the host (verified), so this keeps Access-protected preview versions from filling the public cache.

  The adapter builds from a second Wrangler file that still names SvelteKit's output, through its `config` option.

- **Workers Cache on `Site`** (C10), switched on in configuration with the `enable_ctx_exports` compatibility flag that the loopback call needs.
- **Bounded freshness** (owner decision): article pages, the home page, the sitemap and the feed send:
  - `Cloudflare-CDN-Cache-Control: max-age=60, stale-while-revalidate=300` for the edge;
  - `Cache-Control: public, max-age=0` for browsers.

  A page refilled from a not-yet-updated KV region is therefore stale for about a minute at most. The edge-only header is used because `s-maxage` turns off `stale-while-revalidate` on Cloudflare, and Cloudflare strips it before the response reaches the visitor (both verified).

- **Everything else is explicitly `no-store`,** including 404s. Workers Cache stores responses that carry no `Cache-Control` (200 for 2 hours, 404 for 3 minutes), so leaving the header out would not opt out (verified).
- **Cache tags.** An article page carries `entry:article:<slug>`, `type:article` and `locale:en`. The home page, sitemap and feed carry `index:article:en`, `type:article` and `locale:en`. Slugs are fixed after the first publish (`revisions-publishing`), so a slug-based tag is stable, and it equals the KV key.
- **Purge after every projection.** After a successful publish, rollback, unpublish or retry, `admin` calls `Site.purge([entry tag, index tag])` through a service binding (`WELCOME`, entrypoint `Site`). A purge failure is logged as a warning and does not fail the publish, because the 60-second lifetime bounds the staleness.
- **A `CachePurger` port in cms-core,** with the shared tag builders, so `welcome` and `admin` agree on tag names.
- **Owner check in production.** `Cf-Cache-Status` is `HIT` on a repeated request, and after a publish the next request is a `MISS` with the new content, while unrelated articles stay `HIT`.

Out of scope:

- Caching `admin` (Access-protected, owner-only).
- Purging by path prefix or purging everything.
- Workers Paid, Cache Reserve and custom-domain zone caching.
- Static assets: Workers Static Assets already serves them without the worker.

## Capabilities

### New Capabilities

- `edge-caching`: which public responses are cached and for how long, how they are tagged, how a publish purges exactly the affected pages, what happens when a purge fails, and who can purge.

### Modified Capabilities

- `observability`: a new requirement that a failed purge writes one warning log line naming the tags.

## Impact

- **New files**: `apps/welcome/src/worker.ts`, `apps/welcome/src/sveltekit-worker.d.ts`, `apps/welcome/wrangler.sveltekit.jsonc`, `apps/welcome/src/lib/server/cache.ts`, `apps/welcome/src/lib/worker-config.test.ts`, `packages/cms-core/src/cache-tags.ts`, `apps/admin/src/lib/server/cache-purger.ts`, `apps/admin/e2e/cache-purge.spec.ts`.
- **Changed files**: `apps/welcome/wrangler.jsonc` (`main`, `cache`, `exports`, the compatibility flag) and its regenerated types, `apps/welcome/vite.config.ts` (the adapter's `config`), `apps/welcome`'s route loads and endpoints (cache headers and tags); `apps/admin/wrangler.jsonc` (the `WELCOME` service binding) and its regenerated types; `packages/cms-core/src/ports.ts` and `publishing.ts`; `README.md`.
- **Releases**: `feat(welcome)` and `feat(admin)`. `welcome` must be live with `Site` before `admin` calls it, and a purge against a missing entrypoint only logs a warning (design D6).
- **Cost**: with caching on, cached hits and static-asset requests count toward the Free plan's 100,000 requests a day (verified). The monthly usage check (ROADMAP, P3) watches this.
- **Decisions**: implements C10 and contradicts none. At archive, DECISIONS.md records the wrapper-entry pattern, the purge scope per entrypoint, the request-billing fact, slug-based tags, and the 60-second lifetime with stale-while-revalidate.
