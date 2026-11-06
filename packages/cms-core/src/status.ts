// The one rule that decides an entry's publishing status (design D6). The entry
// page and the entry list both read it from here, so the two cannot disagree.
import type { ProjectionState } from "./ports.ts";

/** How an entry stands with visitors (design D6). */
export type PublishingStatus = "live" | "not-published" | "published-not-live";

/** The entry state the status depends on (design D6). */
export interface StatusEntry {
  /** The published revision, or nothing while the entry is unpublished. */
  readonly publishedRevisionId: string | null;
  readonly projectionState: ProjectionState;
}

/**
 * Reads an entry's publishing status (design D6). A dirty entry with no pointer
 * is a failed unpublish, so it stays "not-published" until Retry repairs it.
 */
export function publishingStatus(entry: StatusEntry): PublishingStatus {
  if (entry.publishedRevisionId === null) {
    return "not-published";
  }
  return entry.projectionState === "dirty" ? "published-not-live" : "live";
}
