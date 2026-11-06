import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { unstable_readConfig } from "wrangler";

// `welcome` reads published snapshots and nothing else (C5, design D3), and
// the sitemap robots.txt advertises must live on the configured site origin
// (design D4). The unit-test step of the deploy gate runs this file before a
// deploy, so a stray database binding or a drifted origin stops the deploy.
//
// Wrangler 4.151.1 exports `unstable_readConfig`, so the test parses the file
// with Wrangler's own reader instead of a JSONC parser of our own; it fails
// when Wrangler itself would reject the file.
const welcome = unstable_readConfig({
  config: new URL("../../wrangler.jsonc", import.meta.url).pathname,
});
const admin = unstable_readConfig({
  config: new URL("../../../admin/wrangler.jsonc", import.meta.url).pathname,
});
const robots = readFileSync(
  new URL("../../static/robots.txt", import.meta.url),
  "utf8",
);

/** The absolute sitemap URL robots.txt advertises, or a failed test. */
function advertisedSitemap(): string {
  const line = lineStartingWith(robots, "Sitemap:");
  if (line === undefined) {
    throw new Error("robots.txt has no Sitemap: line.");
  }
  return line.slice("Sitemap:".length).trim();
}

function lineStartingWith(text: string, prefix: string): string | undefined {
  return text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith(prefix));
}

/** A KV binding as Wrangler reads it (Wrangler types the list loosely). */
interface KvBinding {
  readonly binding: string;
  readonly id?: string;
}

/** The config part `snapshotId` reads. */
interface KvConfig {
  readonly kv_namespaces?: readonly KvBinding[];
}

/** The id `config` binds `SNAPSHOTS` to, if it declares the binding. */
function snapshotId(config: KvConfig): string | undefined {
  return config.kv_namespaces?.find(
    (namespace) => namespace.binding === "SNAPSHOTS",
  )?.id;
}

describe("the committed welcome configuration", () => {
  it("binds no database", () => {
    const databaseBindings = [
      ...(welcome.hyperdrive ?? []),
      ...(welcome.d1_databases ?? []),
    ];
    expect(databaseBindings).toEqual([]);
  });

  it("reads the same snapshot namespace as admin", () => {
    expect(snapshotId(welcome)).toBeDefined();
    expect(snapshotId(welcome)).toBe(snapshotId(admin));
  });

  it("advertises the configured origin in robots.txt", () => {
    expect(advertisedSitemap()).toBe(
      `${String(welcome.vars.SITE_ORIGIN)}/sitemap.xml`,
    );
  });
});
