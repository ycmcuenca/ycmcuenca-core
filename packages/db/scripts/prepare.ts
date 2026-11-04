// Prepares the local database for development and tests (design D6): create
// the integration-test database when it is absent, then apply migrations to
// both it and the development database. Run by the root `db:prepare` script.
import { Client } from "pg";
import { isMain, requireEnvironment } from "./main.ts";
import { applyMigrations } from "./migrate.ts";

async function main(): Promise<void> {
  const migratorUrl = requireEnvironment("DATABASE_URL");
  const testUrl = requireEnvironment("DATABASE_URL_TEST");
  await createDatabaseIfAbsent(migratorUrl, databaseName(testUrl));
  await migrateDatabase(migratorUrl);
  await migrateDatabase(testUrl);
}

async function createDatabaseIfAbsent(
  connectionString: string,
  name: string,
): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [name],
    );
    if (rowCount === 0) {
      // CREATE DATABASE cannot take a bind parameter for the name; quote it.
      await client.query(`CREATE DATABASE ${quoteIdentifier(name)}`);
      console.log(`Created the ${name} database.`);
    }
  } finally {
    await client.end();
  }
}

async function migrateDatabase(connectionString: string): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await applyMigrations(client);
  } finally {
    await client.end();
  }
}

function databaseName(url: string): string {
  const name = new URL(url).pathname.replace(/^\//, "");
  if (name === "") {
    throw new Error(`${url} names no database.`);
  }
  return name;
}

function quoteIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

if (isMain(import.meta.url)) {
  await main();
}
