// The database the admin e2e shares (design D6, D7). Every spec seeds its own
// entries with @ycmcuenca/db, the functions the app and the integration tests
// use, and reads the tables back. The database is a singleton, so
// `playwright.config.ts` runs one worker at a time (design D7).
import { connectDatabase } from "@ycmcuenca/db";
import type { Database } from "@ycmcuenca/db";
import { sql } from "drizzle-orm";

/** Runs `work` against the database `turbo.jsonc` passes through (design D6). */
export async function withTestDatabase<T>(
  work: (database: Database) => Promise<T>,
): Promise<T> {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === "") {
    throw new Error(
      "DATABASE_URL is not set; turbo.jsonc passes it through to test:e2e.",
    );
  }
  return connectDatabase(url, work);
}

/** Empties the tables, so each spec starts from the same state (design D7). */
export async function truncateEntries(): Promise<void> {
  await withTestDatabase((database) =>
    database.execute(sql`TRUNCATE revisions, entries CASCADE`),
  );
}
