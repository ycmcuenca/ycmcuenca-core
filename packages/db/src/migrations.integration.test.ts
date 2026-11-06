// The migration path against a real database (spec "Schema changes are
// forward-only and backward-compatible"): a fresh database gets exactly the
// pending migrations, a partly migrated one gets only the rest, and a second
// run changes nothing (design D4). Every expectation comes from the migration
// journal and folder, so a new migration needs no edit here.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../scripts/migrate.ts";
import { testDatabaseUrl, withMigratorClient } from "./test-helpers.ts";

const migrationsFolder = fileURLToPath(
  new URL("../migrations", import.meta.url),
);

/** One migration as the journal records it; `when` is its applied timestamp. */
interface JournalEntry {
  readonly idx: number;
  readonly when: number;
  readonly tag: string;
}

/** Drizzle's `meta/_journal.json`: the ordered list of migrations to apply. */
interface Journal {
  readonly version: string;
  readonly dialect: string;
  readonly entries: readonly JournalEntry[];
}

// A scratch database per case, so each case starts with an empty migration
// history and the prepared database is never part of the test's state.
let scratchName = "";
let scratchCount = 0;

function scratchUrl(): string {
  const url = new URL(testDatabaseUrl());
  url.pathname = `/${scratchName}`;
  return url.toString();
}

async function readJournal(): Promise<Journal> {
  return readJournalAt(join(migrationsFolder, "meta", "_journal.json"));
}

async function readJournalAt(path: string): Promise<Journal> {
  const journal = JSON.parse(await readFile(path, "utf8")) as Journal;
  return journal;
}

/**
 * The public tables the journal's migrations create, sorted. Reading the
 * `CREATE TABLE` statements keeps the expectation true when a later migration
 * adds a table.
 */
async function journalTables(): Promise<string[]> {
  const created = new Set<string>();
  for (const entry of (await readJournal()).entries) {
    const sql = await readFile(
      join(migrationsFolder, `${entry.tag}.sql`),
      "utf8",
    );
    for (const match of sql.matchAll(
      /CREATE TABLE (?:IF NOT EXISTS )?"([^"]+)"/g,
    )) {
      const table = match[1];
      if (table !== undefined) {
        created.add(table);
      }
    }
  }
  return [...created].sort();
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

/**
 * Migrates from `folder` instead of the real one. It stands in for a database
 * left at an older version, where only some journal entries had been applied.
 */
async function migrateScratchFrom(folder: string): Promise<void> {
  const client = new Client({ connectionString: scratchUrl() });
  await client.connect();
  try {
    await migrate(drizzle({ client }), { migrationsFolder: folder });
  } finally {
    await client.end();
  }
}

/**
 * A copy of the migrations folder holding only `entries`, the way the folder
 * looked before the later migrations were written.
 */
async function folderWithEntries(
  entries: readonly JournalEntry[],
): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "content-store-migrations-"));
  const journal = await readJournal();
  await mkdir(join(folder, "meta"));
  for (const entry of entries) {
    await copyFile(
      join(migrationsFolder, `${entry.tag}.sql`),
      join(folder, `${entry.tag}.sql`),
    );
  }
  await writeFile(
    join(folder, "meta", "_journal.json"),
    JSON.stringify(
      { version: journal.version, dialect: journal.dialect, entries },
      null,
      2,
    ),
  );
  return folder;
}

/** The journal `when` of each applied migration, oldest first. */
async function appliedMigrationTimes(): Promise<number[]> {
  const client = new Client({ connectionString: scratchUrl() });
  await client.connect();
  try {
    const { rows } = await client.query<{ created_at: string }>(
      "SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at",
    );
    return rows.map((row) => Number(row.created_at));
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

beforeEach(async () => {
  scratchCount += 1;
  scratchName = `content_store_migrations_${process.pid}_${scratchCount}`;
  await withMigratorClient((client) =>
    client.query(`CREATE DATABASE "${scratchName}"`),
  );
});

afterEach(async () => {
  await withMigratorClient((client) =>
    client.query(`DROP DATABASE "${scratchName}" WITH (FORCE)`),
  );
});

describe("migrations", () => {
  it("applies exactly the journal's migrations, in order", async () => {
    const journal = await readJournal();

    await migrateScratch();

    expect(await publicTables()).toEqual(await journalTables());
    // One row per journal entry, in the journal's order: no entry was skipped
    // and none was applied twice.
    const applied = await appliedMigrationTimes();
    expect(applied).toHaveLength(journal.entries.length);
    expect(applied).toEqual(journal.entries.map((entry) => entry.when));
  });

  it("applies only the migrations pending on a partly migrated database", async () => {
    const journal = await readJournal();
    const [firstEntry, ...pendingEntries] = journal.entries;
    if (firstEntry === undefined) {
      throw new Error("The migration journal has no entries.");
    }
    expect(pendingEntries.length).toBeGreaterThan(0);

    const olderFolder = await folderWithEntries([firstEntry]);
    try {
      await migrateScratchFrom(olderFolder);
    } finally {
      await rm(olderFolder, { recursive: true, force: true });
    }

    const partlyApplied = await appliedMigrationTimes();
    expect(partlyApplied).toEqual([firstEntry.when]);

    await migrateScratch();

    const applied = await appliedMigrationTimes();
    expect(applied.slice(partlyApplied.length)).toEqual(
      pendingEntries.map((entry) => entry.when),
    );
    expect(applied).toHaveLength(journal.entries.length);
  });

  it("changes nothing on a database that is already up to date", async () => {
    await migrateScratch();
    const applied = await appliedMigrationTimes();

    await migrateScratch();

    expect(await appliedMigrationTimes()).toEqual(applied);
  });
});
