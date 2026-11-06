// The public API of @ycmcuenca/cms-core (design D1): the field, block and type
// layers, the `article` type, how article input is validated, how Markdown
// becomes safe HTML, how stored content and published snapshots are versioned,
// how a type describes its own form, and the ports and use cases that publish
// a revision. Adapters depend on this package, never the other way round, and
// `eslint.config.js` enforces that boundary.
//
// Relative imports carry their `.ts` extension: the apps' Vite configs load
// this package through Node's ESM loader, which resolves nothing extensionless.
export { bodySchema, markdownBlock } from "./blocks.ts";
export type { BlockTypeName } from "./blocks.ts";
export { multilineField, slugField, textField } from "./fields.ts";
export type { FieldDefinition, FieldEditor, FieldOptions } from "./fields.ts";
export { formDescription } from "./form.ts";
export type { FieldDescription } from "./form.ts";
export type {
  Clock,
  EntryRecord,
  EntryStore,
  ProjectionState,
  PublishedEntry,
  RevisionRecord,
  SnapshotStore,
} from "./ports.ts";
export { buildEntrySnapshot, buildIndexSnapshot } from "./projector.ts";
export {
  changeSlug,
  publishRevision,
  retryProjection,
  rollBack,
  unpublish,
} from "./publishing.ts";
export type {
  ProjectionLogger,
  PublishingDependencies,
  PublishingResult,
} from "./publishing.ts";
export { renderMarkdown } from "./render-markdown.ts";
export { entryKey, indexKey } from "./snapshot-keys.ts";
export {
  entrySnapshot,
  indexSnapshot,
  readEntrySnapshot,
  readIndexSnapshot,
  snapshotVersion,
  UnsupportedSnapshotVersionError,
} from "./snapshot.ts";
export type { EntrySnapshot, IndexSnapshot } from "./snapshot.ts";
export {
  readStoredContent,
  schemaVersion,
  storedContent,
  UnsupportedSchemaVersionError,
} from "./stored-content.ts";
export type { StoredContent } from "./stored-content.ts";
export {
  article,
  articleSchema,
  bodyByteLimit,
  revisionContent,
  validateArticle,
} from "./types/article.ts";
export type {
  ArticleContent,
  ArticleErrors,
  ArticleValidation,
  ContentType,
} from "./types/article.ts";
