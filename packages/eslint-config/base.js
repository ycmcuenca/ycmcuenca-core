// @ycmcuenca/eslint-config/base — the shared flat config every workspace
// member lints with. See design D3 and D5 in
// openspec/changes/bootstrap-monorepo/design.md.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default defineConfig(
  // Generated output, caches and test reports are never linted.
  globalIgnores([
    "**/node_modules/**",
    "**/.svelte-kit/**",
    "**/build/**",
    "**/dist/**",
    "**/.wrangler/**",
    "**/.turbo/**",
    "**/coverage/**",
    "**/playwright-report/**",
    "**/test-results/**",
    // Written by `wrangler types`; regenerated, not hand-edited.
    "**/worker-configuration.d.ts",
  ]),
  // ESLint's own recommended rules for plain JavaScript.
  js.configs.recommended,
  // TypeScript rules. The non-type-checked variants on purpose: rules that
  // need full type information would slow lint down and mostly repeat what
  // `bun run check` (svelte-check / tsc) already verifies.
  ...tseslint.configs.recommended,
  // Must stay last: it switches off ESLint rules that would fight Prettier,
  // which owns formatting in this workspace.
  prettier,
);
