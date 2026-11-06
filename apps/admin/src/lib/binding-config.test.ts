import { describe, expect, it } from "vitest";
import { unstable_readConfig } from "wrangler";

// The committed Hyperdrive binding (design D5). `admin` reaches the database
// through it, so the binding must name a configuration and must never carry a
// connection string: that lives only in the Hyperdrive configuration, which
// holds `cms_runtime`'s password. Wrangler's own reader parses the file, so a
// file Wrangler would reject fails this test too.
const config = unstable_readConfig({
  config: new URL("../../wrangler.jsonc", import.meta.url).pathname,
});

/** The parts of a Hyperdrive binding this test asserts on. */
interface HyperdriveBinding {
  readonly binding: string;
  readonly id: string;
  readonly localConnectionString?: string;
}

const bindings = (config.hyperdrive ?? []) as HyperdriveBinding[];

describe("the committed Hyperdrive binding", () => {
  it("binds HYPERDRIVE to a real 32-character hex id", () => {
    const binding = bindings.find((entry) => entry.binding === "HYPERDRIVE");
    expect(binding).toBeDefined();
    expect(binding?.id).toMatch(/^[0-9a-f]{32}$/);
    // The all-zero placeholder passes the shape check but binds nothing in
    // production, so a release must never carry it.
    expect(binding?.id).not.toBe("0".repeat(32));
  });

  it("never commits a local connection string", () => {
    for (const binding of bindings) {
      expect(binding.localConnectionString).toBeUndefined();
    }
  });
});
