// The published read contract (design D7; decision C8): what the projector
// writes to KV and what `welcome` reads back. Both schemas are plain
// `z.object`, which strips fields the reader does not know, so a later
// version can add one while an older reader still works. The functions that
// build these snapshots belong to the projector in `revisions-publishing`.
import { z } from "zod";
import { declaredVersion, describeVersion } from "./versioning.ts";

/** The snapshot version this code writes (design D7). */
export const snapshotVersion = 1;

/** Every snapshot version this code can read, oldest first (design D7). */
const supportedVersions: readonly number[] = [snapshotVersion];

/** A rendered block: Markdown becomes `html` at publish (design D5, C9). */
const renderedBlock = z.object({
  type: z.literal("markdown"),
  html: z.string(),
});

/** One published entry, as a visitor's page reads it (design D7). */
export const entrySnapshot = z.object({
  snapshot_v: z.literal(snapshotVersion),
  type: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  blocks: z.array(renderedBlock),
  publishedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/** One entry as the list of its type shows it (design D7). */
const indexItem = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  publishedAt: z.iso.datetime(),
});

/** The list of one type's published entries (design D7). */
export const indexSnapshot = z.object({
  snapshot_v: z.literal(snapshotVersion),
  type: z.string(),
  locale: z.literal("en"),
  items: z.array(indexItem),
});

/** A published entry as it is stored and read back. */
export type EntrySnapshot = z.infer<typeof entrySnapshot>;

/** A type's published list as it is stored and read back. */
export type IndexSnapshot = z.infer<typeof indexSnapshot>;

/** Reading a snapshot failed because its version is not supported (D7). */
export class UnsupportedSnapshotVersionError extends Error {
  /** The version found, or `undefined` when the value carried none. */
  readonly version: unknown;

  constructor(version: unknown) {
    super(`Unsupported snapshot version: ${describeVersion(version)}.`);
    this.name = "UnsupportedSnapshotVersionError";
    this.version = version;
  }
}

/** Reads a published entry snapshot, whatever version wrote it (design D7). */
export function readEntrySnapshot(value: unknown): EntrySnapshot {
  requireSupportedVersion(value);
  return entrySnapshot.parse(value);
}

/** Reads the published list of a type (design D7). */
export function readIndexSnapshot(value: unknown): IndexSnapshot {
  requireSupportedVersion(value);
  return indexSnapshot.parse(value);
}

// The version is checked before anything is parsed, so a version this code
// does not support is refused whole rather than half-read (design D7).
function requireSupportedVersion(value: unknown): void {
  const version = declaredVersion(value, "snapshot_v");
  if (typeof version !== "number" || !supportedVersions.includes(version)) {
    throw new UnsupportedSnapshotVersionError(version);
  }
}
