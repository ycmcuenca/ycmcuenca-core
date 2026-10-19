# Tasks

## 1. Package scaffold

- [x] 1.1 Create `packages/cms-core/` per design D1: `package.json` (name `@ycmcuenca/cms-core`, private, ESM, export `".": "./src/index.ts"`, scripts `check`/`test`/`lint` copied from `packages/edge/package.json`, exact dependencies `zod@4.6.7` and `markdown-it@15.0.3`, devDependencies matching `packages/edge`), `tsconfig.json` (copy of `packages/edge/tsconfig.json` with `lib: ["esnext"]`; if `tsc` reports `TextEncoder` missing, add `src/ambient.d.ts` declaring it and note why), and an empty `src/index.ts`. Verify `bun install` updates `bun.lock`, `bun install --frozen-lockfile` then passes, and `bunx turbo run check lint test --filter=@ycmcuenca/cms-core` runs all three tasks for the package
- [x] 1.2 Add `packages/cms-core/eslint.config.js` extending `@ycmcuenca/eslint-config/base` with a `no-restricted-imports` rule for `cloudflare:*`, `pg`, `drizzle-orm`, `svelte` and `@sveltejs/*` (design D1). Verify `bun run lint` passes, and fails when a temporary `import "pg";` is added to `src/index.ts` (then remove it)
- [x] 1.3 Add a `cms-runtime` package rule to `renovate.json5` next to `edge-runtime` (`matchPackageNames: ["zod", "markdown-it"]`, `semanticCommitType: "fix"`, with a comment citing this design). Verify `bunx --package renovate@44.166.0 renovate-config-validator renovate.json5` reports the config valid

## 2. Fields, blocks and the article type

- [x] 2.1 Implement `src/fields.ts` (`textField`, `slugField`, `multilineField`) and `src/blocks.ts` (`markdownBlock`, `bodySchema` as a non-empty discriminated union array) per design D2, with Vitest tests in `src/fields.test.ts` and `src/blocks.test.ts`. Verify the tests cover every scenario of the spec's "Field limits" requirement (121-character title, title with `\n`, the four bad slugs, `hello-world-2`, trimming) and "Article content type" (empty body, `image` block)
- [x] 2.2 Implement `src/types/article.ts` with the 32,768-byte body limit counted by `TextEncoder` (design D5), and `validateArticle` returning `{ ok, content }` or `{ ok: false, errors }` keyed by field path with the package's own messages (design D3). Verify `src/types/article.test.ts` covers "Body size limit" (32,768 bytes accepted, 32,769 rejected, using a multi-byte character so bytes and characters differ) and "Errors per field" (empty title and bad slug give two errors)

## 3. Rendering, versioning and the snapshot contract

- [x] 3.1 Implement `src/render-markdown.ts` per design D5 (one module-level `MarkdownIt({ html: false, linkify: false, typographer: false })`). Verify `src/render-markdown.test.ts` covers every scenario of "Markdown renders to safe HTML", including `data:text/html` refused and `data:image/png` kept, plus a golden-output test for a sample with a heading, emphasis, a list, a code block and a link
- [x] 3.2 Implement `storedContent`, `readStoredContent` and `UnsupportedSchemaVersionError` in `src/stored-content.ts` per design D4. Verify `src/stored-content.test.ts` shows version 1 is read, version 7 fails naming 7, and a missing version fails naming "missing"
- [x] 3.3 Implement `entrySnapshot`, `indexSnapshot`, `readEntrySnapshot`, `readIndexSnapshot` and `UnsupportedSnapshotVersionError` in `src/snapshot.ts` per design D7. Verify `src/snapshot.test.ts` covers both round trips, an unknown `reading_time` field stripped, version 2 rejected naming 2, and a missing title rejected naming the title

## 4. Form descriptions and the public API

- [x] 4.1 Implement `formDescription` in `src/form.ts` per design D6. Verify `src/form.test.ts` asserts the exact article description from the spec and, for each described field, that a value at the stated limit validates and one unit more is rejected
- [x] 4.2 Export the public API from `src/index.ts` (design D2's list) with a short header comment citing design D1. Verify `bunx turbo run check lint test --filter=@ycmcuenca/cms-core` passes and `bun run format` reports no file in `packages/cms-core`

## 5. Integration check

- [x] 5.1 Run the local CI equivalent from `AGENTS.md` (install, format, lint, check, build, test, test:e2e, `bunx openspec validate --all --strict --no-interactive`, `scripts/docs/check-living-docs.sh`). Verify all pass and `bunx openspec validate content-model --strict` passes

## Workflow follow-up

- Archive per `openspec/config.yaml`: set the ROADMAP row to `archived`; in ARCHITECTURE.md turn the `packages/cms-core` workspace row from planned to exists; record in DECISIONS.md the block-list body, English-only S2 content with the first upcaster in S4, and the 32 KB Markdown limit; complete the planned notebook entries this change applies only where it built them (it applies hexagonal architecture and versioned contracts in part, so they stay planned until `revisions-publishing` and `public-rendering`).
