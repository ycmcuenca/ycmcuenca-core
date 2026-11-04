// The home page shows how many entries are stored (design D11): the smallest
// real use of the binding, which proves the Hyperdrive connection, the runtime
// role and the schema together.
import { countEntries } from "@ycmcuenca/db";
import { withDatabase } from "#lib/server/database.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  const count = await withDatabase((database) => countEntries(database));
  return { count };
};
