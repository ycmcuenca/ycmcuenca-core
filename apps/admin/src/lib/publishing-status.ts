// The entry page's status line (design D6): the shared publishing status, with
// the number of the revision a visitor sees when the entry is live.
import type { PublishingStatus } from "@ycmcuenca/cms-core";

export function statusLabel(
  status: PublishingStatus,
  publishedRevision: number | null,
): string {
  switch (status) {
    case "live":
      return `Live: revision ${publishedRevision}`;
    case "published-not-live":
      return "Published, not live";
    case "not-published":
      return "Not published";
  }
}
