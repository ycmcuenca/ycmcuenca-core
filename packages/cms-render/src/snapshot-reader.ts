// The KV adapter on the read side (design D2): it turns a published snapshot
// into the value a page renders, and it is tolerant of anything it cannot
// read. A missing or unreadable snapshot is "not published", never a crash.
import {
  entryKey,
  indexKey,
  readEntrySnapshot,
  readIndexSnapshot,
  UnsupportedSnapshotVersionError,
} from "@ycmcuenca/cms-core";
import type { EntrySnapshot, IndexSnapshot } from "@ycmcuenca/cms-core";

/** The one content type and locale this sprint publishes (design D3, D7). */
const articleType = "article";
const articleLocale = "en";

/** The part of the request logger the reader uses (design D2, D6). */
export interface SnapshotLogger {
  error(message: string, fields?: Record<string, unknown>): void;
}

/**
 * The part of `KVNamespace` the reader needs (design D2). It is declared
 * here, rather than imported from Cloudflare's types, so a unit test can use
 * a plain object. KV answers `null` for a missing key; `undefined` is
 * accepted too so a test fake may use the simpler value.
 */
export interface SnapshotKeyValueStore {
  get(key: string, type: "json"): Promise<unknown>;
}

/**
 * Reads one published article, or `undefined` when it is missing or its
 * snapshot cannot be read (design D2). The caller turns `undefined` into a
 * 404.
 */
export function readArticle(
  kv: SnapshotKeyValueStore,
  slug: string,
  log: SnapshotLogger,
): Promise<EntrySnapshot | undefined> {
  return readSnapshot(kv, entryKey(articleType, slug), readEntrySnapshot, log);
}

/**
 * Reads the published article list, or `undefined` when the index is missing
 * or cannot be read (design D2). The caller treats `undefined` as an empty
 * list.
 */
export function readArticleIndex(
  kv: SnapshotKeyValueStore,
  log: SnapshotLogger,
): Promise<IndexSnapshot | undefined> {
  return readSnapshot(
    kv,
    indexKey(articleType, articleLocale),
    readIndexSnapshot,
    log,
  );
}

/** A cms-core reader: it returns the typed snapshot or throws. */
type SnapshotReader<Snapshot> = (value: unknown) => Snapshot;

// One code path for both keys (design D2): a missing value is silence, an
// unreadable one is one error line, and anything else is a real failure that
// SvelteKit's `handleError` must see.
async function readSnapshot<Snapshot>(
  kv: SnapshotKeyValueStore,
  key: string,
  read: SnapshotReader<Snapshot>,
  log: SnapshotLogger,
): Promise<Snapshot | undefined> {
  let value: unknown;
  try {
    value = await kv.get(key, "json");
  } catch (error) {
    reportUnreadable(key, error, log, isNotJson);
    return undefined;
  }

  if (value === null || value === undefined) {
    return undefined;
  }

  try {
    return read(value);
  } catch (error) {
    reportUnreadable(key, error, log, isUnreadableSnapshot);
    return undefined;
  }
}

// A value the reader cannot use is one error line, whichever side failed to
// read it (design D2). Every other error is rethrown, so an outage still fails
// loudly through SvelteKit's `handleError`.
function reportUnreadable(
  key: string,
  error: unknown,
  log: SnapshotLogger,
  isUnreadable: (error: unknown) => boolean,
): void {
  if (!isUnreadable(error)) {
    throw error;
  }
  log.error("unreadable snapshot", { key, problem: describeProblem(error) });
}

// The two failures the parsed value may carry (design D2): a version this code
// does not support, and a value that fails the snapshot schema.
function isUnreadableSnapshot(error: unknown): boolean {
  return (
    error instanceof UnsupportedSnapshotVersionError || isValidationError(error)
  );
}

// `KVNamespace.get(key, "json")` parses the stored bytes itself and throws a
// `SyntaxError` when they are not JSON. That is one bad value, not the KV
// outage design D2 lets fail loudly, so it takes the unreadable path.
function isNotJson(error: unknown): boolean {
  return error instanceof SyntaxError;
}

/** A Zod error, as much of it as the log line needs. */
interface ValidationError extends Error {
  readonly issues: readonly ValidationIssue[];
}

/** One schema problem: where it is and what is wrong. */
interface ValidationIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

// `readEntrySnapshot` throws Zod's error through cms-core, which does not
// re-export the class. Its name and `issues` list are the stable shape, and
// matching them keeps zod out of this package's dependencies (design D1).
function isValidationError(error: unknown): error is ValidationError {
  if (!(error instanceof Error) || error.name !== "ZodError") {
    return false;
  }
  return Array.isArray((error as Partial<ValidationError>).issues);
}

// What the log's `problem` field says: the version error's own message, or
// the failing paths and messages of a schema error.
function describeProblem(error: unknown): string {
  if (error instanceof UnsupportedSnapshotVersionError) {
    return error.message;
  }
  if (isValidationError(error)) {
    return error.issues.map(describeIssue).join("; ");
  }
  return error instanceof Error ? error.message : String(error);
}

function describeIssue(issue: ValidationIssue): string {
  const path = issue.path.map((part) => String(part)).join(".");
  return path === "" ? issue.message : `${path}: ${issue.message}`;
}
