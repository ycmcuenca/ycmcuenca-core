# Tasks

## 1. Package `@ycmcuenca/ui`

Check: `bunx turbo run check lint --filter=@ycmcuenca/ui --filter=admin`

- [x] 1.1 Scaffold `packages/ui/` per design D1 (manifest with the `svelte`/`types` export and `./styles.css`, `svelte` 5.57.2 as a peer, `tsconfig.json` and `eslint.config.js` like `packages/cms-render`). Try `bunx shadcn-svelte@1.8.0 init` in `packages/ui`. If it refuses a non-SvelteKit package, run it plus `add button input textarea label badge alert card` in `.scratch/admin-editor/` (a fresh `bunx sv create`), copy the components into `packages/ui/src/components/ui/`, rewrite `$lib` imports to relative ones, and delete the scratch app. Pin every dependency the components import exactly (re-check `tailwind-variants` 3.3.1 against 4.0.1 and the other versions in the design's facts table, and update the table). Verify `bunx turbo run check lint --filter=@ycmcuenca/ui` passes and `bun install --frozen-lockfile` passes after the lockfile update
- [x] 1.2 Write `packages/ui/src/styles.css` (Tailwind import, `tw-animate-css`, `@source "./"`, the neutral light theme variables) and `src/index.ts` exporting the seven components and `cn`. Create `apps/admin/src/app.css` (imports `@ycmcuenca/ui/styles.css`, then the three `.align-left|center|right` rules copied from `apps/welcome/src/app.css:1-13`, with a comment naming that file, design D7), import `../app.css` in `apps/admin/src/routes/+layout.svelte`, and add `@ycmcuenca/ui` (workspace) and `@tailwindcss/vite` to `apps/admin/package.json` with the plugin before `sveltekit(...)` in `apps/admin/vite.config.ts`. Verify `bun run build` in `apps/admin` emits one CSS file under `.svelte-kit/cloudflare/_app/immutable/assets/` that contains the button's classes
- [x] 1.3 Render all seven components on a temporary `admin` route and load it in the admin smoke harness. Verify no `securitypolicyviolation` is collected and the button's computed background is not transparent (design D1, assumption A1). Replace any component that violates with plain markup and classes, record it in the design, then remove the temporary route
- [x] 1.4 Add a `ui-runtime` Renovate group (`tailwindcss`, `@tailwindcss/vite`, `tw-animate-css`, `bits-ui`, `tailwind-variants`, `tailwind-merge`, `clsx`; `semanticCommitType: "fix"`) to `renovate.json5`, next to the existing groups. Verify the Renovate config validator passes

## 2. Shared logic in `cms-core` and `db`

Check: `bunx turbo run check lint test test:integration --filter=@ycmcuenca/cms-core --filter=@ycmcuenca/db`

- [x] 2.1 Add `renderBody(body)` in `packages/cms-core/src/render-body.ts` (design D5), export it from `packages/cms-core/src/index.ts`, and make `buildEntrySnapshot` in `packages/cms-core/src/projector.ts` call it instead of mapping blocks inline. Verify `render-body.test.ts` (one block renders to `{ type: "markdown", html }`) and the existing `projector.test.ts` pass unchanged
- [x] 2.2 Add `publishingStatus(entry)` in `packages/cms-core/src/status.ts` (design D6: `"live"`, `"not-published"`, `"published-not-live"`; a dirty entry with no pointer is `"not-published"`) and export it from `index.ts`. Verify `status.test.ts` covers the four combinations of pointer and projection state
- [x] 2.3 Add `listEntrySummaries(database)` to `packages/db/src/entries.ts` (design D5: one query joining each entry to its latest revision, newest save first, title through `readStoredContent`) and export it and its record type from `packages/db/src/index.ts`. Verify `entries.integration.test.ts` covers an entry with three revisions (latest title and save time), an entry published and one unpublished (pointer and projection state), and the order of two entries

## 3. Generated form

Depends: 1
Check: `bunx turbo run check lint test --filter=admin`

- [x] 3.1 Implement `apps/admin/src/lib/server/entry-form.ts` (`FormData` to cms-core input, entry to form values, `DuplicateSlugError` to a slug field error with the store's message) per design D2 and D3. Verify `entry-form.test.ts` covers the one-block body, the ignored slug when locked, and the taken-slug message
- [x] 3.2 Implement `apps/admin/src/lib/components/EntryForm.svelte` per design D2. Verify a component test with `svelte/server`'s `render` shows the four labeled controls in order, `maxlength` on title, slug and summary, `aria-invalid` plus `aria-describedby` on a field with an error, and a read-only slug with the note when locked

## 4. Routes and actions

Depends: 1, 2, 3
Check: `bunx turbo run check lint test --filter=admin`

- [x] 4.1 Add `@ycmcuenca/cms-render` (workspace) to `apps/admin/package.json`, then add `apps/admin/src/routes/entries/new/+page.server.ts` and `+page.svelte` (actions `create` and `preview`, the preview through `renderBody` and `BlockList`) per design D3 and D5. Verify under `bun run dev` that a valid article redirects to its entry page, that a taken slug re-renders the form with the error and the entered values, and that Preview shows the rendered body without creating an entry
- [x] 4.2 Extend `apps/admin/src/routes/entries/[id]/+page.server.ts` with the form values, `slugLocked` (from `entry.firstPublishedAt`) and the actions `save` and `preview` (design D3: "No changes to save.", slug-only change through `changeSlug`, 409 on `ConcurrentRevisionError`), replace `statusOf` with `publishingStatus` keeping the page's existing status texts (design D6), and rebuild its `+page.svelte` on the `ui` components, with the publishing panel unchanged in behavior. Verify `publishing.spec.ts` and `publish-path.spec.ts` pass through `bunx turbo run test:e2e --filter=admin -- publishing publish-path`
- [x] 4.3 Rebuild `apps/admin/src/routes/+page.svelte` and its `+page.server.ts` as the entry list per the spec (keeping `Admin` and the "N entries" line; data from `listEntrySummaries` and `publishingStatus`). Verify `bunx turbo run test:e2e --filter=admin -- smoke` still finds `Admin` and "0 entries"

## 5. End-to-end tests

Depends: 4
Check: `bunx turbo run test:e2e --filter=admin -- editing`

- [x] 5.1 Write `apps/admin/e2e/editing.spec.ts` in the style of `publishing.spec.ts` (`withTestDatabase`, `truncateEntries`, signed Access header), covering every scenario of `specs/content-editing/spec.md`: create, slug taken, edit appends revision 3, save without changes, save races another save (two parallel requests, one 409 message, no server error), two errors kept at their fields, preview without a new revision, a `<script>` shown escaped in the preview, a previewed table keeping its alignment class, slug editable before publish, slug-only change adds no revision, new slug taken, slug read-only after publish, and the three statuses in the list (forcing "Published, not live" by setting `projection_state = 'dirty'` with SQL). Each test collects CSP violations and expects none (assumption A2 for the preview). Verify the suite passes locally

## 6. Documentation and local CI

Depends: 5
Check: `scripts/docs/check-living-docs.sh`

- [ ] 6.1 Add an "Editing content" paragraph to the README (the editor, the preview, the slug rule, the one-block form) and a short `packages/ui/README.md` (the CSP rule for components, how to add one). Verify `scripts/docs/check-living-docs.sh` passes
- [ ] 6.2 Run the local CI equivalent from `AGENTS.md` plus `bun run test:integration`. Verify all pass, `bunx openspec validate admin-editor --strict` passes, and `ci-ok` is green on the pull request

## 7. Owner production check (manual)

Phase: after-verify

- [ ] 7.1 **Owner task (the Sprint 2 exit criteria without caching):** after the release deploy of `admin`, create and publish a real English article in production `admin`. Verify it appears at `https://welcome.ycmcuenca.workers.dev/en/articles/<slug>`, on the home page, in the sitemap and in the feed
- [ ] 7.2 Edit that article in production `admin`. Verify the revision list grows and earlier revisions are unchanged
- [ ] 7.3 Publish an article with a body close to 32 KB, and record the publish request's `cpuTimeMs` from Workers Logs in the design's facts table (design D4). Verify the value is recorded, and if it is consistently above 10 ms, open a follow-up to lower the limit

## Workflow follow-up

- Archive per `openspec/config.yaml`: set the ROADMAP row to `archived`; record in DECISIONS.md the CSP rule for UI components and the measured 32 KB publish CPU time; in ARCHITECTURE.md turn `packages/ui` solid; in USER_JOURNEY.md mark the owner's write and publish steps as today; in DESIGN.md describe the neutral admin theme as the base S5 builds on.
