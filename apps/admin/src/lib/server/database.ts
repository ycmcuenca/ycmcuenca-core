// The `admin` app's database access (design D5, D11). Hyperdrive recommends
// one client per request, which `connectDatabase` opens and always closes; the
// connection string comes from the binding, never from the app's files.
import { connectDatabase } from "@ycmcuenca/db";
import type { Database } from "@ycmcuenca/db";
import { env } from "cloudflare:workers";

/** Runs `work` against the database `admin` is bound to. */
export function withDatabase<T>(
  work: (database: Database) => Promise<T>,
): Promise<T> {
  return connectDatabase(env.HYPERDRIVE.connectionString, work);
}
