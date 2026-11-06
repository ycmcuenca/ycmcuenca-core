// Absolute URLs come from the one committed origin (design D4). A preview URL
// or a `wrangler dev` port never reaches a canonical link, so a preview can
// never claim to be the canonical page.
import { env } from "cloudflare:workers";

/** The page-level SEO values the layout renders (design D4). */
export interface PageSeo {
  /** The page's absolute URL on the committed origin. */
  readonly canonical: string;
  /** The page's meta description. */
  readonly description: string;
}

/** The absolute form of a site path such as `/en/feed.xml` (design D4). */
export function absoluteUrl(path: string): string {
  return new URL(path, env.SITE_ORIGIN).toString();
}
