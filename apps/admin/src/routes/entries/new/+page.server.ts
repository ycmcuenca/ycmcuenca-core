// The create page (design D3): one action stores the article and opens its
// entry page, the other renders the unsaved body without writing anything.
import { article, formDescription, renderBody } from "@ycmcuenca/cms-core";
import { createEntry, DuplicateSlugError } from "@ycmcuenca/db";
import { fail, redirect } from "@sveltejs/kit";
import { withDatabase } from "#lib/server/database.js";
import { readArticleForm, takenSlugErrors } from "#lib/server/entry-form.js";
import type { EntryFormValues } from "#lib/server/entry-form.js";
import type { Actions, PageServerLoad } from "./$types";

/** The form the create page starts with: every field empty (design D2). */
const emptyValues: EntryFormValues = {
  title: "",
  slug: "",
  summary: "",
  body: "",
};

// A new entry has no stored slug to protect, so the posted one is used as is.
const newEntrySlug = { slug: "", slugLocked: false };

export const load: PageServerLoad = () => ({
  description: formDescription(article),
  values: emptyValues,
});

export const actions = {
  create: async ({ request }) => {
    const form = await request.formData();
    const read = readArticleForm(form, newEntrySlug);
    if (!read.ok) {
      return fail(400, { errors: read.errors, values: read.values });
    }
    try {
      const created = await withDatabase((database) =>
        createEntry(database, read.input),
      );
      if (!created.ok) {
        return fail(400, { errors: created.errors, values: read.values });
      }
      redirect(303, `/entries/${created.entry.id}`);
    } catch (error) {
      if (error instanceof DuplicateSlugError) {
        return fail(400, {
          errors: takenSlugErrors(error),
          values: read.values,
        });
      }
      throw error;
    }
  },
  preview: async ({ request }) => {
    const form = await request.formData();
    const read = readArticleForm(form, newEntrySlug);
    if (!read.ok) {
      return fail(400, { errors: read.errors, values: read.values });
    }
    return { values: read.values, preview: renderBody(read.content.body) };
  },
} satisfies Actions;
