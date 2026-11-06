# Design

## Context

See proposal.md for the motivation, `specs/publishing/spec.md` for the behavior and the `observability` delta for logging.

Current state, expected after `content-model` and `content-store` (both proposed 2026-10-19 and built before this change):

- `@ycmcuenca/cms-core` exports `validateArticle`, `renderMarkdown`, `readStoredContent`, the `entrySnapshot`/`indexSnapshot` schemas and readers (`snapshot_v: 1`) and `formDescription`. It has no ports yet.
- `@ycmcuenca/db` has `entries` (id, type, slug, created_at) and append-only `revisions`, the repository functions (`createEntry`, `appendRevision`, `findEntry`, `listRevisions`, `getRevision`, `updateSlug`, …), `connectDatabase`, `migrate.ts` with the privilege check, and integration tests on `DATABASE_URL_TEST`. `cms_runtime` has `SELECT, INSERT, UPDATE` on `entries` and `SELECT, INSERT` on `revisions`.
- `admin` has the `HYPERDRIVE` binding, `withDatabase` in `src/lib/server/database.ts`, and a home page with the entry count. Its e2e runs against a prepared local Postgres.
- `@ycmcuenca/edge` exports `createLogger(app, request)` (`packages/edge/src/logging.ts:27`), which writes one JSON line with `level`, `msg`, `app`, `requestId` and the given fields.

### Versions and facts verified (2026-10-19)

| Item            | Fact                                                                                                                                                         | Source                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| KV Free limits  | 100,000 reads, 1,000 writes, 1,000 deletes and 1,000 list requests a day, 1 GB stored; limits reset at 00:00 UTC, and a further operation of that type fails | Context7 `/llmstxt/developers_cloudflare_workers_llms-full_txt` (KV pricing) |
| KV consistency  | eventually consistent: a write is visible at once in its own region and later elsewhere                                                                      | same source (Workers KV, build-a-jamstack-app tutorial)                      |
| KV local state  | `wrangler kv key get/put --local` (with `--persist-to` when a custom directory is used) reads and writes the local simulation                                | same source (local data)                                                     |
| KV per-key rate | 1 write per second per key                                                                                                                                   | DECISIONS.md facts table (2026-10-18)                                        |

## Goals / Non-Goals

**Goals:**

- Neon can always rebuild KV: the projection is a pure function of the database state at the moment it runs (C4).
- A failure leaves a visible, repairable state, never a silent inconsistency.
- The publishing rules live in cms-core and are tested with fakes; the adapters stay thin.

**Non-Goals:**

- Transactions spanning Neon and KV. That is impossible across the two systems, and the dirty mark replaces it.
- Optimistic concurrency between two editors. There is one owner (config context).

## Decisions

### D1. Ports in cms-core

`packages/cms-core/src/ports.ts`:

```ts
interface EntryStore {
  findEntry(entryId): Promise<EntryRecord | undefined>; // incl. slug, pointer, times, projection state
  getRevision(revisionId): Promise<RevisionRecord | undefined>;
  markPublished(entryId, revisionId, at: Date): Promise<void>; // pointer + times + dirty, one UPDATE
  markUnpublished(entryId): Promise<void>; // pointer null + dirty, one UPDATE
  markProjected(entryId): Promise<void>; // dirty -> clean
  listPublished(type): Promise<PublishedEntry[]>; // slug, title, summary, firstPublishedAt
}
interface SnapshotStore {
  putEntry(type, slug, snapshot: EntrySnapshot): Promise<void>;
  deleteEntry(type, slug): Promise<void>;
  putIndex(type, locale, index: IndexSnapshot): Promise<void>;
}
interface Clock {
  now(): Date;
}
```

- `@ycmcuenca/db` implements `EntryStore` in `src/publishing.ts` as `entryStoreFor(db)`. `admin` implements `SnapshotStore` in `src/lib/server/snapshot-store.ts` on `env.SNAPSHOTS`.
- **Pattern:** [hexagonal architecture (ports and adapters)](../../../docs/SYSTEM_DESIGN.md#hexagonal-architecture-ports-and-adapters). The ports appear now because this is the first change with two implementations of each: a fake in unit tests and the real adapter.
- **Alternatives:** _cms-core calling Drizzle and KV directly_ (breaks C1, and the rules could only be tested against real services); _one `Repository` port for everything_ (it would mix the source of truth with the projection, the two sides C4 keeps apart).

### D2. The publishing use cases

`packages/cms-core/src/publishing.ts` exports `publishRevision`, `rollBack`, `unpublish`, `retryProjection` and `changeSlug`, each taking `{ entries, snapshots, clock, log }` and returning a result `{ ok: true, live: boolean } | { ok: false, reason }`:

1. **Publish** (`publishRevision(entryId, revisionId)`):
   1. Load the entry and the revision, and refuse a revision whose `entryId` differs (spec).
   2. `markPublished(entryId, revisionId, clock.now())`. This single `UPDATE` moves the pointer, sets `first_published_at = coalesce(first_published_at, now)` and `last_published_at = now`, and sets `projection_state = 'dirty'`.
   3. `project(entryId)`.
2. **Roll back** is `publishRevision` with an older revision. It is its own function only so that `admin`'s button and the logs name it.
3. **Unpublish:** `markUnpublished`, then `project`.
4. **Project** (`retryProjection` calls the same function):
   1. Read the entry again from the store, which is the source of truth.
   2. If it has a pointer, build the entry snapshot (D3) and `putEntry`. If it has none, `deleteEntry`.
   3. Rebuild the index from `listPublished(type)` and `putIndex(type, "en", …)`.
   4. `markProjected`.

   A failure in step 2 or 3 logs one error line (D6), leaves the mark set and returns `{ ok: true, live: false }`. The pointer move succeeded; only the projection is pending.

5. **Change slug** (`changeSlug`): refuse when `firstPublishedAt` is set (spec, "Slug fixed after first publish"). `@ycmcuenca/db`'s `updateSlug` adds `WHERE first_published_at IS NULL` as a second guard.

- **Pattern:** [CQRS-lite read projections](../../../docs/SYSTEM_DESIGN.md#cqrs-lite-read-projections), with the "mark dirty first, clear after projecting" rule from C4 that S4's [reconciliation loop](../../../docs/SYSTEM_DESIGN.md#reconciliation-loops-and-at-most-once-claims) will automate.
- **Why mark dirty in the same write as the pointer:** if the worker dies between the pointer move and the KV write, the database still says "not projected". Marking dirty after a failure would lose exactly the case where the failure kills the code that writes the mark.
- **Why re-read the entry inside the projection:** a retry then projects the current published state, not the state at the time of the failed publish. That also makes it idempotent (spec).
- **Alternatives:** _write KV first, then the pointer_ (a crash in between leaves public content that the database says is unpublished; C4 makes Neon the truth); _an outbox table and a background worker_ (the S4 reconciler is that worker, and until then the owner presses retry, by owner decision).
- **Failure modes:** _the KV write limit (1,000 a day) is reached:_ the projection fails, the entry stays dirty, and a retry after 00:00 UTC succeeds. _Two publishes of one entry within a second:_ KV's one write per second per key may refuse the second, which leaves it dirty and retryable. _The worker is killed after `putEntry` but before `putIndex`:_ the mark stays, and a retry rewrites both.

### D3. Snapshot building (C8, C9)

- `packages/cms-core/src/projector.ts`: `buildEntrySnapshot(entry, revision)` reads the revision through `readStoredContent` and renders each block with `renderMarkdown`. It returns `{ snapshot_v: 1, type, slug, title, summary, blocks: [{ type: "markdown", html }], publishedAt, updatedAt }`, with the times as ISO 8601 UTC strings from the entry's `first_published_at` and `last_published_at`. `buildIndexSnapshot(type, published)` sorts by `firstPublishedAt` descending, and by slug when the times are equal, so the order is stable.
- Both results are parsed with `entrySnapshot`/`indexSnapshot` before writing, so a projector bug fails here, not in `welcome`.
- **The index is rebuilt from Neon, never read-modify-written in KV.** KV is eventually consistent, so reading the old index and patching it can lose a concurrent change. Rebuilding from the source of truth always converges.
- **Pattern:** [versioned contracts and tolerant readers](../../../docs/SYSTEM_DESIGN.md#versioned-contracts-and-tolerant-readers): the producer validates against the same schema the consumer reads.
- **Failure modes:** _a large index:_ each item is about 500 bytes, so even 1,000 articles stay far under KV's value size limit, and S2 has a handful.

### D4. The schema change (expand only)

- A new migration in `packages/db/migrations/`, generated from `src/schema.ts`. On `entries` it adds `published_revision_id uuid null references revisions(id)`, `first_published_at timestamptz null`, `last_published_at timestamptz null`, and `projection_state text not null default 'clean'` with a check constraint `in ('clean', 'dirty')`. No grant changes are needed, since `cms_runtime` already has `UPDATE` on `entries`.
- Every new column is nullable or has a default, so the `admin` released by `content-store` keeps working against it (content-store D4, "expand then contract").
- `listPublished(type)` joins `entries` to the published `revisions` row and reads title and summary through `readStoredContent`. An entry whose content cannot be read fails the whole projection, with the error logged, rather than silently dropping the entry from the index.

### D5. `admin`'s entry page and the KV adapter

- `apps/admin/wrangler.jsonc` gains `"kv_namespaces": [{ "binding": "SNAPSHOTS", "id": "<id>" }]`, created by the owner with `wrangler kv namespace create snapshots`.
- `src/lib/server/snapshot-store.ts`: keys `entry:<type>:<slug>` and `index:<type>:<locale>`, with values written by `JSON.stringify` and no expiration (C4: KV holds a projection, rebuilt from Neon). It exports the two key functions, so that `public-rendering` uses the same names through cms-core (task 1.3 moves them to `packages/cms-core/src/snapshot-keys.ts`, so the reader and the writer share them).
- `src/routes/entries/[id]/+page.server.ts`:
  - `load` returns the entry, its revisions (number, created time, title) and its status: "Not published", "Live: revision N" or "Published, not live". An entry with no published revision whose mark is set (a failed unpublish) stays "Not published" and shows Retry, because the old snapshot can remain public until the retry removes it. A separate "still live" status was rejected: it adds a state for a case the retry already repairs (owner decision, amendment 1).
  - Form actions `publish` (with `revisionId`), `rollBack` (with `revisionId`), `unpublish` and `retry` call the cms-core use cases through `withDatabase` and `snapshotStoreFor(env.SNAPSHOTS)`.
  - Each action returns `fail(400, { message })` on a refusal.
- `+page.svelte` is deliberately plain: a status line, an ordered revision list with one button per revision ("Publish" on the newest, "Roll back to this" on older ones when something is published), "Unpublish", and "Retry" only while the entry is dirty. `admin-editor` styles it.
- **Alternatives:** _JSON endpoints instead of form actions_ (I2 says form actions with Zod until an outside consumer exists); _a combined publish-and-save action_ (saving belongs to `admin-editor`).

### D6. Logging a failed projection

`publishing.ts` receives a `log` (the `Logger` from `createLogger("admin", request)`). On failure it writes `log.error("projection failed", { entryId, step, error: message })`, where `step` is `entry-snapshot`, `entry-removal` or `index`. It never logs the title, summary or body (observability delta).

### D7. The e2e test reads local KV

`apps/admin/e2e/publishing.spec.ts`:

1. Seed an entry with two revisions through `@ycmcuenca/db` and `DATABASE_URL`, after truncating the tables. `turbo.jsonc` passes `DATABASE_URL` through to `test:e2e`.
2. Open `/entries/<id>` with a signed token, press "Publish", and expect "Live: revision 2".
3. Run `bunx wrangler kv key get --local --binding SNAPSHOTS entry:article:<slug>` in `apps/admin` and parse the result with `readEntrySnapshot`.
4. Roll back and expect revision 1's title in KV.
5. Unpublish and expect the key to be gone and the index to be empty.

- **Pattern:** [testing the production artifact](../../../docs/SYSTEM_DESIGN.md#testing-the-production-artifact): the built worker under `wrangler dev`, with workerd's real KV simulation.
- **Failure modes:** _`wrangler kv … --local` reads a different persistence directory than `wrangler dev` uses:_ task 4.2 checks it first. If they differ, both get the same `--persist-to` path.

## Risks / Trade-offs

- **Until S4, a failed projection waits for the owner:** it is visible on the entry page and logged, and the owner is the one who just pressed Publish.
- **The index is rewritten on every publish:** one write each time, within the limits (D2).
- **Rollback deploy across the expand migration:** task 2.2 runs the previous `admin` build against the migrated local database.

## Migration Plan

1. Owner: create the KV namespace and commit its id (task 3.1).
2. Merge. The `admin` release deploy runs the expand migration, checks privileges and uploads.
3. Rollback: redeploy the previous `admin` tag. It ignores the new columns, and KV keeps whatever was projected.

## Assumptions

- **A1.** One KV namespace is shared by `admin` (writer) and, from `public-rendering` on, `welcome` (reader). Separate namespaces per environment are not needed, because there is one environment.
- **A2.** The owner's first real publish in production happens with `admin-editor`, when content can be written through the UI. This change's production check is limited to the deploy and the migration, and the C9 CPU measurement of a 32 KB publish moves to `admin-editor`.
