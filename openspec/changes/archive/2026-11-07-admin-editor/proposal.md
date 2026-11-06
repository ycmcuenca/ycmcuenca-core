# Proposal

## Why

After `public-rendering`, an article can travel from Neon to `welcome`, but the owner cannot write one: `admin` has no form, only a plain entry page with publish buttons. Sprint 2's goal starts with "the owner writes and publishes an English entry in `admin`". This change adds the writing part: the entry list, a form generated from the content model (C2), a Markdown editor with a server-rendered preview, and the first shared UI package with Tailwind and shadcn-svelte (Q2).

## What Changes

- **New package `@ycmcuenca/ui`** (C1, Q2): Tailwind CSS v4 and a small set of shadcn-svelte components (button, input, textarea, label, badge, alert, card), plus the shared stylesheet. Only components that render no inline `style` attribute are included, so the strict CSP stays unchanged (I10). The brand sprint (S5) adds tokens and typography on top.
- **Entry list on `admin`'s home page.** It keeps the `Admin` heading and the entry count, and lists each article's title, slug, status (live, not published, or published but not live) and last save time, with a "New article" link. The list reads from a new `listEntrySummaries` in `@ycmcuenca/db`, because `listEntries` returns no title, save time or publish state (amendment 1).
- **Two small additions to `@ycmcuenca/cms-core`** (amendment 1), so `admin` copies no publishing logic:
  - `renderBody(body)` renders a body's blocks to the snapshot's block shape. The projector and the preview both call it, so the preview is "the same renderer the publish uses" by construction.
  - `publishingStatus(entry)` decides "live", "not published" or "published, not live" from the published pointer and the projection state. The entry list and the entry page both call it.
- **Forms generated from the type definition** (owner decision: definitions drive forms). A form component renders `formDescription(article)`: single-line fields as inputs, multi-line fields as textareas, and the body as a monospace Markdown textarea (owner decision: a textarea, no rich editor). New types in later sprints need no new form code.
- **Create and edit.**
  - "New article" creates the entry and its first revision, then opens the entry page.
  - Saving on the entry page appends a revision (C3). Saving unchanged content is refused with "No changes to save.", so the history holds no empty revisions.
  - The slug can be edited until the first publish, and is shown read-only afterwards. Changing only the slug of a never-published entry updates the slug and adds no revision.
  - A save that loses a race with another save is refused with "Reload and try again." instead of failing with a server error.
- **Field errors next to the fields.** Validation errors from cms-core appear under each field, the entered values are kept, and the fields are marked invalid for assistive technology.
- **Server-rendered preview** (owner decision). A "Preview" button renders the current form content with the same renderer the publish uses and the same `cms-render` blocks as `welcome`, without saving.
- **The entry page is styled.** The publishing panel from `revisions-publishing` (status, revisions, publish, roll back, unpublish, retry) moves onto the shared components.
- **The first production publish.** The owner writes and publishes a real article, and measures the CPU time of publishing a 32 KB article (C9; content-model D5).

Out of scope:

- More than one body block in the form. The model allows several, but S2's form edits one Markdown block.
- A rich or syntax-highlighting editor (it would need a CSP spike), autosave, and draft preview of the full page (W2, S4).
- Deleting entries, changing a published slug, other content types, and media (S3).
- Brand tokens, typography and dark mode (S5), and automated accessibility checks (Q3, S5).

## Capabilities

### New Capabilities

- `content-editing`: how the owner lists, creates and edits entries in `admin`, how the form follows the type definition, how validation errors and the preview are shown, and when the slug can change.

### Modified Capabilities

None. The publishing behavior on the entry page is unchanged; only its presentation moves to the shared components.

## Impact

- **New files**:
  - `packages/ui/`: manifest, configs, `styles.css`, components and `components.json` if the shadcn-svelte CLI is used;
  - `apps/admin/src/lib/components/EntryForm.svelte`, `apps/admin/src/lib/server/entry-form.ts`;
  - `apps/admin/src/routes/entries/new/+page.server.ts` and `+page.svelte`;
  - `apps/admin/src/app.css` (the table-alignment classes the preview needs, copied from `apps/welcome/src/app.css`);
  - `packages/cms-core/src/render-body.ts` and `status.ts` with their tests;
  - `apps/admin/e2e/editing.spec.ts`.
- **Changed files**: `apps/admin/vite.config.ts` (the Tailwind plugin), `apps/admin/package.json` (adds `@ycmcuenca/ui` and `@ycmcuenca/cms-render`), `apps/admin/src/routes/+layout.svelte`, `+page.server.ts`, `+page.svelte`, `entries/[id]/+page.server.ts` and `+page.svelte`, `apps/admin/e2e/smoke.spec.ts`, `packages/cms-core/src/projector.ts` and `index.ts` (use and export the two additions), `packages/db/src/entries.ts` and `index.ts` (`listEntrySummaries`) with its integration test, `renovate.json5`, `README.md`, `bun.lock`.
- **Dependencies**: `tailwindcss` and `@tailwindcss/vite` (4.3.4 on 2026-11-06), `tw-animate-css` 1.4.0, `bits-ui` (2.20.6), `tailwind-variants` (3.3.1; 4.0.1 is out, adopt it only if the components need it), `tailwind-merge` 3.7.0 and `clsx` 2.1.1, pinned exactly at task 1.1 (each only if the chosen components need it).
- **Releases**: `feat(admin)` releases `admin`. The `cms-core` and `db` additions reach production only through `admin`, so the commits that touch them are scoped `feat(admin)` and touch an `admin` file too (AGENTS.md, shipping shared-package changes).
- **Next change**: `edge-cache` edits the same `dependenciesFor` in `entries/[id]/+page.server.ts` to add the purge. Saving and slug changes never project, so they need no purge.
- **Decisions**: builds on C1, C2, C3, C9, I2 and Q2, and contradicts none. At archive, DECISIONS.md records the CSP rule for UI components (no inline `style` attributes) and the measured CPU time of a 32 KB publish.
