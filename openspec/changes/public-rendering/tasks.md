# Tasks

## 1. Package `@ycmcuenca/cms-render`

- [x] 1.1 Scaffold `packages/cms-render/` per design D1 (manifest with the `svelte` and `types` export conditions, `svelte` 5.57.2 as a peer and a dev dependency, `@ycmcuenca/cms-core: workspace:*`, `svelte-check` 4.7.7, `tsconfig.json` from `packages/edge/tsconfig.json` with Svelte's types, and `eslint.config.js` extending `@ycmcuenca/eslint-config/svelte`), with a stub `src/MarkdownBlock.svelte`. Import the stub into a temporary `apps/welcome` page and run `bun run build`. Verify the build compiles the workspace component (design D1's failure mode); if it does not, **stop and ask the owner** before switching to `svelte-package`. Remove the temporary import
- [x] 1.2 Implement `src/MarkdownBlock.svelte`, `src/BlockList.svelte` and `src/registry.ts` (a `Record` keyed by block type) per design D1. Verify a unit test renders a `markdown` block's HTML in order with `svelte/server`'s `render`, and that `bunx turbo run check lint test --filter=@ycmcuenca/cms-render` passes
- [x] 1.3 Implement `readArticle` and `readArticleIndex` in `src/snapshot-reader.ts` per design D2, using `entryKey`/`indexKey` from cms-core. Verify `src/snapshot-reader.test.ts` covers a valid snapshot, a missing key (no log), a version 2 snapshot (one error log naming the key and version 2), a snapshot without a title, and a broken index

## 2. `welcome` reads KV

- [x] 2.1 Add to `apps/welcome/wrangler.jsonc` the `SNAPSHOTS` KV binding (the id from `apps/admin/wrangler.jsonc`) and `vars.SITE_ORIGIN`, with comments citing design D3 and D4. Add `@ycmcuenca/cms-core` and `@ycmcuenca/cms-render` (`workspace:*`) to `apps/welcome/package.json`, and run `bun run gen`. Verify `worker-configuration.d.ts` types `SNAPSHOTS` and `SITE_ORIGIN`, and `bun run check` passes
- [x] 2.2 Add a unit test `apps/welcome/src/lib/binding-config.test.ts` (Wrangler's `unstable_readConfig`): `welcome` declares no `hyperdrive` or other database binding, its `SNAPSHOTS` id equals `admin`'s, and `static/robots.txt`'s `Sitemap:` line equals `SITE_ORIGIN + "/sitemap.xml"`. Verify it fails when either id or the robots line is changed (then revert)
- [x] 2.3 Implement the home route (`src/routes/+page.server.ts`, `+page.svelte`, keeping `<h1>{appName}</h1>`) and the article route (`src/routes/en/articles/[slug]/+page.server.ts`, `+page.svelte`) per design D3. Verify `bun run check` and `bun run build` pass, and, under `bun run dev` with a snapshot put into local KV by hand, that both pages render and an unknown slug returns 404
- [x] 2.4 Implement `src/lib/server/seo.ts`, the `<svelte:head>` metadata in `src/routes/+layout.svelte` and each page's `seo` data per design D4, and add the `Sitemap:` line to `static/robots.txt`. Verify `curl -s` against the built worker under `wrangler dev` shows the canonical, both alternates, the description and the feed link on the home page and on an article page
- [x] 2.5 Implement `src/lib/server/xml.ts`, `src/routes/sitemap.xml/+server.ts` and `src/routes/en/feed.xml/+server.ts` per design D3, with unit tests for escaping and for zero and two items. Verify the tests pass and that `curl -s` of both endpoints under `wrangler dev` returns the right `Content-Type`, with output that `xmllint --noout` accepts

## 3. `welcome` end-to-end tests

- [ ] 3.1 Add the `globalSetup` that seeds local KV with `--persist-to .wrangler/e2e-state`, the same `--persist-to` on `apps/welcome/playwright.config.ts`'s `wrangler dev` command, and `apps/welcome/e2e/articles.spec.ts` per design D5. Keep the existing `smoke.spec.ts` passing. Verify `bun run test:e2e` in `apps/welcome` passes, with no CSP violation reported on the article page

## 4. Publish path across both apps

- [ ] 4.1 **Spike (design D5):** start `admin` (8788) and `welcome` (8791) under two `wrangler dev` processes sharing `--persist-to apps/admin/.wrangler/e2e-state`, publish a seeded entry in `admin`, and request the article on `welcome`. Verify `welcome` returns 200 with the title. If it returns 404 after 5 seconds, **stop and ask the owner** (D5's options)
- [ ] 4.2 Add `apps/admin/turbo.json` (`"extends": ["//"]`, `test:e2e` depending on `build` and `welcome#build`), the third `webServer` and the shared `--persist-to` in `apps/admin/playwright.config.ts`, and `apps/admin/e2e/publish-path.spec.ts` per design D5. Verify `bun run test:e2e` from the root passes both suites in parallel without a port clash, and that the test fails if `welcome`'s article route is made to always return 404 (then revert)

## 5. Documentation and integration check

- [ ] 5.1 Add a "Public site" paragraph to the README (routes, `SITE_ORIGIN`, how to seed local KV for `bun run dev`). Verify the documented seeding command works as written and `scripts/docs/check-living-docs.sh` passes
- [ ] 5.2 **Owner task:** after the release deploy of `welcome`, verify in production:
  - the home page shows `Welcome` and "No articles yet.";
  - `/en/articles/anything` returns 404;
  - `/sitemap.xml` and `/en/feed.xml` are valid and empty of articles;
  - the deploy smoke check passed;
  - Workers Logs show `welcome`'s `cpuTimeMs` for the home page within 10 ms (record it in the design's facts table).

  The first production publish happens in `admin-editor`, where content can be written (revisions-publishing assumption A2)

- [ ] 5.3 Run the local CI equivalent from `AGENTS.md` plus `bun run test:integration`. Verify all pass, `bunx openspec validate public-rendering --strict` passes, and `ci-ok` is green on the pull request

## Workflow follow-up

- Archive per `openspec/config.yaml`: set the ROADMAP row to `archived`; record `SITE_ORIGIN` in DECISIONS.md; in ARCHITECTURE.md turn the read path's steps 1, 3 and 4, `packages/cms-render` and `welcome`'s KV line solid; in USER_JOURNEY.md mark the step where visitors read articles; turn the notebook's "versioned contracts and tolerant readers" entry into a built one and draft its lessons.
