# Tasks

## 1. Ports, projector and use cases in cms-core

- [x] 1.1 Add `packages/cms-core/src/ports.ts` (`EntryStore`, `SnapshotStore`, `Clock`, and the `EntryRecord`, `RevisionRecord` and `PublishedEntry` types) per design D1, exported from `src/index.ts`. Verify `bunx turbo run check --filter=@ycmcuenca/cms-core` passes
- [x] 1.2 Implement `buildEntrySnapshot` and `buildIndexSnapshot` in `src/projector.ts` per design D3 (validate the output with the snapshot schemas; sort by first publish descending, then slug). Verify `src/projector.test.ts` shows rendered HTML in the blocks, ISO UTC times, stable ordering for equal times, and that an invalid built snapshot throws
- [x] 1.3 Add `src/snapshot-keys.ts` (`entryKey(type, slug)` returns `entry:<type>:<slug>`; `indexKey(type, locale)` returns `index:<type>:<locale>`), exported from `src/index.ts`. Verify a unit test pins both formats
- [x] 1.4 Implement `publishRevision`, `rollBack`, `unpublish`, `retryProjection` and `changeSlug` in `src/publishing.ts` per design D2 and D6, with in-memory fakes of the three ports in `src/publishing.test.ts`. Verify the tests cover every scenario of `specs/publishing/spec.md` that does not need a database (including a failing `putEntry` leaving the entry dirty with one `projection failed` log line that contains no content, retry clearing the mark, idempotent double retry, retry after a failed unpublish, and the first-publish time kept across unpublish and republish)

## 2. Database adapter and migration

- [x] 2.1 Add the four columns to `packages/db/src/schema.ts` per design D4 and generate the migration (`bun run --filter @ycmcuenca/db db:generate -- --name publishing`). Verify the SQL only adds nullable or defaulted columns plus the check constraint, and that `bun run db:prepare` applies it and the privilege check still passes
- [x] 2.2 Verify backward compatibility: check out the `admin` commit released by `content-store`, build it, and run its e2e against the database migrated by this branch. Verify the old smoke test still passes (spec "Schema changes are forward-only and backward-compatible" from content-store), then return to this branch
- [x] 2.3 Implement `entryStoreFor(db)` in `packages/db/src/publishing.ts` (the `EntryStore` port, with `markPublished` as one `UPDATE` setting the pointer, `coalesce`d first publish, last publish and `dirty`), and add `WHERE first_published_at IS NULL` to `updateSlug` in `src/entries.ts`. Verify `src/publishing.integration.test.ts` (running as `cms_runtime`) covers one `UPDATE` moving the pointer and the mark together, `listPublished` joining the published revision, and `updateSlug` refused after a publish; and that `bun run test:integration` passes

## 3. `admin`: KV adapter, entry page and actions

- [x] 3.1 **Owner task:** run `bunx wrangler kv namespace create snapshots` in `apps/admin`. Commit `"kv_namespaces": [{ "binding": "SNAPSHOTS", "id": "<id>" }]` in `apps/admin/wrangler.jsonc` (with a comment citing design D5), add `@ycmcuenca/cms-core: workspace:*` to `apps/admin/package.json`, and run `bun run gen`. Verify `worker-configuration.d.ts` types `SNAPSHOTS: KVNamespace`, and `bun run check` and `bun run build` pass
- [x] 3.2 Implement `snapshotStoreFor(kv)` in `apps/admin/src/lib/server/snapshot-store.ts` using `entryKey`/`indexKey`. Verify `src/lib/server/snapshot-store.test.ts` (with a `Map`-backed fake implementing the `get`/`put`/`delete` subset) shows the exact keys and JSON values written and deleted
- [x] 3.3 Add `apps/admin/src/routes/entries/[id]/+page.server.ts` (`load` plus the actions `publish`, `rollBack`, `unpublish` and `retry`) and `+page.svelte` per design D5, using `withDatabase`, `entryStoreFor`, `snapshotStoreFor`, a system clock and `createLogger("admin", request)`. Verify `bun run check` passes, and that under `bun run dev` with a seeded entry each button changes the status line as the spec describes

## 4. End-to-end verification

- [x] 4.1 Add `DATABASE_URL` to `test:e2e`'s `passThroughEnv` in `turbo.jsonc`. Verify `bunx turbo run test:e2e --dry=json` lists it for both apps' tasks
- [x] 4.2 Spike: under the admin e2e's `wrangler dev` (port 8788), write a key through a publish, then run `bunx wrangler kv key get --local --binding SNAPSHOTS <key>` in `apps/admin`. Verify the value is returned. If not, add the same `--persist-to .wrangler/e2e-state` to both commands and verify again (design D7)
- [x] 4.3 Write `apps/admin/e2e/publishing.spec.ts` per design D7 (seed, publish, read KV, roll back, unpublish). Verify it passes locally and in the `e2e` CI job, and fails if `projector.ts` is changed to write the wrong title (then revert)

## 5. Documentation and integration check

- [x] 5.1 Add a "Publishing" paragraph to the README's database section: the KV namespace, the two key formats, the dirty state and retry, and the slug rule. Verify `scripts/docs/check-living-docs.sh` passes
- [ ] 5.2 **Owner task:** after the release deploy of `admin`, verify the deploy log shows the publishing migration applied and the privilege check passed, `bunx wrangler kv namespace list` shows `snapshots`, and the signed-in home page still loads (assumption A2: the first real publish happens with `admin-editor`)
- [x] 5.3 Run the local CI equivalent from `AGENTS.md` plus `bun run test:integration`. Verify all pass, `bunx openspec validate revisions-publishing --strict` passes, and `ci-ok` is green on the pull request

## Workflow follow-up

- Archive per `openspec/config.yaml`: set the ROADMAP row to `archived`; record in DECISIONS.md the S2 manual retry (C4 until W1) and the index rebuilt from Neon; in ARCHITECTURE.md turn the KV snapshot element and the write path's steps 2 to 4 solid; turn the notebook's CQRS-lite and event-sourcing-lite entries into built ones and draft their lessons.
