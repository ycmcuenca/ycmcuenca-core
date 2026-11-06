// The feed link every page advertises (design D4). Its absolute form depends
// on the configured origin, which only the server knows.
import { absoluteUrl } from "#lib/server/seo.js";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = () => ({
  feedUrl: absoluteUrl("/en/feed.xml"),
});
