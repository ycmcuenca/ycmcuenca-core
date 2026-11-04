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

/** Applies every pending migration and verifies the runtime rights (D4). */
export async function applyMigrations(client: Client): Promise<void> {
  await ensureRuntimeRole(client, process.env.RUNTIME_ROLE_PASSWORD);
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
    await applyMigrations(client);
    console.log("Migrations applied and privileges checked.");
  } finally {
    await client.end();
  }
}

if (isMain(import.meta.url)) {
  await main();
}
