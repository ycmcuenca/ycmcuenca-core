/// <reference types="node" />
// Smoke-test configuration (design D6, D7). Two servers: the Access key-set
// fixture the guard verifies against (design D7), then `wrangler dev` against
// the app's built Workers output, so the test runs in workerd, the same
// runtime as production, with its trust settings pointed at the fixture
// through `--var`. A4: admin serves e2e on 8788 with inspector port 9230
// (fixed so parallel e2e servers cannot race for one).
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Never let a focused test slip into CI.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://127.0.0.1:8788",
    trace: "on-first-retry",
  },
  // Chromium only (owner's choice for now).
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Serves /cdn-cgi/access/certs and writes the private key the smoke
      // test signs with (design D7).
      command: "bun e2e/access-fixture.ts",
      url: "http://127.0.0.1:8799/cdn-cgi/access/certs",
      // Reuse an already-running fixture locally; always start fresh in CI.
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // Fixed inspector port: wrangler dev otherwise probes upward from 9229,
      // so with both apps' e2e suites starting in parallel both servers would
      // pick 9229 and the second one would fail to bind.
      command:
        "bunx wrangler dev --port 8788 --inspector-port 9230" +
        " --var ACCESS_TEAM_DOMAIN:http://127.0.0.1:8799" +
        " --var ACCESS_AUD:e2e-audience",
      url: "http://127.0.0.1:8788",
      // Reuse an already-running dev server locally; always start fresh in CI.
      reuseExistingServer: !process.env.CI,
      // workerd's first boot can be slow; give it room before failing.
      timeout: 120_000,
      env: { WRANGLER_SEND_METRICS: "false" },
    },
  ],
});
