// The runtime role's rights, enforced by the database (spec "The running app
// has least privilege", design D3). The tests run as `cms_runtime`, so a
// successful forbidden statement would be a real hole, not a mock's opinion.
import { sql } from "drizzle-orm";
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

  it("reports the expected rights, and exit-worthy drift when one changes", async () => {
    const reports: string[] = [];
    await withMigratorClient(async (client) => {
      expect(await checkPrivileges(client, (line) => reports.push(line))).toBe(
        true,
      );
    });
    expect(reports).toHaveLength(12);
    expect(reports.every((line) => line.startsWith("ok"))).toBe(true);

    await withMigratorClient((client) =>
      client.query("GRANT DELETE ON revisions TO cms_runtime"),
    );
    try {
      await withMigratorClient(async (client) => {
        const drifted: string[] = [];
        expect(
          await checkPrivileges(client, (line) => drifted.push(line)),
        ).toBe(false);
        expect(drifted).toContainEqual(
          expect.stringContaining("DRIFT  granted  DELETE on revisions"),
        );
      });
    } finally {
      await withMigratorClient((client) =>
        client.query("REVOKE DELETE ON revisions FROM cms_runtime"),
      );
    }
  });
});
