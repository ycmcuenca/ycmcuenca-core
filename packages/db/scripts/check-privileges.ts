// Checks the runtime role's rights against the expected least-privilege set
// (design D3). It reads the catalog instead of asking a fixed list of
// questions: every table, column, sequence, schema and database right the role
// — or PUBLIC — holds is compared with an allow-list, so a grant made by hand,
// including a column-level one, is named and fails the check. The deploy runs
// it before uploading `admin` (deployment spec).
import { Client } from "pg";
import { isMain, requireEnvironment } from "./main.ts";
import { runtimeRole } from "./runtime-role.ts";

/** One right the runtime role must (or must not) hold. */
interface Right {
  readonly name: string;
  readonly expected: boolean;
  readonly granted: boolean;
}

interface RelationRightRow {
  readonly schema_name: string;
  readonly relation_name: string;
  readonly relation_kind: string;
  readonly privilege: string;
  readonly grantable: boolean;
}

interface ColumnRightRow {
  readonly schema_name: string;
  readonly relation_name: string;
  readonly column_name: string;
  readonly privilege: string;
  readonly grantable: boolean;
}

interface SchemaRightRow {
  readonly schema_name: string;
  readonly privilege: string;
  readonly grantable: boolean;
}

interface DefaultAclRightRow {
  readonly schema_name: string | null;
  readonly object_type: string;
  readonly privilege: string;
  readonly grantable: boolean;
}

interface RoleAttributesRow {
  readonly rolsuper: boolean;
  readonly rolcreaterole: boolean;
  readonly rolcreatedb: boolean;
  readonly rolreplication: boolean;
  readonly rolbypassrls: boolean;
}

/** The role attributes that would let the app escape its least privilege. */
const roleAttributeNames: ReadonlyArray<
  readonly [keyof RoleAttributesRow, string]
> = [
  ["rolsuper", "SUPERUSER"],
  ["rolcreaterole", "CREATE ROLE"],
  ["rolcreatedb", "CREATE DATABASE"],
  ["rolreplication", "REPLICATION"],
  ["rolbypassrls", "BYPASS RLS"],
];

/** How `pg_default_acl` spells each kind of object it covers. */
const defaultAclObjectNames: Readonly<Record<string, string>> = {
  r: "tables",
  S: "sequences",
  f: "functions",
  T: "types",
  n: "schemas",
};

/**
 * The only rights the running app needs: `USAGE` on `public`, read and write
 * on entries (a slug move is an UPDATE), and read and append on revisions.
 */
function requiredRights(database: string): ReadonlySet<string> {
  return new Set([
    "USAGE on schema public",
    "SELECT on table public.entries",
    "INSERT on table public.entries",
    "UPDATE on table public.entries",
    "SELECT on table public.revisions",
    "INSERT on table public.revisions",
    `CONNECT on database ${database}`,
  ]);
}

/**
 * Rights that are allowed on top of the required ones. Postgres gives every
 * role `CONNECT` and `TEMPORARY` through PUBLIC; the app needs `CONNECT`, and
 * temporary tables live outside the persistent schema, so design D2 accepts
 * `TEMPORARY` rather than calling it drift.
 */
function allowedRights(
  database: string,
  required: ReadonlySet<string>,
): ReadonlySet<string> {
  return new Set([...required, `TEMPORARY on database ${database}`]);
}

/**
 * Reports every right the role holds within the allow-list, every required
 * right it lacks, and every granted right outside the allow-list; returns
 * whether all of them match. `log` defaults to the console; tests pass a
 * collector.
 */
export async function checkPrivileges(
  client: Client,
  log: (line: string) => void = console.log,
): Promise<boolean> {
  const database = await currentDatabase(client);
  const required = requiredRights(database);
  const allowed = allowedRights(database, required);
  const granted = await collectGrantedRights(client, database);

  const rights: Right[] = [...allowed]
    .filter((name) => granted.has(name))
    .map((name) => right(name, true, true));
  for (const name of required) {
    if (!granted.has(name)) {
      rights.push(right(name, true, false));
    }
  }
  for (const name of granted) {
    if (!allowed.has(name)) {
      rights.push(right(name, false, true));
    }
  }
  rights.sort((one, other) => one.name.localeCompare(other.name));

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

/**
 * Every right `cms_runtime` holds, directly or through PUBLIC, in non-system
 * objects. Table, column, sequence and schema rights come from `aclexplode`
 * over the catalog's ACL columns, so nothing has to be known in advance.
 */
async function collectGrantedRights(
  client: Client,
  database: string,
): Promise<Set<string>> {
  const names = [
    ...(await schemaRights(client)),
    ...(await relationRights(client)),
    ...(await columnRights(client)),
    ...(await databaseRights(client, database)),
    ...(await roleRights(client)),
    ...(await defaultAclRights(client)),
  ];
  return new Set(names);
}

async function currentDatabase(client: Client): Promise<string> {
  const { rows } = await client.query<{ name: string }>(
    "SELECT current_database() AS name",
  );
  const name = rows[0]?.name;
  if (name === undefined) {
    throw new Error("Could not read the current database name.");
  }
  return name;
}

async function schemaRights(client: Client): Promise<string[]> {
  const { rows } = await client.query<SchemaRightRow>(
    `SELECT n.nspname AS schema_name,
            a.privilege_type AS privilege,
            a.is_grantable AS grantable
       FROM pg_namespace n
       CROSS JOIN LATERAL aclexplode(
         coalesce(n.nspacl, acldefault('n', n.nspowner))
       ) a
       LEFT JOIN pg_roles granted_role ON granted_role.oid = a.grantee
      WHERE (a.grantee = 0 OR granted_role.rolname = $1)
        AND n.nspname <> 'information_schema'
        AND n.nspname NOT LIKE 'pg\\_%'`,
    [runtimeRole],
  );
  return rows.map((row) =>
    aclRight(`schema ${row.schema_name}`, row.privilege, row.grantable),
  );
}

async function relationRights(client: Client): Promise<string[]> {
  const { rows } = await client.query<RelationRightRow>(
    `SELECT n.nspname AS schema_name,
            c.relname AS relation_name,
            c.relkind AS relation_kind,
            a.privilege_type AS privilege,
            a.is_grantable AS grantable
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       CROSS JOIN LATERAL aclexplode(
         coalesce(
           c.relacl,
           CASE WHEN c.relkind = 'S'
                THEN acldefault('s', c.relowner)
                ELSE acldefault('r', c.relowner)
           END
         )
       ) a
       LEFT JOIN pg_roles granted_role ON granted_role.oid = a.grantee
      WHERE (a.grantee = 0 OR granted_role.rolname = $1)
        AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
        AND n.nspname <> 'information_schema'
        AND n.nspname NOT LIKE 'pg\\_%'`,
    [runtimeRole],
  );
  return rows.map((row) => {
    const kind = row.relation_kind === "S" ? "sequence" : "table";
    return aclRight(
      `${kind} ${row.schema_name}.${row.relation_name}`,
      row.privilege,
      row.grantable,
    );
  });
}

async function columnRights(client: Client): Promise<string[]> {
  const { rows } = await client.query<ColumnRightRow>(
    `SELECT n.nspname AS schema_name,
            c.relname AS relation_name,
            attribute.attname AS column_name,
            a.privilege_type AS privilege,
            a.is_grantable AS grantable
       FROM pg_attribute attribute
       JOIN pg_class c ON c.oid = attribute.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       CROSS JOIN LATERAL aclexplode(attribute.attacl) a
       LEFT JOIN pg_roles granted_role ON granted_role.oid = a.grantee
      WHERE (a.grantee = 0 OR granted_role.rolname = $1)
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
        AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
        AND n.nspname <> 'information_schema'
        AND n.nspname NOT LIKE 'pg\\_%'`,
    [runtimeRole],
  );
  return rows.map((row) =>
    aclRight(
      `column ${row.schema_name}.${row.relation_name}.${row.column_name}`,
      row.privilege,
      row.grantable,
    ),
  );
}

/**
 * `CREATE` is checked on every database, because it would let the role build
 * schema objects; `CONNECT` and `TEMPORARY` are read on the current one.
 */
async function databaseRights(
  client: Client,
  database: string,
): Promise<string[]> {
  const { rows } = await client.query<{
    connect: boolean;
    temporary: boolean;
  }>(
    `SELECT has_database_privilege($1, $2, 'CONNECT') AS connect,
            has_database_privilege($1, $2, 'TEMPORARY') AS temporary`,
    [runtimeRole, database],
  );
  const current = rows[0];
  if (current === undefined) {
    throw new Error(`Could not read the rights on ${database}.`);
  }
  const rights: string[] = [];
  if (current.connect) {
    rights.push(`CONNECT on database ${database}`);
  }
  if (current.temporary) {
    rights.push(`TEMPORARY on database ${database}`);
  }

  const createRights = await client.query<{ database_name: string }>(
    `SELECT datname AS database_name
       FROM pg_database
      WHERE NOT datistemplate
        AND has_database_privilege($1, oid, 'CREATE')`,
    [runtimeRole],
  );
  for (const row of createRights.rows) {
    rights.push(`CREATE on database ${row.database_name}`);
  }
  return rights;
}

async function roleRights(client: Client): Promise<string[]> {
  const attributes = await client.query<RoleAttributesRow>(
    `SELECT rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls
       FROM pg_roles
      WHERE rolname = $1`,
    [runtimeRole],
  );
  const row = attributes.rows[0];
  if (row === undefined) {
    throw new Error(`The ${runtimeRole} role does not exist.`);
  }
  const rights = roleAttributeNames
    .filter(([column]) => row[column])
    .map(([, name]) => `${name} on role ${runtimeRole}`);

  const memberships = await client.query<{ role_name: string }>(
    `SELECT granted.rolname AS role_name
       FROM pg_auth_members membership
       JOIN pg_roles granted ON granted.oid = membership.roleid
       JOIN pg_roles member ON member.oid = membership.member
      WHERE member.rolname = $1`,
    [runtimeRole],
  );
  for (const membership of memberships.rows) {
    rights.push(`membership in role ${membership.role_name}`);
  }
  return rights;
}

/**
 * Default privileges apply to objects created later, so a default grant is a
 * right the role holds even while no matching object exists yet.
 */
async function defaultAclRights(client: Client): Promise<string[]> {
  const { rows } = await client.query<DefaultAclRightRow>(
    `SELECT n.nspname AS schema_name,
            d.defaclobjtype AS object_type,
            a.privilege_type AS privilege,
            a.is_grantable AS grantable
       FROM pg_default_acl d
       LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
       CROSS JOIN LATERAL aclexplode(d.defaclacl) a
       LEFT JOIN pg_roles granted_role ON granted_role.oid = a.grantee
      WHERE (a.grantee = 0 OR granted_role.rolname = $1)
        AND (
          n.nspname IS NULL
          OR (n.nspname <> 'information_schema' AND n.nspname NOT LIKE 'pg\\_%')
        )`,
    [runtimeRole],
  );
  return rows.map((row) => {
    const objects = defaultAclObjectNames[row.object_type] ?? "objects";
    const place = row.schema_name ?? "any schema";
    const name = `${row.privilege} by default on ${objects} in ${place}`;
    return row.grantable ? `${name} WITH GRANT OPTION` : name;
  });
}

function aclRight(
  object: string,
  privilege: string,
  grantable: boolean,
): string {
  const grantOption = grantable ? " WITH GRANT OPTION" : "";
  return `${privilege}${grantOption} on ${object}`;
}

function right(name: string, expected: boolean, granted: boolean): Right {
  return { name, expected, granted };
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
