// The database handle the repository functions take, and the one helper that
// opens a connection the way Hyperdrive recommends (design D5): one client per
// call, always closed.
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "./schema.ts";

/** The application's handle on the database, typed with this package's schema. */
export type Database = NodePgDatabase<typeof schema>;

/**
 * Runs `work` against a fresh connection, always closing it (design D5). A
 * new client per call is what lets Hyperdrive pool connections; the app never
 * caches a client between requests.
 */
export async function connectDatabase<T>(
  connectionString: string,
  work: (database: Database) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await work(drizzle({ client, schema }));
  } finally {
    await client.end();
  }
}
