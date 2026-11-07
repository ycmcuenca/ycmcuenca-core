// One published article (design D3): its snapshot's title, dates and rendered
// blocks. A malformed slug is refused before KV is read; a missing or
// unreadable snapshot is the same 404.
import { articleSchema } from "@ycmcuenca/cms-core";
import { readArticle } from "@ycmcuenca/cms-render";
import { createLogger } from "@ycmcuenca/edge";
import { error } from "@sveltejs/kit";
import { env } from "cloudflare:workers";
import { absoluteUrl } from "#lib/server/seo.js";
import type { PageSeo } from "#lib/server/seo.js";
import { articlePageTags } from "#lib/server/tags.js";
import type { PageServerLoad } from "./$types";

/** cms-core's own slug rule, so bad input never reaches KV (design D3). */
function isArticleSlug(value: string): boolean {
  return articleSchema.shape.slug.safeParse(value).success;
}

export const load: PageServerLoad = async ({ locals, params, request }) => {
  if (!isArticleSlug(params.slug)) {
    error(404, "No article has that slug.", { requestId: "" });
  }
  const snapshot = await readArticle(
    env.SNAPSHOTS,
    params.slug,
    createLogger("welcome", request),
  );
  if (snapshot === undefined) {
    error(404, "No article has that slug.", { requestId: "" });
  }
  const seo: PageSeo = {
    canonical: absoluteUrl(`/en/articles/${snapshot.slug}`),
    description: snapshot.summary,
  };
  // The page shows one entry, so a publish of it purges it (design D3).
  locals.cacheTags = articlePageTags(snapshot.slug);
  return { article: snapshot, seo };
};
