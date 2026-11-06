# Proposal

## Why

After `content-store`, revisions exist but nothing is public. Decisions C4, C5, C6 and C8 say how publishing works: Neon keeps a pointer to the published revision, and a projector writes a versioned snapshot to KV, which is the only thing `welcome` will read. This change builds that write side of the publish path, so `public-rendering` has snapshots to serve.

## What Changes

- **Publish, unpublish and roll back** (owner decision; all three are pointer moves on append-only revisions, C3):
  - **Publish** points the entry at a revision and projects it.
  - **Unpublish** clears the pointer and removes the entry's snapshot.
  - **Roll back** publishes an older revision of the same entry.
- **The projector (C4, C5, C9) in `@ycmcuenca/cms-core`.** It builds the entry snapshot from the published revision, rendering each Markdown block to safe HTML at publish time. It builds the type index from every published entry of that type, read from Neon, never from KV. It writes both through a snapshot-store port.
- **KV layout (C6).** One key per entry, `entry:article:<slug>`, and one index key, `index:article:en`. A publish costs two KV writes, and an unpublish costs one delete and one write, well within the Free plan's 1,000 writes a day.
- **Publish times.** `publishedAt` is set automatically, in UTC, on an entry's first publish and never changes afterwards, even after an unpublish and a re-publish. `updatedAt` is the time of the latest publish (owner decision).
- **Dirty state and manual retry** (owner decision, until W1's reconciler arrives in S4). The pointer move marks the entry dirty in the same database write, and a successful projection clears the mark. If the KV write fails, `admin` shows the entry as "published, not live" with a retry button that runs the same idempotent projection.
- **Slugs are fixed after the first publish.** Changing a published slug needs redirects, which are out of scope.
- **Ports and adapters (C1).** cms-core gains the ports `EntryStore`, `SnapshotStore` and `Clock`. `@ycmcuenca/db` implements `EntryStore`, and `admin` implements `SnapshotStore` on its new `SNAPSHOTS` KV binding.
- **A minimal entry page in `admin`.** It shows the status and the revision list, with publish, unpublish, roll back and retry buttons. `admin-editor` later styles it and adds the editing form.
- **An expand migration.** Nullable publish columns plus a `projection_state` column with a default. This is the first change to exercise content-store's expand-then-contract rule and the rollback check.

Out of scope:

- Rendering on `welcome` (`public-rendering`), and cache purging (`edge-cache`).
- Automatic retries and scheduled publishing (W1, S4).
- Draft preview (W2, S4); the editor's own preview is in `admin-editor`.
- Changing a published slug, redirects and deleting entries.
- Localized snapshots; S2 indexes only `en`.

## Capabilities

### New Capabilities

- `publishing`: how an entry's published revision is chosen, how publishing, unpublishing and rolling back reach the published snapshot store, what a snapshot and an index contain, how publish times are kept, and how a failed projection is shown and retried.

### Modified Capabilities

- `observability`: a new requirement that a failed projection writes one error log line naming the entry and the failed step.

## Impact

- **New files**: `packages/cms-core/src/ports.ts`, `projector.ts`, `publishing.ts` and their tests; `packages/db/src/publishing.ts` and its integration test; a new migration in `packages/db/migrations/`; `apps/admin/src/lib/server/snapshot-store.ts` and its test; `apps/admin/src/routes/entries/[id]/+page.server.ts` and `+page.svelte`; `apps/admin/e2e/publishing.spec.ts`.
- **Changed files**: `apps/admin/wrangler.jsonc` (the `SNAPSHOTS` KV binding) and its regenerated types, `apps/admin/package.json` (`@ycmcuenca/cms-core`), `packages/cms-core/src/index.ts`, `packages/db/src/index.ts`, `packages/db/src/entries.ts` (the slug rule), `turbo.jsonc` (`DATABASE_URL` for `test:e2e`), `README.md`.
- **External systems (owner task)**: one KV namespace, `snapshots`, created with Wrangler; its id is committed, as it is not a secret.
- **Releases**: `feat(admin)` releases `admin`. Its deploy runs the expand migration first.
- **Decisions**: builds on C3, C4, C5, C6, C8 and C9. C4's "the cron reconciler retries" is met in S2 by a manual retry, and W1 automates the same code path in S4. This is an interim step, not a contradiction. At archive, DECISIONS.md records the manual retry and that the index is rebuilt from Neon on every publish.
