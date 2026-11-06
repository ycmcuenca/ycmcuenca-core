# @ycmcuenca/ui

The shared Svelte components for `admin`'s pages (design D1 in
[`openspec/changes/admin-editor/design.md`](../../openspec/changes/admin-editor/design.md)).
They are shadcn-svelte components: plain markup plus Tailwind classes, copied
into this package, so the app owns the code it renders.

This package is source-only and has no build step. The consuming app's Vite
build compiles `src/`, and `src/index.ts` is the public surface. `src/styles.css`
holds Tailwind, `tw-animate-css` and one neutral light theme; `apps/admin`
imports it from its own `src/app.css`.

## The CSP rule

`admin` serves a strict Content Security Policy that allows no inline `style`
attribute. A component that renders one on the server is not used here.
Popover, select, dialog and tooltip position themselves with inline styles, so
this package leaves them out.

Every admin page must load with no `securitypolicyviolation`. The e2e suites fail
on one, and the button assertion also checks that its background is not
transparent, which proves Tailwind found the package's classes.

## Adding a component

1. Copy the component from shadcn-svelte into `src/components/ui/<name>/`. The
   `1.8.0` CLI refuses a package with no SvelteKit app, so run `init` and
   `add <name>` in a scratch `bunx sv create` app, then copy the files.
2. Rewrite every `$lib` import to a relative path. `cn` and the prop helpers live
   in `src/utils.ts`.
3. Export the component, its parts and its variants from `src/index.ts`.
4. Pin each dependency it imports to an exact version in `package.json`, and add
   any new dependency to the design's facts table.
5. Run `bunx turbo run check lint --filter=@ycmcuenca/ui`.
6. Render it in an admin e2e run and confirm the suites report no CSP violation.
