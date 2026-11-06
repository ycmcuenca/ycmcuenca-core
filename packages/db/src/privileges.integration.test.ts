// The runtime role's rights, enforced by the database (spec "The running app
// has least privilege", design D3). The tests run as `cms_runtime`, so a
// successful forbidden statement would be a real hole, not a mock's opinion.
import { sql } from "drizzle-orm";
import type { Client } from "pg";
import { beforeEach, describe, expect, it } from "vitest";
import { checkPrivileges } from "../scripts/check-privileges.ts";
import { createEntry } from "./index.ts";
import {
  articleInput,
  asRuntimeRole,
  errorCode,
  truncateEntries,
  withMigratorClient,
} from "./test-helpers.ts";

// SQLSTATE 42501: insufficient_privilege, the database refusing a statement.
const insufficientPrivilege = "42501";

beforeEach(truncateEntries);

describe("the runtime role's rights", () => {
  it("refuses to update or delete a revision", async () => {
    const created = await asRuntimeRole((db) =>
      createEntry(db, articleInput()),
    );
    expect(created.ok).toBe(true);

    const updateError = await asRuntimeRole((db) =>
      db.execute(sql`UPDATE revisions SET number = number`),
    ).catch((reason: unknown) => reason);
    expect(errorCode(updateError)).toBe(insufficientPrivilege);

    const deleteError = await asRuntimeRole((db) =>
      db.execute(sql`DELETE FROM revisions`),
    ).catch((reason: unknown) => reason);
    expect(errorCode(deleteError)).toBe(insufficientPrivilege);
  });

  it("refuses to create a table", async () => {
    const error = await asRuntimeRole((db) =>
      db.execute(sql`CREATE TABLE runtime_cannot (id integer)`),
    ).catch((reason: unknown) => reason);
    expect(errorCode(error)).toBe(insufficientPrivilege);
  });

  it("reports only the expected rights on a migrated database", async () => {
    const reports: string[] = [];
    await withMigratorClient(async (client) => {
      expect(await checkPrivileges(client, (line) => reports.push(line))).toBe(
        true,
      );
    });
    expect(reports.length).toBeGreaterThan(0);
    expect(reports.every((line) => line.startsWith("ok"))).toBe(true);
    expect(reports).toContainEqual(
      expect.stringContaining("SELECT on table public.entries"),
    );
  });

  it("reports an extra table right", async () => {
    const reports = await reportsAfterGrant((client) =>
      client.query("GRANT DELETE ON revisions TO cms_runtime"),
    );
    expect(reports).toContainEqual(
      expect.stringContaining(
        "DRIFT  granted  DELETE on table public.revisions",
      ),
    );
  });

  it("reports a column-level right", async () => {
    const reports = await reportsAfterGrant((client) =>
      client.query("GRANT UPDATE (content) ON revisions TO cms_runtime"),
    );
    expect(reports).toContainEqual(
      expect.stringContaining(
        "DRIFT  granted  UPDATE on column public.revisions.content",
      ),
    );
  });

  it("reports TRIGGER and REFERENCES on a table", async () => {
    const reports = await reportsAfterGrant((client) =>
      client.query("GRANT TRIGGER, REFERENCES ON revisions TO cms_runtime"),
    );
    expect(reports).toContainEqual(
      expect.stringContaining(
        "DRIFT  granted  TRIGGER on table public.revisions",
      ),
    );
    expect(reports).toContainEqual(
      expect.stringContaining(
        "DRIFT  granted  REFERENCES on table public.revisions",
      ),
    );
  });

  it("reports CREATE on a database", async () => {
    const reports = await reportsAfterGrant((client) =>
      client.query(
        `DO $$
         BEGIN
           EXECUTE format(
             'GRANT CREATE ON DATABASE %I TO cms_runtime',
             current_database()
           );
         END
         $$`,
      ),
    );
    expect(reports).toContainEqual(
      expect.stringContaining("DRIFT  granted  CREATE on database"),
    );
  });

  it("reports an extra table with every right", async () => {
    const reports = await reportsAfterGrant(async (client) => {
      await client.query("CREATE TABLE runtime_extra (id integer)");
      await client.query("GRANT ALL ON runtime_extra TO cms_runtime");
    });
    expect(reports).toContainEqual(
      expect.stringContaining(
        "DRIFT  granted  SELECT on table public.runtime_extra",
      ),
    );
    expect(reports).toContainEqual(
      expect.stringContaining(
        "DRIFT  granted  DELETE on table public.runtime_extra",
      ),
    );
  });
});

/**
 * Runs the privilege check after `grant` and rolls the grant back, so the
 * shared local role is unchanged even when an assertion fails. The check reads
 * the catalog on the same connection, so it sees the uncommitted grant.
 */
async function reportsAfterGrant(
  grant: (client: Client) => Promise<unknown>,
): Promise<string[]> {
  return withMigratorClient(async (client) => {
    await client.query("BEGIN");
    try {
      await grant(client);
      const reports: string[] = [];
      expect(await checkPrivileges(client, (line) => reports.push(line))).toBe(
        false,
      );
      return reports;
    } finally {
      await client.query("ROLLBACK");
    }
  });
}
