// Checks the runtime role's rights against the expected least-privilege set
// (design D3), using read-only `has_*_privilege` calls so the check itself
// needs no special rights. It prints one line per right and fails on any
// difference; the deploy runs it before uploading `admin` (deployment spec).
import { Client } from "pg";
import { isMain, requireEnvironment } from "./main.ts";
import { runtimeRole } from "./runtime-role.ts";

/** One right the runtime role must (or must not) hold. */
interface Right {
  readonly name: string;
  readonly expected: boolean;
  readonly granted: boolean;
}

/**
 * Reports every expected right and returns whether all of them match. Any
 * grant beyond the set — or a missing one — makes the result false. `log`
 * defaults to the console; tests pass a collector.
 */
export async function checkPrivileges(
  client: Client,
  log: (line: string) => void = console.log,
): Promise<boolean> {
  const { rows } = await client.query<Record<string, boolean>>(
    `SELECT
       has_schema_privilege($1, 'public', 'USAGE')  AS schema_usage,
       has_schema_privilege($1, 'public', 'CREATE') AS schema_create,
       has_table_privilege($1, 'public.entries', 'SELECT')   AS entries_select,
       has_table_privilege($1, 'public.entries', 'INSERT')   AS entries_insert,
       has_table_privilege($1, 'public.entries', 'UPDATE')   AS entries_update,
       has_table_privilege($1, 'public.entries', 'DELETE')   AS entries_delete,
       has_table_privilege($1, 'public.entries', 'TRUNCATE') AS entries_truncate,
       has_table_privilege($1, 'public.revisions', 'SELECT')   AS revisions_select,
       has_table_privilege($1, 'public.revisions', 'INSERT')   AS revisions_insert,
       has_table_privilege($1, 'public.revisions', 'UPDATE')   AS revisions_update,
       has_table_privilege($1, 'public.revisions', 'DELETE')   AS revisions_delete,
       has_table_privilege($1, 'public.revisions', 'TRUNCATE') AS revisions_truncate`,
    [runtimeRole],
  );
  const result = rows[0] ?? {};
  const rights: Right[] = [
    right("USAGE on schema public", true, result.schema_usage),
    right("CREATE on schema public", false, result.schema_create),
    right("SELECT on entries", true, result.entries_select),
    right("INSERT on entries", true, result.entries_insert),
    right("UPDATE on entries", true, result.entries_update),
    right("DELETE on entries", false, result.entries_delete),
    right("TRUNCATE on entries", false, result.entries_truncate),
    right("SELECT on revisions", true, result.revisions_select),
    right("INSERT on revisions", true, result.revisions_insert),
    right("UPDATE on revisions", false, result.revisions_update),
    right("DELETE on revisions", false, result.revisions_delete),
    right("TRUNCATE on revisions", false, result.revisions_truncate),
  ];

  let matches = true;
  for (const entry of rights) {
    const ok = entry.granted === entry.expected;
    matches &&= ok;
    log(
      `${ok ? "ok" : "DRIFT"}  ${entry.granted ? "granted" : "denied"}  ${entry.name} (expected ${entry.expected ? "granted" : "denied"})`,
    );
  }
  return matches;
}

function right(
  name: string,
  expected: boolean,
  granted: boolean | undefined,
): Right {
  return { name, expected, granted: granted === true };
}

async function main(): Promise<void> {
  const connectionString = requireEnvironment("DATABASE_URL");
  const client = new Client({ connectionString });
  await client.connect();
  try {
    if (!(await checkPrivileges(client))) {
      console.error("The runtime privileges differ from the expected set.");
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

if (isMain(import.meta.url)) {
  await main();
}
