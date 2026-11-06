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
import type { PageServerLoad } from "./$types";

/** cms-core's own slug rule, so bad input never reaches KV (design D3). */
function isArticleSlug(value: string): boolean {
  return articleSchema.shape.slug.safeParse(value).success;
}

export const load: PageServerLoad = async ({ params, request }) => {
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
  return { article: snapshot, seo };
};
