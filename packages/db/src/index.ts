// The public API of @ycmcuenca/db (design D1): how the app connects, and the
// repository functions for entries and their append-only revisions. Drizzle
// stays inside this package; callers see only these functions and types.
export { connectDatabase } from "./client.ts";
export type { Database } from "./client.ts";
export {
  appendRevision,
  ConcurrentRevisionError,
  countEntries,
  createEntry,
  DuplicateSlugError,
  findEntry,
  getRevision,
  listEntries,
  listRevisions,
  MissingEntryError,
  updateSlug,
} from "./entries.ts";
export type {
  AppendRevisionResult,
  CreateEntryResult,
  Entry,
  Revision,
  StoreFailure,
} from "./entries.ts";
export { entries, revisions } from "./schema.ts";
