// The status line and the status badge every admin page shares (design D6):
// the publishing status with the number of the revision a visitor sees when
// the entry is live.
import type { PublishingStatus } from "@ycmcuenca/cms-core";

/** The status line: what a visitor sees, in the owner's words (design D6). */
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

/** The badge each status wears, so the list and the entry page agree (D6). */
export function statusVariant(
  status: PublishingStatus,
): "default" | "secondary" | "outline" {
  switch (status) {
    case "live":
      return "default";
    case "published-not-live":
      return "secondary";
    case "not-published":
      return "outline";
  }
}
