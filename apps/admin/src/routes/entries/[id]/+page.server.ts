// The entry page and its six actions (design D3, D5): the form saves the
// owner's edits and previews them, the publishing actions run one cms-core use
// case each against the database of record and the snapshot store.
import {
  article,
  changeSlug,
  formDescription,
  publishingStatus,
  publishRevision,
  renderBody,
  retryProjection,
  rollBack,
  unpublish,
  validateArticle,
} from "@ycmcuenca/cms-core";
import type {
  Block,
  PublishingDependencies,
  PublishingResult,
} from "@ycmcuenca/cms-core";
import {
  appendRevision,
  ConcurrentRevisionError,
  entryStoreFor,
  listRevisions,
} from "@ycmcuenca/db";
import type { Database, Revision } from "@ycmcuenca/db";
import { createLogger } from "@ycmcuenca/edge";
import { error, fail } from "@sveltejs/kit";
import type { ActionFailure } from "@sveltejs/kit";
import { env } from "cloudflare:workers";
import { withDatabase } from "#lib/server/database.js";
import {
  articleInputFrom,
  formValuesFrom,
  formValuesFromInput,
} from "#lib/server/entry-form.js";
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

// A URL parameter that names an entry or a revision is a UUID. Postgres treats
// any other string as a malformed uuid and throws, which would turn bad input
// into a 500, so the route checks the shape before it queries.
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return uuidPattern.test(value);
}

export const load: PageServerLoad = async ({ params }) => {
  if (!isUuid(params.id)) {
    error(404, "No entry has that id.", { requestId: "" });
  }
  return withDatabase(async (database) => {
    const entry = await entryStoreFor(database).findEntry(params.id);
    if (entry === undefined) {
      error(404, "No entry has that id.", { requestId: "" });
    }
    const revisions = await listRevisions(database, entry.id);
    const latest = revisions.at(-1);
    if (latest === undefined) {
      throw new Error(`Entry ${entry.id} has no revision.`);
    }
    return {
      entry: { id: entry.id, type: entry.type, slug: entry.slug },
      description: formDescription(article),
      values: formValuesFrom(entry.slug, latest.stored),
      slugLocked: entry.firstPublishedAt !== null,
      revisions: revisions.map(describeRevision),
      publishedRevisionId: entry.publishedRevisionId,
      publishedRevisionNumber: publishedRevisionNumber(entry, revisions),
      status: publishingStatus(entry),
      dirty: entry.projectionState === "dirty",
    };
  });
};

export const actions = {
  save: async ({ params, request }) => saveEntry(params.id, request),
  preview: async ({ params, request }) => previewEntry(params.id, request),
  publish: async ({ params, request }) =>
    runRevisionAction(params.id, request, (dependencies, revisionId) =>
      publishRevision(dependencies, params.id, revisionId),
    ),
  rollBack: async ({ params, request }) =>
    runRevisionAction(params.id, request, (dependencies, revisionId) =>
      rollBack(dependencies, params.id, revisionId),
    ),
  unpublish: async ({ params, request }) =>
    run(params.id, request, (dependencies) =>
      unpublish(dependencies, params.id),
    ),
  retry: async ({ params, request }) =>
    run(params.id, request, (dependencies) =>
      retryProjection(dependencies, params.id),
    ),
} satisfies Actions;

// Saves the form's content as a new revision and the slug when it moved
// (design D3). A slug-only change writes no revision, and identical content
// says so instead of adding revision N+1.
async function saveEntry(entryId: string, request: Request) {
  if (!isUuid(entryId)) {
    return fail(400, { message: "That entry id is not valid." });
  }
  const form = await request.formData();
  return withDatabase(async (database) => {
    const entry = await entryStoreFor(database).findEntry(entryId);
    if (entry === undefined) {
      return fail(400, { message: `No entry has the id ${entryId}.` });
    }
    const revisions = await listRevisions(database, entry.id);
    const latest = revisions.at(-1);
    if (latest === undefined) {
      throw new Error(`Entry ${entry.id} has no revision.`);
    }
    const source = {
      slug: entry.slug,
      slugLocked: entry.firstPublishedAt !== null,
    };
    const input = articleInputFrom(form, source);
    const values = formValuesFromInput(input);
    const validated = validateArticle(input);
    if (!validated.ok) {
      return fail(400, { errors: validated.errors, values });
    }
    const contentChanged = differsFrom(
      validated.content,
      latest.stored.content,
    );
    const slugChanged = !source.slugLocked && input.slug !== entry.slug;
    if (!contentChanged && !slugChanged) {
      return fail(400, { message: "No changes to save." });
    }
    if (slugChanged) {
      const changed = await changeSlug(
        dependenciesFor(database, request),
        entry.id,
        input.slug,
      );
      if (!changed.ok) {
        return fail(400, { errors: { slug: changed.reason }, values });
      }
    }
    if (contentChanged) {
      try {
        const appended = await appendRevision(database, entry.id, input);
        if (!appended.ok) {
          return fail(400, { errors: appended.errors, values });
        }
      } catch (thrown) {
        if (thrown instanceof ConcurrentRevisionError) {
          return fail(409, {
            message: "Another save came first. Reload and try again.",
          });
        }
        throw thrown;
      }
    }
    return { message: "" };
  });
}

// Renders the form's unsaved body the way a publish would, writing nothing
// (design D3, D5).
async function previewEntry(entryId: string, request: Request) {
  if (!isUuid(entryId)) {
    return fail(400, { message: "That entry id is not valid." });
  }
  const form = await request.formData();
  return withDatabase(async (database) => {
    const entry = await entryStoreFor(database).findEntry(entryId);
    if (entry === undefined) {
      return fail(400, { message: `No entry has the id ${entryId}.` });
    }
    const source = {
      slug: entry.slug,
      slugLocked: entry.firstPublishedAt !== null,
    };
    const input = articleInputFrom(form, source);
    const values = formValuesFromInput(input);
    const validated = validateArticle(input);
    if (!validated.ok) {
      return fail(400, { errors: validated.errors, values });
    }
    return { values, preview: renderBody(validated.content.body) };
  });
}

// The publish and rollback forms name the revision they act on.
async function runRevisionAction(
  entryId: string,
  request: Request,
  work: (
    dependencies: PublishingDependencies,
    revisionId: string,
  ) => Promise<PublishingResult>,
): Promise<ActionOutcome> {
  const form = await request.formData();
  const revisionId = form.get("revisionId");
  if (typeof revisionId !== "string" || !isUuid(revisionId)) {
    return fail(400, { message: "Choose a revision." });
  }
  return run(entryId, request, (dependencies) =>
    work(dependencies, revisionId),
  );
}

// Every publishing action runs one use case with the database, the KV adapter,
// the system clock and the request's logger (design D2, D5, D6).
async function run(
  entryId: string,
  request: Request,
  work: (dependencies: PublishingDependencies) => Promise<PublishingResult>,
): Promise<ActionOutcome> {
  if (!isUuid(entryId)) {
    return fail(400, { message: "That entry id is not valid." });
  }
  const result = await withDatabase((database) =>
    work(dependenciesFor(database, request)),
  );
  if (!result.ok) {
    return fail(400, { message: result.reason });
  }
  if (!result.live) {
    return {
      message:
        "The change is saved, but the snapshot store was not updated. Press Retry.",
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

// The published revision's number, which the "Live: revision N" status names.
function publishedRevisionNumber(
  entry: { readonly publishedRevisionId: string | null },
  revisions: readonly Revision[],
): number | null {
  if (entry.publishedRevisionId === null) {
    return null;
  }
  const published = revisions.find(
    (revision) => revision.id === entry.publishedRevisionId,
  );
  if (published === undefined) {
    throw new Error(`No revision has the id ${entry.publishedRevisionId}.`);
  }
  return published.number;
}

// Whether the submitted written content differs from the latest revision
// (design D3). The slug lives on the entry, never on a revision, so it is
// compared separately.
function differsFrom(written: WrittenContent, stored: WrittenContent): boolean {
  return (
    written.title !== stored.title ||
    written.summary !== stored.summary ||
    !sameBody(written.body, stored.body)
  );
}

// The written part of a revision, as both validation and storage return it.
interface WrittenContent {
  readonly title: string;
  readonly summary: string;
  readonly body: readonly Block[];
}

function sameBody(left: readonly Block[], right: readonly Block[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((block, index) => {
    const other = right[index];
    return (
      other !== undefined &&
      block.type === other.type &&
      block.source === other.source
    );
  });
}
