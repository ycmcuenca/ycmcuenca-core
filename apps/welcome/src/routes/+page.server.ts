// The home page (design D3): the published article list from the index
// snapshot, and the metadata the layout renders (design D4).
import { readArticleIndex } from "@ycmcuenca/cms-render";
import { createLogger } from "@ycmcuenca/edge";
import { env } from "cloudflare:workers";
import { siteIntroduction } from "#lib/app-meta.js";
import { absoluteUrl } from "#lib/server/seo.js";
import type { PageSeo } from "#lib/server/seo.js";
import { articleIndexTags } from "#lib/server/tags.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, request }) => {
  const index = await readArticleIndex(
    env.SNAPSHOTS,
    createLogger("welcome", request),
  );
  // The projector builds the index newest first publish first (design D3), so
  // the page keeps the order it reads.
  const articles = index?.items ?? [];
  const seo: PageSeo = {
    canonical: absoluteUrl("/"),
    description: siteIntroduction,
  };
  // The page lists the article index, so a publish purges it (design D3).
  locals.cacheTags = articleIndexTags();
  return { articles, seo };
};
