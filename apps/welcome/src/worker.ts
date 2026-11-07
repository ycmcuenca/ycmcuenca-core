// The Worker entry around SvelteKit's build (design D1, D2 and D4 in
// openspec/changes/edge-cache/design.md). `Site` is the entrypoint that owns
// the Workers Cache: it has the context a purge needs, which SvelteKit's
// default handler does not receive.
import { WorkerEntrypoint } from "cloudflare:workers";
import type { PurgeOutcome } from "@ycmcuenca/cms-core";
import sveltekit from "../.svelte-kit/cloudflare/_worker.js";
import { isCacheable, purgeTags } from "./lib/server/cache.js";

/**
 * The site's own entrypoint (design D1, D4). A request routed here runs
 * SvelteKit with the full context; `purge` is reachable only over a service
 * binding, so no public URL can remove a cached page (spec, "Only admin can
 * purge").
 */
export class Site extends WorkerEntrypoint<Env> {
  fetch(request: Request): Promise<Response> {
    return sveltekit.fetch(request, this.env, this.ctx);
  }

  purge(tags: string[]): Promise<PurgeOutcome> {
    return purgeTags(this.ctx.cache, tags);
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return isCacheable(request, env)
      ? ctx.exports.Site.fetch(request)
      : sveltekit.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
