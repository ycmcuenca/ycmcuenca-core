/// <reference types="node" />
// Smoke-test configuration (design D6). The web server is `wrangler dev`
// against the app's built Workers output, so the test runs in workerd, the
// same runtime as production. A4: welcome serves e2e on 8787 with inspector
// port 9229 (fixed so parallel e2e servers cannot race for it).
import { defineConfig, devices } from "@playwright/test";
import { e2eStateDirectory } from "./e2e/environment";

export default defineConfig({
  testDir: "./e2e",
  // The article tests read the snapshots this setup seeds into KV (design D5):
  // the global setup writes them into the same local state the server serves.
  globalSetup: "./e2e/global-setup.ts",
  // Never let a focused test slip into CI.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://127.0.0.1:8787",
    trace: "on-first-retry",
  },
  // Chromium only (owner's choice for now).
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Fixed inspector port: wrangler dev otherwise probes upward from 9229,
    // so with both apps' e2e suites starting in parallel both servers would
    // pick 9229 and the second one would fail to bind. `--persist-to` keeps
    // the seeded e2e state apart from a developer's local state.
    command:
      "bunx wrangler dev --port 8787 --inspector-port 9229" +
      ` --persist-to ${e2eStateDirectory}`,
    url: "http://127.0.0.1:8787",
    // Reuse an already-running dev server locally; always start fresh in CI.
    reuseExistingServer: !process.env.CI,
    // workerd's first boot can be slow; give it room before failing.
    timeout: 120_000,
    env: { WRANGLER_SEND_METRICS: "false" },
  },
});
