// The sitemap (design D3): the home page and every published article, read
// from the index snapshot. An unreadable index lists only the home page, just
// as the home page then says "No articles yet.".
import { readArticleIndex } from "@ycmcuenca/cms-render";
import { createLogger } from "@ycmcuenca/edge";
import { env } from "cloudflare:workers";
import { absoluteUrl } from "#lib/server/seo.js";
import { sitemapXml } from "#lib/server/xml.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request }) => {
  const index = await readArticleIndex(
    env.SNAPSHOTS,
    createLogger("welcome", request),
  );
  const articles = (index?.items ?? []).map((item) => ({
    url: absoluteUrl(`/en/articles/${item.slug}`),
    lastModified: item.publishedAt,
  }));
  return new Response(sitemapXml(absoluteUrl("/"), articles), {
    headers: { "content-type": "application/xml" },
  });
};
