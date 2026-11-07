// What the admin e2e shares with its config (design D5 in
// openspec/changes/public-rendering/design.md): the local KV state `admin`
// writes the published snapshots into, and the `welcome` worker that reads
// them. Two `wrangler dev` processes point at the same directory, so the
// publish-path test proves what a deploy would leave behind.

/** The isolated local KV state, relative to `apps/admin` (design D5). */
export const stateDirectory = ".wrangler/e2e-state";

/** The same directory as `welcome`'s server sees it, from `apps/welcome`. */
export const stateDirectoryFromWelcome = "../admin/.wrangler/e2e-state";

/** The port `welcome` serves the publish-path test on (design D5). */
export const welcomeOrigin = "http://127.0.0.1:8791";

/**
 * Where `admin`'s `wrangler dev` leaves its console output (design D7 in
 * openspec/changes/edge-cache/design.md). The config sends it through `tee`,
 * because Playwright only forwards a server's output and the cache-purge test
 * reads the worker's warning lines from this file. Relative to `apps/admin`.
 */
export const adminOutputLog = ".wrangler/e2e/admin-output.log";
