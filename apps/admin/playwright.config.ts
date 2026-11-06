/// <reference types="node" />
// Smoke-test configuration (design D6, D7). Three servers: the Access key-set
// fixture the guard verifies against (design D7), then `wrangler dev` for
// `welcome`, which reads the published snapshots (design D5 in
// openspec/changes/public-rendering/design.md), then `wrangler dev` for
// `admin`, against the app's built Workers output, so the tests run in
// workerd, the same runtime as production, with its trust settings pointed at
// the fixture through `--var`. A4: admin serves e2e on 8788 with inspector
// port 9230, and welcome on 8791 with inspector port 9231 (fixed so parallel
// e2e servers cannot race for one).
import { defineConfig, devices } from "@playwright/test";
import {
  stateDirectory,
  stateDirectoryFromWelcome,
  welcomeOrigin,
} from "./e2e/environment";

export default defineConfig({
  testDir: "./e2e",
  // Never let a focused test slip into CI.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Seeding, the browser flow and four Wrangler CLI reads fit well inside the
  // default, but CI's cold `bunx wrangler` starts deserve room.
  timeout: 60_000,
  // The database and the local KV are singletons shared by every spec: the
  // publishing test seeds and truncates the tables, and the smoke test
  // expects them empty (design D7). One worker keeps the two deterministic.
  workers: 1,
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
      // The reader of the publish path (design D5 in
      // openspec/changes/public-rendering/design.md): its built worker serves
      // the same local KV state `admin` writes, so the test can read a
      // published article on the site a visitor uses.
      command:
        "bunx wrangler dev --port 8791 --inspector-port 9231" +
        ` --persist-to ${stateDirectoryFromWelcome}`,
      cwd: "../welcome",
      url: welcomeOrigin,
      // Reuse an already-running dev server locally; always start fresh in CI.
      reuseExistingServer: !process.env.CI,
      // workerd's first boot can be slow; give it room before failing.
      timeout: 120_000,
      env: { WRANGLER_SEND_METRICS: "false" },
    },
    {
      // Fixed inspector port: wrangler dev otherwise probes upward from 9229,
      // so with both apps' e2e suites starting in parallel both servers would
      // pick 9229 and the second one would fail to bind. `--persist-to` is the
      // state the welcome server reads, so a publish reaches the site.
      command:
        "bunx wrangler dev --port 8788 --inspector-port 9230" +
        ` --persist-to ${stateDirectory}` +
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
