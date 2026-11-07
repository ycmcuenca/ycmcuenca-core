# Tasks

## 1. Spikes

- [x] 1.1 **Spike (design D1):** in `apps/welcome`, add `wrangler.sveltekit.jsonc`, point the adapter at it in `vite.config.ts`, switch `wrangler.jsonc`'s `main` to a minimal `src/worker.ts` that re-exports SvelteKit's default handler, and add `enable_ctx_exports`. Verify that `bun run build`, `bunx wrangler deploy --dry-run --outdir .scratch/edge-cache/dry`, `bunx wrangler dev` (home page 200) and `bun run dev` (home page 200 with KV readable) all work. If any fails, **stop and ask the owner**, and revert
- [x] 1.2 **Spike (design D4, D7):** with the full `Site` class and the per-entrypoint `cache`/`exports` config in place, call `Site.purge(["x"])` from a temporary `admin` route over the `WELCOME` service binding, with both apps under `wrangler dev`. Record whether `this.ctx.cache` exists locally (design D7 depends on it), then remove the temporary route

## 2. Tags and the purge port in cms-core

- [x] 2.1 Add `packages/cms-core/src/cache-tags.ts` (`entryTag`, `indexTag`, `typeTag`, `localeTag`) and `CachePurger`/`PurgeOutcome` in `src/ports.ts`, exported from `src/index.ts`. Verify a unit test pins the four formats, and that `entryTag` equals `entryKey` for the same type and slug
- [x] 2.2 Add the purge step to `src/publishing.ts` after `markProjected`, per design D4: widen `ProjectionLogger` with `warn`, add `purger` to `PublishingDependencies`, and give the fakes in `src/publishing.test.ts` a purger. Verify `src/publishing.test.ts` shows: exactly `[entry tag, index tag]` purged after publish, rollback, unpublish and retry; no purge when the projection fails; and, for a failing purger or one that throws, a `cache purge failed` warning naming the tags with the result still `{ ok: true, live: true }`

## 3. `welcome`: entrypoint, routing and headers

- [x] 3.1 Complete `apps/welcome/src/worker.ts` (`Site` with `fetch` and `purge`, and the `default` handler with `isCacheable`) and `src/sveltekit-worker.d.ts` per design D1, D2 and D4, and finish the `cache`/`exports` config in `wrangler.jsonc` with comments citing the design. Run `bun run gen`. Verify `bun run check` passes, and unit tests cover `isCacheable` (production host GET and HEAD true; preview host, POST and DELETE false) and `Site.purge` (invalid tag, missing `ctx.cache`, fake success and failure)
- [x] 3.2 Add `src/lib/worker-config.test.ts` per design D1. Verify it passes, and fails when `wrangler.sveltekit.jsonc`'s `assets.directory` or `compatibility_date` differs from `wrangler.jsonc`'s (then revert)
- [x] 3.3 Implement `cachePolicy()` in `src/lib/server/cache.ts`, add it to `src/hooks.server.ts` after `securityHeaders()`, add `cacheTags` to `App.Locals` in `src/app.d.ts`, and set `locals.cacheTags` in the home, article, sitemap and feed handlers, per design D3. Verify unit tests for a tagged 200, an untagged 200 and a 404, and that `curl -sI` against `wrangler dev` shows the edge, browser and tag headers on an article and `Cache-Control: no-store` on `/en/articles/nope`
- [x] 3.4 Extend `apps/welcome/e2e/articles.spec.ts` with the header assertions from design D7. Verify `bun run test:e2e` passes in `apps/welcome`

## 4. `admin`: service binding and purger

- [x] 4.1 Add the `WELCOME` service binding to `apps/admin/wrangler.jsonc` per design D5 and run `bun run gen`. Implement `apps/admin/src/lib/server/cache-purger.ts`, and add the purger to `dependenciesFor` in `src/routes/entries/[id]/+page.server.ts`. Verify `bun run check` passes, and a unit test shows a thrown binding error becoming `{ purged: false, reason }`
- [ ] 4.2 Write `apps/admin/e2e/cache-purge.spec.ts` per design D7, using the two-worker setup in `apps/admin/playwright.config.ts`. Verify the publish succeeds and is live, and that the purge outcome logged matches what task 1.2 recorded

## 5. Documentation and production check

- [x] 5.1 Add a "Caching" paragraph to the README's "Public site" section: the wrapper entry and the two Wrangler files, the headers, the tags, purge after publish, the request-billing note for the monthly usage check, and how to roll back (design Migration Plan). Verify `scripts/docs/check-living-docs.sh` passes
- [ ] 5.2 **Owner task (Sprint 2's last exit criterion):** after both release deploys, verify in production with `curl -sI`:
  - an article returns `MISS`, then `HIT`;
  - after publishing an edit in `admin`, the next request returns `MISS` with the new title;
  - a second article stays `HIT`;
  - the home page is refreshed;
  - neither `Cache-Tag` nor `Cloudflare-CDN-Cache-Control` reaches the client;
  - a 404 is never `HIT`;
  - a `welcome` preview URL (signed in) serves its own version while production still serves the cached page;
  - Workers Logs show no `cache purge failed` warning for that publish.

  Record the observed `Cf-Cache-Status` sequence in the design's facts table. If a purge fails or `ctx.cache` is missing in production (assumption A1), **stop and ask the owner**

- [x] 5.3 Run the local CI equivalent from `AGENTS.md` plus `bun run test:integration`. Verify all pass, `bunx openspec validate edge-cache --strict` passes, and `ci-ok` is green on the pull request

## Workflow follow-up

- Archive per `openspec/config.yaml`: set the ROADMAP row to `archived` and mark Sprint 2's exit criteria met; record in DECISIONS.md the wrapper-entry pattern, the per-entrypoint purge scope, slug-based tags, the edge-only cache header and the request-billing fact; in ARCHITECTURE.md turn Workers Cache and the purge line solid; turn the notebook's "cache invalidation by tag" and "hexagonal architecture" entries into built ones and draft their lessons.
