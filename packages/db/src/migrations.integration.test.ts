// The migration path against a real database (spec "Schema changes are
// forward-only and backward-compatible"): a fresh database gets exactly the
// pending migrations, and a second run changes nothing (design D4).
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "../scripts/migrate.ts";
import { testDatabaseUrl, withMigratorClient } from "./test-helpers.ts";

// A scratch database, so the migration history of the prepared one is not
// part of the test's state.
const scratchName = `content_store_migrations_${process.pid}`;

function scratchUrl(): string {
  const url = new URL(testDatabaseUrl());
  url.pathname = `/${scratchName}`;
  return url.toString();
}

async function migrateScratch(): Promise<void> {
  const client = new Client({ connectionString: scratchUrl() });
  await client.connect();
  try {
    await applyMigrations(client, {});
  } finally {
    await client.end();
  }
}

async function appliedMigrations(): Promise<number> {
  const client = new Client({ connectionString: scratchUrl() });
  await client.connect();
  try {
    const { rows } = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations",
    );
    return rows[0]?.count ?? 0;
  } finally {
    await client.end();
  }
}

async function publicTables(): Promise<string[]> {
  const client = new Client({ connectionString: scratchUrl() });
  await client.connect();
  try {
    const { rows } = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' ORDER BY table_name`,
    );
    return rows.map((row) => row.table_name);
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  await withMigratorClient((client) =>
    client.query(`CREATE DATABASE "${scratchName}"`),
  );
});

afterAll(async () => {
  await withMigratorClient((client) =>
    client.query(`DROP DATABASE "${scratchName}" WITH (FORCE)`),
  );
});

describe("migrations", () => {
  it("applies exactly the pending migrations, in order", async () => {
    await migrateScratch();
    expect(await publicTables()).toEqual(["entries", "revisions"]);
    expect(await appliedMigrations()).toBe(2);
  });

  it("changes nothing on a database that is already up to date", async () => {
    await migrateScratch();
    expect(await appliedMigrations()).toBe(2);
  });
});
