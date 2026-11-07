// The two Wrangler files must agree on everything the build and the deploy
// share (design D1 in openspec/changes/edge-cache/design.md). The adapter reads
// `wrangler.sveltekit.jsonc` while the deploy file owns the entry and the cache
// configuration, so a drift between them would deploy a worker the adapter did
// not build for.
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { unstable_readConfig } from "wrangler";
import type { Unstable_Config } from "wrangler";

const deploy = unstable_readConfig({
  config: new URL("../../wrangler.jsonc", import.meta.url).pathname,
});
const adapter = unstable_readConfig({
  config: new URL("../../wrangler.sveltekit.jsonc", import.meta.url).pathname,
});

/** The static assets directory a config serves, if it declares one. */
function assetsDirectory(config: Unstable_Config): string | undefined {
  const assets = config.assets;
  return typeof assets === "object" ? assets?.directory : undefined;
}

/** The entrypoints whose cache is on; only `Site` may be one (design D4). */
function cachedEntrypoints(config: Unstable_Config): string[] {
  return Object.entries(config.exports ?? {})
    .filter(([, entry]) => entry.type === "worker" && entry.cache?.enabled)
    .map(([name]) => name);
}

describe("the two Wrangler files (design D1)", () => {
  it("name the same worker", () => {
    expect(adapter.name).toBe(deploy.name);
  });

  it("serve the same static assets directory", () => {
    expect(assetsDirectory(adapter)).toBe(assetsDirectory(deploy));
  });

  it("pin the same compatibility date", () => {
    expect(adapter.compatibility_date).toBe(deploy.compatibility_date);
  });

  it("point the deploy file at the hand-written entry", () => {
    expect(deploy.main).toBe(
      fileURLToPath(new URL("../../src/worker.ts", import.meta.url)),
    );
  });

  it("enable caching only on Site", () => {
    expect(cachedEntrypoints(deploy)).toEqual(["Site"]);
    expect(deploy.cache?.enabled).toBe(true);
  });
});
