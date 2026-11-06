// The entry page and its four publishing actions (design D5): it shows the
// entry's status and revisions, and each action runs one cms-core use case
// against the database of record and the snapshot store.
import {
  publishRevision,
  retryProjection,
  rollBack,
  unpublish,
} from "@ycmcuenca/cms-core";
import type {
  EntryRecord,
  PublishingDependencies,
  PublishingResult,
} from "@ycmcuenca/cms-core";
import { entryStoreFor, listRevisions } from "@ycmcuenca/db";
import type { Database, Revision } from "@ycmcuenca/db";
import { createLogger } from "@ycmcuenca/edge";
import { error, fail } from "@sveltejs/kit";
import type { ActionFailure } from "@sveltejs/kit";
import { env } from "cloudflare:workers";
import { withDatabase } from "#lib/server/database.js";
import { snapshotStoreFor } from "#lib/server/snapshot-store.js";
import type { Actions, PageServerLoad } from "./$types";

/** The production time source (design D1). */
const systemClock = { now: (): Date => new Date() };

/** What an action reports back to the page; an empty message means success. */
interface ActionMessage {
  readonly message: string;
}

/** An action's result: the page's message, or a refused form submission. */
type ActionOutcome = ActionMessage | ActionFailure<ActionMessage>;

export const load: PageServerLoad = async ({ params }) =>
  withDatabase(async (database) => {
    const entry = await entryStoreFor(database).findEntry(params.id);
    if (entry === undefined) {
      error(404, "No entry has that id.", { requestId: "" });
    }
    const revisions = await listRevisions(database, entry.id);
    return {
      entry: { id: entry.id, type: entry.type, slug: entry.slug },
      revisions: revisions.map(describeRevision),
      publishedRevisionId: entry.publishedRevisionId,
      status: statusOf(entry, revisions),
      dirty: entry.projectionState === "dirty",
    };
  });

export const actions = {
  publish: async ({ params, request }) =>
    runRevisionAction(request, (dependencies, revisionId) =>
      publishRevision(dependencies, params.id, revisionId),
    ),
  rollBack: async ({ params, request }) =>
    runRevisionAction(request, (dependencies, revisionId) =>
      rollBack(dependencies, params.id, revisionId),
    ),
  unpublish: async ({ params, request }) =>
    run(request, (dependencies) => unpublish(dependencies, params.id)),
  retry: async ({ params, request }) =>
    run(request, (dependencies) => retryProjection(dependencies, params.id)),
} satisfies Actions;

// The publish and rollback forms name the revision they act on.
async function runRevisionAction(
  request: Request,
  work: (
    dependencies: PublishingDependencies,
    revisionId: string,
  ) => Promise<PublishingResult>,
): Promise<ActionOutcome> {
  const form = await request.formData();
  const revisionId = form.get("revisionId");
  if (typeof revisionId !== "string" || revisionId === "") {
    return fail(400, { message: "Choose a revision." });
  }
  return run(request, (dependencies) => work(dependencies, revisionId));
}

// Every action runs one use case with the database, the KV adapter, the
// system clock and the request's logger (design D2, D5, D6).
async function run(
  request: Request,
  work: (dependencies: PublishingDependencies) => Promise<PublishingResult>,
): Promise<ActionOutcome> {
  const result = await withDatabase((database) =>
    work(dependenciesFor(database, request)),
  );
  if (!result.ok) {
    return fail(400, { message: result.reason });
  }
  if (!result.live) {
    return {
      message:
        "The revision moved, but its snapshot could not be written. Press Retry.",
    };
  }
  return { message: "" };
}

function dependenciesFor(
  database: Database,
  request: Request,
): PublishingDependencies {
  return {
    entries: entryStoreFor(database),
    snapshots: snapshotStoreFor(env.SNAPSHOTS),
    clock: systemClock,
    log: createLogger("admin", request),
  };
}

function describeRevision(revision: Revision): {
  readonly id: string;
  readonly number: number;
  readonly createdAt: string;
  readonly title: string;
} {
  return {
    id: revision.id,
    number: revision.number,
    createdAt: revision.createdAt.toISOString(),
    title: revision.stored.content.title,
  };
}

// The status lines design D5 names. A dirty entry with no pointer is a failed
// unpublish, so it stays "Not published" and the retry button repairs it.
function statusOf(entry: EntryRecord, revisions: readonly Revision[]): string {
  if (entry.publishedRevisionId === null) {
    return "Not published";
  }
  if (entry.projectionState === "dirty") {
    return "Published, not live";
  }
  const published = revisions.find(
    (revision) => revision.id === entry.publishedRevisionId,
  );
  if (published === undefined) {
    throw new Error(`No revision has the id ${entry.publishedRevisionId}.`);
  }
  return `Live: revision ${published.number}`;
}
