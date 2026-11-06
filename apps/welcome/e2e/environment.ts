// What the `welcome` e2e shares with its config (design D5): the local
// persistence directory the seeding setup and `wrangler dev` both use, and the
// committed origin the site claims in its canonical links, sitemap and feed
// (design D4).

/** The isolated local KV state the e2e seeds and serves. */
export const e2eStateDirectory = ".wrangler/e2e-state";

/** The production origin `SITE_ORIGIN` names in `wrangler.jsonc` (design D4). */
export const siteOrigin = "https://welcome.ycmcuenca.workers.dev";
