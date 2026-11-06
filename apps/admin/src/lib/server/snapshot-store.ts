// The SnapshotStore port on Workers KV (design D5; decision C4). KV holds a
// projection of the database of record: every value is written whole and
// never expires, because the same projection can always be rebuilt from Neon.
import { entryKey, indexKey } from "@ycmcuenca/cms-core";
import type {
  EntrySnapshot,
  IndexSnapshot,
  SnapshotStore,
} from "@ycmcuenca/cms-core";

/**
 * The part of `KVNamespace` the snapshot store needs (design D5). It is
 * declared here so the unit test can use a `Map` instead of KV.
 */
export interface SnapshotKeyValueStore {
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/** The published snapshot store backed by the `SNAPSHOTS` binding (D5). */
export function snapshotStoreFor(kv: SnapshotKeyValueStore): SnapshotStore {
  return {
    async putEntry(type, slug, snapshot: EntrySnapshot): Promise<void> {
      await kv.put(entryKey(type, slug), JSON.stringify(snapshot));
    },
    async deleteEntry(type, slug): Promise<void> {
      await kv.delete(entryKey(type, slug));
    },
    async putIndex(type, locale, index: IndexSnapshot): Promise<void> {
      await kv.put(indexKey(type, locale), JSON.stringify(index));
    },
  };
}
