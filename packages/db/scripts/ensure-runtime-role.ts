// Creates the runtime role and gives it the login the app needs (design D3).
// It runs as the migrator, before the migrations, because the grant migration
// names the role, and it is idempotent: a second run changes nothing.
import { Client } from "pg";
import { isMain, requireEnvironment } from "./main.ts";
import { runtimeRole } from "./runtime-role.ts";

/**
 * Ensures `cms_runtime` exists (NOLOGIN, so it cannot log in until a password
 * is set), that the current user may assume it, and — when `password` is given
 * — that it can log in with that password. Production sets the password by
 * hand once; local runs and CI seed it from the environment.
 */
export async function ensureRuntimeRole(
  client: Client,
  password: string | undefined,
): Promise<void> {
  const existing = await client.query(
    "SELECT 1 FROM pg_roles WHERE rolname = $1",
    [runtimeRole],
  );
  if (existing.rowCount === 0) {
    await client.query(`CREATE ROLE ${runtimeRole} NOLOGIN`);
  }
  // Lets tests and the privilege check `SET ROLE cms_runtime`.
  await client.query(`GRANT ${runtimeRole} TO CURRENT_USER`);
  if (password !== undefined && password !== "") {
    // A utility statement cannot take a bind parameter, so build the safe
    // literal with `format`'s `%L` and run that (the password never reaches
    // the SQL text unescaped).
    const { rows } = await client.query<{ statement: string }>(
      `SELECT format('ALTER ROLE ${runtimeRole} LOGIN PASSWORD %L', $1::text) AS statement`,
      [password],
    );
    const statement = rows[0]?.statement;
    if (statement === undefined) {
      throw new Error("Could not build the runtime password statement.");
    }
    await client.query(statement);
  }
}

async function main(): Promise<void> {
  const connectionString = requireEnvironment("DATABASE_URL");
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await ensureRuntimeRole(client, process.env.RUNTIME_ROLE_PASSWORD);
    console.log(`Ensured the ${runtimeRole} role.`);
  } finally {
    await client.end();
  }
}

if (isMain(import.meta.url)) {
  await main();
}
