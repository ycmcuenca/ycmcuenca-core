import { describe, expect, it } from "vitest";
import { unstable_readConfig } from "wrangler";

// The deployed `admin` verifies every Access token against the team domain and
// audience committed in `wrangler.jsonc` (design D6). The unit-test step of the
// deploy gate runs this file before a deploy (design D2), so a trust setting
// that points anywhere but the real Access team stops the deploy.
//
// Wrangler 4.151.1 exports `unstable_readConfig`, so the test parses the file
// with Wrangler's own reader instead of a JSONC parser of our own; it fails
// when Wrangler itself would reject the file.
const config = unstable_readConfig({
  config: new URL("../../wrangler.jsonc", import.meta.url).pathname,
});

describe("the committed Access trust configuration", () => {
  it("points the team domain at a cloudflareaccess.com origin", () => {
    expect(config.vars.ACCESS_TEAM_DOMAIN).toMatch(
      /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/,
    );
  });

  it("keeps the audience empty, or a 64-character hex tag", () => {
    expect(config.vars.ACCESS_AUD).toMatch(/^(?:|[0-9a-f]{64})$/);
  });
});
