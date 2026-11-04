// Fixtures shared by this package's integration tests. The tests need a real
// database, so they run as the migrator for setup (truncating) and as the
// runtime role for the repository calls (design D3).
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "./schema.ts";

/** The handle the tests pass to the repository functions. */
export type TestDatabase = NodePgDatabase<typeof schema>;

/** The database the integration tests run against, or a clear failure. */
export function testDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_TEST;
  if (url === undefined || url === "") {
    throw new Error("DATABASE_URL_TEST is not set; run `bun run db:prepare`.");
  }
  return url;
}

// One connection per test action, always closed, mirroring connectDatabase.
async function withClient<T>(work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: testDatabaseUrl() });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

/**
 * Runs `work` on a connection as the migrator: for setup (truncating) and for
 * checks that need more rights than the app has (design D3).
 */
export async function withMigratorClient<T>(
  work: (client: Client) => Promise<T>,
): Promise<T> {
  return withClient(work);
}

/** Empties both tables as the migrator, before each test. */
export async function truncateEntries(): Promise<void> {
  await withClient((client) =>
    client.query("TRUNCATE revisions, entries CASCADE"),
  );
}

/**
 * Runs `work` as `cms_runtime`, so the repository calls exercise exactly the
 * rights the running app has (not the migrator's).
 */
export async function asRuntimeRole<T>(
  work: (database: TestDatabase) => Promise<T>,
): Promise<T> {
  return withClient(async (client) => {
    await client.query("SET ROLE cms_runtime");
    return work(drizzle({ client, schema }));
  });
}

/**
 * The Postgres SQLSTATE of a thrown error, following Drizzle's `cause` chain
 * to the driver's error (as `isUniqueViolation` does in the repository).
 */
export function errorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (
    let depth = 0;
    depth < 5 && current !== null && typeof current === "object";
    depth += 1
  ) {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === "string") {
      return candidate.code;
    }
    current = candidate.cause;
  }
  return undefined;
}

/** A valid article input, with any field overridable. */
export function articleInput(
  overrides: Partial<{
    slug: string;
    title: string;
    summary: string;
    source: string;
  }> = {},
): {
  slug: string;
  title: string;
  summary: string;
  body: { type: "markdown"; source: string }[];
} {
  return {
    slug: overrides.slug ?? "hello-world",
    title: overrides.title ?? "Hello world",
    summary: overrides.summary ?? "A short summary.",
    body: [{ type: "markdown", source: overrides.source ?? "Hello there." }],
  };
}
