// The one place that knows how an entry form meets the content model (design
// D2, D3): the body is a single Markdown block, a published entry's slug is
// the entry's own, and form values come back out of a stored revision.
import type { ArticleErrors, Block, StoredContent } from "@ycmcuenca/cms-core";
import type { DuplicateSlugError } from "@ycmcuenca/db";

/** The values the form shows: one entry per field, plus the body's Markdown. */
export interface EntryFormValues {
  readonly title: string;
  readonly slug: string;
  readonly summary: string;
  readonly body: string;
}

/** What a posted form becomes: the input `validateArticle` reads (design D3). */
export interface ArticleInput {
  readonly title: string;
  readonly slug: string;
  readonly summary: string;
  readonly body: readonly Block[];
}

/** The slug a form may not change, from the entry it edits (design D2). */
export interface SlugSource {
  /** The entry's current slug. */
  readonly slug: string;
  /** Whether the entry is published, which freezes its slug. */
  readonly slugLocked: boolean;
}

/**
 * Turns a posted form into article input (design D2). A published entry's slug
 * cannot change, so a posted slug is ignored in favour of the entry's own.
 */
export function articleInputFrom(
  form: FormData,
  source: SlugSource,
): ArticleInput {
  return {
    title: postedValue(form, "title"),
    slug: source.slugLocked ? source.slug : postedValue(form, "slug"),
    summary: postedValue(form, "summary"),
    body: [{ type: "markdown", source: postedValue(form, "body") }],
  };
}

/**
 * The values the edit form starts with, read from an entry's latest revision
 * (design D3). The form edits one Markdown block, so a body of several blocks
 * is joined back into the one source the form shows.
 */
export function formValuesFrom(
  slug: string,
  stored: StoredContent,
): EntryFormValues {
  return {
    title: stored.content.title,
    slug,
    summary: stored.content.summary,
    body: stored.content.body.map((block) => block.source).join("\n\n"),
  };
}

/**
 * A taken slug, shown at the slug field in the store's own words (design D2).
 * Creating and saving share this, so both pages say the same thing.
 */
export function takenSlugErrors(error: DuplicateSlugError): ArticleErrors {
  return { slug: error.message };
}

// A field the form did not post is empty, which validation then reports in the
// same way as a field the owner cleared.
function postedValue(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}
