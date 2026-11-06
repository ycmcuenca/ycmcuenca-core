# Design

## Context

See proposal.md for the motivation and `specs/content-editing/spec.md` for the behavior.

Current state, verified against the code on 2026-11-06 after `content-store`, `revisions-publishing` and `public-rendering` were archived (amendment 1):

- `@ycmcuenca/cms-core` exports `validateArticle` (errors keyed by field path; `packages/cms-core/src/types/article.ts:94`), `formDescription` (`form.ts:21`), `renderMarkdown` (`render-markdown.ts:53`) and the publishing use cases, including `changeSlug` (`publishing.ts:112`, returns `{ ok: false, reason }` as text, not a field error). It has **no** helper that renders a whole body: the projector maps blocks inline (`projector.ts:27`). Table alignment is rendered as classes `align-left|center|right`, not inline style.
- `@ycmcuenca/db` exports `createEntry`, `appendRevision`, `listEntries`, `countEntries`, `listRevisions`, `getRevision(database, entryId, number)`, `updateSlug` and `entryStoreFor`. `createEntry` and `updateSlug` **throw** `DuplicateSlugError` for a taken slug, and `appendRevision` throws `ConcurrentRevisionError` for a raced save (`packages/db/src/entries.ts:49-153`). `listEntries` (`:220`) returns only `{ id, type, slug, createdAt }`: no title, last save or publish state.
- `@ycmcuenca/cms-render` exports `BlockList`, `MarkdownBlock` and `blockComponents`, and is declared `sideEffects: false` so a client bundle does not pull in Zod (its `index.ts` comment). `admin` does **not** depend on it yet.
- `admin`:
  - `src/routes/+page.svelte` shows `Admin` and "N entries" (`+page.server.ts` calls `countEntries`);
  - `src/routes/+layout.svelte` renders only the favicon and `children`; there is no stylesheet;
  - `src/routes/entries/[id]/` has `load` (entry, revisions with titles, status text such as "Live: revision N", dirty flag) plus the actions `publish`, `rollBack`, `unpublish` and `retry`, with plain markup; `statusOf` lives in that file (`+page.server.ts:157`);
  - `vite.config.ts` sets the hash-mode CSP from `@ycmcuenca/edge`'s `cspDirectives` (`style-src 'self'`, and `style-src-attr` allowing one hash);
  - its e2e suites are `smoke`, `publishing` and `publish-path`, each failing on any CSP violation; the helpers are `e2e/database.ts` (`withTestDatabase`, `truncateEntries`) and `e2e/access-token.ts`; Playwright runs one worker (the database is a singleton);
  - `welcome` styles `.align-left|center|right` in `apps/welcome/src/app.css:1-13`; `admin` has no equivalent.

### Versions and facts verified (2026-10-19, versions re-checked 2026-11-06)

| Item                  | Version or fact                                                                                                                                                                                                                                                                                                                                                                                                                                             | Source                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Tailwind CSS          | `tailwindcss` and `@tailwindcss/vite` 4.3.3 on 2026-10-19, **4.3.4 on 2026-11-06**; v4 is set up with the Vite plugin; files in `node_modules` and `.gitignore`d paths are not scanned unless registered with `@source` (relative to the stylesheet)                                                                                                                                                                                                        | npm registry; Context7 `/tailwindlabs/tailwindcss.com` (detecting classes in source files)  |
| shadcn-svelte         | CLI `shadcn-svelte` 1.7.0 on 2026-10-19, **1.8.0 on 2026-11-06** (`init`, `add`); components are copied into the project and themed with CSS variables in a global stylesheet that imports `tailwindcss` and `tw-animate-css`; `init` refuses a package with no SvelteKit app, so task 1.1 generated them in a scratch app (`--preset nova --base-color neutral`) and copied them                                                                           | npm registry; Context7 `/websites/shadcn-svelte` (installation, CLI, Tailwind v4 migration) |
| Component support     | Pinned in `packages/ui/package.json` on 2026-11-06: `bits-ui` 2.20.6, `tailwind-variants` **4.0.1**, `tailwind-merge` 3.7.0, `clsx` 2.1.1, `tw-animate-css` 1.4.0. The 1.8.0 CLI wrote `tailwind-variants` as `^3.3.0`; 4.0.1 keeps the same `tv`/`VariantProps` API and `svelte-check` passes with it, so 4.0.1 is pinned. The CLI's `cn` and `shadcn-svelte` packages are not used: `src/utils.ts` holds the `clsx` + `tailwind-merge` helper (design D1) | npm registry (`npm view`, 2026-11-06); task 1.1 check                                       |
| CSP and inline styles | a `style` attribute in server-rendered HTML is governed by `style-src-attr`, which allows only the announcer's hash here; styles set from script through the CSSOM are not blocked by CSP (CSP3); external stylesheets need only `style-src 'self'`                                                                                                                                                                                                         | edge-infrastructure design D8; CSP3                                                         |

## Goals / Non-Goals

**Goals:**

- The form is data-driven end to end: adding a field to the article type in cms-core shows it in `admin` with no Svelte change.
- Forms work without JavaScript (SvelteKit form actions), and `use:enhance` only improves them.
- No CSP change: Tailwind arrives as an external stylesheet.

**Non-Goals:**

- Live preview while typing (the owner chose a server-rendered preview).
- A component library beyond what these pages use.

## Decisions

### D1. `@ycmcuenca/ui`: a source-only Svelte package with Tailwind v4

- `packages/ui/package.json`:
  - exports `".": { "types": "./src/index.ts", "svelte": "./src/index.ts" }` and `"./styles.css": "./src/styles.css"`;
  - `svelte` 5.57.2 as a peer dependency;
  - dependencies limited to what the copied components import (`bits-ui`, `tailwind-variants`, `tailwind-merge`, `clsx`), pinned exactly;
  - `tailwindcss` 4.3.4 and `tw-animate-css` 1.4.0 as dependencies of the stylesheet.
- `src/styles.css`: `@import "tailwindcss"; @import "tw-animate-css";`, then `@source "./";` (so the package's own components are scanned), then shadcn-svelte's CSS variables for one neutral light theme, with no dark mode until S5.
- `apps/admin/src/app.css` imports `@ycmcuenca/ui/styles.css` and holds the three `.align-*` rules (D7). The layout imports `app.css`, not the package stylesheet directly.
- Components (`src/components/ui/<name>/`): button, input, textarea, label, badge, alert, card. They are added with the shadcn-svelte CLI if it runs in a non-app package (task 1.1). Otherwise they are added in a scratch SvelteKit app and copied, with `$lib` imports rewritten to relative ones. `src/utils.ts` holds `cn()`.
- `apps/admin/vite.config.ts` adds `tailwindcss()` from `@tailwindcss/vite` before `sveltekit(...)`. `src/routes/+layout.svelte` imports `../app.css`, which imports `@ycmcuenca/ui/styles.css`, and the admin app's own sources are scanned automatically.
- **The CSP rule:** a component that renders a `style` attribute on the server is not used. Popover, select, dialog and tooltip position themselves with inline styles and are left out. The e2e violation check enforces the rule on every page.
- **Pattern:** design tokens, part one ([design tokens and theming](../../../docs/SYSTEM_DESIGN.md#design-tokens-and-theming), Q2): neutral variables now, brand values in S5.
- **Alternatives:** _Tailwind inside `apps/admin` only_ (Q2 names `@ycmcuenca/ui`, and S5's brand work would have to move it); _a different kit, such as Skeleton or Flowbite_ (Q2 decided shadcn-svelte); _plain CSS_ (simplest, but Q2 decided).
- **Failure modes:**
  - _A chosen component renders an inline `style`:_ the e2e CSP check fails, and the component is replaced with plain markup plus classes.
  - _Tailwind misses classes from the package:_ `@source "./"` in the package's stylesheet registers it, and an e2e assertion on a component's computed style (button background is not transparent) catches a miss.

### D2. The generated form

- `apps/admin/src/lib/components/EntryForm.svelte` takes `{ description, values, errors, slugLocked }`. It loops over `description` and renders `Label`, then the control for the editor kind, then the help text and the error:
  - `text`: `Input` with `maxlength`;
  - `textarea`: `Textarea` with `maxlength`;
  - `markdown`: a monospace `Textarea` with `rows=24`, and no `maxlength`, because the limit is in bytes.
- Every control gets `id`, `name`, `required`, and, when there is an error, `aria-invalid="true"` and `aria-describedby="<id>-error"`.
- The body is posted as one field, `body`. `src/lib/server/entry-form.ts` turns `FormData` into cms-core input (`{ title, slug, summary, body: [{ type: "markdown", source }] }`) and maps an existing entry back to form values. That is the only place that knows S2 edits one block.
- `entry-form.ts` also maps a store refusal to a field error: a `DuplicateSlugError` (thrown by `createEntry` and `updateSlug`) becomes `{ slug: <the error's message> }`, so create and save show the same text. The text is the store's ("An article already uses the slug ..."), not a second message to keep in step.
- When `slugLocked` is set, the slug renders as a read-only `Input` with the note "Published slugs cannot change.", and the server ignores any posted `slug` (spec).
- **Pattern:** a schema-driven form from one source of truth (content-model D6).
- **Alternatives:** _a hand-written `ArticleForm.svelte`_ (the owner rejected it); _a form library such as Superforms_ (another dependency for what one component does, and I2 says form actions with Zod).

### D3. Routes and actions

| Route           | `load`                                                                                       | Actions                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `/`             | the count, plus `listEntrySummaries` (D5) with each entry's `publishingStatus` (D6)          | none                                                                                               |
| `/entries/new`  | the article description                                                                      | `create`: validate, `createEntry`, `redirect(303, /entries/<id>)`; `preview`                       |
| `/entries/[id]` | the entry, its revisions, the status, the form values from the latest revision, `slugLocked` | `save`; `preview`; plus `publish`, `rollBack`, `unpublish` and `retry` from `revisions-publishing` |

- **`save`** (amendment 1; the first draft refused "no changes" before looking at the slug, which would lose a slug-only edit):
  1. Validate the input. Errors come back at their fields with the entered values.
  2. Read the latest revision and compare its title, summary and body with the submitted ones (deep equality). The submitted slug counts as changed only when the entry is unlocked and it differs from the entry's slug.
  3. Neither changed: return `fail(400, { message: "No changes to save." })`.
  4. Slug changed: call `changeSlug`. A refusal is shown at the slug field (the use case's reason, which is the store's message for a taken slug).
  5. Content changed: `appendRevision`. A `ConcurrentRevisionError` returns `fail(409, { message: "Another save came first. Reload and try again." })`.
  - A slug-only change therefore updates the slug and adds no revision. If step 4 succeeds and step 5 then fails, the slug stays changed (a never-published entry has no snapshot, so nothing public depends on it) and the owner sees the 409 message.
- **`preview`:** validate, then `renderBody` (D5) on the body, and return `{ values, preview: blocks }` without writing anything. The page renders `preview` with `cms-render`'s `BlockList`, so the preview and `welcome` share markup.
- A taken slug is mapped to the slug field's error by `entry-form.ts` (D2) on both `create` and `save`.
- Forms use `use:enhance` from `$app/forms`, and work without it.
- **Pattern:** [read-your-writes for previews](../../../docs/SYSTEM_DESIGN.md#read-your-writes-for-previews), in its simplest form: the preview renders the request's own data.
- **Failure modes:** _preview CPU:_ the 32 KB limit bounds rendering to about 3 ms (content-model D5). _A double submit creates two revisions:_ the second hits "No changes to save.". _Two tabs save at once:_ the unique `(entry, number)` constraint turns the loser into a `ConcurrentRevisionError`, shown as the 409 message instead of a 500.

### D4. Measuring C9 in production

The owner publishes an article whose body is close to 32 KB and reads that request's `cpuTimeMs` in Workers Logs. If it is consistently over 10 ms, a follow-up lowers the limit in cms-core (content-model D5's failure mode). The value is recorded in this design's facts table and, at archive, in DECISIONS.md.

### D5. Entry summaries and body rendering as shared code (amendment 1)

- **`listEntrySummaries(database)`** in `@ycmcuenca/db` returns, newest save first, one record per entry: `{ id, slug, title, lastSavedAt, publishedRevisionId, projectionState }`, from one query that joins each entry to its latest revision (highest `number`). `title` comes through `readStoredContent`, like `listPublished` does, so an unreadable content version fails loudly. `countEntries` stays for the "N entries" line.
- **`renderBody(body)`** in `@ycmcuenca/cms-core` (`render-body.ts`) maps a body's blocks to the snapshot's `{ type: "markdown", html }` shape. `buildEntrySnapshot` calls it, and so does the preview. Behavior of the projector is unchanged; its tests pin that.
- **Alternatives:** _`listEntries` then `listRevisions` per entry in `admin`_ (N+1 queries over Hyperdrive, and `admin` would own a query); _the preview copying the projector's mapping_ (the two would drift, and the spec says the preview uses the same rendering as a publish).
- **Failure modes:** _a body with a block type the renderer lacks:_ `renderBody` is typed over the block union, so adding a block type is a compile error until it renders (same rule as `cms-render`'s registry).

### D6. One publishing status (amendment 1)

- **`publishingStatus(entry)`** in `@ycmcuenca/cms-core` (`status.ts`) takes `{ publishedRevisionId, projectionState }` and returns `"live"`, `"not-published"` or `"published-not-live"`. A dirty entry with no pointer is a failed unpublish and stays `"not-published"` (the rule `statusOf` already encodes at `entries/[id]/+page.server.ts:157`).
- The list shows the three labels from the spec. The entry page keeps its existing text ("Live: revision N", "Not published", "Published, not live"), built from the same function plus the published revision's number, so `publishing.spec.ts` keeps passing.
- **Alternative:** _an admin-local helper_ (the rule would be written twice as soon as another app lists entries).

### D7. Styles for the preview (amendment 1)

`renderMarkdown` renders a table cell's alignment as a class (`align-left|center|right`) because the CSP forbids inline style. `welcome` styles those classes in `apps/welcome/src/app.css:1-13`; without them a previewed table would look different from the public page. `apps/admin/src/app.css` repeats the three rules, with a comment pointing at welcome's file. Moving them into a shared stylesheet is deferred to S5, when brand tokens give the apps one.

- **Alternative:** _a stylesheet in `cms-render`_ (shared, but it changes `welcome` in this change and `cms-render` is declared side-effect free).

## Risks / Trade-offs

- **The shadcn-svelte CLI may not support a non-app package** → copy from a scratch app (D1); the components are copied either way.
- **Unknown inline styles in components** → only components without positioning; the e2e CSP check (D1).
- **`admin` now bundles `cms-render` for the preview** → it is `sideEffects: false` for this reason; the e2e CSP check on the entry page with a preview fails if Zod reaches the client (assumption A2).
- **Version drift since the first draft** (Tailwind 4.3.4, `tailwind-variants` 4.0.1) → task 1.1 re-pins and records the result in the facts table.
- **A plain textarea is a modest editor** → the owner's choice; the field's editor kind lets a richer editor replace it later without touching the model.

## Migration Plan

1. Merge. The `admin` release adds no migration.
2. The owner writes and publishes the first real article (task 5.2), which also closes `public-rendering`'s production check of a publish.
3. Rollback: redeploy the previous `admin` tag. The data is unchanged.

## Assumptions

- **A1.** shadcn-svelte's button, input, textarea, label, badge, alert and card render no `style` attribute on the server. Verified on 2026-11-06 by task 1.3: all seven rendered on a temporary route with no `securitypolicyviolation`, and the button's computed background was not transparent (the package's classes were found). The e2e suites keep the check on every page.
- **A2.** Importing `BlockList` from `@ycmcuenca/cms-render` in an `admin` page adds no Content Security Policy violation. `cms-render`'s `index.ts` documents that its reader would, if bundled for the client; the package is `sideEffects: false` to prevent it. Unverified until the preview e2e test runs (task 4.1).
