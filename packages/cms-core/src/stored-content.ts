// The stored shape of article content and the version that shapes it (design
// D4). Version 1 is English-only article content; Sprint 4 adds the first
// upcaster when localization moves fields to per-locale values.
import { z } from "zod";
import { revisionContent } from "./types/article.ts";
import { declaredVersion, describeVersion } from "./versioning.ts";

/** The schema version every stored article content carries (design D4). */
export const schemaVersion = 1;

/** Stored content: the version, and the content that version shapes (D4). */
export const storedContent = z.object({
  schema_v: z.literal(schemaVersion),
  content: revisionContent,
});

/** Stored content as the CMS persists it and reads it back. */
export type StoredContent = z.infer<typeof storedContent>;

/** Reading stored content failed because its version is not supported (D4). */
export class UnsupportedSchemaVersionError extends Error {
  /** The version found, or `undefined` when the value carried none. */
  readonly version: unknown;

  constructor(version: unknown) {
    super(`Unsupported schema version: ${describeVersion(version)}.`);
    this.name = "UnsupportedSchemaVersionError";
    this.version = version;
  }
}

/**
 * Reads stored content, whatever version wrote it (design D4). A version this
 * code does not support fails loudly and names it, so nothing renders
 * half-understood content.
 */
export function readStoredContent(value: unknown): StoredContent {
  const version = declaredVersion(value, "schema_v");
  if (version !== schemaVersion) {
    throw new UnsupportedSchemaVersionError(version);
  }
  return storedContent.parse(value);
}
