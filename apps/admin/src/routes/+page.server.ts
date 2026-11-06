// The home page lists every entry, newest save first (design D3, D5, D6): the
// count says how many there are, and each row carries the shared status. The
// count remains the smallest real use of the binding, which proves the
// Hyperdrive connection, the runtime role and the schema together.
import { publishingStatus } from "@ycmcuenca/cms-core";
import { countEntries, listEntrySummaries } from "@ycmcuenca/db";
import { withDatabase } from "#lib/server/database.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () =>
  withDatabase(async (database) => {
    const count = await countEntries(database);
    const entries = await listEntrySummaries(database);
    return {
      count,
      entries: entries.map((entry) => ({
        id: entry.id,
        slug: entry.slug,
        title: entry.title,
        lastSavedAt: entry.lastSavedAt.toISOString(),
        status: publishingStatus(entry),
      })),
    };
  });
