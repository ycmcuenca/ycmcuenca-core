# Proposal

## Why

Sprint 2 builds the publish path as a walking skeleton (ROADMAP, Sprint 2). Every later piece of it needs one shared answer to "what is an entry": the database stores it, the publish projector renders it, `welcome` reads its snapshot and `admin` builds its form from it. Decisions C1, C2, C8 and C9 put that answer in a pure TypeScript package, `@ycmcuenca/cms-core`, with no knowledge of Neon, KV or Svelte. This change creates that package first, because the other five Sprint 2 changes depend on it and it depends on nothing.

## What Changes

- **New package `@ycmcuenca/cms-core`** (C1): pure TypeScript, unit-tested, with no Cloudflare, database or UI dependency. Its only runtime dependencies are a schema validator and a Markdown parser.
- **Field, block and type layers (C2).** A field is a validated value with form metadata (label, help text, editor kind, limits). A block is an ordered piece of body content; Sprint 2 has one block type, `markdown`. A type combines fields and the blocks its body allows.
- **The `article` type**, the only type in Sprint 2: `title`, `slug` and `summary` fields, and a body of one or more `markdown` blocks.
- **Validation with field-level errors.** Validation turns raw input into article content or into one error message per invalid field, so `admin` can show them next to the fields.
- **A 32 KB limit on an article's Markdown.** It is measured across all blocks of the body. Rendering 30 KB takes about 2.5 ms (measured, design D5), which keeps a publish within `admin`'s 10 ms CPU budget (P3).
- **Safe Markdown rendering (C9).** Raw HTML in Markdown is shown as text, never as markup. Links and images with dangerous schemes (`javascript:`, `vbscript:`, `file:`, non-image `data:`) are not turned into links. The output is the HTML a snapshot stores.
- **Versioned stored content.** Every stored article content carries `schema_v: 1`. Reading content with any other version fails with a clear error. Sprint 4 adds the first upcaster, when localization moves fields to per-locale values (owner decision: English-only now, upcast in S4).
- **The snapshot contract (C8).** Zod schemas for the entry snapshot and the per-type index snapshot, each carrying `snapshot_v: 1`. A tolerant reader accepts the current version, ignores unknown fields and rejects unknown versions.
- **Form descriptions.** For each type, an ordered list of field descriptions that `admin` renders generically (owner decision: definitions drive forms). Adding a type in a later sprint needs no new form code.

Out of scope:

- Any storage, KV, cache or Svelte code. The ports that adapters implement arrive in `revisions-publishing`, the first change that uses them.
- Localization (L2 to L5) and the upcaster chain (S4).
- Other content types, including projects (S6), and other block types, such as images (S3).
- Slug changes after publish and redirects.
- Versioning or publishing internal packages (parking lot; the owner deferred it until a consumer outside this repository exists).

## Capabilities

### New Capabilities

- `content-model`: the content types the CMS knows, how article input is validated, the limits on it, how Markdown becomes safe HTML, how stored content and published snapshots are versioned, and how a type describes its own form.

### Modified Capabilities

None.

## Impact

- **New files**: `packages/cms-core/` (manifest, `tsconfig.json`, `eslint.config.js`, source and tests).
- **Changed files**: `bun.lock`, `renovate.json5` (a `cms-runtime` group for the package's runtime dependencies).
- **Dependencies**: `zod` 4.6.7 and `markdown-it` 15.0.3, pinned exactly. markdown-it 15 ships its own type declarations.
- **Releases**: none. Only apps are versioned (P14), and no app imports the package until `revisions-publishing`.
- **Decisions**: builds on C1, C2, C8 and C9 and contradicts none. At archive, DECISIONS.md records that the article body is a block list, that S2 content is English-only with the first upcaster in S4, and the 32 KB Markdown limit.
- **Sprint 2 order** (owner decision): `content-model`, `content-store`, `revisions-publishing`, `public-rendering`, `admin-editor`, `edge-cache`.
