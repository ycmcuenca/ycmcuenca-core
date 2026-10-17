/// <reference types="node" />
// Smoke-test configuration (design D6). The web server is `wrangler dev`
// against the app's built Workers output, so the test runs in workerd, the
// same runtime as production. A4: welcome serves e2e on 8787.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
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
    command: "bunx wrangler dev --port 8787",
    url: "http://127.0.0.1:8787",
    // Reuse an already-running dev server locally; always start fresh in CI.
    reuseExistingServer: !process.env.CI,
    // workerd's first boot can be slow; give it room before failing.
    timeout: 120_000,
    env: { WRANGLER_SEND_METRICS: "false" },
  },
});
