// The one migration entry point (design D4), used locally, in CI and by the
// deploy before `wrangler deploy`. It runs as the migrator (DATABASE_URL):
// ensure the runtime role, apply the pending migrations, then check the
// runtime privileges, so drift stops a deploy before anything is uploaded.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { checkPrivileges } from "./check-privileges.ts";
import { ensureRuntimeRole } from "./ensure-runtime-role.ts";
import { isMain, requireEnvironment } from "./main.ts";

const migrationsFolder = fileURLToPath(
  new URL("../migrations", import.meta.url),
);

/** What the caller may seed besides the schema. */
export interface MigrationOptions {
  /** The runtime login password to set; production passes none (D3). */
  runtimePassword?: string;
}

/**
 * Applies every pending migration and verifies the runtime rights (D4). The
 * runtime password arrives as an argument, never from the environment, so the
 * production entry point cannot seed it from a developer's `.env` (D3).
 */
export async function applyMigrations(
  client: Client,
  { runtimePassword }: MigrationOptions,
): Promise<void> {
  await ensureRuntimeRole(client, runtimePassword);
  await migrate(drizzle({ client }), { migrationsFolder });
  if (!(await checkPrivileges(client))) {
    throw new Error("The runtime privileges differ from the expected set.");
  }
}

async function main(): Promise<void> {
  const connectionString = requireEnvironment("DATABASE_URL");
  const client = new Client({ connectionString });
  await client.connect();
  try {
    // No runtime password: production sets it by hand once (D3).
    await applyMigrations(client, {});
    console.log("Migrations applied and privileges checked.");
  } finally {
    await client.end();
  }
}

if (isMain(import.meta.url)) {
  await main();
}
